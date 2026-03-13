// api/config.js — CommonJS
const { testConnection } = require('../lib/coinbase.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    return res.status(200).json({
      PRODUCT_IDS              : process.env.PRODUCT_IDS               || 'BTC-USD,ETH-USD,SOL-USD',
      TREND_MA_DAYS            : process.env.TREND_MA_DAYS             || '200',
      MOMENTUM_DAYS_BTC        : process.env.MOMENTUM_DAYS_BTC         || '120',
      MOMENTUM_DAYS_ETH        : process.env.MOMENTUM_DAYS_ETH         || '90',
      MOMENTUM_DAYS_SOL        : process.env.MOMENTUM_DAYS_SOL         || '60',
      VOL_DAYS                 : process.env.VOL_DAYS                  || '20',
      ATR_DAYS                 : process.env.ATR_DAYS                  || '14',
      ATR_MULTIPLIER           : process.env.ATR_MULTIPLIER            || '2',
      TOP_K                    : process.env.TOP_K                     || '1',
      MAX_GROSS_EXPOSURE       : process.env.MAX_GROSS_EXPOSURE        || '0.8',
      FEE_TAKER_BPS            : process.env.FEE_TAKER_BPS             || '40',
      FEE_MAKER_BPS            : process.env.FEE_MAKER_BPS             || '25',
      SLIPPAGE_BPS             : process.env.SLIPPAGE_BPS              || '5',
      PAPER_START_CASH_USD     : process.env.PAPER_START_CASH_USD      || '500',
      DRY_RUN                  : process.env.DRY_RUN                   || 'true',
      STOP_LOSS_PCT            : process.env.STOP_LOSS_PCT             || '0.08',
      TRAILING_STOP_ACTIVATION : process.env.TRAILING_STOP_ACTIVATION  || '0.20',
      TRAILING_STOP_PCT        : process.env.TRAILING_STOP_PCT         || '0.10',
      ANTI_WHIPSAW_HOURS       : process.env.ANTI_WHIPSAW_HOURS        || '24',
      coinbase_configured      : !!(process.env.COINBASE_KEY_NAME && process.env.COINBASE_PRIVATE_KEY),
      sheets_configured        : !!process.env.APPS_SCRIPT_URL,
      telegram_configured      : !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    });
  }
  if (req.method === 'POST' && req.body?.action === 'testConnection') {
    const result = await testConnection();
    return res.status(200).json(result);
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
