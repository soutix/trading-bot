// api/backtest.js — CommonJS
const { getCandlesLong } = require('../lib/coinbase.js');
const { runStrategy }    = require('../lib/strategy.js');
const { initState, computeEquity, computeRequiredTrades, applyPaperTrade } = require('../lib/portfolio.js');

module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='POST') return res.status(405).json({error:'POST only'});

  const {
    assets        = ['BTC-USD','ETH-USD','SOL-USD'],
    trendMaDays   = 200, momentumDays  = 90,
    volDays       = 20,  topK          = 1,
    maxExposure   = 0.8, startCash     = 500,
    numDays       = 500,
  } = req.body || {};

  try {
    // Fetch candles for all assets
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

    // Find the min number of candles available across all assets
    const minLen = Math.min(...Object.values(candlesMap).map(c => c.length));
    // Trim all to same length
    Object.keys(candlesMap).forEach(k => {
      candlesMap[k] = candlesMap[k].slice(-minLen);
    });

    const config = {
      TREND_MA_DAYS: trendMaDays, MOMENTUM_DAYS: momentumDays,
      VOL_DAYS: volDays, TOP_K: topK, MAX_GROSS_EXPOSURE: maxExposure,
      MIN_VOL_FLOOR: 1e-6, FEE_TAKER_BPS: 60, FEE_MAKER_BPS: 40,
      SLIPPAGE_BPS: 5, USE_TAKER_FEES: true, DRY_RUN: true,
    };

    let state           = initState({ PAPER_START_CASH_USD: startCash, DRY_RUN: true });
    const equityCurve   = [];
    const tradesLog     = [];
    const WARMUP        = Math.max(trendMaDays, momentumDays) + 5;

    // BTC buy-and-hold reference
    const btcAsset      = assets.find(a => a.startsWith('BTC')) || assets[0];
    const btcCandles    = candlesMap[btcAsset] || [];
    const btcStartPrice = btcCandles[WARMUP]?.close || 1;

    for (let i = WARMUP; i < minLen; i++) {
      // Build slice up to day i
      const sliceMap = {};
      Object.keys(candlesMap).forEach(k => {
        sliceMap[k] = candlesMap[k].slice(0, i + 1);
      });

      const { signals, targets } = runStrategy(sliceMap, config);
      const prices = {};
      signals.forEach(s => { prices[s.asset] = s.price; });

      const requiredTrades = computeRequiredTrades(state, targets, prices);
      const sorted         = [
        ...requiredTrades.filter(t=>t.side==='SELL'),
        ...requiredTrades.filter(t=>t.side==='BUY'),
      ];

      for (const trade of sorted) {
        trade.comment = 'backtest';
        const { newState, tradeRecord } = applyPaperTrade(state, trade, config);
        if (tradeRecord) { state = newState; tradesLog.push(tradeRecord); }
      }

      const equity    = computeEquity(state, prices);
      const topSignal = signals.find(s => s.selected);
      const btcPrice  = candlesMap[btcAsset][i]?.close || btcStartPrice;
      const btcBH     = startCash * (btcPrice / btcStartPrice);
      const date      = new Date(candlesMap[btcAsset][i].timestamp * 1000).toISOString().slice(0,10);

      // Track drawdown
      state.max_equity_ever  = Math.max(state.max_equity_ever || startCash, equity);
      state.current_drawdown = state.max_equity_ever > 0 ? (equity - state.max_equity_ever) / state.max_equity_ever : 0;
      state.max_drawdown_ever = Math.min(state.max_drawdown_ever || 0, state.current_drawdown);

      equityCurve.push({
        date, equity: parseFloat(equity.toFixed(2)),
        btcBH: parseFloat(btcBH.toFixed(2)),
        cash: parseFloat(state.cash_usd.toFixed(2)),
        invested: parseFloat((equity - state.cash_usd).toFixed(2)),
        topAsset: topSignal?.asset || 'CASH',
        drawdown: parseFloat((state.current_drawdown * 100).toFixed(2)),
      });
    }

    const finalEquity   = equityCurve[equityCurve.length - 1]?.equity || startCash;
    const finalBtcBH    = equityCurve[equityCurve.length - 1]?.btcBH  || startCash;
    const totalReturn   = (finalEquity - startCash) / startCash * 100;
    const btcReturn     = (finalBtcBH  - startCash) / startCash * 100;
    const maxDD         = Math.min(...equityCurve.map(e => e.drawdown));
    const numTrades     = tradesLog.length;
    const annualFactor  = 365 / (equityCurve.length || 365);
    const cagr          = (Math.pow(finalEquity / startCash, annualFactor) - 1) * 100;

    // Sharpe ratio (simplified, daily returns)
    const returns = equityCurve.slice(1).map((e,i) =>
      (e.equity - equityCurve[i].equity) / equityCurve[i].equity);
    const meanR  = returns.reduce((s,r)=>s+r,0) / (returns.length||1);
    const stdR   = Math.sqrt(returns.reduce((s,r)=>s+(r-meanR)**2,0) / (returns.length||1));
    const sharpe = stdR > 0 ? parseFloat(((meanR / stdR) * Math.sqrt(252)).toFixed(2)) : 0;

    return res.status(200).json({
      summary: {
        startCash, finalEquity: parseFloat(finalEquity.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        btcReturn: parseFloat(btcReturn.toFixed(2)),
        cagr: parseFloat(cagr.toFixed(2)),
        sharpe, maxDrawdown: parseFloat(maxDD.toFixed(2)),
        numTrades, days: equityCurve.length,
        params: { trendMaDays, momentumDays, volDays, topK, maxExposure, assets },
      },
      equityCurve,
      trades: tradesLog.slice(-50), // last 50 trades
    });
  } catch (e) {
    console.error('[backtest] Error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
