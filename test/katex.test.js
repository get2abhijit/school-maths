'use strict';
/**
 * Every $…$ segment in every generated text renders in KaTeX 0.16.22 (MathML output, throwOnError).
 * KaTeX is an optional dev dependency (`npm i --no-save katex@0.16.22`); without it this file is skipped.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/index.js');
let katex = null;
try { katex = require('katex'); } catch (e) { /* optional */ }

function texts(q) {
  const t = [q.prompt, q.instructions, ...(q.promptLines || []), ...(q.promptTable ? [...q.promptTable.columns, ...q.promptTable.rows.flat()] : []), ...q.hints.map(h => h.text), ...q.solution.steps, q.solution.result];
  const a = q.answer;
  (a.options || []).forEach(o => t.push(o.text, o.feedback));
  (a.items || []).forEach(o => t.push(o.text));
  (a.cells || []).forEach(c => t.push(c.label, ...(c.spec.distractors || []).map(d => d.feedback)));
  (a.distractors || []).forEach(d => t.push(d.feedback));
  if (a.grid) t.push(...a.grid.columns, ...a.grid.rows.flat().map(e => e.text));
  return t.filter(Boolean);
}

test('KaTeX renders all generated formulas (60 seeds × every template/level) and the catalog texts', { skip: katex ? false : 'katex not installed (optional)' }, () => {
  assert.equal(katex.version, '0.16.22', 'test the version the app pins');
  const all = [];
  for (const t of E.TEMPLATES) for (const l of t.levels) for (let s = 1; s <= 60; s++) all.push(...texts(E.generateQuestion(t.id, s, l)));
  const cat = require('../catalog.json');
  JSON.stringify(cat, (k, v) => { if (typeof v === 'string' && v.includes('$')) all.push(v); return v; });
  let n = 0;
  for (const x of all) {
    const parts = x.split('$');
    assert.equal(parts.length % 2, 1, `unbalanced $ in: ${x}`);
    for (let i = 1; i < parts.length; i += 2) { katex.renderToString(parts[i], { throwOnError: true, output: 'mathml', strict: 'error' }); n++; }
  }
  assert.ok(n > 10000, `only ${n} formulas`);
});

test('KaTeX renders every formula of printed worksheets (student sheets and answer keys, 40 sheets)', { skip: katex ? false : 'katex not installed (optional)' }, () => {
  const texts = [];
  for (let s = 1; s <= 40; s++) {
    const { worksheet, questions } = E.createWorksheet({ skills: E.skillsWithTemplates(), levels: [1, 2, 3, 4], count: 30, baseSeed: s, keyMode: 'worked' });
    const L = E.worksheetLayout(worksheet, questions);
    JSON.stringify(L, (k, v) => { if (typeof v === 'string') texts.push(v); return v; });
  }
  let n = 0;
  for (const x of texts) {
    const parts = x.split('$');
    assert.equal(parts.length % 2, 1, `unbalanced $ in: ${x}`);
    for (let i = 1; i < parts.length; i += 2) { katex.renderToString(parts[i], { throwOnError: true, output: 'mathml', strict: 'error' }); n++; }
  }
  assert.ok(n > 5000, `only ${n} formulas`);
});
