const { getState } = require('../lib/sheets.js');
module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  try {
    const state = await getState();
    return res.status(200).json({signals: state?.last_signals_detail||[]});
  } catch(e) { return res.status(500).json({error:e.message}); }
};
