module.exports = async function handler(req, res) {
    try {
        // Dans la V2, les signaux sont gérés en interne lors du rebalance.
        // On renvoie un objet vide pour ne pas faire planter les anciennes requêtes du Dashboard.
        res.status(200).json({ signals: [] });
    } catch (error) {
        console.error("❌ Erreur API Signals:", error.message);
        res.status(500).json({ error: "Impossible de charger les signaux" });
    }
}