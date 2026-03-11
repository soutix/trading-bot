const { getLogs } = require('../lib/sheets.js');
module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  try {
    const logs = await getLogs(parseInt(req.query?.limit)||100);
    return res.status(200).json({logs});
  } catch(e) { return res.status(500).json({error:e.message}); }
};
