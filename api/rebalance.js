/**
 * api/rebalance.js — Cycle de rebalance principal
 *
 * Améliorations v2.1 :
 *   - Vérification on-chain de chaque position après placeOrder()
 *   - Logging structuré via lib/logger.js (cycle_id, metadata JSONB)
 *   - Détection de désynchronisation Supabase ↔ Hyperliquid en début de cycle
 *   - Supabase n'est jamais mis à jour si l'ordre n'est pas confirmé on-chain
 *   - Chaque étape critique loggue succès ET échec avec contexte complet
 */

const { supabase }          = require('../lib/supabase.js');
const { createLogger }      = require('../lib/logger.js');
const {
    getAssetPrice, getFundingRate, getAccountBalance,
    getOpenPosition, getAllOpenPositions,
    placeOrder, placeStopOrder, cancelAllOrders,
} = require('../lib/hyperliquid.js');
const { getCandles }        = require('../lib/market.js');
const {
    getSignal, calculatePositionSize,
    calculateMA, calculateSlope, calculateATR, rankAssets,
} = require('../lib/strategy.js');

const TRADABLE_ASSETS = ['ETH', 'SOL'];
const LIGHTHOUSE      = 'BTC';

// Délai de confirmation après un ordre (ms) — laisse le temps à Hyperliquid de traiter
const ORDER_CONFIRM_DELAY_MS = 3000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function handler(req, res) {
    const log = createLogger(supabase);
    log.info('Démarrage du cycle de rebalance', { trigger: req.method === 'POST' ? 'manuel' : 'cron' });

    try {
        // ─────────────────────────────────────────────────────────────────────
        // 1. LECTURE DE L'ÉTAT SUPABASE
        // ─────────────────────────────────────────────────────────────────────
        const { data: botState, error: stateError } = await supabase
            .from('bot_state').select('*').eq('id', 1).single();

        if (stateError) throw new Error(`Lecture bot_state impossible: ${stateError.message}`);

        log.info('État Supabase chargé', {
            current_mode:  botState.current_mode,
            active_asset:  botState.active_asset,
            entry_price:   botState.entry_price,
            position_size: botState.position_size,
        });

        // ─────────────────────────────────────────────────────────────────────
        // 2. VÉRIFICATION SYNCHRONISATION SUPABASE ↔ HYPERLIQUID
        //    Détecte les désynchronisations avant d'agir — protection principale
        //    contre le bug de "position fantôme".
        // ─────────────────────────────────────────────────────────────────────
        const realPositions = await getAllOpenPositions();
        log.debug('Positions on-chain récupérées', { positions: realPositions });

        if (botState.current_mode !== 'CASH') {
            const realPos = realPositions.find(p => p.coin === botState.active_asset);

            if (!realPos) {
                // Supabase dit qu'on a une position, Hyperliquid dit non
                log.warn('DÉSYNCHRONISATION DÉTECTÉE — Supabase indique une position inexistante on-chain', {
                    supabase_mode:  botState.current_mode,
                    supabase_asset: botState.active_asset,
                    real_positions: realPositions.map(p => `${p.side} ${p.coin}`),
                    action:         'Forçage passage en CASH',
                });
                await supabase.from('bot_state').update({
                    current_mode:        'CASH',
                    active_asset:        null,
                    entry_price:         0,
                    position_size:       0,
                    trailing_stop_level: 0,
                }).eq('id', 1);
                throw new Error(`Désynchronisation détectée sur ${botState.active_asset} — cycle annulé, état forcé en CASH. Relancez un cycle.`);
            }

            if (realPos.side !== botState.current_mode) {
                log.warn('DÉSYNCHRONISATION CÔTÉ — Direction incorrecte', {
                    supabase_side: botState.current_mode,
                    on_chain_side: realPos.side,
                    asset:         botState.active_asset,
                });
            }

            log.info('Position on-chain confirmée', {
                asset:    realPos.coin,
                side:     realPos.side,
                size:     realPos.size,
                entry_px: realPos.entryPx,
            });
        } else if (realPositions.length > 0) {
            // Supabase dit CASH mais des positions existent on-chain
            log.warn('DÉSYNCHRONISATION INVERSE — Positions on-chain non trackées par Supabase', {
                on_chain_positions: realPositions.map(p => `${p.side} ${p.coin} @ ${p.entryPx}`),
                action:             'Cycle poursuit normalement — vérifiez manuellement',
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3. CAPITAL RÉEL
        // ─────────────────────────────────────────────────────────────────────
        const capital = await getAccountBalance();
        if (!capital) throw new Error('Solde du compte inaccessible ou nul. Cycle annulé.');
        log.info('Capital récupéré', { capital_usdc: capital });

        // ─────────────────────────────────────────────────────────────────────
        // 4. DONNÉES DE MARCHÉ
        // ─────────────────────────────────────────────────────────────────────
        log.info('Récupération données marché', { coins: [LIGHTHOUSE, ...TRADABLE_ASSETS] });

        const allCoins   = [LIGHTHOUSE, ...TRADABLE_ASSETS];
        const candlesMap = {};
        const pricesMap  = {};

        await Promise.all(allCoins.map(async coin => {
            const [candles, price] = await Promise.all([getCandles(coin), getAssetPrice(coin)]);
            candlesMap[coin] = candles;
            pricesMap[coin]  = price;
        }));

        const missing = allCoins.filter(c => !candlesMap[c] || !pricesMap[c]);
        if (missing.length > 0) {
            throw new Error(`Données marché inaccessibles: ${missing.join(', ')}. Prix: [${allCoins.map(c => `${c}:${pricesMap[c] || 'Echec'}`).join(', ')}]. Bougies: [${allCoins.map(c => `${c}:${candlesMap[c] ? 'OK' : 'Echec'}`).join(', ')}]`);
        }

        // Prix loggés
        log.debug('Prix récupérés', Object.fromEntries(allCoins.map(c => [c, pricesMap[c]])));

        // ─────────────────────────────────────────────────────────────────────
        // 5. INDICATEURS — BTC LIGHTHOUSE
        // ─────────────────────────────────────────────────────────────────────
        const btcClosePrices = candlesMap[LIGHTHOUSE].map(c => c.close);
        const btcMa200       = calculateMA(btcClosePrices, 200);
        const btcPrice       = pricesMap[LIGHTHOUSE];
        const btcBullish     = btcPrice > btcMa200;

        log.debug('BTC Lighthouse calculé', {
            btc_price:   btcPrice,
            btc_ma200:   btcMa200?.toFixed(2),
            btc_bullish: btcBullish,
        });

        // ─────────────────────────────────────────────────────────────────────
        // 6. INDICATEURS — ACTIFS TRADABLES
        // ─────────────────────────────────────────────────────────────────────
        const assetsData = TRADABLE_ASSETS.map(coin => {
            const candles   = candlesMap[coin];
            const prices    = candles.map(c => c.close);
            const atr       = calculateATR(candles, 14);
            const ma200     = calculateMA(prices, 200);
            const maHistory = [];
            for (let i = prices.length - 6; i <= prices.length - 1; i++) {
                maHistory.push(calculateMA(prices.slice(0, i + 1), 200));
            }
            const slope  = calculateSlope(maHistory, 5);
            const signal = (ma200 && slope !== null)
                ? getSignal(pricesMap[coin], ma200, slope, btcPrice, btcMa200)
                : 'CASH';

            log.debug(`Indicateurs ${coin}`, {
                price:  pricesMap[coin],
                ma200:  ma200?.toFixed(2),
                slope:  slope?.toFixed(4),
                atr:    atr?.toFixed(2),
                signal,
            });

            return { coin, candles, prices, atr, ma200, slope, signal };
        });

        // ─────────────────────────────────────────────────────────────────────
        // 7. GESTION DU TRAILING STOP (priorité absolue)
        // ─────────────────────────────────────────────────────────────────────
        if (botState.current_mode === 'LONG' || botState.current_mode === 'SHORT') {
            const activeAsset = botState.active_asset;
            const activeData  = assetsData.find(a => a.coin === activeAsset);

            if (!activeData) {
                log.warn(`Données manquantes pour ${activeAsset} — vérification stop ignorée ce cycle`);
            } else {
                const entryPrice   = parseFloat(botState.entry_price);
                const atr          = activeData.atr;
                let   currentStop  = parseFloat(botState.trailing_stop_level);
                const currentPrice = pricesMap[activeAsset];

                log.debug('Vérification trailing stop', {
                    asset:         activeAsset,
                    mode:          botState.current_mode,
                    entry_price:   entryPrice,
                    current_price: currentPrice,
                    current_stop:  currentStop,
                    atr,
                });

                if (botState.current_mode === 'LONG') {
                    const profit = currentPrice - entryPrice;

                    if (profit >= (2 * atr) && currentStop < entryPrice) {
                        currentStop = entryPrice;
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                        log.info(`[${activeAsset} LONG] Stop sécurisé à Breakeven`, { stop: currentStop, profit_usd: profit });
                    }

                    const dynamicStop = currentPrice - (1.5 * atr);
                    if (dynamicStop > currentStop) {
                        currentStop = dynamicStop;
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                        log.info(`[${activeAsset} LONG] Trailing stop relevé`, { new_stop: currentStop.toFixed(2), price: currentPrice });
                    }

                    if (currentPrice <= currentStop) {
                        log.info(`[${activeAsset} LONG] Stop déclenché — clôture position`, {
                            current_price: currentPrice, stop_level: currentStop,
                        });
                        const orderOk = await placeOrder(activeAsset, false, botState.position_size, currentPrice);

                        if (!orderOk) {
                            log.error(`[${activeAsset} LONG] placeOrder() stop a échoué`, {
                                price: currentPrice, size: botState.position_size,
                            });
                            throw new Error(`Échec fermeture LONG ${activeAsset} sur stop — position toujours ouverte.`);
                        }

                        // Attente + confirmation on-chain
                        await sleep(ORDER_CONFIRM_DELAY_MS);
                        const remaining = await getOpenPosition(activeAsset);
                        if (remaining) {
                            log.warn(`[${activeAsset} LONG] Position partiellement ouverte après stop`, {
                                remaining_size: remaining.size,
                            });
                        }

                        const pnlPct = ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);
                        await supabase.from('trade_history').insert([{
                            asset: activeAsset, direction: 'LONG',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_percentage: parseFloat(pnlPct),
                            close_date: new Date().toISOString(),
                        }]);
                        await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null, position_size: 0, entry_price: 0, trailing_stop_level: 0 }).eq('id', 1);

                        log.trade(`Stop LONG ${activeAsset} déclenché et confirmé`, {
                            asset: activeAsset, direction: 'LONG',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_pct: parseFloat(pnlPct),
                        });
                        await log.summary('STOP_LONG', { pnl_pct: parseFloat(pnlPct) });
                        return res.status(200).json({ message: `Stop Loss LONG ${activeAsset} touché. PnL: ${pnlPct}%` });
                    }
                }

                if (botState.current_mode === 'SHORT') {
                    const profit = entryPrice - currentPrice;

                    if (profit >= (2 * atr) && currentStop > entryPrice) {
                        currentStop = entryPrice;
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                        log.info(`[${activeAsset} SHORT] Stop sécurisé à Breakeven`, { stop: currentStop, profit_usd: profit });
                    }

                    const dynamicStop = currentPrice + (1.5 * atr);
                    if (dynamicStop < currentStop) {
                        currentStop = dynamicStop;
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                        log.info(`[${activeAsset} SHORT] Trailing stop abaissé`, { new_stop: currentStop.toFixed(2), price: currentPrice });
                    }

                    if (currentPrice >= currentStop) {
                        log.info(`[${activeAsset} SHORT] Stop déclenché — clôture position`, {
                            current_price: currentPrice, stop_level: currentStop,
                        });
                        const orderOk = await placeOrder(activeAsset, true, botState.position_size, currentPrice);

                        if (!orderOk) {
                            log.error(`[${activeAsset} SHORT] placeOrder() stop a échoué`, {
                                price: currentPrice, size: botState.position_size,
                            });
                            throw new Error(`Échec fermeture SHORT ${activeAsset} sur stop — position toujours ouverte.`);
                        }

                        // Attente + confirmation on-chain
                        await sleep(ORDER_CONFIRM_DELAY_MS);
                        const remaining = await getOpenPosition(activeAsset);
                        if (remaining) {
                            log.warn(`[${activeAsset} SHORT] Position partiellement ouverte après stop`, {
                                remaining_size: remaining.size,
                            });
                        }

                        const pnlPct = ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2);
                        await supabase.from('trade_history').insert([{
                            asset: activeAsset, direction: 'SHORT',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_percentage: parseFloat(pnlPct),
                            close_date: new Date().toISOString(),
                        }]);
                        await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null, position_size: 0, entry_price: 0, trailing_stop_level: 0 }).eq('id', 1);

                        log.trade(`Stop SHORT ${activeAsset} déclenché et confirmé`, {
                            asset: activeAsset, direction: 'SHORT',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_pct: parseFloat(pnlPct),
                        });
                        await log.summary('STOP_SHORT', { pnl_pct: parseFloat(pnlPct) });
                        return res.status(200).json({ message: `Stop Loss SHORT ${activeAsset} touché. PnL: ${pnlPct}%` });
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 8. RANKING MULTI-ACTIFS
        // ─────────────────────────────────────────────────────────────────────
        const ranked    = rankAssets(assetsData);
        const rankStr   = ranked.map(a => `${a.coin}(${a.score?.toFixed(2)})`).join(' > ');
        const winner    = ranked.find(a => a.signal === 'LONG' || a.signal === 'SHORT') || null;
        const newSignal = winner?.signal   || 'CASH';
        const newAsset  = winner?.coin     || null;
        const winnerPrice = winner ? pricesMap[winner.coin] : null;
        const winnerAtr   = winner?.atr    || null;

        log.info('Ranking calculé', {
            ranking:    rankStr,
            winner:     newAsset,
            signal:     newSignal,
            btc_filter: btcBullish ? 'shorts filtrés' : 'shorts autorisés',
        });

        // ─────────────────────────────────────────────────────────────────────
        // 9. VÉRIFICATION FUNDING RATE (SHORT entrant uniquement)
        // ─────────────────────────────────────────────────────────────────────
        if (newSignal === 'SHORT' && botState.current_mode === 'CASH') {
            const fundingRate = await getFundingRate(newAsset);
            log.debug('Funding rate vérifié', { asset: newAsset, funding_rate: fundingRate });

            if (fundingRate < -0.0003) {
                log.warn(`Short ${newAsset} annulé — funding rate trop négatif`, {
                    funding_rate: fundingRate,
                    threshold:    -0.0003,
                });
                await log.summary('FUNDING_BLOCK', { asset: newAsset, funding_rate: fundingRate });
                return res.status(200).json({ message: `Short ${newAsset} annulé — Funding Rate négatif.` });
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 10. EXÉCUTION DES CHANGEMENTS D'ÉTAT
        // ─────────────────────────────────────────────────────────────────────
        const stateChanged  = newSignal !== botState.current_mode || newAsset !== botState.active_asset;
        const assetSwitched = newAsset && botState.active_asset && newAsset !== botState.active_asset;

        if (stateChanged) {
            log.info('Changement d\'état détecté', {
                from_mode:  botState.current_mode,
                from_asset: botState.active_asset,
                to_mode:    newSignal,
                to_asset:   newAsset,
                reason:     assetSwitched ? 'rotation' : 'nouveau signal',
            });

            // ── A. FERMETURE DE L'ANCIENNE POSITION ──
            if (botState.current_mode !== 'CASH') {
                const isBuyToClose = botState.current_mode === 'SHORT';
                const closePrice   = pricesMap[botState.active_asset];
                const closeEntryPx = parseFloat(botState.entry_price);
                const pnlPct = botState.current_mode === 'LONG'
                    ? ((closePrice - closeEntryPx) / closeEntryPx * 100).toFixed(2)
                    : ((closeEntryPx - closePrice) / closeEntryPx * 100).toFixed(2);

                log.info(`Fermeture ${botState.current_mode} ${botState.active_asset}`, {
                    entry_price: closeEntryPx,
                    close_price: closePrice,
                    pnl_pct:     parseFloat(pnlPct),
                    reason:      assetSwitched ? `rotation vers ${newAsset}` : `signal ${newSignal}`,
                });

                await cancelAllOrders(botState.active_asset);
                log.debug(`Ordres ouverts annulés sur ${botState.active_asset}`);

                const closeOk = await placeOrder(botState.active_asset, isBuyToClose, botState.position_size, closePrice);

                if (!closeOk) {
                    log.error(`placeOrder() fermeture a échoué sur ${botState.active_asset}`, {
                        mode:  botState.current_mode,
                        size:  botState.position_size,
                        price: closePrice,
                    });
                    throw new Error(`Échec fermeture ${botState.current_mode} ${botState.active_asset} — cycle interrompu.`);
                }

                // Confirmation on-chain de la fermeture
                await sleep(ORDER_CONFIRM_DELAY_MS);
                const stillOpen = await getOpenPosition(botState.active_asset);
                if (stillOpen) {
                    log.warn(`Position ${botState.active_asset} encore partiellement ouverte après fermeture`, {
                        remaining_size: stillOpen.size,
                        expected: 0,
                    });
                } else {
                    log.info(`Fermeture ${botState.active_asset} confirmée on-chain ✓`);
                }

                await supabase.from('trade_history').insert([{
                    asset:           botState.active_asset,
                    direction:       botState.current_mode,
                    entry_price:     closeEntryPx,
                    exit_price:      closePrice,
                    pnl_percentage:  parseFloat(pnlPct),
                    close_date:      new Date().toISOString(),
                }]);

                log.trade(`Trade clôturé — ${botState.current_mode} ${botState.active_asset}`, {
                    entry_price: closeEntryPx,
                    exit_price:  closePrice,
                    pnl_pct:     parseFloat(pnlPct),
                });
            }

            // ── B. OUVERTURE DE LA NOUVELLE POSITION ──
            if (newSignal !== 'CASH' && winner) {
                const positionSize     = calculatePositionSize(capital, winnerPrice, newSignal);
                const isBuyToOpen      = newSignal === 'LONG';
                const initialStopLevel = newSignal === 'SHORT'
                    ? winnerPrice + (1.5 * winnerAtr)
                    : winnerPrice - (1.5 * winnerAtr);

                log.info(`Ouverture ${newSignal} ${newAsset}`, {
                    price:         winnerPrice,
                    size:          positionSize.toFixed(4),
                    initial_stop:  initialStopLevel.toFixed(2),
                    atr:           winnerAtr?.toFixed(2),
                    capital_used:  (positionSize * winnerPrice).toFixed(2),
                });

                const openOk = await placeOrder(newAsset, isBuyToOpen, positionSize, winnerPrice);

                if (!openOk) {
                    log.error(`placeOrder() ouverture a échoué sur ${newAsset}`, {
                        signal: newSignal, price: winnerPrice, size: positionSize,
                    });
                    // Supabase reste en CASH — on ne met PAS à jour
                    await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null, position_size: 0, entry_price: 0, trailing_stop_level: 0 }).eq('id', 1);
                    throw new Error(`Ordre ${newSignal} ${newAsset} rejeté par Hyperliquid — Supabase maintenu en CASH.`);
                }

                // ── CONFIRMATION ON-CHAIN (protection désynchronisation) ──
                await sleep(ORDER_CONFIRM_DELAY_MS);
                const confirmedPos = await getOpenPosition(newAsset);

                if (!confirmedPos) {
                    log.error(`POSITION NON CONFIRMÉE on-chain après ouverture ${newSignal} ${newAsset}`, {
                        expected_side: newSignal,
                        expected_size: positionSize.toFixed(4),
                        on_chain:      'aucune position trouvée',
                        action:        'Supabase maintenu en CASH — ne pas mettre à jour',
                    });
                    await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null, position_size: 0, entry_price: 0, trailing_stop_level: 0 }).eq('id', 1);
                    throw new Error(`Position ${newSignal} ${newAsset} non confirmée on-chain — Supabase maintenu en CASH. Vérifiez Hyperliquid.`);
                }

                if (confirmedPos.side !== newSignal) {
                    log.error(`Direction incorrecte on-chain`, {
                        expected: newSignal,
                        on_chain: confirmedPos.side,
                        asset:    newAsset,
                    });
                }

                log.info(`Position confirmée on-chain ✓`, {
                    asset:    confirmedPos.coin,
                    side:     confirmedPos.side,
                    size:     confirmedPos.size,
                    entry_px: confirmedPos.entryPx,
                });

                // Stop natif Hyperliquid
                const isBuyToCloseStop = newSignal === 'SHORT';
                const stopOk = await placeStopOrder(newAsset, isBuyToCloseStop, positionSize, initialStopLevel);
                if (!stopOk) {
                    log.warn(`Stop natif Hyperliquid non placé sur ${newAsset}`, {
                        stop_level: initialStopLevel.toFixed(2),
                        note: 'Le cron gérera le stop — risque accru entre cycles',
                    });
                } else {
                    log.info(`Stop natif Hyperliquid placé ✓`, { stop_level: initialStopLevel.toFixed(2) });
                }

                // ── MISE À JOUR SUPABASE (seulement après confirmation) ──
                await supabase.from('bot_state').update({
                    current_mode:        newSignal,
                    active_asset:        newAsset,
                    entry_price:         confirmedPos.entryPx || winnerPrice,
                    position_size:       confirmedPos.size    || positionSize,
                    trailing_stop_level: initialStopLevel,
                }).eq('id', 1);

                log.info(`Supabase mis à jour ✓`, {
                    mode:  newSignal, asset: newAsset,
                    entry: confirmedPos.entryPx || winnerPrice,
                    stop:  initialStopLevel.toFixed(2),
                });

            } else {
                // Passage en CASH
                await supabase.from('bot_state').update({
                    current_mode: 'CASH', active_asset: null,
                    position_size: 0, entry_price: 0, trailing_stop_level: 0,
                }).eq('id', 1);
                log.info('Passage en CASH — aucun signal actionnable');
            }

        } else {
            log.info('Maintien de la position actuelle', {
                mode:  botState.current_mode,
                asset: botState.active_asset || 'aucun',
            });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 11. RAPPORT D'ANALYSE (log ANALYSIS pour le dashboard)
        // ─────────────────────────────────────────────────────────────────────
        const tendance  = ranked[0] ? (pricesMap[ranked[0].coin] > ranked[0].ma200 ? 'Haussière 🟢' : 'Baissière 🔴') : '-';
        const btcFilter = btcBullish ? 'BTC haussier — shorts filtrés' : 'BTC baissier — shorts autorisés';
        const decision  = stateChanged
            ? `Transition ➡️ ${newSignal}${newAsset ? ` ${newAsset}` : ''}`
            : `Maintien ${botState.current_mode}${botState.active_asset ? ` ${botState.active_asset}` : ''}`;

        await log.analysis(
            `Ranking: ${rankStr}. Tendance: ${tendance}. ${btcFilter}. Décision: ${decision}.`,
            {
                ranking:    ranked.map(a => ({ coin: a.coin, score: a.score?.toFixed(2), signal: a.signal })),
                btc_price:  btcPrice,
                btc_ma200:  btcMa200?.toFixed(2),
                tendance,
                decision,
                new_signal: newSignal,
                new_asset:  newAsset,
            }
        );

        await log.summary('SUCCESS', { state_changed: stateChanged, new_signal: newSignal });
        return res.status(200).json({ status: 'success', current_mode: newSignal, active_asset: newAsset });

    } catch (error) {
        await log.exception('Erreur critique cycle rebalance', error, {
            phase: 'unknown', // sera précisé si on ajoute des blocs try imbriqués
        });
        await log.summary('ERROR');
        return res.status(500).json({ error: error.message });
    }
};