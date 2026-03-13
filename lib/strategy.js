// lib/strategy.js — CommonJS

// ─── INDICATEURS ──────────────────────────────────────────────────────────────

function computeMA(closes, days) {
  if (closes.length < days) return null;
  const slice = closes.slice(-days);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

// Average True Range : mesure la volatilité réelle (hauts/bas/clôtures)
// Utilisé pour le stop-loss dynamique (2x ATR depuis le prix d'entrée)
function computeATR(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const recent = trs.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function computeMomentum(closes, days) {
  if (closes.length < days + 1) return null;
  const start = closes[closes.length - 1 - days];
  const end   = closes[closes.length - 1];
  if (start === 0) return null;
  return (end - start) / start;
}

function computeVolatility(closes, days) {
  if (closes.length < days + 1) return null;
  const slice   = closes.slice(-(days + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i++)
    if (slice[i - 1] > 0) returns.push(Math.log(slice[i] / slice[i - 1]));
  if (returns.length < 2) return null;
  const mean     = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252);
}

// Momentum calibré par asset : cycles différents selon la volatilité structurelle
// BTC=120j (cycles longs), ETH=90j (intermédiaire), SOL=60j (cycles courts)
function getMomentumDays(asset, config) {
  const map = {
    'BTC-USD': parseInt(config.MOMENTUM_DAYS_BTC) || 120,
    'ETH-USD': parseInt(config.MOMENTUM_DAYS_ETH) || 90,
    'SOL-USD': parseInt(config.MOMENTUM_DAYS_SOL) || 60,
  };
  return map[asset] || parseInt(config.MOMENTUM_DAYS) || 90;
}

// ─── STRATÉGIE PRINCIPALE ─────────────────────────────────────────────────────

function runStrategy(candlesMap, config) {
  const {
    TREND_MA_DAYS      = 200,
    VOL_DAYS           = 20,
    ATR_DAYS           = 14,
    TOP_K              = 1,
    MIN_VOL_FLOOR      = 1e-6,
    MAX_GROSS_EXPOSURE = 0.8,
  } = config;

  const assets     = Object.keys(candlesMap);
  const indicators = assets.map(asset => {
    const candles      = candlesMap[asset];
    const closes       = candles.map(c => c.close);
    const price        = closes[closes.length - 1];
    const ma           = computeMA(closes, TREND_MA_DAYS);
    const momentumDays = getMomentumDays(asset, config);
    const mom          = computeMomentum(closes, momentumDays);
    const vol          = computeVolatility(closes, VOL_DAYS);
    const atr          = computeATR(candles, ATR_DAYS);
    return {
      asset, price, ma200: ma,
      eligible: ma !== null && price > ma,
      momentum: mom, momentumDays,
      vol: Math.max(vol ?? MIN_VOL_FLOOR, MIN_VOL_FLOOR),
      atr,
    };
  });

  const eligible = indicators
    .filter(a => a.eligible && a.momentum !== null)
    .sort((a, b) => b.momentum - a.momentum);
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
    eligible: a.eligible, momentum: a.momentum, momentumDays: a.momentumDays,
    vol: a.vol, atr: a.atr,
    rawWeight: rawWeights[a.asset] || 0,
    adjWeight: targets[a.asset] || 0,
    rank: signalMap[a.asset] || null,
    selected: selectedAssets.has(a.asset),
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

// ─── STOP-LOSS ATR ────────────────────────────────────────────────────────────
// Stop dynamique : entryPrice - (ATR_MULTIPLIER x ATR_at_entry)
// Fallback stop fixe si ATR non disponible (STOP_LOSS_PCT)
function checkStopLoss(state, prices, config) {
  const triggered = [];
  const stopPct   = (typeof config === 'number') ? config : (config.STOP_LOSS_PCT || 0.08);
  const atrMult   = (typeof config === 'object') ? (config.ATR_MULTIPLIER || 2) : 2;

  for (const [asset, pos] of Object.entries(state.positions || {})) {
    if (!pos.entry_price || !prices[asset]) continue;
    const currentPrice = prices[asset];

    if (pos.atr_at_entry && pos.atr_at_entry > 0) {
      const atrStop = pos.entry_price - atrMult * pos.atr_at_entry;
      if (currentPrice <= atrStop) {
        const loss = (currentPrice - pos.entry_price) / pos.entry_price;
        triggered.push({ asset, price: currentPrice, loss, entryPrice: pos.entry_price,
          stopType: 'ATR_STOP', stopPrice: parseFloat(atrStop.toFixed(2)) });
        continue;
      }
    } else {
      const loss = (currentPrice - pos.entry_price) / pos.entry_price;
      if (loss <= -Math.abs(stopPct)) {
        triggered.push({ asset, price: currentPrice, loss, entryPrice: pos.entry_price,
          stopType: 'FIXED_STOP', stopPrice: parseFloat((pos.entry_price * (1 - Math.abs(stopPct))).toFixed(2)) });
      }
    }
  }
  return triggered;
}

// ─── TRAILING STOP ────────────────────────────────────────────────────────────
// S'active si profit > TRAILING_STOP_ACTIVATION (defaut +20%)
// Se declenche si prix < position_high x (1 - TRAILING_STOP_PCT)
function checkTrailingStop(state, prices, config) {
  const triggered     = [];
  const activationPct = config.TRAILING_STOP_ACTIVATION || 0.20;
  const trailingPct   = config.TRAILING_STOP_PCT        || 0.10;

  for (const [asset, pos] of Object.entries(state.positions || {})) {
    if (!pos.entry_price || !prices[asset]) continue;
    const currentPrice = prices[asset];
    const positionHigh = pos.position_high || currentPrice;

    // Activation basée sur le PLUS HAUT atteint (pas le prix actuel)
    // Une fois le seuil atteint, le trailing stop reste actif même si le prix a rechuté
    const peakProfitPct = (positionHigh - pos.entry_price) / pos.entry_price;
    if (peakProfitPct < activationPct) continue;

    const trailingStop = positionHigh * (1 - trailingPct);

    if (currentPrice <= trailingStop) {
      triggered.push({ asset, price: currentPrice, positionHigh,
        trailingStop: parseFloat(trailingStop.toFixed(2)),
        profit: parseFloat((peakProfitPct * 100).toFixed(2)) });
    }
  }
  return triggered;
}

// ─── ANTI-WHIPSAW ─────────────────────────────────────────────────────────────
function checkAntiWhipsaw(state, asset, minHoldHours = 24) {
  const lastTrade  = state.last_trade_times?.[asset];
  if (!lastTrade) return false;
  const hoursSince = (Date.now() - new Date(lastTrade).getTime()) / 3600000;
  return hoursSince < minHoldHours;
}

module.exports = {
  runStrategy, hasStrategyChanged,
  computeMA, computeMomentum, computeVolatility, computeATR, getMomentumDays,
  checkStopLoss, checkTrailingStop, checkAntiWhipsaw,
};
