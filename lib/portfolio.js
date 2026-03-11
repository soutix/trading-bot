// lib/portfolio.js
// Manages portfolio state transitions (paper + live)

const DEFAULT_STATE = {
  cash_usd                 : 500.0,
  start_cash               : 500.0,
  positions                : {},        // { "BTC-USD": { units, avg_price, weight } }
  cumulative_fees          : 0.0,
  cumulative_slippage      : 0.0,
  dry_run                  : true,
  last_signals             : {},
  last_rebalance_timestamp : null,
  initialized_at           : null,
  updated_at               : null,
};

// ─── STATE ────────────────────────────────────────────────────────────────────

export function initState(config = {}) {
  const now = new Date().toISOString();
  return {
    ...DEFAULT_STATE,
    cash_usd       : config.PAPER_START_CASH_USD ?? 500.0,
    start_cash     : config.PAPER_START_CASH_USD ?? 500.0,
    dry_run        : config.DRY_RUN !== false,
    initialized_at : now,
    updated_at     : now,
  };
}

// ─── EQUITY ───────────────────────────────────────────────────────────────────

export function computeEquity(state, prices = {}) {
  const invested = Object.entries(state.positions || {}).reduce((sum, [asset, pos]) => {
    const price = prices[asset] || pos.avg_price || 0;
    return sum + pos.units * price;
  }, 0);
  return state.cash_usd + invested;
}

// ─── TRADE COMPUTATION ────────────────────────────────────────────────────────
// Compute what trades are needed to go from current state to targets

export function computeRequiredTrades(state, targets, prices, config) {
  const MIN_TRADE_USD = 5; // ignore tiny differences
  const totalEquity   = computeEquity(state, prices);
  const trades        = [];

  const allAssets = new Set([
    ...Object.keys(state.positions || {}),
    ...Object.keys(targets),
  ]);

  for (const asset of allAssets) {
    const price      = prices[asset];
    if (!price) continue;

    const currentPos   = state.positions?.[asset];
    const currentUnits = currentPos?.units || 0;
    const currentValue = currentUnits * price;

    const targetWeight = targets[asset] || 0;
    const targetValue  = totalEquity * targetWeight;
    const diff         = targetValue - currentValue;

    if (Math.abs(diff) < MIN_TRADE_USD) continue;

    trades.push({
      asset,
      side       : diff > 0 ? 'BUY' : 'SELL',
      diffUSD    : diff,            // positive = buy, negative = sell
      price,
      currentUnits,
      currentValue,
      targetValue,
      targetWeight,
    });
  }

  return trades;
}

// ─── PAPER TRADE EXECUTION ────────────────────────────────────────────────────

export function applyPaperTrade(state, trade, config) {
  const {
    FEE_TAKER_BPS  = 60,
    FEE_MAKER_BPS  = 40,
    SLIPPAGE_BPS   = 5,
    USE_TAKER_FEES = true,
  } = config;

  const feeBps      = USE_TAKER_FEES ? FEE_TAKER_BPS : FEE_MAKER_BPS;
  const feeRate     = feeBps / 10000;
  const slipRate    = SLIPPAGE_BPS / 10000;

  const newState    = JSON.parse(JSON.stringify(state)); // deep clone
  const positions   = newState.positions;
  const { asset, side, price } = trade;

  let fee      = 0;
  let slippage = 0;
  let units    = 0;
  let notional = 0;

  if (side === 'BUY') {
    // Budget = |diffUSD|, back out fee
    const budget   = Math.abs(trade.diffUSD);
    const slipPrice = price * (1 + slipRate);           // slippage raises buy price
    notional        = budget / (1 + feeRate);
    fee             = notional * feeRate;
    slippage        = notional * slipRate;
    units           = (notional - slippage) / slipPrice;

    newState.cash_usd -= budget;

    if (!positions[asset]) {
      positions[asset] = { units: 0, avg_price: slipPrice, weight: 0 };
    }
    const prev      = positions[asset];
    const totalCost = prev.units * prev.avg_price + notional;
    prev.units     += units;
    prev.avg_price  = prev.units > 0 ? totalCost / prev.units : slipPrice;
    prev.weight     = trade.targetWeight;

  } else {
    // SELL
    const pos       = positions[asset];
    if (!pos || pos.units <= 0) return { newState, tradeRecord: null };

    const slipPrice = price * (1 - slipRate);           // slippage lowers sell price
    units           = Math.min(Math.abs(trade.diffUSD) / price, pos.units);
    notional        = units * slipPrice;
    fee             = notional * feeRate;
    slippage        = units * price * slipRate;
    const proceeds  = notional - fee;

    newState.cash_usd += proceeds;
    pos.units         -= units;

    if (pos.units < 1e-8) {
      delete positions[asset]; // fully exited
    } else {
      pos.weight = trade.targetWeight;
    }
  }

  newState.cumulative_fees     += fee;
  newState.cumulative_slippage += slippage;
  newState.updated_at           = new Date().toISOString();

  const tradeRecord = {
    timestamp    : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    type         : side,
    asset,
    quantity     : parseFloat(units.toFixed(8)),
    price        : parseFloat(price.toFixed(2)),
    notional     : parseFloat(notional.toFixed(2)),
    fee          : parseFloat(fee.toFixed(4)),
    slippage     : parseFloat(slippage.toFixed(4)),
    cash_before  : parseFloat(state.cash_usd.toFixed(2)),
    cash_after   : parseFloat(newState.cash_usd.toFixed(2)),
    equity_before: parseFloat(computeEquity(state, { [asset]: price }).toFixed(2)),
    equity_after : parseFloat(computeEquity(newState, { [asset]: price }).toFixed(2)),
    pnl          : side === 'SELL' && state.positions?.[asset]
                   ? parseFloat(((price - state.positions[asset].avg_price) * units).toFixed(2))
                   : 0,
    comment      : trade.comment || '',
  };

  return { newState, tradeRecord };
}
