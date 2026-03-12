// api/portfolio.js — CommonJS
const { getState }      = require('../lib/sheets.js');
const { computeEquity } = require('../lib/portfolio.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const state = await getState();
    if (!state) return res.status(200).json({ initialized: false });
    const prices   = {};
    (state.last_signals_detail || []).forEach(s => { prices[s.asset] = s.price; });
    const equity   = computeEquity(state, prices);
    const invested = equity - (state.cash_usd || 0);
    const pnl      = equity - (state.start_cash || 500);
    return res.status(200).json({
      initialized       : true,
      total_equity      : parseFloat(equity.toFixed(2)),
      cash_usd          : parseFloat((state.cash_usd || 0).toFixed(2)),
      invested          : parseFloat(invested.toFixed(2)),
      start_cash        : state.start_cash || 500,
      pnl               : parseFloat(pnl.toFixed(2)),
      pnl_pct           : parseFloat((pnl / (state.start_cash || 500) * 100).toFixed(2)),
      cumulative_fees   : parseFloat((state.cumulative_fees || 0).toFixed(4)),
      dry_run           : state.dry_run !== false,
      last_rebalance    : state.last_rebalance_timestamp || null,
      positions         : state.positions || {},
      last_signals      : state.last_signals || {},
      current_drawdown  : state.current_drawdown || 0,
      max_drawdown_ever : state.max_drawdown_ever || 0,
    });
  } catch (e) {
    console.error('[portfolio] Error:', e.message, e.stack);
    return res.status(500).json({ error: e.message });
  }
};
