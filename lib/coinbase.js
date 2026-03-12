// lib/coinbase.js — CommonJS, no external dependencies
const crypto = require('crypto');

const BASE_URL = 'https://api.coinbase.com';

// Build JWT using Node.js native crypto (no jose needed)
function createJWT(method, path) {
  const keyName = process.env.COINBASE_KEY_NAME;
  const rawKey  = process.env.COINBASE_PRIVATE_KEY;
  if (!keyName || !rawKey) throw new Error('Coinbase credentials not configured');

  const pemKey  = rawKey.replace(/\\n/g, '\n');
  const now     = Math.floor(Date.now() / 1000);
  const nonce   = crypto.randomBytes(8).toString('hex');
  const uri     = `${method} api.coinbase.com${path}`;

  const header  = Buffer.from(JSON.stringify({ alg:'ES256', kid:keyName, nonce, typ:'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub:keyName, iss:'cdp', uri, iat:now, nbf:now, exp:now+120 })).toString('base64url');

  const sign    = crypto.createSign('SHA256');
  sign.update(`${header}.${payload}`);
  sign.end();
  const sig     = sign.sign({ key: pemKey, format: 'pem', dsaEncoding: 'ieee-p1363' }).toString('base64url');

  return `${header}.${payload}.${sig}`;
}

async function cbRequest(method, path, body = null) {
  const pathOnly = path.split('?')[0];
  const jwt      = createJWT(method, pathOnly);
  const opts     = {
    method,
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE_URL}${path}`, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(`Coinbase API ${res.status}: ${json?.message || JSON.stringify(json)}`);
  return json;
}

async function getCandles(productId, numDays = 210) {
  const now   = Math.floor(Date.now() / 1000);
  const start = now - numDays * 86400;
  const path  = `/api/v3/brokerage/products/${productId}/candles?start=${start}&end=${now}&granularity=ONE_DAY`;
  const data  = await cbRequest('GET', path);
  if (!data.candles || data.candles.length === 0)
    throw new Error(`No candles for ${productId}`);
  return data.candles
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map(c => ({
      timestamp: Number(c.start), open: parseFloat(c.open),
      high: parseFloat(c.high),   low:  parseFloat(c.low),
      close: parseFloat(c.close), volume: parseFloat(c.volume),
    }));
}

async function getCandlesLong(productId, numDays = 500) {
  const MAX_PER_REQ = 290;
  const allCandles  = [];
  let endTime       = Math.floor(Date.now() / 1000);
  let remaining     = numDays;
  while (remaining > 0) {
    const chunk     = Math.min(remaining, MAX_PER_REQ);
    const startTime = endTime - chunk * 86400;
    const path      = `/api/v3/brokerage/products/${productId}/candles?start=${startTime}&end=${endTime}&granularity=ONE_DAY`;
    try {
      const data = await cbRequest('GET', path);
      if (data.candles?.length > 0) allCandles.push(...data.candles);
    } catch (e) { console.warn(`[coinbase] chunk failed: ${e.message}`); }
    endTime    = startTime;
    remaining -= chunk;
  }
  const seen = new Set();
  return allCandles
    .filter(c => { if (seen.has(c.start)) return false; seen.add(c.start); return true; })
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map(c => ({
      timestamp: Number(c.start), open: parseFloat(c.open),
      high: parseFloat(c.high),   low:  parseFloat(c.low),
      close: parseFloat(c.close), volume: parseFloat(c.volume),
    }));
}

async function getAccounts() {
  return (await cbRequest('GET', '/api/v3/brokerage/accounts')).accounts || [];
}

async function createMarketOrder(productId, side, { quoteSize, baseSize }) {
  const clientOrderId = crypto.randomUUID();
  const orderConfig   = side === 'BUY'
    ? { market_market_ioc: { quote_size: quoteSize.toFixed(2) } }
    : { market_market_ioc: { base_size:  baseSize.toFixed(8)  } };
  const data = await cbRequest('POST', '/api/v3/brokerage/orders',
    { client_order_id: clientOrderId, product_id: productId, side, order_configuration: orderConfig });
  if (!data.success) throw new Error(`Order failed: ${JSON.stringify(data.error_response)}`);
  return { orderId: data.order_id || clientOrderId, productId, side, status: 'FILLED' };
}

async function testConnection() {
  try { return { ok: true, accountCount: (await getAccounts()).length }; }
  catch (e) { return { ok: false, error: e.message }; }
}

module.exports = { getCandles, getCandlesLong, getAccounts, createMarketOrder, testConnection };
