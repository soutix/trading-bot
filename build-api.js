// build-api.js — bundles each API function into a self-contained file
const esbuild = require('esbuild');
const fs      = require('fs');
const path    = require('path');

const API_DIR  = path.join(__dirname, 'api');
const OUT_DIR  = path.join(__dirname, 'api-dist');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const files = fs.readdirSync(API_DIR)
  .filter(f => f.endsWith('.js') && !fs.statSync(path.join(API_DIR, f)).isDirectory());

Promise.all(files.map(file =>
  esbuild.build({
    entryPoints : [path.join(API_DIR, file)],
    outfile     : path.join(OUT_DIR, file),
    bundle      : true,
    platform    : 'node',
    target      : 'node20',
    format      : 'cjs',
    external    : [], // bundle everything including lib/
    minify      : false,
  })
)).then(() => {
  console.log(`✅ Bundled ${files.length} API functions to api-dist/`);
}).catch(e => { console.error(e); process.exit(1); });
