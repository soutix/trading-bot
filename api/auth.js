// api/auth.js
// POST /api/auth — verifies the dashboard password

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const secret = process.env.DASHBOARD_PASSWORD;

  if (!secret) {
    // No password set — let through (dev mode)
    return res.status(200).json({ ok: true });
  }

  if (password === secret) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false });
}
