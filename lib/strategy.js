/**
 * strategy.js — Indicateurs techniques + Machine à États Triple + Ranking multi-actifs
 */

// ─── INDICATEURS DE BASE ──────────────────────────────────────────────────────

/**
 * Moyenne Mobile Simple (MA/SMA)
 * @param {number[]} prices - Tableau des prix de clôture
 * @param {number}   period - Période (ex: 200)
 */
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(prices.length - period);
    return slice.reduce((acc, val) => acc + val, 0) / period;
}

/**
 * Pente de la MA sur les N dernières valeurs
 * @param {number[]} maHistory - Historique de valeurs MA
 * @param {number}   lookback  - Nombre de bougies en arrière (ex: 5)
 */
function calculateSlope(maHistory, lookback = 5) {
    if (maHistory.length <= lookback) return null;
    return maHistory[maHistory.length - 1] - maHistory[maHistory.length - 1 - lookback];
}

/**
 * Average True Range (ATR) — mesure la volatilité
 * @param {Object[]} candles - Tableau { high, low, close }
 * @param {number}   period  - Période classique : 14
 */
function calculateATR(candles, period = 14) {
    if (candles.length <= period) return null;

    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
        const { high, low } = candles[i];
        const prevClose = candles[i - 1].close;
        trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }

    const recent = trueRanges.slice(-period);
    return recent.reduce((acc, val) => acc + val, 0) / period;
}

/**
 * Momentum = rendement sur N bougies (fenêtre par actif)
 * Mesure la force de la tendance en % de variation
 * @param {number[]} prices - Tableau des prix de clôture
 * @param {number}   window - Nombre de bougies (BTC=120, ETH=90, SOL=60)
 */
function calculateMomentum(prices, window) {
    if (prices.length < window + 1) return null;
    const past    = prices[prices.length - 1 - window];
    const current = prices[prices.length - 1];
    if (past === 0) return null;
    return (current - past) / past; // rendement décimal, ex: 0.15 = +15%
}

// ─── SIGNAL PAR ACTIF ─────────────────────────────────────────────────────────

/**
 * Machine à États Triple pour un actif donné
 * @param {number} price    - Prix actuel
 * @param {number} ma200    - MA200 de l'actif
 * @param {number} slope    - Pente de la MA200 (sur 5 bougies)
 * @param {number} btcPrice - Prix du BTC (lighthouse)
 * @param {number} btcMa200 - MA200 du BTC
 */
function getSignal(price, ma200, slope, btcPrice, btcMa200) {
    const upperBuffer = ma200 * 1.01;
    const lowerBuffer = ma200 * 0.99;

    if (price > upperBuffer && slope > 0) return 'LONG';

    if (price < lowerBuffer && slope < 0 && btcPrice < btcMa200) return 'SHORT';

    return 'CASH';
}

/**
 * Taille de position (Dollar-based sizing, levier ~1x)
 *
 * 1. Montant en dollars à engager = capital x exposure
 * 2. Conversion en unités via le prix actuel
 *
 * LONG  : 80% du capital
 * SHORT : 40% du capital (position défensive)
 *
 * @param {number} capital - Capital disponible en USDC
 * @param {number} price   - Prix actuel de l actif
 * @param {string} mode    - LONG ou SHORT
 */
function calculatePositionSize(capital, price, mode) {
    const exposure         = mode === 'LONG' ? 0.80 : 0.40;
    const positionValueUSD = capital * exposure;
    return positionValueUSD / price;
}

// ─── RANKING MULTI-ACTIFS ─────────────────────────────────────────────────────

/**
 * Fenêtres momentum par actif (en nombre de bougies 8h)
 * BTC=120 bougies × 8h = 40 jours
 * ETH=90  bougies × 8h = 30 jours
 * SOL=60  bougies × 8h = 20 jours
 *
 * Note : Ces fenêtres sont volontairement asymétriques :
 *   - BTC : slow money, tendances longues → fenêtre large
 *   - SOL : volatile, retournements rapides → fenêtre courte
 */
const MOMENTUM_WINDOWS = {
    BTC: 120,
    ETH: 90,
    SOL: 60,
};

/**
 * Calcule le score de sélection d'un actif : momentum / ATR
 * Le momentum mesure la force de la tendance.
 * L'ATR normalise par la volatilité → on favorise les tendances fortes ET stables.
 *
 * @param {number} momentum - Rendement sur la fenêtre de l'actif (décimal)
 * @param {number} atr      - ATR de l'actif
 * @param {number} price    - Prix actuel (pour normaliser l'ATR en %)
 */
function _computeScore(momentum, atr, price) {
    const atrPct = atr / price; // ATR normalisé en % du prix
    if (atrPct === 0) return 0;
    return momentum / atrPct;
}

/**
 * Classe les actifs par score et retourne la liste triée (meilleur en premier).
 * Filtre les actifs sans données valides.
 *
 * @param {Object[]} assetsData - Tableau d'objets par actif :
 *   {
 *     coin:     string,   // ex: 'ETH'
 *     prices:   number[], // prix de clôture
 *     candles:  Object[], // { high, low, close }
 *     ma200:    number,
 *     atr:      number,
 *     slope:    number,
 *     signal:   string,   // 'LONG' | 'SHORT' | 'CASH'
 *   }
 * @returns {Object[]} Liste triée par score décroissant, avec score injecté
 */
function rankAssets(assetsData) {
    return assetsData
        .map(asset => {
            const window   = MOMENTUM_WINDOWS[asset.coin] || 90;
            const momentum = calculateMomentum(asset.prices, window);

            if (momentum === null || !asset.atr || !asset.ma200) {
                return { ...asset, momentum: null, score: -Infinity };
            }

            const currentPrice = asset.prices[asset.prices.length - 1];
            const score        = _computeScore(momentum, asset.atr, currentPrice);

            return { ...asset, momentum, score };
        })
        .filter(a => a.score !== -Infinity)
        .sort((a, b) => b.score - a.score);
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    calculateMA,
    calculateSlope,
    calculateATR,
    calculateMomentum,
    getSignal,
    calculatePositionSize,
    rankAssets,
    MOMENTUM_WINDOWS,
};