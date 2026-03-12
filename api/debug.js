// api/debug.js — diagnostic pur, aucune dépendance
module.exports = function handler(req, res) {
  const results = {};

  const libs = ['../lib/sheets.js','../lib/portfolio.js','../lib/strategy.js',
                 '../lib/coinbase.js','../lib/telegram.js'];
  for (const lib of libs) {
    try {
      require(lib);
      results[lib] = 'OK';
    } catch(e) {
      results[lib] = `ERROR: ${e.message}`;
    }
  }

  return res.status(200).json({ node: process.version, results });
};
