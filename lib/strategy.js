/**
 * Calcule la Moyenne Mobile Simple (SMA / MA)
 * @param {Array<number>} prices - Tableau des prix de clôture
 * @param {number} period - La période (ex: 200)
 */
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(prices.length - period);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / period;
}

/**
 * Calcule la Pente (Slope) de la MA sur les X dernières bougies
 * @param {Array<number>} maHistory - L'historique des valeurs de la MA200
 * @param {number} lookback - Le nombre de bougies en arrière (ex: 5)
 */
function calculateSlope(maHistory, lookback = 5) {
    if (maHistory.length <= lookback) return null;
    const currentMA = maHistory[maHistory.length - 1];
    const pastMA = maHistory[maHistory.length - 1 - lookback];
    
    // Si positif = tendance haussière confirmée. Si négatif = tendance baissière.
    return currentMA - pastMA; 
}

/**
 * Calcule l'Average True Range (ATR) pour la volatilité et le Trailing Stop
 * @param {Array<Object>} candles - Tableau d'objets { high, low, close }
 * @param {number} period - La période classique est 14
 */
function calculateATR(candles, period = 14) {
    if (candles.length <= period) return null;
    
    let trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
    }

    // On calcule la moyenne des True Ranges sur la période demandée
    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((acc, val) => acc + val, 0) / period;
    return atr;
}

/**
 * 🎯 LA MACHINE À ÉTATS : Le filtre de décision global
 * @param {number} price - Prix actuel de l'actif
 * @param {number} ma200 - La MA200 de l'actif
 * @param {number} slope - La pente de la MA200 de l'actif sur 5 bougies
 * @param {number} btcPrice - Le prix actuel du Bitcoin (Le "Lighthouse")
 * @param {number} btcMa200 - La MA200 du Bitcoin
 */
function getSignal(price, ma200, slope, btcPrice, btcMa200) {
    // 1. La "Buffer Zone" de 1% pour éviter le bruit
    const upperBuffer = ma200 * 1.01;
    const lowerBuffer = ma200 * 0.99;

    // 2. ÉTAT LONG
    if (price > upperBuffer && slope > 0) {
        return 'LONG';
    }
    
    // 3. ÉTAT SHORT (Avec le filtre BTC)
    if (price < lowerBuffer && slope < 0 && btcPrice < btcMa200) {
        return 'SHORT';
    }

    // 4. ÉTAT CASH (Neutre par défaut)
    return 'CASH';
}

/**
 * Calcule la taille de la position de manière asymétrique (Volatility Targeting)
 * @param {number} capital - Le capital total disponible en USDC
 * @param {number} atr - L'ATR calculé
 * @param {string} mode - 'LONG' ou 'SHORT'
 */
function calculatePositionSize(capital, atr, mode) {
    // Exposition asymétrique selon ton plan
    const exposure = mode === 'LONG' ? 0.80 : 0.40;
    
    // Position_Size = (Capital * Exposure) / ATR
    const size = (capital * exposure) / atr;
    return size;
}

module.exports = {
    calculateMA,
    calculateSlope,
    calculateATR,
    getSignal,
    calculatePositionSize
};