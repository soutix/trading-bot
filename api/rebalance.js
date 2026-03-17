const { supabase } = require('../lib/supabase.js');
const { getAssetPrice, getFundingRate, placeOrder } = require('../lib/hyperliquid.js');
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

        // --- PARAMÈTRES DU BOT ---
        const targetAsset = 'ETH'; // L'actif que tu trades
        const capital = 1000; // Ton capital alloué en USDC (tu peux aussi le mettre dans ton .env)

        // 2. RÉCUPÉRATION DES PRIX ET HISTORIQUES
        console.log(`📊 Récupération des données du marché pour ${targetAsset} et BTC...`);
        const currentPrice = await getAssetPrice(targetAsset);
        const btcPrice = await getAssetPrice('BTC');

        const targetCandles = await getCandles(targetAsset);
        const btcCandles = await getCandles('BTC');

if (!targetCandles || !btcCandles || !currentPrice || !btcPrice) {
            throw new Error(`Données inaccessibles. Prix: [ETH:${currentPrice || 'Echec'}, BTC:${btcPrice || 'Echec'}]. Bougies: [ETH:${targetCandles ? 'OK' : 'Echec'}, BTC:${btcCandles ? 'OK' : 'Echec'}]`);
        }

        // Extraction des prix de clôture
        const targetClosePrices = targetCandles.map(c => c.close);
        const btcClosePrices = btcCandles.map(c => c.close);

        // 3. CALCUL DES INDICATEURS MATHÉMATIQUES (Le Cerveau)
        const atr = calculateATR(targetCandles, 14); // ATR sur 14 périodes
        const ma200 = calculateMA(targetClosePrices, 200);
        const btcMa200 = calculateMA(btcClosePrices, 200);
        
        // Calcul de la MA200 d'il y a 5 bougies pour obtenir la pente (Slope)
        const pastMa200 = calculateMA(targetClosePrices.slice(0, targetClosePrices.length - 5), 200);
        const slope = ma200 - pastMa200; 

        console.log(`📈 Indicateurs ${targetAsset} | Prix: ${currentPrice} | MA200: ${ma200.toFixed(2)} | Pente: ${slope.toFixed(4)} | ATR: ${atr.toFixed(2)}`);

        // 4. GESTION DU TRAILING STOP (Sécurité d'abord !)
        if (botState.current_mode === 'SHORT') {
            const entryPrice = parseFloat(botState.entry_price);
            let currentStop = parseFloat(botState.trailing_stop_level);
            
            // Calcul du profit actuel (en Short, on gagne quand le prix baisse)
            const profit = entryPrice - currentPrice;

            // Règle V2 : Si profit > 2*ATR, on descend le stop à Breakeven (Prix d'entrée)
            if (profit >= (2 * atr) && currentStop > entryPrice) {
                currentStop = entryPrice;
                console.log("🛡️ Trailing Stop sécurisé à Breakeven !");
            }

            // Règle V2 : Le stop "suit" le prix à 1.5*ATR pendant la chute
            const dynamicStop = currentPrice + (1.5 * atr);
            if (dynamicStop < currentStop) {
                currentStop = dynamicStop;
                console.log(`📉 Trailing Stop abaissé à : ${currentStop.toFixed(2)}`);
                await supabase.from('bot_state').update({ trailing_stop_level: currentStop }).eq('id', 1);
            }

            // DÉCLENCHEMENT DU STOP LOSS
            if (currentPrice >= currentStop) {
                console.log("🛑 Trailing Stop touché ! Clôture du Short et passage en CASH.");
                await placeOrder(targetAsset, true, botState.position_size, currentPrice); // Achat pour clôturer le Short
                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
                
                // Enregistrement de la perte/gain dans l'historique
                await supabase.from('trade_history').insert([{
                    asset: targetAsset, direction: 'SHORT', entry_price: entryPrice, exit_price: currentPrice
                }]);

                return res.status(200).json({ message: "Stop Loss touché, position clôturée." });
            }
        }

        // 5. ANALYSE ET DÉCISION DU NOUVEAU CYCLE
        const newSignal = getSignal(currentPrice, ma200, slope, btcPrice, btcMa200);

        // Vérification du Funding Rate si on s'apprête à Shorter
        if (newSignal === 'SHORT' && botState.current_mode === 'CASH') {
            const fundingRate = await getFundingRate(targetAsset);
            console.log(`💰 Funding Rate actuel pour ${targetAsset}: ${fundingRate}`);
            
            // Règle V2 : Funding Rate < -0.03% = On annule le Short
            if (fundingRate < -0.0003) { 
                console.log("⚠️ Funding Rate trop négatif. Annulation du Short, on reste en CASH.");
                await supabase.from('system_logs').insert([{ log_type: 'SIGNAL', message: 'Short annulé : Funding Rate négatif' }]);
                return res.status(200).json({ message: "Short annulé à cause du Funding Rate" });
            }
        }

        // 6. EXÉCUTION DES CHANGEMENTS D'ÉTATS
        if (newSignal !== botState.current_mode) {
            console.log(`🔄 Changement d'état détecté : ${botState.current_mode} ➡️ ${newSignal}`);

            // A. Clôturer l'ancienne position si on n'était pas en CASH
            if (botState.current_mode !== 'CASH') {
                const isBuyToClose = botState.current_mode === 'SHORT'; // Si on était SHORT, on BUY. Si LONG, on SELL (false).
                await placeOrder(botState.active_asset, isBuyToClose, botState.position_size, currentPrice);
                
                await supabase.from('trade_history').insert([{
                    asset: botState.active_asset,
                    direction: botState.current_mode,
                    entry_price: botState.entry_price,
                    exit_price: currentPrice
                }]);
            }

            // B. Ouvrir la nouvelle position
            if (newSignal !== 'CASH') {
                const positionSize = calculatePositionSize(capital, atr, newSignal);
                const isBuyToOpen = newSignal === 'LONG';
                
                // Calcul du Stop Initial : 1.5 ATR au-dessus du prix (Short) ou en-dessous (Long)
                const initialStopLevel = newSignal === 'SHORT' ? currentPrice + (1.5 * atr) : currentPrice - (1.5 * atr);

                await placeOrder(targetAsset, isBuyToOpen, positionSize, currentPrice);
                
                await supabase.from('bot_state').update({
                    current_mode: newSignal,
                    active_asset: targetAsset,
                    entry_price: currentPrice,
                    position_size: positionSize,
                    trailing_stop_level: initialStopLevel
                }).eq('id', 1);
            } else {
                // Retour pur en CASH
                await supabase.from('bot_state').update({ current_mode: 'CASH', active_asset: null }).eq('id', 1);
            }
        } else {
            console.log(`⏸️ Aucun changement de tendance. Le bot maintient sa position : ${botState.current_mode}`);
        }

        console.log("✅ Cycle de 8h terminé avec succès.");

        // --- CRÉATION DU RAPPORT D'ANALYSE ---
        const reportMessage = `Analyse terminée. Tendance: ${currentPrice > ma200 ? 'Haussière 🟢' : 'Baissière 🔴'}. Pente: ${slope > 0 ? 'Positive ↗️' : 'Négative ↘️'}. Décision finale du bot: Maintien en mode ${botState.current_mode}.`;

        await supabase.from('system_logs').insert([{
            log_type: 'ANALYSIS',
            message: reportMessage,
            timestamp: new Date().toISOString()
        }]);
        // --------------------------------------



        res.status(200).json({ status: 'success', current_mode: newSignal });

    } catch (error) {
        console.error("❌ Erreur critique dans le Cron Job:", error.message);
        // On tente de logguer l'erreur dans Supabase
        await supabase.from('system_logs').insert([{ log_type: 'ERROR', message: error.message }]);
        res.status(500).json({ error: error.message });
    }
}