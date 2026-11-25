'use strict';
/**
 * Chapter 6 oracle tests: fixed parameters, expected results computed BY HAND (see comments), independent of the
 * engine's arithmetic. They also pin the generic additions of Session 6: numeric `unit`, `places`, table `grid`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch6.${id}`];
function build(t, p, level) {
  assert.equal(t.constraints(p, level), true, `${t.id}: constraints`);
  const body = t.build(p, level);
  assert.equal(E.validateAnswer(body.answer, t.solve(p, level)).status, 'correct', `${t.id}: independent solve`);
  return body;
}
const res = (spec, input) => E.validateAnswer(spec, input);
const status = (spec, input) => res(spec, input).status;
const cat = (spec, input) => res(spec, input).errorCategory;

// ---------------------------------------------------------------- generic: units, places, grid
test('unit: € and % inputs with and without unit; wrong unit is unit_confusion, unknown word is invalid', () => {
  const eur = { type: 'decimal', value: '4.5', tolerance: '0', places: 2, unit: '€', canonical: '4,50' };
  for (const ok of ['4,50', '4,5', '4.50', '4,50 €', '4,50€', '€ 4,50', '4,50 Euro', '4,50 EUR']) assert.equal(status(eur, ok), 'correct', ok);
  const r = res(eur, '4,50 %');
  assert.equal(r.status, 'incorrect'); assert.equal(r.errorCategory, 'unit_confusion'); assert.equal(r.code, 'unit_value_ok');
  assert.equal(res(eur, '5 %').code, 'unit_wrong');
  assert.equal(status(eur, '4,50 Euros'), 'invalid');
  assert.equal(status(eur, '4,40 €'), 'incorrect');
  const pc = { type: 'decimal', value: '37.5', tolerance: '0', unit: '%', canonical: '37,5' };
  for (const ok of ['37,5', '37,5 %', '37,5%', '37,5 Prozent']) assert.equal(status(pc, ok), 'correct', ok);
  assert.equal(status(pc, '0,375'), 'incorrect');
  const yrs = { type: 'integer', value: '4', unit: 'Jahre', canonical: '4' };
  for (const ok of ['4', '4 Jahre', '4 Jahr']) assert.equal(status(yrs, ok), 'correct', ok);
  // a spec WITHOUT unit keeps the old strict behaviour (Ch1/Ch4 unchanged)
  assert.equal(status({ type: 'integer', value: '42', canonical: '42' }, '42 %'), 'invalid');
});

test('rounding tolerance: half a cent accepts the exact value, not the neighbouring cents', () => {
  // 2475 € · 2,5 % = 61,875 € → 61,88 €
  const s = { type: 'decimal', value: '61.88', tolerance: '0.005', places: 2, unit: '€', canonical: '61,88' };
  assert.equal(status(s, '61,88'), 'correct');
  assert.equal(status(s, '61,875'), 'correct');
  assert.equal(status(s, '61,87'), 'incorrect');
  assert.equal(cat(s, '61,87'), 'rounding');   // near miss within 10× tolerance
  assert.equal(status(s, '61,89'), 'incorrect');
});

test('schema: bad unit, places and grid layouts are rejected by validateQuestion', () => {
  const base = { id: 'a', templateId: 't', templateVersion: 1, skillId: 's', signature: 'x', prompt: 'p', level: 1,
    hints: E.HINT_KINDS.map(k => ({ kind: k, text: 't' })), solution: { steps: ['s'], result: 'r' } };
  const cell = id => ({ id, spec: { type: 'integer', value: '1', canonical: '1' } });
  assert.match(E.validateQuestion({ ...base, answer: { type: 'integer', value: '1', unit: 'Meilen', canonical: '1' } }).errors.join(), /bad unit/);
  assert.match(E.validateQuestion({ ...base, answer: { type: 'decimal', value: '1.234', tolerance: '0', places: 2, canonical: '1,234' } }).errors.join(), /more decimals/);
  const grid = (rows) => ({ ...base, answer: { type: 'table', cells: [cell('a'), cell('b')], grid: { columns: ['x', 'y'], rows } } });
  assert.equal(E.validateQuestion(grid([[{ text: '1' }, { cell: 'a' }], [{ text: '2' }, { cell: 'b' }]])).ok, true);
  assert.match(E.validateQuestion(grid([[{ text: '1' }, { cell: 'a' }]])).errors.join(), /exactly once/);            // b missing
  assert.match(E.validateQuestion(grid([[{ cell: 'a' }, { cell: 'a' }], [{ text: '2' }, { cell: 'b' }]])).errors.join(), /exactly once/);
  assert.match(E.validateQuestion(grid([[{ text: '1' }], [{ text: '2' }, { cell: 'b' }]])).errors.join(), /wrong length/);
  assert.match(E.validateQuestion(grid([[{ text: '1' }, { cell: 'zz' }], [{ text: '2' }, { cell: 'b' }]])).errors.join(), /unknown cell/);
});

// ---------------------------------------------------------------- VI.1 compare
test('convert: 3/8 = 37,5 %; 0,4 % = 0,004; 125 % = 5/4 (reduced required)', () => {
  const t = T('pct.compare.convert');
  let q = build(t, { dir: 'frac2pct', n: 3, d: 8 }, 2);
  assert.equal(status(q.answer, '37,5 %'), 'correct');
  assert.equal(status(q.answer, '0,375'), 'incorrect');                       // forgot ·100
  q = build(t, { dir: 'pct2dec', n: 1, d: 250 }, 2);                          // 1/250 = 0,4 %
  assert.match(q.prompt, /0\{,\}4/);
  assert.equal(status(q.answer, '0,004'), 'correct');
  assert.equal(status(q.answer, '0,04'), 'incorrect');                        // comma moved one place only
  q = build(t, { dir: 'pct2frac', n: 5, d: 4 }, 2);                           // 125 % = 125/100 = 5/4
  assert.equal(status(q.answer, '5/4'), 'correct');
  assert.equal(res(q.answer, '125/100').code, 'not_reduced');
});

test('shares: 12 of 20 (60 %) beats 15 of 30 (50 %) although 15 > 12', () => {
  const t = T('pct.compare.shares');
  const p = { ctx: 'pets', order: [0, 1, 2, 3], groups: [{ a: 12, b: 20 }, { a: 15, b: 30 }], perm: ['a', 'b', 'c', 'd'] };
  let q = build(t, p, 2);
  assert.equal(q.answer.correct, 'g0');
  assert.match(q.answer.options.find(o => o.id === 'g1').feedback, /Anzahlen verglichen/);
  q = build(t, p, 4);                                                          // complements: 8 < 15 → statement d is "true but badly argued"
  assert.equal(q.answer.correct, 'a');
  assert.match(q.answer.options.find(o => o.id === 'd').text, /nur 8 Kinder ohne Haustier statt 15/);
  // equal shares 4/16 = 3/12 = 25 %
  q = build(t, { ctx: 'shots', order: [0, 1, 2, 3], groups: [{ a: 4, b: 16 }, { a: 3, b: 12 }] }, 2);
  assert.equal(q.answer.correct, 'eq');
});

// ---------------------------------------------------------------- VI.2–4 basic tasks
test('grundaufgaben: 38 % von 300 € = 114 €; 168 € von 400 € = 42 %; 24 % sind 144 € → 600 €', () => {
  const t = T('pct.basic_tasks.grundaufgaben');
  let q = build(t, { ask: 'value', kind: 'eur', G: '300', p: '38', name: 0 }, 2);
  assert.equal(status(q.answer, '114 €'), 'correct');
  assert.equal(status(q.answer, '11400'), 'incorrect');                       // forgot :100
  q = build(t, { ask: 'rate', kind: 'eur', G: '400', p: '42', name: 0 }, 2);
  assert.equal(status(q.answer, '42'), 'correct');
  assert.equal(status(q.answer, '0,42'), 'incorrect');
  q = build(t, { ask: 'base', kind: 'eur', G: '600', p: '24', name: 0 }, 2);  // W = 144 €
  assert.match(q.prompt, /144 €/);
  assert.equal(status(q.answer, '600'), 'correct');
  assert.equal(status(q.answer, '34,56'), 'incorrect');                      // 24 % of 144 (wrong base)
  // L3 rate with rounding: 786 of 900 = 87,333… % → 87,3 %
  q = build(t, { ask: 'rate', kind: 'count', G: '900', W: '786', name: 0 }, 3);
  assert.equal(q.instructions.includes('Runde auf eine Nachkommastelle'), true);
  assert.equal(status(q.answer, '87,3'), 'correct');
  assert.equal(status(q.answer, '87,33'), 'correct');
  assert.equal(status(q.answer, '87,4'), 'incorrect');
});

test('change: 80 € −15 % = 68 €; after +20 % it costs 54 € → 45 €; 40 € → 46 € is +15 %; +10 % then −10 % of 670 € = 663,30 €', () => {
  const t = T('pct.basic_tasks.change');
  let q = build(t, { v: 'down', item: 1, G: '80', p: '15', dir: -1 }, 2);
  assert.equal(status(q.answer, '68'), 'correct');
  assert.equal(status(q.answer, '12'), 'incorrect');                          // only the change
  q = build(t, { v: 'original', item: 1, G: '45', p: '20', dir: 1 }, 3);     // 45 · 1,2 = 54
  assert.match(q.prompt, /jetzt 54 €/);
  assert.equal(status(q.answer, '45'), 'correct');
  assert.equal(status(q.answer, '43,20'), 'incorrect');                       // 54 · 0,8: wrong base
  q = build(t, { v: 'rate_change', item: 1, G: '40', p: '15', dir: 1 }, 3);
  assert.equal(status(q.answer, '15 %'), 'correct');
  assert.equal(status(q.answer, '115'), 'incorrect');
  q = build(t, { v: 'successive', item: 0, G: '670', a: '10', b: '10', upFirst: false }, 4); // 670·0,9 = 603; ·1,1 = 663,30
  assert.equal(status(q.answer, '663,30'), 'correct');
  const r = res(q.answer, '670');
  assert.equal(r.status, 'incorrect'); assert.match(r.feedback, /heben sich NICHT auf/);
  // offers: A 510 € −35 % = 331,50 €; B 490 € −15 % = 416,50 €
  q = build(t, { v: 'offers', item: 0, G1: '510', pA: '35', G2: '490', pB: '15', fixed: false, amount: '10' }, 4);
  assert.equal(q.answer.correct, 'A');
});

// ---------------------------------------------------------------- VI.5 interest
test('yearly: 2475 € at 2,5 % → 61,875 € ≈ 61,88 €; 42,50 € at 2 % → 2125 €', () => {
  const t = T('interest.simple_compound.yearly');
  let q = build(t, { ask: 'interest', K: '2475', rate: '2.5', name: 0 }, 1);
  assert.equal(status(q.answer, '61,88'), 'correct');
  assert.equal(status(q.answer, '61,87'), 'incorrect');
  assert.match(q.instructions, /Runde auf Cent/);
  q = build(t, { ask: 'capital', K: '2125', rate: '2', name: 0 }, 2);
  assert.match(q.prompt, /42,50 €/);
  assert.equal(status(q.answer, '2125'), 'correct');
});

test('compound table: 5100 € at 1,25 % → 63,75 / 5163,75; 64,55 / 5228,30; 65,35 / 5293,65', () => {
  // Jahr 2: 5163,75 · 0,0125 = 64,546875 → 64,55; Jahr 3: 5228,30 · 0,0125 = 65,35375 → 65,35
  const t = T('interest.simple_compound.compound');
  const q = build(t, { v: 'table', K: '5100', rate: '1.25', years: 3, name: 0 }, 3);
  assert.equal(q.answer.grid.rows.length, 4);
  const ok = { z1: '63,75', k1: '5163,75', z2: '64,55', k2: '5228,30', z3: '65,35', k3: '5293,65' };
  assert.equal(status(q.answer, ok), 'correct');
  const simple = res(q.answer, { ...ok, z2: '63,75' });                       // interest on the start capital again
  assert.equal(simple.status, 'incorrect');
  assert.equal(simple.cells.z2.errorCategory, 'concept_confusion');
  // final balance: 2800 € at 1,25 % for 3 years → 2835,00 → 2870,44 → 2906,32 (without Zinseszins 2905,00)
  const f = build(t, { v: 'final', K: '2800', rate: '1.25', years: 3, name: 0 }, 3);
  assert.equal(status(f.answer, '2906,32'), 'correct');
  assert.equal(status(f.answer, '2905'), 'incorrect');
});

test('compound offers: 4250 € for 3 years, 3,5 % vs Zinstreppe 2,75/3,75/4,75 % → B (4745,85 € vs 4712,05 €)', () => {
  const t = T('interest.simple_compound.compound');
  const q = build(t, { v: 'stairs', K: '4250', rate: '3.5', stairs: ['2.75', '3.75', '4.75'], years: 3, name: 0 }, 4);
  assert.equal(q.answer.correct, 'B');
  assert.match(q.solution.result, /4745,85 € gegenüber 4712,05 €/);
});

// ---------------------------------------------------------------- VI.6 loan
test('loan table: 18500 € at 2 %, rate 2800 € → 370 / 2430 / 16070; 321,40 / 2478,60 / 13591,40; 271,83 / 2528,17 / 11063,23', () => {
  // Jahr 3: 13591,40 · 0,02 = 271,828 → 271,83
  const t = T('interest.loan.table');
  const q = build(t, { S: '18500', rate: '2', R: '2800', purpose: 0, years: 3 }, 2);
  const ok = { z1: '370', t1: '2430', e1: '16070', z2: '321,40', t2: '2478,60', e2: '13591,40', z3: '271,83', t3: '2528,17', e3: '11063,23' };
  assert.equal(status(q.answer, ok), 'correct');
  const r = res(q.answer, { ...ok, z2: '370' });                              // interest on the original loan
  assert.equal(r.cells.z2.status, 'incorrect');
  assert.equal(res(q.answer, { ...ok, e1: '15700' }).cells.e1.status, 'incorrect'); // whole rate subtracted
});

test('loan duration and cost: 12500 € at 6 %, 2600 € → 6 years; 9500 € at 5 %, 5200 € → 713,75 € interest', () => {
  // 12500 → 10650 → 8689 → 6610,34 → 4406,96 → 2071,38 → repaid in year 6 (2071,38 + 124,28 < 2600)
  const t = T('interest.loan.duration');
  let q = build(t, { S: '12500', rate: '6', R: '2600', purpose: 0 }, 3);
  assert.equal(status(q.answer, '6'), 'correct');
  assert.equal(status(q.answer, '6 Jahre'), 'correct');
  assert.equal(status(q.answer, '5'), 'incorrect');                           // 12500 : 2600 → 5 (interest ignored)
  // 475,00 + 238,75 = 713,75; n·R − S = 900 (last payment full) is wrong
  q = build(t, { S: '9500', rate: '5', R: '5200', purpose: 0 }, 4);
  assert.equal(status(q.answer, '713,75 €'), 'correct');
  assert.equal(status(q.answer, '900'), 'incorrect');
  assert.equal(status(q.answer, '950'), 'incorrect');                         // 2 · 475 (interest on original)
});

// ---------------------------------------------------------------- print data
test('worksheet: unit lines and grids on paper, filled grid in the key, no answers on the student sheet', () => {
  const { worksheet, questions } = E.createWorksheet({ skills: ['ch6.interest.loan', 'ch6.pct.basic_tasks'], levels: [1, 2], count: 8, baseSeed: 77, keyMode: 'answers' });
  const L = E.worksheetLayout(worksheet, questions);
  const grids = L.student.filter(s => s.response.kind === 'grid');
  assert.ok(grids.length > 0, 'a loan table appears');
  for (const g of grids) {
    const k = L.key[g.number - 1];
    assert.ok(k.grid, 'key carries the grid');
    g.response.rows.forEach((row, i) => row.forEach((e, j) => { if (e.blank) assert.ok(k.grid.rows[i][j].answer && /\$/.test(k.grid.rows[i][j].text)); }));
    assert.ok(!JSON.stringify(g.response).includes('answer'), 'no answers on the student grid');
  }
  assert.ok(L.student.some(s => s.response.kind === 'line' && s.response.unit), 'unit printed after the answer line');
});
