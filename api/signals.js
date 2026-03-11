// api/signals.js
import { getState } from '../lib/sheets.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const state   = await getState();
    const signals = state?.last_signals_detail || [];
    return res.status(200).json({ signals });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
