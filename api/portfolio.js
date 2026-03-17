const { supabase } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    try {
        const { data, error } = await supabase
            .from('bot_state')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        // On renvoie les données sous la forme d'un objet 'botState'
        res.status(200).json({ botState: data });
    } catch (error) {
        console.error("❌ Erreur API Portfolio:", error.message);
        res.status(500).json({ error: "Impossible de récupérer l'état du bot" });
    }
}