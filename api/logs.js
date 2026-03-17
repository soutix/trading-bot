const { supabase } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    try {
        // On récupère les 100 derniers logs, du plus récent au plus ancien
        const { data, error } = await supabase
            .from('system_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) throw error;

        res.status(200).json(data);
    } catch (error) {
        console.error("❌ Erreur API Logs:", error.message);
        res.status(500).json({ error: "Impossible de récupérer les logs" });
    }
}