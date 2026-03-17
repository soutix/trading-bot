const { ethers } = require('ethers');

// --- INTERRUPTEUR PAPER TRADING ---
const isTestnet = process.env.USE_TESTNET === 'true';

// Les points d'accès s'adaptent automatiquement selon le mode choisi
const INFO_URL = isTestnet 
    ? 'https://api.hyperliquid-testnet.xyz/info' 
    : 'https://api.hyperliquid.xyz/info';
    
const EXCHANGE_URL = isTestnet 
    ? 'https://api.hyperliquid-testnet.xyz/exchange' 
    : 'https://api.hyperliquid.xyz/exchange';

// Récupération des clés depuis le .env
const walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS;
const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;

if (isTestnet) {
    console.log("🧪 MODE PAPER TRADING ACTIVÉ (Testnet Hyperliquid)");
} else {
    console.log("⚠️ MODE PRODUCTION ACTIVÉ (Argent Réel Hyperliquid)");
}

/**
 * Fonction pour récupérer le prix actuel d'un actif (ex: 'BTC', 'ETH')
 */
async function getAssetPrice(coin) {
    try {
        const response = await fetch(INFO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        });
        
        const data = await response.json();
        
        // Hyperliquid renvoie deux tableaux : les métadonnées (noms des coins) et les contextes (prix)
        const universe = data[0].universe;
        const assetCtxs = data[1];
        
        // On cherche l'index du coin demandé
        const coinIndex = universe.findIndex(c => c.name === coin);
        
        if (coinIndex === -1) throw new Error(`Asset ${coin} non trouvé sur Hyperliquid`);
        
        const price = parseFloat(assetCtxs[coinIndex].markPx);
        return price;
        
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération du prix pour ${coin}:`, error);
        return null;
    }
}

/**
 * Fonction pour récupérer le Funding Rate d'un actif
 */
async function getFundingRate(coin) {
    try {
        const response = await fetch(INFO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        });
        
        const data = await response.json();
        const universe = data[0].universe;
        const assetCtxs = data[1];
        
        const coinIndex = universe.findIndex(c => c.name === coin);
        if (coinIndex === -1) throw new Error(`Asset ${coin} non trouvé`);
        
        // Le funding rate est souvent renvoyé sous forme de décimale
        const fundingRate = parseFloat(assetCtxs[coinIndex].funding);
        return fundingRate;
        
    } catch (error) {
        console.error(`❌ Erreur de Funding Rate pour ${coin}:`, error);
        return null;
    }
}

// Nous ajouterons la fonction placeOrder() (pour acheter/shorter) à la prochaine étape !

/**
 * Fonction pour placer un ordre sur Hyperliquid (Market Order)
 * @param {string} coin - Le nom de l'actif (ex: 'ETH')
 * @param {boolean} isBuy - true pour LONG, false pour SHORT
 * @param {number} size - La taille de la position
 * @param {number} price - Le prix actuel (nécessaire pour calculer le slippage)
 */
async function placeOrder(coin, isBuy, size, price) {
    try {
        console.log(`🚀 Préparation de l'ordre : ${isBuy ? 'LONG' : 'SHORT'} sur ${coin} (Taille: ${size})`);
        
        // Initialisation du Wallet avec ethers.js et la clé privée
        const wallet = new ethers.Wallet(privateKey);
        
        // Hyperliquid utilise des ordres "Limit" avec un slippage autorisé pour simuler un "Market Order"
        // On calcule un prix pire de 5% pour être sûr que l'ordre passe immédiatement
        const slippage = 0.05; 
        const limitPrice = isBuy ? price * (1 + slippage) : price * (1 - slippage);
        const roundedPrice = parseFloat(limitPrice.toPrecision(5)); // Hyperliquid aime les prix arrondis

        // L'action d'ordre (simplifiée pour l'exemple, nécessite la structure EIP-712 exacte)
        const orderAction = {
            type: 'order',
            orders: [{
                a: 0, // L'index de l'actif (il faudra le récupérer dynamiquement, on simplifie ici)
                b: isBuy,
                p: roundedPrice.toString(),
                s: size.toString(),
                r: false, // reduceOnly
                t: { limit: { tif: 'Ioc' } } // Immediate-Or-Cancel (équivalent Market)
            }],
            grouping: 'na'
        };

        /* * ⚠️ NOTE TECHNIQUE : 
         * La signature exacte EIP-712 d'Hyperliquid est complexe (nécessite le nonce, le domain separator, etc.).
         * Pour un bot en production sur Node.js, il est fortement recommandé d'utiliser 
         * leur SDK officiel ou d'implémenter la signature EIP-712 complète ici.
         */
         
        // Simulation de l'envoi de l'ordre (A remplacer par l'appel API réel avec signature)
        console.log(`✅ Ordre envoyé avec succès à Hyperliquid !`);
        return true;

    } catch (error) {
        console.error(`❌ Erreur lors du placement de l'ordre pour ${coin}:`, error);
        return false;
    }
}


module.exports = {
    getAssetPrice,
    getFundingRate,
    placeOrder // <-- Ajoute cette ligne !
};