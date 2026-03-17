/**
 * Récupère l'historique des bougies (Klines) via l'API publique de Binance
 * @param {string} coin - Le nom de l'actif (ex: 'ETH', 'BTC')
 * @param {string} interval - L'intervalle de la bougie (par défaut '8h')
 * @param {number} limit - Le nombre de bougies (205 pour avoir la MA200 + la pente sur 5 bougies)
 */
async function getCandles(coin, interval = '8h', limit = 205) {
    try {
        // Binance utilise le format "ETHUSDT" ou "BTCUSDT"
        const symbol = `${coin}USDT`; 
        const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        
        const data = await response.json();

        // Le format brut de Binance est un tableau de tableaux : 
        // [OpenTime, Open, High, Low, Close, Volume, CloseTime, ...]
        // Nous le transformons en un tableau d'objets propres pour notre fichier strategy.js
        const candles = data.map(candle => ({
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4])
        }));

        return candles;

    } catch (error) {
        console.error(`❌ Erreur lors de la récupération des bougies pour ${coin}:`, error);
        return null;
    }
}

module.exports = {
    getCandles
};