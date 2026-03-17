module.exports = async function handler(req, res) {
    try {
        // On renvoie une configuration propre pour la V2
        res.status(200).json({
            hyperliquid_configured: !!process.env.HYPERLIQUID_PRIVATE_KEY,
            isTestnet: process.env.USE_TESTNET === 'true',
            strategy: "Machine à États Triple (Long/Short/Cash)",
            version: "2.0.0"
        });
    } catch (error) {
        console.error("❌ Erreur API Config:", error.message);
        res.status(500).json({ error: "Impossible de charger la config" });
    }
}