const { getTrades } = require('../lib/sheets.js');
module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  try {
    const trades = await getTrades(parseInt(req.query?.limit)||100);
    return res.status(200).json({trades});
  } catch(e) { return res.status(500).json({error:e.message}); }
};
