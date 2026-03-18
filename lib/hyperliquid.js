const { ethers } = require('ethers');
const { encode: msgpackEncode } = require('@msgpack/msgpack');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const isTestnet = process.env.USE_TESTNET === 'true';

const INFO_URL = isTestnet
    ? 'https://api.hyperliquid-testnet.xyz/info'
    : 'https://api.hyperliquid.xyz/info';

const EXCHANGE_URL = isTestnet
    ? 'https://api.hyperliquid-testnet.xyz/exchange'
    : 'https://api.hyperliquid.xyz/exchange';

if (isTestnet) {
    console.log("🧪 MODE PAPER TRADING ACTIVÉ (Testnet Hyperliquid)");
} else {
    console.log("⚠️  MODE PRODUCTION ACTIVÉ (Argent Réel Hyperliquid)");
}

// ─── CACHE META ───────────────────────────────────────────────────────────────
// On appelle metaAndAssetCtxs UNE SEULE FOIS toutes les 30s,
// puis getAssetPrice / getFundingRate / getAssetIndex piochent dedans.

let _metaCache = null;
let _metaCacheTs = 0;
const META_TTL_MS = 30_000;

async function _fetchMeta() {
    const now = Date.now();
    if (_metaCache && (now - _metaCacheTs) < META_TTL_MS) {
        return _metaCache;
    }
    const res = await fetch(INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });
    if (!res.ok) throw new Error(`metaAndAssetCtxs HTTP ${res.status}`);
    _metaCache = await res.json();
    _metaCacheTs = now;
    return _metaCache;
}

// ─── HELPERS PUBLICS ──────────────────────────────────────────────────────────

async function getAssetPrice(coin) {
    try {
        const data = await _fetchMeta();
        const idx  = data[0].universe.findIndex(c => c.name === coin);
        if (idx === -1) throw new Error(`Asset ${coin} non trouvé sur Hyperliquid`);
        return parseFloat(data[1][idx].markPx);
    } catch (err) {
        console.error(`❌ Prix ${coin}:`, err.message);
        return null;
    }
}

async function getFundingRate(coin) {
    try {
        const data = await _fetchMeta();
        const idx  = data[0].universe.findIndex(c => c.name === coin);
        if (idx === -1) throw new Error(`Asset ${coin} non trouvé`);
        return parseFloat(data[1][idx].funding);
    } catch (err) {
        console.error(`❌ FundingRate ${coin}:`, err.message);
        return null;
    }
}

// Retourne { index, szDecimals } pour un coin donné
async function _getAssetMeta(coin) {
    const data = await _fetchMeta();
    const idx  = data[0].universe.findIndex(c => c.name === coin);
    if (idx === -1) throw new Error(`Asset ${coin} non trouvé`);
    return { index: idx, szDecimals: data[0].universe[idx].szDecimals };
}

// ─── FORMATAGE PRIX / TAILLE ──────────────────────────────────────────────────
// Hyperliquid exige :
//   - prix  : max 5 chiffres significatifs, pas de trailing zeros
//   - taille : arrondie à szDecimals (ex: ETH = 4 → 0.0001 minimum)

function _fmtPrice(price) {
    return parseFloat(price.toPrecision(5)).toString();
}

function _fmtSize(size, szDecimals) {
    return parseFloat(size.toFixed(szDecimals)).toString();
}

// ─── SIGNATURE EIP-712 ────────────────────────────────────────────────────────
// Protocole Hyperliquid L1 :
//   1. Encoder l'action en msgpack (clés triées)
//   2. Concaténer : actionBytes | nonce (8 octets BE) | 0x00 (pas de vault)
//   3. keccak256 → connectionId
//   4. signTypedData sur le struct Agent { source, connectionId }
//
// Le chainId EIP-712 de Hyperliquid L1 est toujours 1337,
// indépendamment du testnet/mainnet.
// La distinction testnet se fait uniquement via source: "b" (testnet) / "a" (mainnet).

const EIP712_DOMAIN = {
    name: "Exchange",
    version: "1",
    chainId: 1337,
    verifyingContract: "0x0000000000000000000000000000000000000000"
};

const AGENT_TYPES = {
    Agent: [
        { name: "source",       type: "string"  },
        { name: "connectionId", type: "bytes32" }
    ]
};

async function _signAction(wallet, action, nonce) {
    // 1. Encoder l'action en msgpack, clés triées (requis par Hyperliquid)
    const actionBytes = msgpackEncode(action, { sortKeys: true });

    // 2. Nonce en 8 octets big-endian
    const nonceBuf = Buffer.allocUnsafe(8);
    nonceBuf.writeBigUInt64BE(BigInt(nonce));

    // 3. Flag vault : 0x00 = pas de vault (cas standard)
    const vaultFlag = Buffer.from([0x00]);

    // 4. connectionId = keccak256(actionBytes || nonce8bytes || vaultFlag)
    const preimage   = Buffer.concat([Buffer.from(actionBytes), nonceBuf, vaultFlag]);
    const connectionId = ethers.keccak256(preimage);

    // 5. EIP-712 signTypedData sur le struct Agent
    const message = {
        source:       isTestnet ? "b" : "a",
        connectionId                           // bytes32 hex string
    };

    const rawSig  = await wallet.signTypedData(EIP712_DOMAIN, AGENT_TYPES, message);
    const sig     = ethers.Signature.from(rawSig);

    return { r: sig.r, s: sig.s, v: sig.v };
}

// ─── PLACEMENT D'ORDRE ────────────────────────────────────────────────────────

/**
 * Place un ordre market-simulé (IOC limit avec 5% de slippage) sur Hyperliquid.
 * @param {string}  coin   - Ex: 'ETH', 'BTC'
 * @param {boolean} isBuy  - true = LONG / achat, false = SHORT / vente
 * @param {number}  size   - Taille en unités de l'actif
 * @param {number}  price  - Prix de référence (mark price actuel)
 */
async function placeOrder(coin, isBuy, size, price) {
    try {
        console.log(`🚀 Ordre : ${isBuy ? 'BUY/LONG' : 'SELL/SHORT'} ${size} ${coin} @ ~${price}`);

        const wallet              = new ethers.Wallet(process.env.HYPERLIQUID_PRIVATE_KEY);
        const { index, szDecimals } = await _getAssetMeta(coin);

        // Slippage 5% pour simuler un market order (IOC)
        const slippage   = 0.05;
        const limitPrice = isBuy ? price * (1 + slippage) : price * (1 - slippage);

        const nonce  = Date.now(); // ms timestamp = nonce unique

        const action = {
            type: "order",
            orders: [{
                a: index,                          // index dynamique (plus de 0 hardcodé)
                b: isBuy,
                p: _fmtPrice(limitPrice),
                s: _fmtSize(size, szDecimals),
                r: false,                          // reduceOnly = false
                t: { limit: { tif: "Ioc" } }       // Immediate-Or-Cancel ≈ market order
            }],
            grouping: "na"
        };

        const signature = await _signAction(wallet, action, nonce);

        const payload = { action, nonce, signature };

        const res = await fetch(EXCHANGE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (result.status !== 'ok') {
            throw new Error(`Réponse Hyperliquid: ${JSON.stringify(result)}`);
        }

        const fill = result.response?.data?.statuses?.[0];
        if (fill?.filled) {
            console.log(`✅ Ordre exécuté : ${fill.filled.totalSz} ${coin} @ ${fill.filled.avgPx}`);
        } else if (fill?.resting) {
            console.warn(`⚠️  Ordre en attente (resting) — vérifie Hyperliquid UI`);
        } else {
            console.log(`✅ Ordre accepté :`, JSON.stringify(result.response));
        }

        return true;

    } catch (err) {
        console.error(`❌ placeOrder(${coin}):`, err.message);
        return false;
    }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    getAssetPrice,
    getFundingRate,
    placeOrder
};