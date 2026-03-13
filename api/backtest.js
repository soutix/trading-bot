// api/backtest.js — CommonJS
const { getCandlesLong }  = require('../lib/coinbase.js');
const { runStrategy, checkStopLoss, checkTrailingStop } = require('../lib/strategy.js');
const { initState, computeEquity, computeRequiredTrades,
        applyPaperTrade, updatePositionHighs }          = require('../lib/portfolio.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'POST only' });

  const {
    assets               = ['BTC-USD', 'ETH-USD', 'SOL-USD'],
    trendMaDays          = 200,
    // Momentum calibré par asset
    momentumDaysBtc      = 120,
    momentumDaysEth      = 90,
    momentumDaysSol      = 60,
    volDays              = 20,
    atrDays              = 14,
    atrMultiplier        = 2,
    topK                 = 1,
    maxExposure          = 0.8,
    startCash            = 500,
    numDays              = 500,
    // Trailing stop
    trailingStopActivation = 0.20,
    trailingStopPct        = 0.10,
  } = req.body || {};

  try {
    const candlesMap = {};
    for (const asset of assets) {
      try {
        candlesMap[asset] = await getCandlesLong(asset, numDays);
      } catch (e) {
        console.warn(`[backtest] Failed to fetch ${asset}: ${e.message}`);
      }
    }
    if (Object.keys(candlesMap).length === 0)
      return res.status(500).json({ error: 'No market data available' });

    const minLen = Math.min(...Object.values(candlesMap).map(c => c.length));
    Object.keys(candlesMap).forEach(k => { candlesMap[k] = candlesMap[k].slice(-minLen); });

    const config = {
      TREND_MA_DAYS            : trendMaDays,
      MOMENTUM_DAYS_BTC        : momentumDaysBtc,
      MOMENTUM_DAYS_ETH        : momentumDaysEth,
      MOMENTUM_DAYS_SOL        : momentumDaysSol,
      VOL_DAYS                 : volDays,
      ATR_DAYS                 : atrDays,
      ATR_MULTIPLIER           : atrMultiplier,
      TOP_K                    : topK,
      MAX_GROSS_EXPOSURE       : maxExposure,
      MIN_VOL_FLOOR            : 1e-6,
      // Frais simulés à 40bps (équivalent maker) — taker réel serait 60bps
      FEE_TAKER_BPS            : 40,
      FEE_MAKER_BPS            : 25,
      SLIPPAGE_BPS             : 5,
      USE_TAKER_FEES           : true,
      DRY_RUN                  : true,
      STOP_LOSS_PCT            : 0.08,
      TRAILING_STOP_ACTIVATION : trailingStopActivation,
      TRAILING_STOP_PCT        : trailingStopPct,
    };

    let state         = initState({ PAPER_START_CASH_USD: startCash, DRY_RUN: true });
    const equityCurve = [];
    const tradesLog   = [];
    const WARMUP      = Math.max(trendMaDays, momentumDaysBtc, momentumDaysEth, momentumDaysSol) + 5;

    const btcAsset      = assets.find(a => a.startsWith('BTC')) || assets[0];
    const btcStartPrice = candlesMap[btcAsset]?.[WARMUP]?.close || 1;

    for (let i = WARMUP; i < minLen; i++) {
      const sliceMap = {};
      Object.keys(candlesMap).forEach(k => { sliceMap[k] = candlesMap[k].slice(0, i + 1); });

      const { signals, targets } = runStrategy(sliceMap, config);
      const prices = {};
      signals.forEach(s => { prices[s.asset] = s.price; });

      // Mettre à jour les plus hauts (trailing stop)
      updatePositionHighs(state, prices);

      // Check stop-loss ATR
      const stopTriggers = checkStopLoss(state, prices, config);
      for (const sl of stopTriggers) {
        const pos = state.positions[sl.asset];
        if (!pos) continue;
        const slTrade = {
          asset: sl.asset, side: 'SELL', price: sl.price,
          diffUSD: -(pos.units * sl.price), currentUnits: pos.units,
          currentValue: pos.units * sl.price, targetValue: 0, targetWeight: 0,
          comment: sl.stopType,
        };
        const { newState, tradeRecord } = applyPaperTrade(state, slTrade, config);
        if (tradeRecord) { state = newState; tradesLog.push(tradeRecord); }
        targets[sl.asset] = 0;
      }

      // Check trailing stop
      const trailingTriggers = checkTrailingStop(state, prices, config);
      for (const tt of trailingTriggers) {
        const pos = state.positions[tt.asset];
        if (!pos) continue;
        const tTrade = {
          asset: tt.asset, side: 'SELL', price: tt.price,
          diffUSD: -(pos.units * tt.price), currentUnits: pos.units,
          currentValue: pos.units * tt.price, targetValue: 0, targetWeight: 0,
          comment: 'TRAILING_STOP',
        };
        const { newState, tradeRecord } = applyPaperTrade(state, tTrade, config);
        if (tradeRecord) { state = newState; tradesLog.push(tradeRecord); }
        targets[tt.asset] = 0;
      }

      // Rebalance normal
      const requiredTrades = computeRequiredTrades(state, targets, prices);
      const sorted = [
        ...requiredTrades.filter(t => t.side === 'SELL'),
        ...requiredTrades.filter(t => t.side === 'BUY'),
      ];

      for (const trade of sorted) {
        trade.comment = 'backtest';
        // Stocker ATR pour le stop-loss dynamique
        if (trade.side === 'BUY') {
          const sig = signals.find(s => s.asset === trade.asset);
          trade.atr = sig?.atr || null;
        }
        const { newState, tradeRecord } = applyPaperTrade(state, trade, config);
        if (tradeRecord) { state = newState; tradesLog.push(tradeRecord); }
      }

      const equity    = computeEquity(state, prices);
      const topSignal = signals.find(s => s.selected);
      const btcPrice  = candlesMap[btcAsset][i]?.close || btcStartPrice;
      const btcBH     = startCash * (btcPrice / btcStartPrice);
      const date      = new Date(candlesMap[btcAsset][i].timestamp * 1000).toISOString().slice(0, 10);

      state.max_equity_ever   = Math.max(state.max_equity_ever || startCash, equity);
      state.current_drawdown  = state.max_equity_ever > 0
        ? (equity - state.max_equity_ever) / state.max_equity_ever : 0;
      state.max_drawdown_ever = Math.min(state.max_drawdown_ever || 0, state.current_drawdown);

      equityCurve.push({
        date,
        equity   : parseFloat(equity.toFixed(2)),
        btcBH    : parseFloat(btcBH.toFixed(2)),
        cash     : parseFloat(state.cash_usd.toFixed(2)),
        invested : parseFloat((equity - state.cash_usd).toFixed(2)),
        topAsset : topSignal?.asset || 'CASH',
        drawdown : parseFloat((state.current_drawdown * 100).toFixed(2)),
      });
    }

    const finalEquity = equityCurve[equityCurve.length - 1]?.equity || startCash;
    const finalBtcBH  = equityCurve[equityCurve.length - 1]?.btcBH  || startCash;
    const totalReturn = (finalEquity - startCash) / startCash * 100;
    const btcReturn   = (finalBtcBH  - startCash) / startCash * 100;
    const maxDD       = equityCurve.length > 0 ? Math.min(...equityCurve.map(e => e.drawdown)) : 0;
    const annualFactor = 365 / (equityCurve.length || 365);
    const cagr        = (Math.pow(finalEquity / startCash, annualFactor) - 1) * 100;

    const returns = equityCurve.slice(1).map((e, i) =>
      (e.equity - equityCurve[i].equity) / equityCurve[i].equity);
    const meanR  = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
    const stdR   = Math.sqrt(returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (returns.length || 1));
    const sharpe = stdR > 0 ? parseFloat(((meanR / stdR) * Math.sqrt(252)).toFixed(2)) : 0;

    return res.status(200).json({
      summary: {
        startCash, finalEquity: parseFloat(finalEquity.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        btcReturn  : parseFloat(btcReturn.toFixed(2)),
        cagr       : parseFloat(cagr.toFixed(2)),
        sharpe, maxDrawdown: parseFloat(maxDD.toFixed(2)),
        numTrades  : tradesLog.length,
        days       : equityCurve.length,
        params     : { trendMaDays, momentumDaysBtc, momentumDaysEth, momentumDaysSol,
                       volDays, atrDays, atrMultiplier, topK, maxExposure, assets,
                       trailingStopActivation, trailingStopPct },
      },
      equityCurve,
      trades: tradesLog.slice(-50),
    });
  } catch (e) {
    console.error('[backtest] Error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
