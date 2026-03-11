// lib/coinbase.js — CommonJS
const { SignJWT }          = require('jose');
const { createPrivateKey } = require('crypto');

const BASE_URL = 'https://api.coinbase.com';

async function createJWT(method, path) {
  const keyName    = process.env.COINBASE_KEY_NAME;
  const rawKey     = process.env.COINBASE_PRIVATE_KEY;
  if (!keyName || !rawKey) throw new Error('Coinbase credentials not configured');
  const pemKey     = rawKey.replace(/\\n/g, '\n');
  const privateKey = createPrivateKey({ key: pemKey, format: 'pem' });
  const nonce      = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const uri        = `${method} api.coinbase.com${path}`;
  return new SignJWT({ sub: keyName, iss: 'cdp', uri })
    .setProtectedHeader({ alg: 'ES256', kid: keyName, nonce })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setNotBefore('0s')
    .sign(privateKey);
}

async function cbRequest(method, path, body = null) {
  // JWT uri must NOT include query params
  const pathOnly = path.split('?')[0];
  const jwt      = await createJWT(method, pathOnly);
  const url      = `${BASE_URL}${path}`;
  const opts     = {
    method,
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(`Coinbase API ${res.status}: ${json?.message || JSON.stringify(json)}`);
  return json;
}

// Standard candles (up to 300 days)
async function getCandles(productId, numDays = 210) {
  const now   = Math.floor(Date.now() / 1000);
  const start = now - numDays * 86400;
  const path  = `/api/v3/brokerage/products/${productId}/candles?start=${start}&end=${now}&granularity=ONE_DAY`;
  const data  = await cbRequest('GET', path);
  if (!data.candles || data.candles.length === 0)
    throw new Error(`No candles for ${productId} — check API key view permissions`);
  return data.candles
    .slice()
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map(c => ({
      timestamp: Number(c.start), open: parseFloat(c.open),
      high: parseFloat(c.high),   low:  parseFloat(c.low),
      close: parseFloat(c.close), volume: parseFloat(c.volume),
    }));
}

// Paginated candles for backtest (supports >300 days)
async function getCandlesLong(productId, numDays = 500) {
  const MAX_PER_REQ = 290;
  const now         = Math.floor(Date.now() / 1000);
  const allCandles  = [];
  let endTime       = now;
  let remaining     = numDays;

  while (remaining > 0) {
    const chunk     = Math.min(remaining, MAX_PER_REQ);
    const startTime = endTime - chunk * 86400;
    const path      = `/api/v3/brokerage/products/${productId}/candles?start=${startTime}&end=${endTime}&granularity=ONE_DAY`;
    try {
      const data = await cbRequest('GET', path);
      if (data.candles && data.candles.length > 0) allCandles.push(...data.candles);
    } catch (e) {
      console.warn(`[coinbase] getCandlesLong chunk failed: ${e.message}`);
    }
    endTime    = startTime;
    remaining -= chunk;
  }

  // Deduplicate & sort
  const seen = new Set();
  return allCandles
    .filter(c => { const k = c.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map(c => ({
      timestamp: Number(c.start), open: parseFloat(c.open),
      high: parseFloat(c.high),   low:  parseFloat(c.low),
      close: parseFloat(c.close), volume: parseFloat(c.volume),
    }));
}

async function getAccounts() {
  const data = await cbRequest('GET', '/api/v3/brokerage/accounts');
  return data.accounts || [];
}

async function createMarketOrder(productId, side, { quoteSize, baseSize }) {
  const clientOrderId = crypto.randomUUID();
  const orderConfig   = side === 'BUY'
    ? { market_market_ioc: { quote_size: quoteSize.toFixed(2) } }
    : { market_market_ioc: { base_size:  baseSize.toFixed(8)  } };
  const body = { client_order_id: clientOrderId, product_id: productId, side, order_configuration: orderConfig };
  const data = await cbRequest('POST', '/api/v3/brokerage/orders', body);
  if (!data.success) throw new Error(`Order failed: ${JSON.stringify(data.error_response)}`);
  return { orderId: data.order_id || clientOrderId, productId, side, status: 'FILLED' };
}

async function testConnection() {
  try {
    const accounts = await getAccounts();
    return { ok: true, accountCount: accounts.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { getCandles, getCandlesLong, getAccounts, createMarketOrder, testConnection };
