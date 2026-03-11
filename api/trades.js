// api/trades.js
import { getTrades } from '../lib/sheets.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const limit  = parseInt(req.query?.limit) || 100;
    const trades = await getTrades(limit);
    return res.status(200).json({ trades });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
