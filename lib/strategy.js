// lib/strategy.js — CommonJS

function computeMA(closes, days) {
  if (closes.length < days) return null;
  const slice = closes.slice(-days);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function computeMomentum(closes, days) {
  if (closes.length < days + 1) return null;
  const slice = closes.slice(-(days + 1));
  const start = slice[0], end = slice[slice.length - 1];
  if (start === 0) return null;
  return (end - start) / start;
}

function computeVolatility(closes, days) {
  if (closes.length < days + 1) return null;
  const slice   = closes.slice(-(days + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i++)
    if (slice[i-1] > 0) returns.push(Math.log(slice[i] / slice[i-1]));
  if (returns.length < 2) return null;
  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252);
}

function runStrategy(candlesMap, config) {
  const {
    TREND_MA_DAYS      = 200, MOMENTUM_DAYS      = 90,
    VOL_DAYS           = 20,  TOP_K              = 1,
    MIN_VOL_FLOOR      = 1e-6, MAX_GROSS_EXPOSURE = 0.8,
  } = config;

  const assets     = Object.keys(candlesMap);
  const indicators = assets.map(asset => {
    const closes = candlesMap[asset].map(c => c.close);
    const price  = closes[closes.length - 1];
    const ma     = computeMA(closes, TREND_MA_DAYS);
    const mom    = computeMomentum(closes, MOMENTUM_DAYS);
    const vol    = computeVolatility(closes, VOL_DAYS);
    return { asset, price, ma200: ma, eligible: ma !== null && price > ma,
             momentum: mom, vol: Math.max(vol ?? MIN_VOL_FLOOR, MIN_VOL_FLOOR) };
  });

  const eligible = indicators.filter(a => a.eligible && a.momentum !== null);
  eligible.sort((a, b) => b.momentum - a.momentum);
  const selected       = eligible.slice(0, TOP_K);
  const selectedAssets = new Set(selected.map(a => a.asset));

  const rawWeights = {};
  let totalRaw = 0;
  selected.forEach(a => { rawWeights[a.asset] = 1 / a.vol; totalRaw += 1 / a.vol; });

  const targets = {};
  assets.forEach(asset => targets[asset] = 0);
  if (totalRaw > 0) {
    if (selected.length === 1) {
      targets[selected[0].asset] = MAX_GROSS_EXPOSURE;
    } else {
      selected.forEach(a => {
        targets[a.asset] = Math.min(rawWeights[a.asset] / totalRaw, MAX_GROSS_EXPOSURE);
      });
    }
  }

  const signalMap = {};
  eligible.forEach((a, i) => { signalMap[a.asset] = i + 1; });

  const signals = indicators.map(a => ({
    asset: a.asset, price: a.price, ma200: a.ma200,
    eligible: a.eligible, momentum: a.momentum, vol: a.vol,
    rawWeight: rawWeights[a.asset] || 0, adjWeight: targets[a.asset] || 0,
    rank: signalMap[a.asset] || null, selected: selectedAssets.has(a.asset),
  }));

  return { signals, targets };
}

function hasStrategyChanged(prevState, newTargets, newSignals) {
  const prevTopAsset = prevState.last_signals?.top_asset || null;
  const newSelected  = newSignals.find(s => s.selected);
  const newTopAsset  = newSelected?.asset || null;
  if (prevTopAsset !== newTopAsset) return true;
  if (newTopAsset) {
    const prevWeight = prevState.positions?.[newTopAsset]?.weight || 0;
    const newWeight  = newTargets[newTopAsset] || 0;
    if (Math.abs(newWeight - prevWeight) > 0.05) return true;
  }
  return false;
}

// ─── STOP LOSS ────────────────────────────────────────────────────────────────
// Returns list of assets that have breached stop loss
function checkStopLoss(state, prices, stopLossPct = 0.08) {
  const triggered = [];
  for (const [asset, pos] of Object.entries(state.positions || {})) {
    if (!pos.entry_price || !prices[asset]) continue;
    const loss = (prices[asset] - pos.entry_price) / pos.entry_price;
    if (loss <= -stopLossPct) {
      triggered.push({ asset, price: prices[asset], loss, entryPrice: pos.entry_price });
    }
  }
  return triggered;
}

// ─── ANTI-WHIPSAW ─────────────────────────────────────────────────────────────
// Returns true if trade should be blocked (too soon after last trade on this asset)
function checkAntiWhipsaw(state, asset, minHoldHours = 24) {
  const lastTrade = state.last_trade_times?.[asset];
  if (!lastTrade) return false;
  const hoursSince = (Date.now() - new Date(lastTrade).getTime()) / 3600000;
  return hoursSince < minHoldHours;
}

module.exports = {
  runStrategy, hasStrategyChanged,
  computeMA, computeMomentum, computeVolatility,
  checkStopLoss, checkAntiWhipsaw,
};
