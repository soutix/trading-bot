// api/logs.js
import { getLogs } from '../lib/sheets.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const limit = parseInt(req.query?.limit) || 100;
    const logs  = await getLogs(limit);
    return res.status(200).json({ logs });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
