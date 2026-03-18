/**
 * 🧪 SMOKE TEST — Stratégie multi-actifs (ETH + SOL, lighthouse BTC)
 *
 * Valide sans placer d'ordres :
 *   1. Solde master wallet
 *   2. Prix live pour BTC, ETH, SOL (cache partagé)
 *   3. Bougies + indicateurs (MA200, ATR, pente, momentum) par actif
 *   4. Signal LONG / SHORT / CASH par actif
 *   5. Ranking momentum/ATR
 *   6. Sélection du winner + sizing de position
 *
 * Usage :
 *   node test-strategy.js
 */

require('dotenv').config();

if (process.env.USE_TESTNET !== 'true') {
    console.error('\n🛑 USE_TESTNET doit être "true". Arrêt par sécurité.\n');
    process.exit(1);
}

const { getAssetPrice, getAccountBalance } = require('./lib/hyperliquid.js');
const { getCandles }                        = require('./lib/market.js');
const {
    calculateMA, calculateSlope, calculateATR,
    calculateMomentum, getSignal, calculatePositionSize,
    rankAssets, MOMENTUM_WINDOWS
} = require('./lib/strategy.js');

const SEP = '─'.repeat(55);
function section(title) { console.log(`\n${SEP}\n   ${title}\n${SEP}`); }
function pass(label, detail = '') { console.log(`✅  ${label}${detail ? `  →  ${detail}` : ''}`); }
function fail(label, err)         { console.error(`❌  ${label}  →  ${err}`); }

const TRADABLE   = ['ETH', 'SOL'];
const LIGHTHOUSE = 'BTC';
const ALL_COINS  = [LIGHTHOUSE, ...TRADABLE];

async function runTests() {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`   🧪  Smoke Test — Stratégie Multi-Actifs`);
    console.log(`${'═'.repeat(55)}`);

    let passed = 0, failed = 0;

    // ── TEST 1 : Solde réel ───────────────────────────────────────────────────
    section('TEST 1 · Solde master wallet');
    let capital = null;
    try {
        capital = await getAccountBalance();
        if (!capital || capital <= 0) throw new Error(`Solde invalide : ${capital}`);
        pass('getAccountBalance()', `${capital.toFixed(2)} USDC`);
        passed++;
    } catch (err) { fail('getAccountBalance()', err.message); failed++; }

    // ── TEST 2 : Prix live ────────────────────────────────────────────────────
    section('TEST 2 · Prix live (cache meta partagé)');
    const pricesMap = {};
    try {
        const t0 = Date.now();
        await Promise.all(ALL_COINS.map(async coin => {
            pricesMap[coin] = await getAssetPrice(coin);
        }));
        const elapsed = Date.now() - t0;
        const allOk = ALL_COINS.every(c => pricesMap[c] > 0);
        if (!allOk) throw new Error('Un ou plusieurs prix invalides');
        ALL_COINS.forEach(c => pass(c, `${pricesMap[c].toFixed(2)} $`));
        pass('Cache meta', `${elapsed}ms${elapsed < 100 ? ' — cache actif ✓' : ' — vérifier cache'}`);
        passed++;
    } catch (err) { fail('Prix live', err.message); failed++; }

    // ── TEST 3 : Bougies + indicateurs ───────────────────────────────────────
    section('TEST 3 · Bougies + indicateurs par actif');
    const indicatorsMap = {};

    for (const coin of ALL_COINS) {
        try {
            const candles = await getCandles(coin);
            if (!candles || candles.length < 205)
                throw new Error(`Bougies insuffisantes : ${candles?.length}`);

            const prices   = candles.map(c => c.close);
            const atr      = calculateATR(candles, 14);
            const ma200    = calculateMA(prices, 200);
            const window   = MOMENTUM_WINDOWS[coin] || 90;
            const momentum = calculateMomentum(prices, window);

            // Historique MA200 sur 6 points pour la pente
            const maHistory = [];
            for (let i = prices.length - 6; i <= prices.length - 1; i++) {
                maHistory.push(calculateMA(prices.slice(0, i + 1), 200));
            }
            const slope = calculateSlope(maHistory, 5);

            if (!atr || !ma200 || slope === null || momentum === null)
                throw new Error(`Indicateur null — ATR:${atr} MA200:${ma200} slope:${slope} mom:${momentum}`);

            const price    = pricesMap[coin];
            const maGapPct = ((price - ma200) / ma200 * 100).toFixed(2);

            pass(coin, `MA200: ${ma200.toFixed(0)} (${maGapPct > 0 ? '+' : ''}${maGapPct}%) | ATR: ${atr.toFixed(2)} | Pente: ${slope > 0 ? '↗' : '↘'} | Mom(${window}b): ${(momentum*100).toFixed(2)}%`);

            indicatorsMap[coin] = { coin, candles, prices, atr, ma200, slope, momentum };
            passed++;
        } catch (err) { fail(`Indicateurs ${coin}`, err.message); failed++; }
    }

    // ── TEST 4 : Signals ──────────────────────────────────────────────────────
    section('TEST 4 · Signals LONG / SHORT / CASH');
    const btcMa200 = indicatorsMap[LIGHTHOUSE]?.ma200;
    const btcPrice = pricesMap[LIGHTHOUSE];
    const btcDir   = btcPrice > btcMa200 ? 'haussier 🟢' : 'baissier 🔴';
    console.log(`   BTC lighthouse : ${btcDir} (${btcPrice?.toFixed(0)} $ vs MA200 ${btcMa200?.toFixed(0)} $)`);
    console.log(`   Shorts altcoins : ${btcPrice < btcMa200 ? 'AUTORISÉS' : 'FILTRÉS (BTC haussier)'}\n`);

    const assetsData = [];
    try {
        for (const coin of TRADABLE) {
            const ind    = indicatorsMap[coin];
            if (!ind) throw new Error(`Pas d'indicateurs pour ${coin}`);
            const price  = pricesMap[coin];
            const signal = getSignal(price, ind.ma200, ind.slope, btcPrice, btcMa200);
            ind.signal   = signal;
            const icon   = signal === 'LONG' ? '🟢' : signal === 'SHORT' ? '🔴' : '⚪';
            pass(`Signal ${coin}`, `${icon} ${signal}`);
            assetsData.push(ind);
        }
        passed++;
    } catch (err) { fail('Signals', err.message); failed++; }

    // ── TEST 5 : Ranking ──────────────────────────────────────────────────────
    section('TEST 5 · Ranking momentum / ATR');
    let ranked = [];
    try {
        ranked = rankAssets(assetsData);
        if (!ranked || ranked.length === 0) throw new Error('rankAssets a retourné un tableau vide');

        console.log('   Classement :\n');
        const maxScore = ranked[0].score || 1;
        ranked.forEach((a, i) => {
            const barLen = Math.max(1, Math.round((a.score / maxScore) * 20));
            const bar    = '█'.repeat(barLen);
            console.log(`   ${i + 1}. ${a.coin.padEnd(4)}  score: ${a.score.toFixed(4).padStart(9)}  ${bar}`);
            console.log(`        mom: ${(a.momentum*100).toFixed(2)}%  ATR: ${a.atr.toFixed(2)}  signal: ${a.signal}\n`);
        });

        pass('rankAssets()', `${ranked.length} actifs classés`);
        passed++;
    } catch (err) { fail('Ranking', err.message); failed++; }

    // ── TEST 6 : Winner + sizing ──────────────────────────────────────────────
    section('TEST 6 · Winner + sizing de position');
    try {
        const winner = ranked.find(a => a.signal === 'LONG' || a.signal === 'SHORT') || null;

        if (!winner) {
            pass('Décision', 'CASH — aucun actif qualifié (normal si marché neutre)');
        } else {
            const winnerPrice  = pricesMap[winner.coin];
            const stopLevel    = winner.signal === 'SHORT'
                ? winnerPrice + (1.5 * winner.atr)
                : winnerPrice - (1.5 * winner.atr);
            const exposure     = winner.signal === 'LONG' ? '80%' : '40%';
            const posSize      = capital ? calculatePositionSize(capital, winnerPrice, winner.signal) : null;

            pass('Winner',  `${winner.signal} ${winner.coin}  (score: ${winner.score.toFixed(4)})`);
            if (posSize) {
                const notional = posSize * winnerPrice;
                pass('Sizing', `${posSize.toFixed(4)} ${winner.coin}  ≈ ${notional.toFixed(0)} $  (${exposure} du capital)`);
            }
            pass('Stop initial', `${stopLevel.toFixed(2)} $  (entrée ${winner.signal === 'SHORT' ? '+' : '-'} 1.5 × ATR)`);
        }
        passed++;
    } catch (err) { fail('Winner / Sizing', err.message); failed++; }

    // ── BILAN ─────────────────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`   BILAN : ${passed} passés  |  ${failed} échoués`);
    console.log(`${'═'.repeat(55)}\n`);

    if (failed === 0) {
        console.log(`🎉 Stratégie multi-actifs validée et prête.\n`);
        console.log(`   Cycles automatiques : 00h · 08h · 16h UTC`);
        console.log(`   Forcer un cycle     : POST /api/rebalance\n`);
    } else {
        console.log(`🔧 ${failed} test(s) à corriger avant de déployer.\n`);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('\n💥 Erreur inattendue :', err);
    process.exit(1);
});