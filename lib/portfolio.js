/*Mais je vais être très franc avec toi : oui, tu peux (et tu dois) te débarrasser de tout ce code pour la V2. Voici pourquoi, pour que tu comprennes bien la logique de notre nouvelle architecture.

Pourquoi lib/portfolio.js est devenu obsolète
En lisant ton code, on comprend exactement ce qu'il fait : c'est un simulateur d'échange (Exchange Simulator).*/ 

// lib/portfolio.js — CommonJS

function initState(config = {}) {
  const now = new Date().toISOString();
  return {
    cash_usd: config.PAPER_START_CASH_USD ?? 500.0,
    start_cash: config.PAPER_START_CASH_USD ?? 500.0,
    positions: {},
    cumulative_fees: 0.0,
    cumulative_slippage: 0.0,
    dry_run: config.DRY_RUN !== false,
    last_signals: {},
    last_signals_detail: [],
    last_trade_times: {},
    max_equity_ever: config.PAPER_START_CASH_USD ?? 500.0,
    max_drawdown_ever: 0,
    current_drawdown: 0,
    last_rebalance_timestamp: null,
    initialized_at: now,
    updated_at: now,
  };
}

function computeEquity(state, prices = {}) {
  const invested = Object.entries(state.positions || {}).reduce((sum, [asset, pos]) =>
    sum + pos.units * (prices[asset] || pos.avg_price || 0), 0);
  return (state.cash_usd || 0) + invested;
}

function updateDrawdown(state, equity) {
  state.max_equity_ever   = Math.max(state.max_equity_ever || state.start_cash, equity);
  state.current_drawdown  = state.max_equity_ever > 0
    ? (equity - state.max_equity_ever) / state.max_equity_ever : 0;
  state.max_drawdown_ever = Math.min(state.max_drawdown_ever || 0, state.current_drawdown);
}

// Met à jour le plus haut prix vu depuis l'entrée (utilisé par le trailing stop)
function updatePositionHighs(state, prices) {
  for (const [asset, pos] of Object.entries(state.positions || {})) {
    const price = prices[asset];
    if (price && price > (pos.position_high || 0)) {
      pos.position_high = price;
    }
  }
}

function computeRequiredTrades(state, targets, prices) {
  const MIN_TRADE_USD = 5;
  const totalEquity   = computeEquity(state, prices);
  const trades        = [];
  const allAssets     = new Set([...Object.keys(state.positions || {}), ...Object.keys(targets)]);
  for (const asset of allAssets) {
    const price        = prices[asset]; if (!price) continue;
    const currentUnits = state.positions?.[asset]?.units || 0;
    const currentValue = currentUnits * price;
    const targetValue  = totalEquity * (targets[asset] || 0);
    const diff         = targetValue - currentValue;
    if (Math.abs(diff) < MIN_TRADE_USD) continue;
    trades.push({ asset, side: diff > 0 ? 'BUY' : 'SELL', diffUSD: diff,
      price, currentUnits, currentValue, targetValue, targetWeight: targets[asset] || 0 });
  }
  return trades;
}

function applyPaperTrade(state, trade, config) {
  const { FEE_TAKER_BPS = 40, SLIPPAGE_BPS = 5, USE_TAKER_FEES = true, FEE_MAKER_BPS = 25 } = config;
  // Note: FEE_TAKER_BPS par defaut a 40 (0.4%) — equivalent maker simulé
  // Pour passer aux vrais ordres limite maker (0.25%), implémenter createLimitOrder dans coinbase.js
  const feeRate  = (USE_TAKER_FEES ? FEE_TAKER_BPS : FEE_MAKER_BPS) / 10000;
  const slipRate = SLIPPAGE_BPS / 10000;
  const newState = JSON.parse(JSON.stringify(state));
  const { asset, side, price } = trade;
  let fee = 0, slippage = 0, units = 0, notional = 0;

  if (side === 'BUY') {
    const budget    = Math.abs(trade.diffUSD);
    const slipPrice = price * (1 + slipRate);
    notional        = budget / (1 + feeRate);
    fee             = notional * feeRate;
    slippage        = notional * slipRate;
    units           = (notional - slippage) / slipPrice;
    newState.cash_usd -= budget;

    if (!newState.positions[asset])
      newState.positions[asset] = { units: 0, avg_price: slipPrice, entry_price: price,
        weight: 0, position_high: price, atr_at_entry: null };

    const prev       = newState.positions[asset];
    const totalCost  = prev.units * prev.avg_price + notional;
    prev.units      += units;
    prev.avg_price   = prev.units > 0 ? totalCost / prev.units : slipPrice;
    prev.entry_price = prev.entry_price || price;
    prev.weight      = trade.targetWeight;

    // Stocker ATR au moment de l'entrée (pour stop-loss dynamique)
    if (trade.atr) prev.atr_at_entry = trade.atr;

    // Initialiser le plus haut (pour trailing stop)
    if (!prev.position_high || price > prev.position_high) prev.position_high = price;

    if (!newState.last_trade_times) newState.last_trade_times = {};
    newState.last_trade_times[asset] = new Date().toISOString();

  } else {
    const pos = newState.positions[asset];
    if (!pos || pos.units <= 0) return { newState, tradeRecord: null };
    const slipPrice = price * (1 - slipRate);
    units           = Math.min(Math.abs(trade.diffUSD) / price, pos.units);
    notional        = units * slipPrice;
    fee             = notional * feeRate;
    slippage        = units * price * slipRate;
    newState.cash_usd += notional - fee;
    pos.units         -= units;
    if (!newState.last_trade_times) newState.last_trade_times = {};
    newState.last_trade_times[asset] = new Date().toISOString();
    if (pos.units < 1e-8) delete newState.positions[asset];
    else pos.weight = trade.targetWeight;
  }

  newState.cumulative_fees     += fee;
  newState.cumulative_slippage += slippage;
  newState.updated_at           = new Date().toISOString();

  const tradeRecord = {
    timestamp   : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    type        : side, asset,
    quantity    : parseFloat(units.toFixed(8)),
    price       : parseFloat(price.toFixed(2)),
    notional    : parseFloat(notional.toFixed(2)),
    fee         : parseFloat(fee.toFixed(4)),
    slippage    : parseFloat(slippage.toFixed(4)),
    cash_before : parseFloat(state.cash_usd.toFixed(2)),
    cash_after  : parseFloat(newState.cash_usd.toFixed(2)),
    equity_before: parseFloat(computeEquity(state,  { [asset]: price }).toFixed(2)),
    equity_after : parseFloat(computeEquity(newState,{ [asset]: price }).toFixed(2)),
    pnl         : side === 'SELL' && state.positions?.[asset]
      ? parseFloat(((price - state.positions[asset].avg_price) * units).toFixed(2)) : 0,
    comment     : trade.comment || '',
  };
  return { newState, tradeRecord };
}

module.exports = {
  initState, computeEquity, updateDrawdown,
  updatePositionHighs,
  computeRequiredTrades, applyPaperTrade,
};
