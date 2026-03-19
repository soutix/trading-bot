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
// Un seul appel metaAndAssetCtxs toutes les 30s partagé entre
// getAssetPrice, getFundingRate et _getAssetMeta.

let _metaCache   = null;
let _metaCacheTs = 0;
const META_TTL_MS = 30_000;

async function _fetchMeta() {
    const now = Date.now();
    if (_metaCache && (now - _metaCacheTs) < META_TTL_MS) return _metaCache;
    const res = await fetch(INFO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'metaAndAssetCtxs' })
    });
    if (!res.ok) throw new Error(`metaAndAssetCtxs HTTP ${res.status}`);
    _metaCache   = await res.json();
    _metaCacheTs = now;
    return _metaCache;
}

// ─── PRIX & FUNDING ───────────────────────────────────────────────────────────

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

// ─── SOLDE DU COMPTE ──────────────────────────────────────────────────────────
// Lit le solde sur le MASTER wallet (qui détient les fonds),
// pas sur l'API wallet (qui ne fait que signer les ordres).
//
// .env requis :
//   HYPERLIQUID_MASTER_ADDRESS=0x1135F7F8aBE3726C1005cA9270d7097727845dd5
//   HYPERLIQUID_WALLET_ADDRESS=0x82b451...   (API wallet, pour la signature)
//   HYPERLIQUID_PRIVATE_KEY=...              (clé privée de l'API wallet)

async function getAccountBalance() {
    try {
        const masterAddress = process.env.HYPERLIQUID_MASTER_ADDRESS;
        if (!masterAddress) throw new Error('HYPERLIQUID_MASTER_ADDRESS manquant dans .env');

        const res = await fetch(INFO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'clearinghouseState', user: masterAddress })
        });
        if (!res.ok) throw new Error(`clearinghouseState HTTP ${res.status}`);

        const data    = await res.json();
        const balance = parseFloat(data.marginSummary.accountValue);

        if (balance <= 0) {
            throw new Error(
                isTestnet
                    ? 'Solde testnet à 0. Crédite ton compte sur app.hyperliquid-testnet.xyz → Faucet.'
                    : 'Solde compte à 0. Impossible de calculer un sizing.'
            );
        }

        console.log(`💰 Solde du compte : ${balance.toFixed(2)} USDC`);
        return balance;

    } catch (err) {
        console.error('❌ getAccountBalance:', err.message);
        return null;
    }
}

// ─── HELPERS INTERNES ─────────────────────────────────────────────────────────

async function _getAssetMeta(coin) {
    const data = await _fetchMeta();
    const idx  = data[0].universe.findIndex(c => c.name === coin);
    if (idx === -1) throw new Error(`Asset ${coin} non trouvé`);
    return { index: idx, szDecimals: data[0].universe[idx].szDecimals };
}

function _fmtPrice(price) {
    return parseFloat(price.toPrecision(5)).toString();
}

function _fmtSize(size, szDecimals) {
    return parseFloat(size.toFixed(szDecimals)).toString();
}

// ─── SIGNATURE EIP-712 ────────────────────────────────────────────────────────
// Protocole Hyperliquid L1 :
//   1. Encoder l'action en msgpack (ordre d'insertion, PAS sortKeys)
//   2. Concaténer : actionBytes | nonce (8 octets BE) | 0x00 (pas de vault)
//   3. keccak256 → connectionId
//   4. signTypedData sur Agent { source, connectionId }
//      chainId EIP-712 = 1337 (L1 Hyperliquid, indépendant du testnet/mainnet)
//      source = "b" testnet / "a" mainnet

const EIP712_DOMAIN = {
    name:              'Exchange',
    version:           '1',
    chainId:           1337,
    verifyingContract: '0x0000000000000000000000000000000000000000'
};

const AGENT_TYPES = {
    Agent: [
        { name: 'source',       type: 'string'  },
        { name: 'connectionId', type: 'bytes32' }
    ]
};

async function _signAction(wallet, action, nonce) {
    const actionBytes = msgpackEncode(action);

    const nonceBuf = Buffer.allocUnsafe(8);
    nonceBuf.writeBigUInt64BE(BigInt(nonce));

    const preimage     = Buffer.concat([Buffer.from(actionBytes), nonceBuf, Buffer.from([0x00])]);
    const connectionId = ethers.keccak256(preimage);

    const message = { source: isTestnet ? 'b' : 'a', connectionId };
    const rawSig  = await wallet.signTypedData(EIP712_DOMAIN, AGENT_TYPES, message);
    const sig     = ethers.Signature.from(rawSig);

    return { r: sig.r, s: sig.s, v: sig.v };
}

// ─── PLACEMENT D'ORDRE ────────────────────────────────────────────────────────

/**
 * Place un ordre market-simulé (IOC limit + 5% slippage) sur Hyperliquid.
 * @param {string}  coin   - Ex: 'ETH', 'BTC'
 * @param {boolean} isBuy  - true = LONG/achat, false = SHORT/vente
 * @param {number}  size   - Taille en unités de l'actif
 * @param {number}  price  - Mark price de référence
 */
async function placeOrder(coin, isBuy, size, price) {
    try {
        console.log(`🚀 Ordre : ${isBuy ? 'BUY/LONG' : 'SELL/SHORT'} ${size} ${coin} @ ~${price}`);

        const wallet                = new ethers.Wallet(process.env.HYPERLIQUID_PRIVATE_KEY);
        const { index, szDecimals } = await _getAssetMeta(coin);

        const slippage   = 0.05;
        const limitPrice = isBuy ? price * (1 + slippage) : price * (1 - slippage);
        const nonce      = Date.now();

        const action = {
            type:   'order',
            orders: [{
                a: index,
                b: isBuy,
                p: _fmtPrice(limitPrice),
                s: _fmtSize(size, szDecimals),
                r: false,
                t: { limit: { tif: 'Ioc' } }
            }],
            grouping: 'na'
        };

        const signature = await _signAction(wallet, action, nonce);
        const res       = await fetch(EXCHANGE_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action, nonce, signature })
        });

        const result = await res.json();
        if (result.status !== 'ok') throw new Error(`Réponse Hyperliquid: ${JSON.stringify(result)}`);

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


// ─── STOP-LOSS NATIF HYPERLIQUID ─────────────────────────────────────────────
// Un ordre trigger déposé sur l exchange — exécuté en temps réel par Hyperliquid
// même quand le cron dort. C est la protection contre les chocs nocturnes.
//
// Structure clé : t: { trigger: { triggerPx, isMarket: true, tpsl: "sl" } }
//   - triggerPx  : prix de déclenchement
//   - isMarket   : true = exécution market au déclenchement (pas de slippage limit)
//   - tpsl       : "sl" = stop-loss (vs "tp" = take-profit)
//   - r: true    : reduceOnly = ferme la position existante, n ouvre pas une nouvelle
//
// Pour un LONG : isBuy = false (on vend pour fermer), triggerPx sous le prix d entrée
// Pour un SHORT : isBuy = true  (on achète pour fermer), triggerPx au-dessus

/**
 * Place un ordre stop-loss natif sur Hyperliquid.
 * @param {string}  coin         - Ex: "ETH", "SOL"
 * @param {boolean} isBuy        - false pour fermer un LONG, true pour fermer un SHORT
 * @param {number}  size         - Taille de la position (même valeur qu utilisée à l ouverture)
 * @param {number}  triggerPrice - Prix de déclenchement du stop
 */
async function placeStopOrder(coin, isBuy, size, triggerPrice) {
    try {
        console.log(`🛡️ Stop natif : ${isBuy ? "BUY" : "SELL"} ${size} ${coin} si prix ${isBuy ? ">" : "<"} ${triggerPrice.toFixed(2)}`);

        const wallet                = new ethers.Wallet(process.env.HYPERLIQUID_PRIVATE_KEY);
        const { index, szDecimals } = await _getAssetMeta(coin);
        const nonce                 = Date.now();

        const action = {
            type:   "order",
            orders: [{
                a: index,
                b: isBuy,
                p: _fmtPrice(triggerPrice), // prix de déclenchement
                s: _fmtSize(size, szDecimals),
                r: true,                    // reduceOnly — ferme la position, n ouvre pas
                t: { trigger: { triggerPx: _fmtPrice(triggerPrice), isMarket: true, tpsl: "sl" } }
            }],
            grouping: "na"
        };

        const signature = await _signAction(wallet, action, nonce);
        const res       = await fetch(EXCHANGE_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action, nonce, signature })
        });

        const result = await res.json();
        if (result.status !== "ok") throw new Error(`Réponse Hyperliquid: ${JSON.stringify(result)}`);

        const status = result.response?.data?.statuses?.[0];
        if (status?.resting) {
            console.log(`✅ Stop natif enregistré sur Hyperliquid @ ${triggerPrice.toFixed(2)}`);
        } else {
            console.log(`✅ Stop natif accepté :`, JSON.stringify(result.response));
        }

        return true;

    } catch (err) {
        console.error(`❌ placeStopOrder(${coin}):`, err.message);
        return false;
    }
}

/**
 * Annule tous les ordres ouverts sur un actif (utilisé avant de placer un nouveau stop).
 * Évite d accumuler des stops orphelins si la position est modifiée.
 * @param {string} coin - Ex: "ETH"
 */
async function cancelAllOrders(coin) {
    try {
        const wallet              = new ethers.Wallet(process.env.HYPERLIQUID_PRIVATE_KEY);
        const { index }           = await _getAssetMeta(coin);
        const masterAddress       = process.env.HYPERLIQUID_MASTER_ADDRESS;

        // Récupérer les ordres ouverts
        const infoRes = await fetch(INFO_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ type: "openOrders", user: masterAddress })
        });
        const orders = await infoRes.json();
        const toCancel = orders.filter(o => o.coin === coin);

        if (toCancel.length === 0) {
            console.log(`ℹ️  Aucun ordre ouvert à annuler sur ${coin}`);
            return true;
        }

        const nonce  = Date.now();
        const action = {
            type:    "cancel",
            cancels: toCancel.map(o => ({ a: index, o: o.oid }))
        };

        const signature = await _signAction(wallet, action, nonce);
        const res       = await fetch(EXCHANGE_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ action, nonce, signature })
        });

        const result = await res.json();
        if (result.status !== "ok") throw new Error(`Cancel échoué: ${JSON.stringify(result)}`);

        console.log(`🗑️  ${toCancel.length} ordre(s) annulé(s) sur ${coin}`);
        return true;

    } catch (err) {
        console.error(`❌ cancelAllOrders(${coin}):`, err.message);
        return false;
    }
}
// ─── VÉRIFICATION POSITION ON-CHAIN ──────────────────────────────────────────
/**
 * Vérifie qu'une position est réellement ouverte sur Hyperliquid.
 * Utilisé après placeOrder() pour confirmer l'exécution avant de mettre à jour Supabase.
 *
 * @param {string} coin - Ex: 'ETH', 'SOL'
 * @returns {object|null} - { coin, size, entryPx, side } ou null si pas de position
 */
async function getOpenPosition(coin) {
    try {
        const masterAddress = process.env.HYPERLIQUID_MASTER_ADDRESS;
        if (!masterAddress) throw new Error('HYPERLIQUID_MASTER_ADDRESS manquant');

        const res = await fetch(INFO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'clearinghouseState', user: masterAddress })
        });
        if (!res.ok) throw new Error(`clearinghouseState HTTP ${res.status}`);

        const data = await res.json();
        const pos  = data.assetPositions
            ?.find(p => p.position.coin === coin && parseFloat(p.position.szi) !== 0)
            ?.position;

        if (!pos) return null;

        const size = parseFloat(pos.szi);
        return {
            coin,
            size:    Math.abs(size),
            side:    size > 0 ? 'LONG' : 'SHORT',
            entryPx: parseFloat(pos.entryPx),
            raw:     pos,
        };
    } catch (err) {
        console.error(`❌ getOpenPosition(${coin}):`, err.message);
        return null;
    }
}

/**
 * Retourne toutes les positions ouvertes du compte.
 * Utile pour détecter des désynchronisations entre Supabase et Hyperliquid.
 * @returns {object[]} - Tableau de positions { coin, size, side, entryPx }
 */
async function getAllOpenPositions() {
    try {
        const masterAddress = process.env.HYPERLIQUID_MASTER_ADDRESS;
        if (!masterAddress) throw new Error('HYPERLIQUID_MASTER_ADDRESS manquant');

        const res = await fetch(INFO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'clearinghouseState', user: masterAddress })
        });
        if (!res.ok) throw new Error(`clearinghouseState HTTP ${res.status}`);

        const data = await res.json();
        return (data.assetPositions || [])
            .filter(p => parseFloat(p.position.szi) !== 0)
            .map(p => ({
                coin:    p.position.coin,
                size:    Math.abs(parseFloat(p.position.szi)),
                side:    parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT',
                entryPx: parseFloat(p.position.entryPx),
            }));
    } catch (err) {
        console.error('❌ getAllOpenPositions:', err.message);
        return [];
    }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    getAssetPrice,
    getFundingRate,
    getAccountBalance,
    getOpenPosition,
    getAllOpenPositions,
    placeOrder,
    placeStopOrder,
    cancelAllOrders
};