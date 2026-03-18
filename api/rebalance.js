const { supabase } = require('../lib/supabase.js');
const { getAssetPrice, getFundingRate, getAccountBalance, placeOrder } = require('../lib/hyperliquid.js');
const { getSignal, calculatePositionSize, calculateMA, calculateSlope, calculateATR } = require('../lib/strategy.js');
const { getCandles } = require('../lib/market.js');

module.exports = async function handler(req, res) {
    try {
        console.log("🔄 Démarrage du cycle de 8h (Rebalance)...");

        // 1. LIRE LA MÉMOIRE (L'état actuel du bot dans Supabase)
        const { data: botState, error: stateError } = await supabase
            .from('bot_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (stateError) throw new Error("Impossible de lire l'état Supabase : " + stateError.message);


        const targetAsset = process.env.TARGET_ASSET || 'ETH';

        // Capital lu en temps réel depuis le compte Hyperliquid
        // Le sizing s adapte automatiquement aux gains/pertes accumules
        const capital = await getAccountBalance();
        if (!capital) throw new Error('Solde du compte inaccessible ou nul. Cycle annule.');

        // 2. RÉCUPÉRATION DES PRIX ET HISTORIQUES
        console.log(`📊 Récupération des données du marché pour ${targetAsset} et BTC...`);
        const currentPrice = await getAssetPrice(targetAsset);
        const btcPrice     = await getAssetPrice('BTC');

        const targetCandles = await getCandles(targetAsset);
        const btcCandles    = await getCandles('BTC');

        if (!targetCandles || !btcCandles || !currentPrice || !btcPrice) {
            throw new Error(`Données inaccessibles. Prix: [${targetAsset}:${currentPrice || 'Echec'}, BTC:${btcPrice || 'Echec'}]. Bougies: [${targetAsset}:${targetCandles ? 'OK' : 'Echec'}, BTC:${btcCandles ? 'OK' : 'Echec'}]`);
        }

        // Extraction des prix de clôture
        const targetClosePrices = targetCandles.map(c => c.close);
        const btcClosePrices    = btcCandles.map(c => c.close);

        // 3. CALCUL DES INDICATEURS MATHÉMATIQUES (Le Cerveau)
        const atr     = calculateATR(targetCandles, 14);
        const ma200   = calculateMA(targetClosePrices, 200);
        const btcMa200 = calculateMA(btcClosePrices, 200);

        // FIX : utilisation de calculateSlope() depuis strategy.js (source unique de vérité)
        // On reconstruit l'historique des MA200 sur les 6 dernières valeurs pour obtenir la pente sur 5 bougies
        const maHistory = [];
        for (let i = targetClosePrices.length - 6; i <= targetClosePrices.length - 1; i++) {
            maHistory.push(calculateMA(targetClosePrices.slice(0, i + 1), 200));
        }
        const slope = calculateSlope(maHistory, 5);

        console.log(`📈 Indicateurs ${targetAsset} | Prix: ${currentPrice} | MA200: ${ma200.toFixed(2)} | Pente: ${slope.toFixed(4)} | ATR: ${atr.toFixed(2)}`);

        // ─────────────────────────────────────────────────────────────────────
        // 4. GESTION DU TRAILING STOP (Sécurité d'abord !)
        //    FIX : la logique couvre désormais LONG et SHORT de manière symétrique
        // ─────────────────────────────────────────────────────────────────────

        if (botState.current_mode === 'LONG') {
            const entryPrice = parseFloat(botState.entry_price);
            let currentStop  = parseFloat(botState.trailing_stop_level);

            // En Long, on gagne quand le prix monte
            const profit = currentPrice - entryPrice;

            // Règle V2 : Si profit >= 2*ATR → sécuriser le stop à Breakeven
            if (profit >= (2 * atr) && currentStop < entryPrice) {
                currentStop = entryPrice;
                console.log("🛡️ [LONG] Trailing Stop sécurisé à Breakeven !");
                await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
            }

            // Règle V2 : Le stop "suit" le prix vers le haut à 1.5*ATR sous le sommet
            const dynamicStop = currentPrice - (1.5 * atr);
            if (dynamicStop > currentStop) {
                currentStop = dynamicStop;
                console.log(`📈 [LONG] Trailing Stop relevé à : ${currentStop.toFixed(2)}`);
                await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
            }

            // DÉCLENCHEMENT DU STOP LOSS LONG
            if (currentPrice <= currentStop) {
                console.log("🛑 [LONG] Trailing Stop touché ! Clôture du Long et passage en CASH.");

                await placeOrder(targetAsset, false, botState.position_size, currentPrice); // SELL pour clôturer le Long

                // FIX : calcul et insertion du pnl_percentage
                const pnlPct = ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2);

                await supabase.from('trade_history').insert([{
                    asset:          targetAsset,
                    direction:      'LONG',
                    entry_price:    entryPrice,
                    exit_price:     currentPrice,
                    pnl_percentage: parseFloat(pnlPct),
                    close_date:     new Date().toISOString()
                }]);

                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);

                await supabase.from('system_logs').insert([{
                    log_type:  'TRADE',
                    message:   `Stop Loss LONG déclenché. Entrée: ${entryPrice} | Sortie: ${currentPrice} | PnL: ${pnlPct}%`,
                    timestamp: new Date().toISOString()
                }]);

                return res.status(200).json({ message: "Stop Loss LONG touché, position clôturée." });
            }
        }

        if (botState.current_mode === 'SHORT') {
            const entryPrice = parseFloat(botState.entry_price);
            let currentStop  = parseFloat(botState.trailing_stop_level);

            // En Short, on gagne quand le prix baisse
            const profit = entryPrice - currentPrice;

            // Règle V2 : Si profit >= 2*ATR → sécuriser le stop à Breakeven
            if (profit >= (2 * atr) && currentStop > entryPrice) {
                currentStop = entryPrice;
                console.log("🛡️ [SHORT] Trailing Stop sécurisé à Breakeven !");
                await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
            }

            // Règle V2 : Le stop "suit" le prix vers le bas à 1.5*ATR au-dessus du creux
            const dynamicStop = currentPrice + (1.5 * atr);
            if (dynamicStop < currentStop) {
                currentStop = dynamicStop;
                console.log(`📉 [SHORT] Trailing Stop abaissé à : ${currentStop.toFixed(2)}`);
                await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
            }

            // DÉCLENCHEMENT DU STOP LOSS SHORT
            if (currentPrice >= currentStop) {
                console.log("🛑 [SHORT] Trailing Stop touché ! Clôture du Short et passage en CASH.");

                await placeOrder(targetAsset, true, botState.position_size, currentPrice); // BUY pour clôturer le Short

                // FIX : calcul et insertion du pnl_percentage
                const pnlPct = ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2);

                await supabase.from('trade_history').insert([{
                    asset:          targetAsset,
                    direction:      'SHORT',
                    entry_price:    entryPrice,
                    exit_price:     currentPrice,
                    pnl_percentage: parseFloat(pnlPct),
                    close_date:     new Date().toISOString()
                }]);

                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);

                await supabase.from('system_logs').insert([{
                    log_type:  'TRADE',
                    message:   `Stop Loss SHORT déclenché. Entrée: ${entryPrice} | Sortie: ${currentPrice} | PnL: ${pnlPct}%`,
                    timestamp: new Date().toISOString()
                }]);

                return res.status(200).json({ message: "Stop Loss SHORT touché, position clôturée." });
            }
        }

        // 5. ANALYSE ET DÉCISION DU NOUVEAU CYCLE
        const newSignal = getSignal(currentPrice, ma200, slope, btcPrice, btcMa200);

        // Vérification du Funding Rate si on s'apprête à Shorter
        if (newSignal === 'SHORT' && botState.current_mode === 'CASH') {
            const fundingRate = await getFundingRate(targetAsset);
            console.log(`💰 Funding Rate actuel pour ${targetAsset}: ${(fundingRate * 100).toFixed(4)}%`);

            if (fundingRate < -0.0003) {
                console.log("⚠️ Funding Rate trop négatif. Annulation du Short, on reste en CASH.");
                await supabase.from('system_logs').insert([{
                    log_type:  'SIGNAL',
                    message:   `Short annulé : Funding Rate trop négatif (${(fundingRate * 100).toFixed(4)}%)`,
                    timestamp: new Date().toISOString()
                }]);
                return res.status(200).json({ message: "Short annulé à cause du Funding Rate" });
            }
        }

        // 6. EXÉCUTION DES CHANGEMENTS D'ÉTATS
        if (newSignal !== botState.current_mode) {
            console.log(`🔄 Changement d'état détecté : ${botState.current_mode} ➡️ ${newSignal}`);

            // A. Clôturer l'ancienne position si on n'était pas en CASH
            if (botState.current_mode !== 'CASH') {
                const isBuyToClose = botState.current_mode === 'SHORT';
                await placeOrder(botState.active_asset, isBuyToClose, botState.position_size, currentPrice);

                // FIX : calcul et insertion du pnl_percentage à la fermeture sur signal
                const entryPrice = parseFloat(botState.entry_price);
                const pnlPct = botState.current_mode === 'LONG'
                    ? ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
                    : ((entryPrice - currentPrice) / entryPrice * 100).toFixed(2);

                await supabase.from('trade_history').insert([{
                    asset:          botState.active_asset,
                    direction:      botState.current_mode,
                    entry_price:    entryPrice,
                    exit_price:     currentPrice,
                    pnl_percentage: parseFloat(pnlPct),
                    close_date:     new Date().toISOString()
                }]);

                console.log(`💰 Trade fermé sur signal. PnL: ${pnlPct}%`);
            }

            // B. Ouvrir la nouvelle position
            if (newSignal !== 'CASH') {
                const positionSize    = calculatePositionSize(capital, atr, newSignal);
                const isBuyToOpen     = newSignal === 'LONG';
                const initialStopLevel = newSignal === 'SHORT'
                    ? currentPrice + (1.5 * atr)
                    : currentPrice - (1.5 * atr);

                await placeOrder(targetAsset, isBuyToOpen, positionSize, currentPrice);

                await supabase.from('bot_state').update({
                    current_mode:         newSignal,
                    active_asset:         targetAsset,
                    entry_price:          currentPrice,
                    position_size:        positionSize,
                    trailing_stop_level:  initialStopLevel
                }).eq('id', 1);

                console.log(`🟢 Nouvelle position ${newSignal} ouverte. Stop initial: ${initialStopLevel.toFixed(2)}`);
            } else {
                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
                console.log("⚪ Passage en CASH.");
            }

        } else {
            console.log(`⏸️ Aucun changement de tendance. Le bot maintient sa position : ${botState.current_mode}`);
        }

        console.log("✅ Cycle de 8h terminé avec succès.");

        // --- RAPPORT D'ANALYSE ---
        // FIX : utilisation de newSignal (état APRÈS décision) et non botState.current_mode (état AVANT)
        const tendance  = currentPrice > ma200 ? 'Haussière 🟢' : 'Baissière 🔴';
        const penteStr  = slope > 0 ? 'Positive ↗️' : 'Négative ↘️';
        const maGapPct  = ((currentPrice - ma200) / ma200 * 100).toFixed(2);
        const decision  = newSignal !== botState.current_mode
            ? `Transition ${botState.current_mode} ➡️ ${newSignal}`
            : `Maintien en mode ${newSignal}`;

        const reportMessage = `Tendance: ${tendance} (${maGapPct}% vs MA200). Pente: ${penteStr}. ATR: ${atr.toFixed(2)}. Décision: ${decision}.`;

        await supabase.from('system_logs').insert([{
            log_type:  'ANALYSIS',
            message:   reportMessage,
            timestamp: new Date().toISOString()
        }]);

        res.status(200).json({ status: 'success', current_mode: newSignal });

    } catch (error) {
        console.error("❌ Erreur critique dans le Cron Job:", error.message);
        await supabase.from('system_logs').insert([{ log_type: 'ERROR', message: error.message }]);
        res.status(500).json({ error: error.message });
    }
}