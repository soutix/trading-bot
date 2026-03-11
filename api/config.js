const { testConnection } = require('../lib/coinbase.js');
module.exports = async function handler(req, res) {
  if (req.method==='OPTIONS') return res.status(200).end();
  if (req.method==='GET') {
    return res.status(200).json({
      PRODUCT_IDS: process.env.PRODUCT_IDS||'BTC-USD,ETH-USD',
      TREND_MA_DAYS: process.env.TREND_MA_DAYS||'200',
      MOMENTUM_DAYS: process.env.MOMENTUM_DAYS||'90',
      VOL_DAYS: process.env.VOL_DAYS||'20',
      TOP_K: process.env.TOP_K||'1',
      MIN_VOL_FLOOR: process.env.MIN_VOL_FLOOR||'1e-6',
      MAX_GROSS_EXPOSURE: process.env.MAX_GROSS_EXPOSURE||'0.8',
      FEE_TAKER_BPS: process.env.FEE_TAKER_BPS||'60',
      FEE_MAKER_BPS: process.env.FEE_MAKER_BPS||'40',
      SLIPPAGE_BPS: process.env.SLIPPAGE_BPS||'5',
      USE_TAKER_FEES: process.env.USE_TAKER_FEES||'true',
      PAPER_START_CASH_USD: process.env.PAPER_START_CASH_USD||'500',
      DRY_RUN: process.env.DRY_RUN||'true',
      coinbase_configured: !!(process.env.COINBASE_KEY_NAME&&process.env.COINBASE_PRIVATE_KEY),
      sheets_configured: !!process.env.APPS_SCRIPT_URL,
    });
  }
  if (req.method==='POST' && req.body?.action==='testConnection') {
    const result = await testConnection();
    return res.status(200).json(result);
  }
  return res.status(405).json({error:'Method not allowed'});
};
