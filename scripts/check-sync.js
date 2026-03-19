/**
 * scripts/check-sync.js — Vérification synchronisation Supabase ↔ Hyperliquid
 *
 * Usage :
 *   node scripts/check-sync.js
 *   node scripts/check-sync.js --fix    (corrige automatiquement les écarts)
 *   node scripts/check-sync.js --json   (output JSON brut pour intégration CI)
 *
 * Requis dans .env :
 *   SUPABASE_URL, SUPABASE_ANON_KEY (ou SERVICE_KEY)
 *   HYPERLIQUID_MASTER_ADDRESS
 *   USE_TESTNET=true|false
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const IS_FIX  = process.argv.includes('--fix');
const IS_JSON = process.argv.includes('--json');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const isTestnet   = process.env.USE_TESTNET === 'true';
const INFO_URL    = isTestnet
    ? 'https://api.hyperliquid-testnet.xyz/info'
    : 'https://api.hyperliquid.xyz/info';
const MASTER_ADDR = process.env.HYPERLIQUID_MASTER_ADDRESS;

const TOLERANCE_PCT = 0.5; // % d'écart acceptable sur la taille de position

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt   = (n, d = 2) => (n != null ? parseFloat(n).toFixed(d) : 'N/A');
const pct   = (a, b)     => b ? Math.abs((a - b) / b * 100).toFixed(2) : '∞';
const GREEN  = s => IS_JSON ? s : `\x1b[32m${s}\x1b[0m`;
const RED    = s => IS_JSON ? s : `\x1b[31m${s}\x1b[0m`;
const YELLOW = s => IS_JSON ? s : `\x1b[33m${s}\x1b[0m`;
const BOLD   = s => IS_JSON ? s : `\x1b[1m${s}\x1b[0m`;
const DIM    = s => IS_JSON ? s : `\x1b[2m${s}\x1b[0m`;

const OK   = GREEN('✓ OK');
const WARN = YELLOW('⚠ WARN');
const FAIL = RED('✗ FAIL');

// ─── FETCH HYPERLIQUID ────────────────────────────────────────────────────────

async function fetchHyperliquid() {
    const res = await fetch(INFO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'clearinghouseState', user: MASTER_ADDR }),
    });
    if (!res.ok) throw new Error(`Hyperliquid API HTTP ${res.status}`);
    return res.json();
}

async function fetchHLPrices() {
    const res = await fetch(INFO_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    if (!res.ok) throw new Error(`Hyperliquid metaAndAssetCtxs HTTP ${res.status}`);
    return res.json();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
    const report = {
        timestamp:  new Date().toISOString(),
        network:    isTestnet ? 'testnet' : 'mainnet',
        checks:     [],
        issues:     [],
        fixed:      [],
        overall:    'OK',
    };

    const log = (status, label, detail = '', fix = null) => {
        report.checks.push({ status, label, detail, fix });
        if (status !== 'OK') {
            report.issues.push({ label, detail });
            if (report.overall === 'OK') report.overall = status;
            if (status === 'FAIL') report.overall = 'FAIL';
        }
        if (!IS_JSON) {
            const icon = status === 'OK' ? OK : status === 'WARN' ? WARN : FAIL;
            console.log(`  ${icon}  ${label}${detail ? DIM('  →  ' + detail) : ''}`);
        }
    };

    if (!IS_JSON) {
        console.log('\n' + BOLD('═══════════════════════════════════════════════'));
        console.log(BOLD('  CryptoBot V2 — Sync Check Supabase ↔ Hyperliquid'));
        console.log(BOLD('═══════════════════════════════════════════════'));
        console.log(DIM(`  Network : ${isTestnet ? 'TESTNET' : 'MAINNET'}`));
        console.log(DIM(`  Wallet  : ${MASTER_ADDR}`));
        console.log(DIM(`  Time    : ${new Date().toLocaleString('fr-FR')}\n`));
    }

    // ── 1. CONNECTIVITÉ ──────────────────────────────────────────────────────
    if (!IS_JSON) console.log(BOLD('[ 1/5 ] Connectivité'));

    let hlData, hlPrices, botState;

    try {
        hlData   = await fetchHyperliquid();
        hlPrices = await fetchHLPrices();
        log('OK', 'Hyperliquid API accessible');
    } catch (err) {
        log('FAIL', 'Hyperliquid API inaccessible', err.message);
        if (!IS_JSON) console.log('\n' + RED('Arrêt : impossible de continuer sans API Hyperliquid.\n'));
        process.exit(1);
    }

    try {
        const { data, error } = await supabase.from('bot_state').select('*').eq('id', 1).single();
        if (error) throw new Error(error.message);
        botState = data;
        log('OK', 'Supabase accessible');
    } catch (err) {
        log('FAIL', 'Supabase inaccessible', err.message);
        process.exit(1);
    }

    // ── 2. ÉTAT BOT_STATE ────────────────────────────────────────────────────
    if (!IS_JSON) console.log('\n' + BOLD('[ 2/5 ] État bot_state Supabase'));

    const mode  = botState.current_mode;
    const asset = botState.active_asset;

    log('OK', 'current_mode',       `"${mode}"`);
    log(asset || mode === 'CASH' ? 'OK' : 'WARN',
        'active_asset',
        asset ? `"${asset}"` : mode === 'CASH' ? 'null (CASH attendu)' : RED('null mais mode = ' + mode));

    const reqFields = ['entry_price', 'position_size', 'trailing_stop_level'];
    if (mode !== 'CASH') {
        for (const f of reqFields) {
            const v = parseFloat(botState[f]);
            log(v > 0 ? 'OK' : 'WARN', f, fmt(v, 4));
        }
    } else {
        for (const f of reqFields) {
            const v = parseFloat(botState[f]) || 0;
            log(v === 0 ? 'OK' : 'WARN', `${f} (devrait être 0 en CASH)`, fmt(v, 4));
        }
    }

    // ── 3. POSITIONS ON-CHAIN ────────────────────────────────────────────────
    if (!IS_JSON) console.log('\n' + BOLD('[ 3/5 ] Positions on-chain Hyperliquid'));

    const openPositions = (hlData.assetPositions || [])
        .filter(p => parseFloat(p.position.szi) !== 0)
        .map(p => ({
            coin:    p.position.coin,
            size:    Math.abs(parseFloat(p.position.szi)),
            side:    parseFloat(p.position.szi) > 0 ? 'LONG' : 'SHORT',
            entryPx: parseFloat(p.position.entryPx),
            markPx:  parseFloat(p.position.positionValue) / Math.abs(parseFloat(p.position.szi)),
            pnl:     parseFloat(p.position.unrealizedPnl),
            margin:  parseFloat(p.position.marginUsed),
        }));

    if (openPositions.length === 0) {
        log(mode === 'CASH' ? 'OK' : 'FAIL',
            'Positions on-chain',
            mode === 'CASH' ? 'Aucune (cohérent avec CASH)' : `Aucune — Supabase dit ${mode} ${asset}`);
    } else {
        for (const pos of openPositions) {
            log('OK', `Position on-chain`, `${pos.side} ${pos.coin} | size: ${fmt(pos.size, 4)} | entry: $${fmt(pos.entryPx)} | PnL: $${fmt(pos.pnl)}`);
        }
    }

    // ── 4. COMPARAISON SUPABASE ↔ HYPERLIQUID ────────────────────────────────
    if (!IS_JSON) console.log('\n' + BOLD('[ 4/5 ] Comparaison Supabase ↔ Hyperliquid'));

    const fixPayload = {};

    if (mode === 'CASH' && openPositions.length === 0) {
        log('OK', 'Mode CASH cohérent', 'Aucune position des deux côtés');

    } else if (mode !== 'CASH' && openPositions.length === 0) {
        log('FAIL', 'DÉSYNCHRONISATION CRITIQUE',
            `Supabase: ${mode} ${asset} — Hyperliquid: aucune position ouverte`);
        Object.assign(fixPayload, { current_mode: 'CASH', active_asset: null, position_size: 0, entry_price: 0, trailing_stop_level: 0 });

    } else if (mode === 'CASH' && openPositions.length > 0) {
        const pos = openPositions[0];
        log('WARN', 'DÉSYNCHRONISATION INVERSE',
            `Supabase: CASH — Hyperliquid: ${pos.side} ${pos.coin} @ $${fmt(pos.entryPx)}`);
        log('WARN', 'Action recommandée', 'Corriger Supabase avec les données on-chain ou fermer la position Hyperliquid');

    } else {
        // Mode actif des deux côtés — vérifier cohérence détaillée
        const hlPos = openPositions.find(p => p.coin === asset);

        if (!hlPos) {
            const otherCoins = openPositions.map(p => p.coin).join(', ');
            log('FAIL', 'Asset mismatch',
                `Supabase: ${mode} ${asset} — Hyperliquid: positions sur ${otherCoins}`);
            const first = openPositions[0];
            Object.assign(fixPayload, {
                active_asset:  first.coin,
                current_mode:  first.side,
                entry_price:   first.entryPx,
                position_size: first.size,
            });
        } else {
            // ── Side ──
            if (hlPos.side === mode) {
                log('OK', 'Direction (side)', `${mode} ↔ ${hlPos.side}`);
            } else {
                log('FAIL', 'Direction incorrecte', `Supabase: ${mode} — Hyperliquid: ${hlPos.side}`);
                fixPayload.current_mode = hlPos.side;
            }

            // ── Entry price ──
            const entryDb = parseFloat(botState.entry_price);
            const entryHL = hlPos.entryPx;
            const entryDiff = pct(entryDb, entryHL);
            if (parseFloat(entryDiff) < TOLERANCE_PCT) {
                log('OK', 'Prix d\'entrée', `Supabase: $${fmt(entryDb)} — Hyperliquid: $${fmt(entryHL)} (écart: ${entryDiff}%)`);
            } else {
                log('WARN', 'Écart prix d\'entrée', `Supabase: $${fmt(entryDb)} — Hyperliquid: $${fmt(entryHL)} (écart: ${entryDiff}%)`);
                fixPayload.entry_price = entryHL;
            }

            // ── Position size ──
            const sizeDb = parseFloat(botState.position_size);
            const sizeHL = hlPos.size;
            const sizeDiff = pct(sizeDb, sizeHL);
            if (parseFloat(sizeDiff) < TOLERANCE_PCT) {
                log('OK', 'Taille position', `Supabase: ${fmt(sizeDb, 4)} — Hyperliquid: ${fmt(sizeHL, 4)} (écart: ${sizeDiff}%)`);
            } else {
                log('WARN', 'Écart taille position', `Supabase: ${fmt(sizeDb, 4)} — Hyperliquid: ${fmt(sizeHL, 4)} (écart: ${sizeDiff}%)`);
                fixPayload.position_size = sizeHL;
            }

            // ── PnL ──
            log('OK', 'PnL on-chain',
                `$${fmt(hlPos.pnl)} | Margin utilisée: $${fmt(hlPos.margin)}`);
        }
    }

    // ── 5. SOLDE & ORDRES OUVERTS ────────────────────────────────────────────
    if (!IS_JSON) console.log('\n' + BOLD('[ 5/5 ] Solde & Ordres ouverts'));

    const balance = parseFloat(hlData.marginSummary?.accountValue || 0);
    const available = parseFloat(hlData.marginSummary?.withdrawable || 0);
    log(balance > 0 ? 'OK' : 'WARN', 'Solde compte',
        `Total: $${fmt(balance)} | Disponible: $${fmt(available)}`);

    // Ordres ouverts (stops natifs)
    try {
        const ordersRes = await fetch(INFO_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ type: 'openOrders', user: MASTER_ADDR }),
        });
        const orders = await ordersRes.json();
        if (orders.length === 0) {
            log(mode === 'CASH' ? 'OK' : 'WARN',
                'Ordres ouverts (stops)',
                mode === 'CASH' ? 'Aucun (cohérent)' : 'Aucun stop natif — protection uniquement via cron');
        } else {
            for (const o of orders) {
                log('OK', `Ordre stop actif`,
                    `${o.side === 'B' ? 'BUY' : 'SELL'} ${o.coin} | trigger: $${fmt(o.triggerPx)} | size: ${fmt(o.sz, 4)}`);
            }
        }
    } catch {
        log('WARN', 'Impossible de récupérer les ordres ouverts');
    }

    // ── AUTO-FIX ─────────────────────────────────────────────────────────────
    if (Object.keys(fixPayload).length > 0) {
        if (!IS_JSON) {
            console.log('\n' + BOLD('[ FIX ] Corrections détectées'));
            console.log(DIM('  Payload :'), fixPayload);
        }

        if (IS_FIX) {
            try {
                const { error } = await supabase.from('bot_state').update(fixPayload).eq('id', 1);
                if (error) throw new Error(error.message);
                report.fixed = Object.keys(fixPayload);
                if (!IS_JSON) console.log(GREEN('  ✓ Supabase corrigé automatiquement'));
            } catch (err) {
                if (!IS_JSON) console.log(RED(`  ✗ Correction échouée: ${err.message}`));
            }
        } else {
            if (!IS_JSON) {
                console.log(YELLOW('  Relancez avec --fix pour corriger automatiquement :'));
                console.log(DIM('  node scripts/check-sync.js --fix'));
            }
        }
    }

    // ── RÉSUMÉ FINAL ─────────────────────────────────────────────────────────
    if (!IS_JSON) {
        console.log('\n' + BOLD('═══════════════════════════════════════════════'));
        const icon = report.overall === 'OK' ? GREEN('✓ TOUT EST SYNCHRONISÉ')
            : report.overall === 'WARN' ? YELLOW('⚠ AVERTISSEMENTS DÉTECTÉS')
            : RED('✗ DÉSYNCHRONISATION CRITIQUE');
        console.log(`  ${icon}`);
        console.log(`  ${report.checks.length} vérifications | ${report.issues.length} problème(s)`);
        if (report.issues.length > 0) {
            console.log('\n  Problèmes :');
            report.issues.forEach(i => console.log(`    ${RED('•')} ${i.label}: ${DIM(i.detail)}`));
        }
        console.log(BOLD('═══════════════════════════════════════════════\n'));
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    process.exit(report.overall === 'FAIL' ? 1 : 0);
}

main().catch(err => {
    console.error('Erreur fatale:', err.message);
    process.exit(1);
});