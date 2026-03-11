// lib/coinbase.js
// Coinbase Advanced Trade API — JWT ES256 authentication
// Coinbase CDP keys are EC (PKCS#1) format — we use Node.js crypto directly.
import { SignJWT }       from 'jose';
import { createPrivateKey } from 'crypto';

const BASE_URL = 'https://api.coinbase.com';

// ─── JWT ─────────────────────────────────────────────────────────────────────

async function createJWT(method, path) {
  const keyName = process.env.COINBASE_KEY_NAME;
  const rawKey  = process.env.COINBASE_PRIVATE_KEY;

  if (!keyName || !rawKey) throw new Error('Coinbase credentials not configured in env vars.');

  // Restore newlines — key may be stored with literal \n in Vercel env vars
  const pemKey = rawKey.replace(/\\n/g, '\n');

  // createPrivateKey handles both EC (PKCS#1) and PKCS#8 formats automatically
  const privateKey = createPrivateKey({ key: pemKey, format: 'pem' });

  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const uri   = `${method} api.coinbase.com${path}`;

  return new SignJWT({ sub: keyName, iss: 'cdp', uri })
    .setProtectedHeader({ alg: 'ES256', kid: keyName, nonce })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setNotBefore('0s')
    .sign(privateKey);
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────

async function cbRequest(method, path, body = null) {
  const jwt = await createJWT(method, path);
  const url = `${BASE_URL}${path}`;

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type':  'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res  = await fetch(url, opts);
  const json = await res.json();

  if (!res.ok) {
    const msg = json?.message || json?.error || JSON.stringify(json);
    throw new Error(`Coinbase API ${res.status}: ${msg}`);
  }
  return json;
}

// ─── CANDLES ─────────────────────────────────────────────────────────────────
// Returns array of daily closes, oldest → newest

export async function getCandles(productId, numDays = 210) {
  const now   = Math.floor(Date.now() / 1000);
  const start = now - numDays * 86400;

  const path = `/api/v3/brokerage/products/${productId}/candles` +
               `?start=${start}&end=${now}&granularity=ONE_DAY`;

  const data = await cbRequest('GET', path);

  if (!data.candles || data.candles.length === 0) {
    throw new Error(`No candles returned for ${productId} — check API key permissions (needs view scope)`);
  }

  // Coinbase returns newest first — reverse to get oldest first
  return data.candles
    .slice()
    .sort((a, b) => Number(a.start) - Number(b.start))
    .map(c => ({
      timestamp : Number(c.start),
      open      : parseFloat(c.open),
      high      : parseFloat(c.high),
      low       : parseFloat(c.low),
      close     : parseFloat(c.close),
      volume    : parseFloat(c.volume),
    }));
}

// ─── SPOT PRICE ───────────────────────────────────────────────────────────────

export async function getSpotPrice(productId) {
  const data = await cbRequest('GET', `/api/v3/brokerage/products/${productId}`);
  return parseFloat(data.price);
}

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────

export async function getAccounts() {
  const data = await cbRequest('GET', '/api/v3/brokerage/accounts');
  return data.accounts || [];
}

export async function getBalance(currency) {
  const accounts = await getAccounts();
  const acc = accounts.find(a => a.currency === currency);
  return acc ? parseFloat(acc.available_balance?.value || 0) : 0;
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

// BUY: specify quoteSize (USD to spend)
// SELL: specify baseSize (units to sell)
export async function createMarketOrder(productId, side, { quoteSize, baseSize }) {
  const clientOrderId = crypto.randomUUID();

  const orderConfig = side === 'BUY'
    ? { market_market_ioc: { quote_size: quoteSize.toFixed(2) } }
    : { market_market_ioc: { base_size:  baseSize.toFixed(8)  } };

  const body = {
    client_order_id    : clientOrderId,
    product_id         : productId,
    side               : side,
    order_configuration: orderConfig,
  };

  const data = await cbRequest('POST', '/api/v3/brokerage/orders', body);

  if (!data.success) {
    throw new Error(`Order failed: ${JSON.stringify(data.error_response)}`);
  }

  return {
    orderId  : data.order_id || clientOrderId,
    productId,
    side,
    status   : data.success_response?.status || 'FILLED',
  };
}

// ─── CONNECTIVITY TEST ────────────────────────────────────────────────────────

export async function testConnection() {
  try {
    const accounts = await getAccounts();
    return { ok: true, accountCount: accounts.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
