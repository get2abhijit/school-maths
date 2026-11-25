'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('engine.js is in sync with src/ and free of DOM/network/eval', () => {
  const root = path.join(__dirname, '..');
  const bundle = fs.readFileSync(path.join(root, 'engine.js'), 'utf8');
  for (const m of ['core', 'expr', 'question', 'index']) {
    assert.ok(bundle.includes(fs.readFileSync(path.join(root, 'src', `${m}.js`), 'utf8')), `engine.js out of date for src/${m}.js — run node tools/bundle-engine.js`);
  }
  const code = bundle.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  for (const bad of ['document.', 'localStorage', 'fetch(', 'XMLHttpRequest', 'eval(', 'new Function', 'Math.random']) {
    assert.ok(!code.includes(bad), `forbidden: ${bad}`);
  }
});

test('src and bundle agree', () => {
  const src = require('../src/index.js');
  const bun = require('../engine.js');
  const s = '3(x-2)-(4-x)';
  assert.equal(src.polyToString(src.toPoly(src.parse(s))), bun.polyToString(bun.toPoly(bun.parse(s))));
});
