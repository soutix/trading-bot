/**
 * api/auth.js — Authentification dashboard
 * Vérifie le mot de passe contre la variable d'environnement DASHBOARD_PASSWORD.
 * Retourne un token signé (timestamp + hash simple) valable 24h.
 */

const crypto = require('crypto');

const SECRET = process.env.DASHBOARD_PASSWORD || 'changeme';

function makeToken() {
    const expires = Date.now() + 24 * 3600 * 1000; // 24h
    const payload = `${expires}`;
    const sig     = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
    return `${expires}.${sig}`;
}

function verifyToken(token) {
    if (!token) return false;
    const [expires, sig] = token.split('.');
    if (!expires || !sig) return false;
    if (Date.now() > parseInt(expires)) return false;
    const expected = crypto.createHmac('sha256', SECRET).update(expires).digest('hex').slice(0, 16);
    return sig === expected;
}

module.exports = async function handler(req, res) {
    // POST /api/auth — login avec mot de passe
    if (req.method === 'POST') {
        const { password } = req.body || {};
        if (!password || password !== SECRET) {
            return res.status(401).json({ error: 'Mot de passe incorrect.' });
        }
        return res.status(200).json({ token: makeToken() });
    }

    // GET /api/auth — vérifier un token existant
    if (req.method === 'GET') {
        const auth  = req.headers.authorization || '';
        const token = auth.replace('Bearer ', '');
        if (verifyToken(token)) {
            return res.status(200).json({ valid: true });
        }
        return res.status(401).json({ valid: false });
    }

    res.status(405).json({ error: 'Method not allowed' });
};