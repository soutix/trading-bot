const { supabase } = require('../lib/supabase.js');
const { getAssetPrice, getFundingRate, getAccountBalance, placeOrder, placeStopOrder, cancelAllOrders } = require('../lib/hyperliquid.js');
const { getSignal, calculatePositionSize, calculateMA, calculateSlope, calculateATR, rankAssets } = require('../lib/strategy.js');
const { getCandles } = require('../lib/market.js');

// ─── UNIVERS D'ACTIFS ─────────────────────────────────────────────────────────
// BTC est le "lighthouse" : utilisé pour le filtre short global mais pas tradé.
// ETH et SOL sont les actifs tradables, classés par score momentum/ATR à chaque cycle.
const TRADABLE_ASSETS = ['ETH', 'SOL'];
const LIGHTHOUSE      = 'BTC';

module.exports = async function handler(req, res) {
    try {
        console.log("🔄 Démarrage du cycle de 8h (Rebalance multi-actifs)...");

        // 1. LIRE L'ÉTAT ACTUEL (Supabase)
        const { data: botState, error: stateError } = await supabase
            .from('bot_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (stateError) throw new Error("Impossible de lire l'état Supabase : " + stateError.message);

        // 2. CAPITAL RÉEL (master wallet)
        const capital = await getAccountBalance();
        if (!capital) throw new Error("Solde du compte inaccessible ou nul. Cycle annulé.");

        // 3. DONNÉES MARCHÉ — BTC (lighthouse) + tous les actifs tradables
        console.log(`📊 Récupération des données pour ${[LIGHTHOUSE, ...TRADABLE_ASSETS].join(', ')}...`);

        const allCoins   = [LIGHTHOUSE, ...TRADABLE_ASSETS];
        const candlesMap = {};
        const pricesMap  = {};

        await Promise.all(allCoins.map(async coin => {
            const [candles, price] = await Promise.all([
                getCandles(coin),
                getAssetPrice(coin)
            ]);
            candlesMap[coin] = candles;
            pricesMap[coin]  = price;
        }));

        // Vérification : toutes les données doivent être disponibles
        const missing = allCoins.filter(c => !candlesMap[c] || !pricesMap[c]);
        if (missing.length > 0) {
            throw new Error(`Données inaccessibles pour : ${missing.join(', ')}`);
        }

        // 4. CALCUL DES INDICATEURS — BTC (lighthouse)
        const btcClosePrices = candlesMap[LIGHTHOUSE].map(c => c.close);
        const btcMa200       = calculateMA(btcClosePrices, 200);
        const btcPrice       = pricesMap[LIGHTHOUSE];

        // 5. CALCUL DES INDICATEURS — Actifs tradables
        const assetsData = TRADABLE_ASSETS.map(coin => {
            const candles = candlesMap[coin];
            const prices  = candles.map(c => c.close);
            const atr     = calculateATR(candles, 14);
            const ma200   = calculateMA(prices, 200);

            // Historique MA200 sur 6 points pour calculer la pente sur 5 bougies
            const maHistory = [];
            for (let i = prices.length - 6; i <= prices.length - 1; i++) {
                maHistory.push(calculateMA(prices.slice(0, i + 1), 200));
            }
            const slope  = calculateSlope(maHistory, 5);
            const signal = (ma200 && slope !== null)
                ? getSignal(pricesMap[coin], ma200, slope, btcPrice, btcMa200)
                : 'CASH';

            console.log(`📈 ${coin} | Prix: ${pricesMap[coin]} | MA200: ${ma200?.toFixed(2)} | Pente: ${slope?.toFixed(4)} | ATR: ${atr?.toFixed(2)} | Signal: ${signal}`);

            return { coin, candles, prices, atr, ma200, slope, signal };
        });

        // ─────────────────────────────────────────────────────────────────────
        // 6. GESTION DU TRAILING STOP (Sécurité d'abord !)
        //    On gère le stop sur la position active AVANT d'évaluer un nouveau signal.
        // ─────────────────────────────────────────────────────────────────────

        if (botState.current_mode === 'LONG' || botState.current_mode === 'SHORT') {
            const activeAsset = botState.active_asset;
            const activeData  = assetsData.find(a => a.coin === activeAsset);

            if (!activeData) {
                console.warn(`⚠️ Données manquantes pour la position active ${activeAsset} — stop ignoré ce cycle.`);
            } else {
                const entryPrice = parseFloat(botState.entry_price);
                const atr        = activeData.atr;
                let   currentStop = parseFloat(botState.trailing_stop_level);
                const currentPrice = pricesMap[activeAsset];

                if (botState.current_mode === 'LONG') {
                    const profit = currentPrice - entryPrice;

                    if (profit >= (2 * atr) && currentStop < entryPrice) {
                        currentStop = entryPrice;
                        console.log(`🛡️ [${activeAsset} LONG] Stop sécurisé à Breakeven.`);
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                    }

                    const dynamicStop = currentPrice - (1.5 * atr);
                    if (dynamicStop > currentStop) {
                        currentStop = dynamicStop;
                        console.log(`📈 [${activeAsset} LONG] Trailing Stop relevé à ${currentStop.toFixed(2)}`);
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                    }

                    if (currentPrice <= currentStop) {
                        console.log(`🛑 [${activeAsset} LONG] Stop déclenché ! Clôture et passage en CASH.`);
                        await placeOrder(activeAsset, false, botState.position_size, currentPrice);

                        const pnlPct = ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);
                        await supabase.from('trade_history').insert([{
                            asset: activeAsset, direction: 'LONG',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_percentage: parseFloat(pnlPct), close_date: new Date().toISOString()
                        }]);
                        await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
                        await supabase.from('system_logs').insert([{
                            log_type: 'TRADE',
                            message: `Stop LONG ${activeAsset} déclenché. Entrée: ${entryPrice} | Sortie: ${currentPrice} | PnL: ${pnlPct}%`,
                            timestamp: new Date().toISOString()
                        }]);
                        return res.status(200).json({ message: `Stop Loss LONG ${activeAsset} touché.` });
                    }
                }

                if (botState.current_mode === 'SHORT') {
                    const profit = entryPrice - currentPrice;

                    if (profit >= (2 * atr) && currentStop > entryPrice) {
                        currentStop = entryPrice;
                        console.log(`🛡️ [${activeAsset} SHORT] Stop sécurisé à Breakeven.`);
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                    }

                    const dynamicStop = currentPrice + (1.5 * atr);
                    if (dynamicStop < currentStop) {
                        currentStop = dynamicStop;
                        console.log(`📉 [${activeAsset} SHORT] Trailing Stop abaissé à ${currentStop.toFixed(2)}`);
                        await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
                    }

                    if (currentPrice >= currentStop) {
                        console.log(`🛑 [${activeAsset} SHORT] Stop déclenché ! Clôture et passage en CASH.`);
                        await placeOrder(activeAsset, true, botState.position_size, currentPrice);

                        const pnlPct = ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2);
                        await supabase.from('trade_history').insert([{
                            asset: activeAsset, direction: 'SHORT',
                            entry_price: entryPrice, exit_price: currentPrice,
                            pnl_percentage: parseFloat(pnlPct), close_date: new Date().toISOString()
                        }]);
                        await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
                        await supabase.from('system_logs').insert([{
                            log_type: 'TRADE',
                            message: `Stop SHORT ${activeAsset} déclenché. Entrée: ${entryPrice} | Sortie: ${currentPrice} | PnL: ${pnlPct}%`,
                            timestamp: new Date().toISOString()
                        }]);
                        return res.status(200).json({ message: `Stop Loss SHORT ${activeAsset} touché.` });
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 7. RANKING MULTI-ACTIFS — Sélection du meilleur actif
        // ─────────────────────────────────────────────────────────────────────

        const ranked = rankAssets(assetsData);

        console.log("🏆 Ranking actifs :");
        ranked.forEach((a, i) => {
            console.log(`   ${i + 1}. ${a.coin} | Score: ${a.score?.toFixed(4)} | Momentum: ${(a.momentum * 100)?.toFixed(2)}% | Signal: ${a.signal}`);
        });

        // Chercher le meilleur actif avec un signal actionnable (LONG ou SHORT)
        const winner = ranked.find(a => a.signal === 'LONG' || a.signal === 'SHORT') || null;
        const newSignal    = winner?.signal    || 'CASH';
        const newAsset     = winner?.coin      || null;
        const winnerPrice  = winner ? pricesMap[winner.coin] : null;
        const winnerAtr    = winner?.atr || null;

        console.log(`🎯 Décision : ${newSignal}${newAsset ? ` sur ${newAsset}` : ''}`);

        // Vérification funding rate si SHORT entrant
        if (newSignal === 'SHORT' && botState.current_mode === 'CASH') {
            const fundingRate = await getFundingRate(newAsset);
            console.log(`💰 Funding Rate ${newAsset}: ${(fundingRate * 100).toFixed(4)}%`);

            if (fundingRate < -0.0003) {
                console.log(`⚠️ Funding Rate trop négatif sur ${newAsset}. Short annulé, on reste en CASH.`);
                await supabase.from('system_logs').insert([{
                    log_type: 'SIGNAL',
                    message: `Short ${newAsset} annulé : Funding Rate ${(fundingRate * 100).toFixed(4)}%`,
                    timestamp: new Date().toISOString()
                }]);
                return res.status(200).json({ message: `Short ${newAsset} annulé — Funding Rate négatif.` });
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 8. EXÉCUTION DES CHANGEMENTS D'ÉTAT
        // ─────────────────────────────────────────────────────────────────────

        const stateChanged   = newSignal !== botState.current_mode || newAsset !== botState.active_asset;
        const assetSwitched  = newAsset && botState.active_asset && newAsset !== botState.active_asset;

        if (stateChanged) {
            console.log(`🔄 Changement : ${botState.current_mode}${botState.active_asset ? `(${botState.active_asset})` : ''} ➡️ ${newSignal}${newAsset ? `(${newAsset})` : ''}`);

            // A. Clôturer l'ancienne position si on en avait une
            if (botState.current_mode !== 'CASH') {
                // Annuler le stop natif existant avant de fermer manuellement
                await cancelAllOrders(botState.active_asset);
                const isBuyToClose  = botState.current_mode === 'SHORT';
                const closePrice    = pricesMap[botState.active_asset];
                const closeEntryPx  = parseFloat(botState.entry_price);
                const pnlPct = botState.current_mode === 'LONG'
                    ? ((closePrice - closeEntryPx) / closeEntryPx * 100).toFixed(2)
                    : ((closeEntryPx - closePrice) / closeEntryPx * 100).toFixed(2);

                await placeOrder(botState.active_asset, isBuyToClose, botState.position_size, closePrice);
                await supabase.from('trade_history').insert([{
                    asset: botState.active_asset, direction: botState.current_mode,
                    entry_price: closeEntryPx, exit_price: closePrice,
                    pnl_percentage: parseFloat(pnlPct), close_date: new Date().toISOString()
                }]);

                const reason = assetSwitched ? `rotation vers ${newAsset}` : `signal ${newSignal}`;
                console.log(`💰 Position ${botState.current_mode} ${botState.active_asset} fermée (${reason}). PnL: ${pnlPct}%`);
            }

            // B. Ouvrir la nouvelle position
            if (newSignal !== 'CASH' && winner) {
                const positionSize     = calculatePositionSize(capital, winnerPrice, newSignal);
                const isBuyToOpen      = newSignal === 'LONG';
                const initialStopLevel = newSignal === 'SHORT'
                    ? winnerPrice + (1.5 * winnerAtr)
                    : winnerPrice - (1.5 * winnerAtr);

                await placeOrder(newAsset, isBuyToOpen, positionSize, winnerPrice);

                // Stop natif Hyperliquid — exécuté en temps réel même si le cron dort
                const isBuyToCloseStop = newSignal === 'SHORT'; // SHORT → BUY pour fermer
                await placeStopOrder(newAsset, isBuyToCloseStop, positionSize, initialStopLevel);

                await supabase.from('bot_state').update({
                    current_mode:        newSignal,
                    active_asset:        newAsset,
                    entry_price:         winnerPrice,
                    position_size:       positionSize,
                    trailing_stop_level: initialStopLevel
                }).eq('id', 1);

                console.log(`🟢 Position ${newSignal} ${newAsset} ouverte. Taille: ${positionSize.toFixed(4)} | Stop: ${initialStopLevel.toFixed(2)}`);
            } else {
                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
                console.log("⚪ Passage en CASH.");
            }

        } else {
            console.log(`⏸️ Maintien : ${botState.current_mode}${botState.active_asset ? ` sur ${botState.active_asset}` : ''}`);
        }

        console.log("✅ Cycle terminé avec succès.");

        // 9. RAPPORT D'ANALYSE
        const rankStr    = ranked.map(a => `${a.coin}(${a.score?.toFixed(2)})`).join(' > ');
        const tendance   = ranked[0] ? (pricesMap[ranked[0].coin] > ranked[0].ma200 ? 'Haussière 🟢' : 'Baissière 🔴') : '-';
        const btcFilter  = btcPrice > btcMa200 ? 'BTC haussier — shorts filtrés' : 'BTC baissier — shorts autorisés';
        const decision   = stateChanged
            ? `Transition ➡️ ${newSignal}${newAsset ? ` ${newAsset}` : ''}`
            : `Maintien ${botState.current_mode}${botState.active_asset ? ` ${botState.active_asset}` : ''}`;

        const reportMessage = `Ranking: ${rankStr}. Tendance: ${tendance}. ${btcFilter}. Décision: ${decision}.`;

        await supabase.from('system_logs').insert([{
            log_type: 'ANALYSIS', message: reportMessage, timestamp: new Date().toISOString()
        }]);

        res.status(200).json({ status: 'success', current_mode: newSignal, active_asset: newAsset });

    } catch (error) {
        console.error("❌ Erreur critique :", error.message);
        await supabase.from('system_logs').insert([{ log_type: 'ERROR', message: error.message }]);
        res.status(500).json({ error: error.message });
    }
};