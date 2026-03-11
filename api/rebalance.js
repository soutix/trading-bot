// api/rebalance.js
// POST /api/rebalance
// Called by GitHub Actions cron every 8h, or manually from the dashboard.
// Runs the full strategy and executes trades if signals have changed.

import { getCandles, getSpotPrice, createMarketOrder } from '../lib/coinbase.js';
import { runStrategy, hasStrategyChanged }              from '../lib/strategy.js';
import { getState, setState, updateDashboard,
         appendTrade, appendSignals, appendLog }        from '../lib/sheets.js';
import { initState, computeRequiredTrades,
         applyPaperTrade, computeEquity }               from '../lib/portfolio.js';

// ─── CONFIG ───────────────────────────────────────────────────────────────────

function getConfig() {
  return {
    PRODUCT_IDS         : (process.env.PRODUCT_IDS || 'BTC-USD,ETH-USD').split(',').map(s => s.trim()),
    TREND_MA_DAYS       : parseInt(process.env.TREND_MA_DAYS)       || 200,
    MOMENTUM_DAYS       : parseInt(process.env.MOMENTUM_DAYS)       || 90,
    VOL_DAYS            : parseInt(process.env.VOL_DAYS)            || 20,
    TOP_K               : parseInt(process.env.TOP_K)               || 1,
    MIN_VOL_FLOOR       : parseFloat(process.env.MIN_VOL_FLOOR)     || 1e-6,
    MAX_GROSS_EXPOSURE  : parseFloat(process.env.MAX_GROSS_EXPOSURE)|| 0.8,
    FEE_TAKER_BPS       : parseInt(process.env.FEE_TAKER_BPS)       || 60,
    FEE_MAKER_BPS       : parseInt(process.env.FEE_MAKER_BPS)       || 40,
    SLIPPAGE_BPS        : parseInt(process.env.SLIPPAGE_BPS)        || 5,
    USE_TAKER_FEES      : process.env.USE_TAKER_FEES !== 'false',
    PAPER_START_CASH_USD: parseFloat(process.env.PAPER_START_CASH_USD) || 500.0,
    DRY_RUN             : process.env.DRY_RUN !== 'false',
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Verify cron secret (protect from random callers)
  const secret = req.headers['x-cron-secret'];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    // Also allow calls from the dashboard (no secret needed if CRON_SECRET not set)
    // Dashboard calls pass x-dashboard: true header instead
    const fromDashboard = req.headers['x-dashboard'] === 'true';
    if (!fromDashboard) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const runId = Date.now().toString(36).toUpperCase();
  const log   = (level, msg) => appendLog({ level, message: msg, run_id: runId });

  try {
    await log('INFO', `▶ Rebalance run started [${runId}]`);

    const config = getConfig();

    // 1. Load or initialize portfolio state
    let state = await getState();
    if (!state) {
      state = initState(config);
      await log('INFO', 'No existing state — initialized fresh portfolio');
    }

    // Override dry_run from env (env always wins)
    state.dry_run = config.DRY_RUN;

    // 2. Fetch candles for all assets
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

    if (Object.keys(candlesMap).length === 0) {
      await log('ERROR', 'No candles available — aborting');
      return res.status(500).json({ error: 'No market data available', action: 'ERROR' });
    }

    // 3. Run strategy
    const { signals, targets } = runStrategy(candlesMap, config);

    const topAsset = signals.find(s => s.selected);
    await log('INFO', topAsset
      ? `Signal: ${topAsset.asset} selected (mom=${(topAsset.momentum * 100).toFixed(1)}%, vol=${(topAsset.vol * 100).toFixed(1)}%)`
      : 'Signal: no eligible asset — 100% cash');

    signals.forEach(s => {
      const status = s.eligible ? (s.selected ? '✓ SELECTED' : 'eligible') : `✗ below MA${config.TREND_MA_DAYS}`;
      log('INFO', `  ${s.asset}: price=${s.price.toFixed(0)} MA200=${s.ma200?.toFixed(0)} → ${status}`);
    });

    // 4. Check if rebalance is needed
    const needsRebalance = hasStrategyChanged(state, targets, signals);

    if (!needsRebalance) {
      await log('INFO', 'No signal change detected — HOLD');
      await appendSignals(signals, new Date().toISOString());

      // Update state with latest signals even on HOLD
      state.last_signals = {
        top_asset : topAsset?.asset || null,
        timestamp : new Date().toISOString(),
      };
      await setState(state);
      await updateDashboard(state, signals);

      return res.status(200).json({ action: 'HOLD', signals, message: 'No signal change' });
    }

    await log('INFO', '⚡ Signal changed — executing rebalance');

    // 5. Get current prices
    const prices = {};
    for (const s of signals) prices[s.asset] = s.price;

    // 6. Compute required trades
    const requiredTrades = computeRequiredTrades(state, targets, prices, config);
    await log('INFO', `${requiredTrades.length} trade(s) required`);

    // 7. Execute trades
    const executedTrades = [];

    // SELLs first, then BUYs (free up cash before buying)
    const sorted = [
      ...requiredTrades.filter(t => t.side === 'SELL'),
      ...requiredTrades.filter(t => t.side === 'BUY'),
    ];

    for (const trade of sorted) {
      trade.comment = topAsset
        ? `Rebalance — ${topAsset.asset} top signal`
        : 'Rebalance — no eligible asset, moving to cash';

      if (state.dry_run) {
        // Paper trading
        const { newState, tradeRecord } = applyPaperTrade(state, trade, config);
        if (tradeRecord) {
          state = newState;
          executedTrades.push(tradeRecord);
          await log('INFO',
            `[PAPER] ${trade.side} ${trade.asset} qty=${tradeRecord.quantity} ` +
            `price=${tradeRecord.price} fee=${tradeRecord.fee}`);
        }
      } else {
        // Live trading
        try {
          const orderParams = trade.side === 'BUY'
            ? { quoteSize: Math.abs(trade.diffUSD) }
            : { baseSize : trade.currentUnits };

          const order = await createMarketOrder(trade.asset, trade.side, orderParams);
          await log('INFO', `[LIVE] Order placed: ${trade.side} ${trade.asset} orderId=${order.orderId}`);

          // For live, record a simplified trade (we don't have fill details immediately)
          executedTrades.push({
            timestamp : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            type      : trade.side,
            asset     : trade.asset,
            quantity  : 0, // filled later from order status
            price     : trade.price,
            notional  : Math.abs(trade.diffUSD),
            fee       : 0,
            slippage  : 0,
            cash_before: state.cash_usd,
            cash_after : 0,
            equity_before: computeEquity(state, prices),
            equity_after: 0,
            pnl        : 0,
            comment    : trade.comment,
          });
        } catch (e) {
          await log('ERROR', `Failed to place ${trade.side} ${trade.asset}: ${e.message}`);
        }
      }
    }

    // 8. Update state
    state.last_signals = {
      top_asset : topAsset?.asset || null,
      timestamp : new Date().toISOString(),
    };
    state.last_rebalance_timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    await setState(state);

    // 9. Write to Sheets
    for (const t of executedTrades) await appendTrade(t);
    await appendSignals(signals, new Date().toISOString());
    await updateDashboard(state, signals);
    await log('INFO', `✅ Rebalance complete — ${executedTrades.length} trade(s) executed`);

    return res.status(200).json({
      action : 'REBALANCE',
      trades : executedTrades,
      signals,
      runId,
    });

  } catch (e) {
    await log('ERROR', `Unhandled error: ${e.message}`).catch(() => {});
    console.error(e);
    return res.status(500).json({ error: e.message, action: 'ERROR' });
  }
}
