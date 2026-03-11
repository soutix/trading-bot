// api/rebalance.js — CommonJS
const { getCandles, createMarketOrder }              = require('../lib/coinbase.js');
const { runStrategy, hasStrategyChanged,
        checkStopLoss, checkAntiWhipsaw }             = require('../lib/strategy.js');
const { getState, setState, updateDashboard,
        appendTrade, appendSignals, appendLog,
        appendEquityHistory }                         = require('../lib/sheets.js');
const { initState, computeRequiredTrades,
        applyPaperTrade, computeEquity,
        updateDrawdown }                              = require('../lib/portfolio.js');
const { alertRebalance, alertStopLoss, alertError }  = require('../lib/telegram.js');

function getConfig() {
  return {
    PRODUCT_IDS          : (process.env.PRODUCT_IDS||'BTC-USD,ETH-USD,SOL-USD').split(',').map(s=>s.trim()),
    TREND_MA_DAYS        : parseInt(process.env.TREND_MA_DAYS)||200,
    MOMENTUM_DAYS        : parseInt(process.env.MOMENTUM_DAYS)||90,
    VOL_DAYS             : parseInt(process.env.VOL_DAYS)||20,
    TOP_K                : parseInt(process.env.TOP_K)||1,
    MIN_VOL_FLOOR        : parseFloat(process.env.MIN_VOL_FLOOR)||1e-6,
    MAX_GROSS_EXPOSURE   : parseFloat(process.env.MAX_GROSS_EXPOSURE)||0.8,
    FEE_TAKER_BPS        : parseInt(process.env.FEE_TAKER_BPS)||60,
    FEE_MAKER_BPS        : parseInt(process.env.FEE_MAKER_BPS)||40,
    SLIPPAGE_BPS         : parseInt(process.env.SLIPPAGE_BPS)||5,
    USE_TAKER_FEES       : process.env.USE_TAKER_FEES!=='false',
    PAPER_START_CASH_USD : parseFloat(process.env.PAPER_START_CASH_USD)||500.0,
    DRY_RUN              : process.env.DRY_RUN!=='false',
    STOP_LOSS_PCT        : parseFloat(process.env.STOP_LOSS_PCT)||0.08,
    ANTI_WHIPSAW_HOURS   : parseInt(process.env.ANTI_WHIPSAW_HOURS)||24,
  };
}

module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='POST') return res.status(405).json({error:'POST only'});

  const secret        = req.headers['x-cron-secret'];
  const fromDashboard = req.headers['x-dashboard']==='true';
  if (process.env.CRON_SECRET && secret!==process.env.CRON_SECRET && !fromDashboard)
    return res.status(401).json({error:'Unauthorized'});

  const runId = Date.now().toString(36).toUpperCase();
  const log   = (level, msg) => appendLog({level, message:msg, run_id:runId});

  try {
    await log('INFO', `▶ Rebalance run started [${runId}]`);
    const config = getConfig();

    let state = await getState();
    if (!state) {
      state = initState(config);
      await log('INFO', 'No existing state — initialized fresh portfolio');
    }
    state.dry_run = config.DRY_RUN;

    // ── 1. FETCH CANDLES ───────────────────────────────────────────────────────
    await log('INFO', `Fetching candles for: ${config.PRODUCT_IDS.join(', ')}`);
    const candlesMap = {};
    for (const asset of config.PRODUCT_IDS) {
      try {
        candlesMap[asset] = await getCandles(asset, 210);
        await log('INFO', `${asset}: ${candlesMap[asset].length} candles loaded`);
      } catch (e) {
        await log('WARN', `Failed to fetch candles for ${asset}: ${e.message}`);
      }
    }
    if (Object.keys(candlesMap).length===0) {
      await log('ERROR', 'No candles available — aborting');
      await alertError('No market data available — rebalance aborted').catch(()=>{});
      return res.status(500).json({error:'No market data available', action:'ERROR'});
    }

    // ── 2. RUN STRATEGY ────────────────────────────────────────────────────────
    const { signals, targets } = runStrategy(candlesMap, config);
    const topSignal = signals.find(s=>s.selected);
    await log('INFO', topSignal
      ? `Signal: ${topSignal.asset} selected (mom=${(topSignal.momentum*100).toFixed(1)}%)`
      : 'Signal: no eligible asset — 100% cash');

    const prices = {};
    signals.forEach(s => { prices[s.asset] = s.price; });

    // ── 3. CHECK STOP LOSS ─────────────────────────────────────────────────────
    const stopLossTriggers = checkStopLoss(state, prices, config.STOP_LOSS_PCT);
    const executedTrades   = [];

    for (const sl of stopLossTriggers) {
      await log('WARN', `🛑 STOP LOSS triggered: ${sl.asset} — loss ${(sl.loss*100).toFixed(1)}%`);
      const slTrade = {
        asset: sl.asset, side: 'SELL', price: sl.price,
        diffUSD: -(state.positions[sl.asset].units * sl.price),
        currentUnits: state.positions[sl.asset].units,
        currentValue: state.positions[sl.asset].units * sl.price,
        targetValue: 0, targetWeight: 0, comment: 'STOP LOSS',
      };
      if (state.dry_run) {
        const { newState, tradeRecord } = applyPaperTrade(state, slTrade, config);
        if (tradeRecord) { state = newState; executedTrades.push(tradeRecord); }
      } else {
        await createMarketOrder(sl.asset, 'SELL', { baseSize: state.positions[sl.asset].units });
        if (state.positions[sl.asset]) delete state.positions[sl.asset];
      }
      const equity = computeEquity(state, prices);
      await alertStopLoss({ asset: sl.asset, price: sl.price, loss: sl.loss, equity, dryRun: state.dry_run }).catch(()=>{});
    }

    // ── 4. CHECK SIGNAL CHANGE ─────────────────────────────────────────────────
    state.last_signals_detail = signals;
    const needsRebalance = hasStrategyChanged(state, targets, signals);

    if (!needsRebalance && stopLossTriggers.length === 0) {
      await log('INFO', 'No signal change — HOLD');
      await appendSignals(signals, new Date().toISOString());
      state.last_signals = { top_asset: topSignal?.asset||null, timestamp: new Date().toISOString() };
      const equity = computeEquity(state, prices);
      updateDrawdown(state, equity);
      await setState(state);
      await updateDashboard(state, signals);
      await appendEquityHistory({ timestamp: new Date().toISOString().replace('T',' ').slice(0,19)+' UTC',
        equity, cash: state.cash_usd, invested: equity - state.cash_usd,
        top_asset: topSignal?.asset||'CASH', drawdown: state.current_drawdown });
      return res.status(200).json({action:'HOLD', signals, message:'No signal change'});
    }

    // ── 5. EXECUTE REBALANCE ───────────────────────────────────────────────────
    if (needsRebalance) await log('INFO', '⚡ Signal changed — executing rebalance');
    const requiredTrades = computeRequiredTrades(state, targets, prices);
    const sorted         = [
      ...requiredTrades.filter(t=>t.side==='SELL'),
      ...requiredTrades.filter(t=>t.side==='BUY'),
    ];

    for (const trade of sorted) {
      // Anti-whipsaw check
      if (checkAntiWhipsaw(state, trade.asset, config.ANTI_WHIPSAW_HOURS)) {
        await log('WARN', `Anti-whipsaw: skipping ${trade.side} ${trade.asset} (traded <${config.ANTI_WHIPSAW_HOURS}h ago)`);
        continue;
      }
      trade.comment = topSignal ? `Rebalance → ${topSignal.asset}` : 'Rebalance → CASH';

      if (state.dry_run) {
        const { newState, tradeRecord } = applyPaperTrade(state, trade, config);
        if (tradeRecord) { state = newState; executedTrades.push(tradeRecord); }
      } else {
        try {
          const params = trade.side==='BUY'
            ? {quoteSize: Math.abs(trade.diffUSD)}
            : {baseSize:  trade.currentUnits};
          await createMarketOrder(trade.asset, trade.side, params);
          executedTrades.push({ timestamp: new Date().toISOString(), type: trade.side,
            asset: trade.asset, price: trade.price, notional: Math.abs(trade.diffUSD),
            quantity:0, fee:0, slippage:0, pnl:0, comment: trade.comment,
            cash_before: state.cash_usd, cash_after:0, equity_before:0, equity_after:0 });
        } catch (e) {
          await log('ERROR', `Order failed ${trade.side} ${trade.asset}: ${e.message}`);
        }
      }
    }

    // Send Telegram alert for each trade
    const equity = computeEquity(state, prices);
    for (const t of executedTrades) {
      await alertRebalance({ action:'REBALANCE', asset:t.asset, side:t.type,
        price:t.price, notional:t.notional, equity, dryRun:state.dry_run }).catch(()=>{});
    }

    // ── 6. SAVE STATE ──────────────────────────────────────────────────────────
    state.last_signals = { top_asset: topSignal?.asset||null, timestamp: new Date().toISOString() };
    state.last_signals_detail = signals;
    state.last_rebalance_timestamp = new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';
    updateDrawdown(state, equity);
    await setState(state);
    for (const t of executedTrades) await appendTrade(t);
    await appendSignals(signals, new Date().toISOString());
    await updateDashboard(state, signals);
    await appendEquityHistory({
      timestamp: new Date().toISOString().replace('T',' ').slice(0,19)+' UTC',
      equity, cash: state.cash_usd, invested: equity - state.cash_usd,
      top_asset: topSignal?.asset||'CASH', drawdown: state.current_drawdown,
    });
    await log('INFO', `✅ Rebalance complete — ${executedTrades.length} trade(s)`);

    return res.status(200).json({action:'REBALANCE', trades:executedTrades, signals, runId});
  } catch (e) {
    console.error('[rebalance] Error:', e.message, e.stack);
    await appendLog({level:'ERROR', message:`Unhandled error: ${e.message}`}).catch(()=>{});
    await alertError(`Unhandled error: ${e.message}`).catch(()=>{});
    return res.status(500).json({error: e.message, action:'ERROR'});
  }
};
