'use strict';
/**
 * S11 (D86) / S12 (D93): adding families grows the template pool, so a NEW worksheet with the same settings and seed
 * picks other questions. Stored worksheets keep their question ids and must still reload and print exactly.
 * This file pins the golden worksheets of Session 10 and Session 11.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

for (const session of ['s10', 's11']) {
  const file = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', `worksheet.${session}.golden.json`), 'utf8'));
  test(`Session-${session.slice(1)} worksheets reload with identical student sheet and answer key`, () => {
    assert.equal(file.worksheets.length, 6);
    for (const { worksheet, layout } of file.worksheets) {
      const r = E.loadWorksheet(worksheet);
      assert.ok(r.ok, `${worksheet.code}: ${r.message}`);
      assert.deepEqual(E.worksheetLayout(r.worksheet, r.questions), layout, worksheet.code);
    }
  });
}
