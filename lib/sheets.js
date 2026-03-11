// lib/sheets.js
// All Sheets I/O goes through the Apps Script Web App

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

if (!APPS_SCRIPT_URL) {
  console.error('[sheets] WARNING: APPS_SCRIPT_URL env var is not set!');
}

// ─── CORE REQUEST ─────────────────────────────────────────────────────────────

async function sheetsGET(action, params = {}) {
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL is not configured');

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    method  : 'GET',
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`Sheets GET ${action} failed: HTTP ${res.status}`);
  return res.json();
}

async function sheetsPOST(action, payload) {
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL is not configured');

  const res = await fetch(APPS_SCRIPT_URL, {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    redirect: 'follow',
    body    : JSON.stringify({ action, payload }),
  });

  if (!res.ok) throw new Error(`Sheets POST ${action} failed: HTTP ${res.status}`);
  return res.json();
}

// ─── STATE ────────────────────────────────────────────────────────────────────

export async function getState() {
  try {
    const data = await sheetsGET('getState');
    const state = data.state || null;
    // Return null if state is empty object (not initialized)
    if (!state || Object.keys(state).length === 0) return null;
    return state;
  } catch (e) {
    console.error('[sheets] getState error:', e.message);
    return null;
  }
}

export async function setState(state) {
  return sheetsPOST('setState', { state });
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export async function updateDashboard(state, signals) {
  const prices = {};
  signals.forEach(s => { prices[s.asset] = s.price; });

  const invested    = Object.entries(state.positions || {}).reduce((sum, [asset, pos]) => {
    return sum + (pos.units * (prices[asset] || pos.avg_price || 0));
  }, 0);
  const totalEquity = (state.cash_usd || 0) + invested;
  const pnl         = totalEquity - (state.start_cash || 500);
  const topSignal   = signals.find(s => s.selected);
  const topPos      = topSignal ? state.positions?.[topSignal.asset] : null;

  return sheetsPOST('updateDashboard', {
    total_equity    : totalEquity,
    cash_usd        : state.cash_usd,
    invested,
    cash_pct        : totalEquity > 0 ? (state.cash_usd / totalEquity * 100).toFixed(2) : 0,
    invested_pct    : totalEquity > 0 ? (invested / totalEquity * 100).toFixed(2) : 0,
    pnl,
    pnl_pct         : (state.start_cash || 500) > 0 ? (pnl / (state.start_cash || 500) * 100).toFixed(2) : 0,
    cumulative_fees : state.cumulative_fees || 0,
    last_rebalance  : state.last_rebalance_timestamp || '—',
    next_rebalance  : '(on signal change)',
    bot_status      : 'RUNNING',
    mode            : state.dry_run ? 'DRY RUN' : 'LIVE',
    active_asset    : topSignal?.asset || 'CASH',
    asset_units     : topPos?.units || 0,
    asset_price     : topSignal?.price || 0,
    asset_value     : topPos ? (topPos.units * (topSignal?.price || topPos.avg_price || 0)) : 0,
  });
}

// ─── TRADES ──────────────────────────────────────────────────────────────────

export async function appendTrade(trade) {
  return sheetsPOST('appendTrade', trade);
}

export async function getTrades(limit = 100) {
  try {
    const data = await sheetsGET('getTrades', { limit });
    return data.trades || [];
  } catch (e) {
    console.error('[sheets] getTrades error:', e.message);
    return [];
  }
}

// ─── SIGNALS ─────────────────────────────────────────────────────────────────

export async function appendSignals(signals, timestamp) {
  return sheetsPOST('appendSignals', { signals, timestamp });
}

export async function getSignals() {
  try {
    const data = await sheetsGET('getSignals');
    return data.signals || [];
  } catch (e) {
    console.error('[sheets] getSignals error:', e.message);
    return [];
  }
}

// ─── LOGS ─────────────────────────────────────────────────────────────────────

export async function appendLog(entry) {
  try {
    return await sheetsPOST('appendLog', {
      timestamp : new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      level     : entry.level || 'INFO',
      message   : entry.message,
      source    : entry.source || 'api/rebalance',
      run_id    : entry.run_id || '',
    });
  } catch (e) {
    console.error('[sheets] appendLog error:', e.message);
  }
}

export async function getLogs(limit = 100) {
  try {
    const data = await sheetsGET('getLogs', { limit });
    return data.logs || [];
  } catch (e) {
    console.error('[sheets] getLogs error:', e.message);
    return [];
  }
}
