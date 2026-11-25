'use strict';
/**
 * build.js — produces the single self-contained app file dist/mathe7.html:
 *   1. rebuilds engine.js from src/ (tools/bundle-engine.js)
 *   2. inlines ui/styles.css, catalog.json, exams.json, engine.js and the UI scripts into ui/index.html
 * Output is deterministic (no timestamps), so a test can check that dist/ is up to date.
 * Usage: node build.js
 */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function build() {
  require('./tools/bundle-engine.js');
  const catalog = JSON.parse(read('catalog.json'));
  const engine = read('engine.js');
  const app = read('ui/app.js').replace('/*@VIEWS*/', () => read('ui/views-practice.js') + '\n' + read('ui/views-other.js') + '\n' + read('ui/views-worksheet.js') + '\n' + read('ui/views-standort.js') + '\n' + read('ui/views-ka.js'));
  // Inline <script> content must not contain "</script" (or "<!--"); JSON gets "<" escaped.
  const safeScript = (s, name) => {
    if (/<\/script|<!--/i.test(s)) throw new Error(`${name} contains </script or <!-- and cannot be inlined`);
    return s;
  };
  const catalogJson = JSON.stringify(catalog).replace(/</g, '\\u003c');
  const examsJson = JSON.stringify(JSON.parse(read('exams.json'))).replace(/</g, '\\u003c');
  let html = read('ui/index.html');
  const parts = { '/*@CSS*/': read('ui/styles.css'), '/*@PAGECSS*/': read('ui/print-page.css'), '/*@CATALOG*/': catalogJson, '/*@EXAMS*/': examsJson, '/*@ENGINE*/': safeScript(engine, 'engine.js'), '/*@APP*/': safeScript(app, 'app.js') };
  for (const [marker, content] of Object.entries(parts)) {
    if (html.split(marker).length !== 2) throw new Error(`marker ${marker} must occur exactly once`);
    html = html.replace(marker, () => content);
  }
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  const out = path.join(root, 'dist', 'mathe7.html');
  // atomic write: tests running in parallel may build and read dist/ at the same time
  const tmp = `${out}.${process.pid}.tmp`; fs.writeFileSync(tmp, html); fs.renameSync(tmp, out);
  return { out, bytes: Buffer.byteLength(html) };
}

if (require.main === module) {
  const r = build();
  console.log(`${path.relative(root, r.out)} written (${(r.bytes / 1024).toFixed(1)} KiB)`);
}
module.exports = { build };
