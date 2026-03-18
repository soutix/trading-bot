const { supabase } = require('../lib/supabase.js');
const { getAccountBalance, getAssetPrice } = require('../lib/hyperliquid.js');

module.exports = async function handler(req, res) {
    try {
        // 1. État du bot (Supabase)
        const { data, error } = await supabase
            .from('bot_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        // 2. Données live Hyperliquid (en parallèle)
        const activeAsset = data?.active_asset;

        const [balance, currentPrice] = await Promise.all([
            getAccountBalance().catch(() => null),
            activeAsset ? getAssetPrice(activeAsset).catch(() => null) : Promise.resolve(null),
        ]);

        // 3. Réponse enrichie
        res.status(200).json({
            botState:     data,
            balance:      balance,
            currentPrice: currentPrice,
        });

    } catch (error) {
        console.error("❌ Erreur API Portfolio:", error.message);
        res.status(500).json({ error: "Impossible de récupérer l'état du bot" });
    }
}