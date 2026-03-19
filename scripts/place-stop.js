/**
 * scripts/place-stop.js — Place un stop natif Hyperliquid sur la position active
 *
 * Usage :
 *   node scripts/place-stop.js
 *
 * Lit bot_state depuis Supabase, calcule le stop si absent, et le place sur Hyperliquid.
 */

require('dotenv').config();
const { createClient }   = require('@supabase/supabase-js');
const { placeStopOrder, getOpenPosition } = require('../lib/hyperliquid.js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function main() {
    console.log('📋 Lecture bot_state depuis Supabase...');
    const { data: botState, error } = await supabase
        .from('bot_state').select('*').eq('id', 1).single();

    if (error) { console.error('❌ Erreur Supabase:', error.message); process.exit(1); }

    const { current_mode, active_asset, entry_price, position_size, trailing_stop_level } = botState;

    console.log(`   Mode          : ${current_mode}`);
    console.log(`   Actif         : ${active_asset}`);
    console.log(`   Entrée        : $${entry_price}`);
    console.log(`   Taille        : ${position_size}`);
    console.log(`   Trailing Stop : $${trailing_stop_level}`);

    if (current_mode === 'CASH' || !active_asset) {
        console.log('\n⚪ Bot en CASH — aucun stop à placer.');
        process.exit(0);
    }

    console.log('\n🔍 Vérification position on-chain...');
    const pos = await getOpenPosition(active_asset);
    if (!pos) {
        console.error(`❌ Aucune position ${active_asset} trouvée sur Hyperliquid. Rien à protéger.`);
        process.exit(1);
    }
    console.log(`   ✓ ${pos.side} ${pos.coin} | size: ${pos.size} | entry: $${pos.entryPx}`);

    const stopLevel = parseFloat(trailing_stop_level) || (
        current_mode === 'SHORT'
            ? parseFloat(entry_price) * 1.05   // fallback +5% si stop manquant
            : parseFloat(entry_price) * 0.95   // fallback -5%
    );

    const isBuyToClose = current_mode === 'SHORT'; // SHORT → BUY pour fermer

    console.log(`\n🛡️  Placement stop natif...`);
    console.log(`   Actif     : ${active_asset}`);
    console.log(`   Direction : ${isBuyToClose ? 'BUY (fermeture SHORT)' : 'SELL (fermeture LONG)'}`);
    console.log(`   Taille    : ${pos.size}`);
    console.log(`   Stop à    : $${stopLevel.toFixed(2)}`);

    const ok = await placeStopOrder(active_asset, isBuyToClose, pos.size, stopLevel);

    if (ok) {
        console.log(`\n✅ Stop natif placé avec succès @ $${stopLevel.toFixed(2)}`);
        console.log('   Lance node scripts/check-sync.js pour confirmer.');
    } else {
        console.error('\n❌ Échec du placement du stop. Vérifiez les logs Hyperliquid.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Erreur fatale:', err.message);
    process.exit(1);
});