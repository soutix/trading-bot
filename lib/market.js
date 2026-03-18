/**
 * Récupère l'historique des bougies via l'API publique de Binance avec Fallbacks et Timeout
 * @param {string} coin - Le nom de l'actif (ex: 'ETH', 'BTC')
 * @param {string} interval - L'intervalle de la bougie
 * @param {number} limit - Le nombre de bougies
 */
async function getCandles(coin, interval = '8h', limit = 205) {
    const symbol = `${coin}USDT`;
    
    // Nos 3 portes d'entrée de secours chez Binance
    const endpoints = [
        'https://data-api.binance.vision/api/v3/klines',
        'https://api3.binance.com/api/v3/klines',
        'https://api.binance.com/api/v3/klines'
    ];

    let lastError = null;

    for (const base_url of endpoints) {
        const url = `${base_url}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        console.log(`[MARKET] 🔍 Tentative Binance pour ${symbol} via : ${base_url}...`);

        try {
            // On impose un délai maximum de 5 secondes par tentative
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId); // Si ça répond avant 5s, on annule le chrono

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`[MARKET] ✅ Succès pour ${symbol} (${data.length} bougies trouvées).`);

            // Transformation des données pour strategy.js
            return data.map(candle => ({
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4])
            }));

        } catch (error) {
            // Si c'est une erreur d'annulation (Timeout de 5s)
            if (error.name === 'AbortError') {
                console.log(`[MARKET] ⚠️ Timeout (trop lent) sur ${base_url}. Passage au suivant...`);
                lastError = "Timeout de 5 secondes dépassé.";
            } else {
                console.log(`[MARKET] ⚠️ Échec sur ${base_url} : ${error.message}`);
                lastError = error.message;
            }
            // La boucle "for" va automatiquement essayer l'URL suivante !
        }
    }

    // Si on arrive ici, c'est que les 3 serveurs ont échoué
    console.error(`[MARKET] ❌ Crash total pour ${symbol}. Dernière erreur:`, lastError);
    return null; // On renvoie null pour que rebalance.js le signale proprement à Supabase
}

module.exports = {
    getCandles
};