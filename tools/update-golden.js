'use strict';
/** Regenerates test/golden/*.golden.json from the current engine.js. Review the diff before committing. */
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const { snapshot, worksheetSnapshot, GOLDEN_CHAPTERS } = require('./golden');
const dir = path.join(__dirname, '..', 'test', 'golden');
for (const ch of GOLDEN_CHAPTERS) {
  const snap = snapshot(E, ch);
  fs.writeFileSync(path.join(dir, `${ch}.golden.json`), JSON.stringify({ engineVersion: E.ENGINE_VERSION, questions: snap }, null, 1) + '\n');
  console.log(`${Object.keys(snap).length} golden questions written to test/golden/${ch}.golden.json`);
}
const ws = worksheetSnapshot(E);
fs.writeFileSync(path.join(dir, 'worksheet.golden.json'), JSON.stringify({ engineVersion: E.ENGINE_VERSION, worksheets: ws }, null, 1) + '\n');
console.log(`${ws.length} golden worksheets written to test/golden/worksheet.golden.json`);
