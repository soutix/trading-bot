const { supabase } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    try {
        // On récupère les 50 derniers trades, du plus récent au plus ancien
        const { data, error } = await supabase
            .from('trade_history')
            .select('*')
            .order('close_date', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error("❌ Erreur API Trades:", error.message);
        res.status(500).json({ error: "Impossible de récupérer l'historique des trades" });
    }
}