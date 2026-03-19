/**
 * api/signals.js — Indicateurs live pour le dashboard
 * Calcule ATR(14) et ranking momentum ETH/SOL sans toucher à l'état du bot.
 * Appelé en parallèle de /api/portfolio par le frontend.
 */

const { getAssetPrice } = require('../lib/hyperliquid.js');
const { getCandles }    = require('../lib/market.js');
const {
    calculateMA,
    calculateSlope,
    calculateATR,
    rankAssets,
    MOMENTUM_WINDOWS,
} = require('../lib/strategy.js');

const TRADABLE = ['ETH', 'SOL'];
const LIGHTHOUSE = 'BTC';

module.exports = async function handler(req, res) {
    try {
        const allCoins = [LIGHTHOUSE, ...TRADABLE];

        // Récupération bougies + prix en parallèle
        const [candlesResults, pricesResults] = await Promise.all([
            Promise.all(allCoins.map(coin => getCandles(coin).catch(() => null))),
            Promise.all(allCoins.map(coin => getAssetPrice(coin).catch(() => null))),
        ]);

        const candlesMap = {};
        const pricesMap  = {};
        allCoins.forEach((coin, i) => {
            candlesMap[coin] = candlesResults[i];
            pricesMap[coin]  = pricesResults[i];
        });

        // BTC lighthouse
        const btcCandles = candlesMap[LIGHTHOUSE];
        const btcPrice   = pricesMap[LIGHTHOUSE];
        const btcMa200   = btcCandles ? calculateMA(btcCandles.map(c => c.close), 200) : null;
        const btcBullish = btcPrice != null && btcMa200 != null ? btcPrice > btcMa200 : null;

        // Indicateurs par actif tradable
        const assetsData = TRADABLE.map(coin => {
            const candles = candlesMap[coin];
            const price   = pricesMap[coin];
            if (!candles || !price) return null;

            const prices = candles.map(c => c.close);
            const atr    = calculateATR(candles, 14);
            const ma200  = calculateMA(prices, 200);

            const maHistory = [];
            for (let i = prices.length - 6; i <= prices.length - 1; i++) {
                maHistory.push(calculateMA(prices.slice(0, i + 1), 200));
            }
            const slope = calculateSlope(maHistory, 5);

            return { coin, candles, prices, atr, ma200, slope, signal: 'CASH' };
        }).filter(Boolean);

        // Ranking
        const ranked = rankAssets(assetsData);

        // ATR de l'actif actif (premier du ranking ou actif avec le meilleur score)
        const atrByAsset = {};
        assetsData.forEach(a => { if (a.atr) atrByAsset[a.coin] = a.atr; });

        const ranking = ranked.map(a => ({
            symbol: a.coin,
            score:  a.score,
            atr:    a.atr,
            ma200:  a.ma200,
        }));

        res.status(200).json({
            signals:    [],        // rétrocompatibilité avec l'ancien stub
            ranking,
            atrByAsset,
            btcBullish,
            btcPrice,
            btcMa200,
            candlesETH: candlesMap['ETH'] ? candlesMap['ETH'].slice(-60) : [],
            candlesSOL: candlesMap['SOL'] ? candlesMap['SOL'].slice(-60) : [],
            computedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('❌ Erreur API Signals:', error.message);
        res.status(500).json({ error: error.message });
    }
};