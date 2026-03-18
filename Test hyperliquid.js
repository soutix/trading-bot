/**
 * 🧪 SMOKE TEST — lib/hyperliquid.js
 * 
 * Lance sur le testnet Hyperliquid pour valider :
 *   1. Connexion et récupération des prix (cache meta)
 *   2. Récupération du funding rate
 *   3. Formatage prix / taille
 *   4. Signature EIP-712 + envoi d'un vrai ordre IOC minuscule
 * 
 * Usage :
 *   node test-hyperliquid.js
 * 
 * Prérequis :
 *   - HYPERLIQUID_PRIVATE_KEY et HYPERLIQUID_WALLET_ADDRESS dans .env
 *   - USE_TESTNET=true dans .env
 *   - npm install @msgpack/msgpack dotenv
 */

require('dotenv').config();

// ─── VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT ──────────────────────────────

const REQUIRED_ENV = ['HYPERLIQUID_PRIVATE_KEY', 'HYPERLIQUID_WALLET_ADDRESS'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
    console.error(`\n❌ Variables manquantes dans .env : ${missing.join(', ')}\n`);
    process.exit(1);
}

if (process.env.USE_TESTNET !== 'true') {
    console.error(`\n🛑 USE_TESTNET n'est pas "true" — arrêt par sécurité.`);
    console.error(`   Ce script ne doit JAMAIS tourner contre le mainnet.\n`);
    process.exit(1);
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

const { getAssetPrice, getFundingRate, placeOrder } = require('./lib/hyperliquid.js');

// ─── HELPERS D'AFFICHAGE ──────────────────────────────────────────────────────

const OK   = '✅';
const FAIL = '❌';
const WARN = '⚠️ ';
const SEP  = '─'.repeat(55);

function pass(label, detail = '') {
    console.log(`${OK}  ${label}${detail ? `  →  ${detail}` : ''}`);
}

function fail(label, err) {
    console.error(`${FAIL}  ${label}  →  ${err}`);
}

function section(title) {
    console.log(`\n${SEP}\n   ${title}\n${SEP}`);
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

async function runTests() {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`   🧪  Smoke Test — Hyperliquid Testnet`);
    console.log(`${'═'.repeat(55)}`);
    console.log(`   Wallet  : ${process.env.HYPERLIQUID_WALLET_ADDRESS}`);
    console.log(`   Réseau  : TESTNET`);

    let passed = 0;
    let failed = 0;

    // ── TEST 1 : Prix ETH ────────────────────────────────────────────────────
    section('TEST 1 · Prix ETH');
    try {
        const ethPrice = await getAssetPrice('ETH');
        if (!ethPrice || ethPrice <= 0) throw new Error(`Prix invalide : ${ethPrice}`);
        pass('getAssetPrice("ETH")', `${ethPrice.toFixed(2)} $`);
        passed++;
    } catch (err) {
        fail('getAssetPrice("ETH")', err.message);
        failed++;
    }

    // ── TEST 2 : Prix BTC (même appel, depuis le cache) ──────────────────────
    section('TEST 2 · Prix BTC (depuis cache)');
    try {
        const t0 = Date.now();
        const btcPrice = await getAssetPrice('BTC');
        const elapsed  = Date.now() - t0;
        if (!btcPrice || btcPrice <= 0) throw new Error(`Prix invalide : ${btcPrice}`);
        pass('getAssetPrice("BTC")', `${btcPrice.toFixed(2)} $  (${elapsed}ms — doit être < 5ms si cache actif)`);
        if (elapsed > 100) console.warn(`${WARN} Cache non utilisé ? (${elapsed}ms)`);
        passed++;
    } catch (err) {
        fail('getAssetPrice("BTC")', err.message);
        failed++;
    }

    // ── TEST 3 : Funding Rate ETH ─────────────────────────────────────────────
    section('TEST 3 · Funding Rate ETH');
    try {
        const fr = await getFundingRate('ETH');
        if (fr === null) throw new Error('getFundingRate a retourné null');
        const frPct = (fr * 100).toFixed(4);
        const frStatus = fr < -0.0003
            ? `${WARN} TROP NÉGATIF — Short serait annulé (${frPct}%)`
            : `${OK} OK pour shorter (${frPct}%)`;
        pass('getFundingRate("ETH")', `${frPct}%`);
        console.log(`   ↳ Règle V2 : ${frStatus}`);
        passed++;
    } catch (err) {
        fail('getFundingRate("ETH")', err.message);
        failed++;
    }

    // ── TEST 4 : Asset introuvable (doit échouer gracieusement) ──────────────
    section('TEST 4 · Asset inconnu (doit retourner null sans crash)');
    try {
        const price = await getAssetPrice('FAKECOIN_XYZ');
        if (price !== null) throw new Error(`Attendu null, reçu : ${price}`);
        pass('getAssetPrice("FAKECOIN_XYZ")', 'retourne null correctement');
        passed++;
    } catch (err) {
        fail('getAssetPrice("FAKECOIN_XYZ")', err.message);
        failed++;
    }

    // ── TEST 5 : Ordre LONG micro (0.001 ETH) ────────────────────────────────
    section('TEST 5 · Ordre LONG micro — 0.001 ETH');
    console.log(`   ℹ️  Ordre IOC minuscule. S'il ne se remplit pas (prix trop loin),`);
    console.log(`      Hyperliquid le rejette silencieusement : c'est NORMAL en testnet.`);
    console.log(`      Ce qui compte : pas d'erreur de signature / format.\n`);
    try {
        const ethPrice = await getAssetPrice('ETH');
        if (!ethPrice) throw new Error('Prix ETH indisponible, test ignoré');

        // Taille minimale : 0.001 ETH (szDecimals = 4 → 0.0010 est valide)
        const result = await placeOrder('ETH', true, 0.001, ethPrice);

        if (result === true) {
            pass('placeOrder("ETH", BUY, 0.001)', 'Requête acceptée par Hyperliquid');
        } else {
            throw new Error('placeOrder a retourné false');
        }
        passed++;
    } catch (err) {
        fail('placeOrder ETH LONG', err.message);
        failed++;
    }

    // ── TEST 6 : Ordre SHORT micro (0.001 ETH) ───────────────────────────────
    section('TEST 6 · Ordre SHORT micro — 0.001 ETH');
    try {
        const ethPrice = await getAssetPrice('ETH');
        if (!ethPrice) throw new Error('Prix ETH indisponible, test ignoré');

        const result = await placeOrder('ETH', false, 0.001, ethPrice);

        if (result === true) {
            pass('placeOrder("ETH", SHORT, 0.001)', 'Requête acceptée par Hyperliquid');
        } else {
            throw new Error('placeOrder a retourné false');
        }
        passed++;
    } catch (err) {
        fail('placeOrder ETH SHORT', err.message);
        failed++;
    }

    // ── BILAN ────────────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`   BILAN : ${passed} passés  |  ${failed} échoués`);
    console.log(`${'═'.repeat(55)}\n`);

    if (failed === 0) {
        console.log(`🎉 Tous les tests sont passés. hyperliquid.js est opérationnel.\n`);
    } else {
        console.log(`🔧 ${failed} test(s) à corriger avant de déployer.\n`);
        process.exit(1);
    }
}

// ─── LANCEMENT ────────────────────────────────────────────────────────────────

runTests().catch(err => {
    console.error('\n💥 Erreur inattendue :', err);
    process.exit(1);
});