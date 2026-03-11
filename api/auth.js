module.exports = function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method!=='POST') return res.status(405).end();
  const { password } = req.body||{};
  const secret = process.env.DASHBOARD_PASSWORD;
  if (!secret) return res.status(200).json({ok:true});
  return res.status(password===secret ? 200 : 401).json({ok: password===secret});
};
