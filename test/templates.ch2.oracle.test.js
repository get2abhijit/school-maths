'use strict';
/**
 * Chapter 2 oracle tests: fixed parameters, expected results computed BY HAND (see comments), independent of the
 * engine's arithmetic. They also pin the generic additions of Session 7: units h/min/Tage (D62), promptTable (D63).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch2.${id}`];
function build(t, p, level) {
  assert.equal(t.constraints(p, level), true, `${t.id}: constraints`);
  const body = t.build(p, level);
  assert.equal(E.validateAnswer(body.answer, t.solve(p, level)).status, 'correct', `${t.id}: independent solve`);
  return body;
}
const res = (spec, input) => E.validateAnswer(spec, input);
const status = (spec, input) => res(spec, input).status;

test('units h, min, Tage (D62): accepted spellings; another known unit is unit_confusion; old units unchanged', () => {
  const h = { type: 'integer', value: '8', unit: 'h', canonical: '8' };
  for (const ok of ['8', '8 h', '8h', '8 Std', '8 Stunden']) assert.equal(status(h, ok), 'correct', ok);
  assert.equal(res(h, '8 min').errorCategory, 'unit_confusion');
  assert.equal(res(h, '8 min').code, 'unit_value_ok');
  const m = { type: 'decimal', value: '7.5', tolerance: '0', unit: 'min', canonical: '7,5' };
  for (const ok of ['7,5', '7,5 min', '7,5 Minuten']) assert.equal(status(m, ok), 'correct', ok);
  const d = { type: 'integer', value: '40', unit: 'Tage', canonical: '40' };
  for (const ok of ['40', '40 Tage', '40 Tag']) assert.equal(status(d, ok), 'correct', ok);
  assert.equal(res(d, '40 Jahre').errorCategory, 'unit_confusion');
  // a spec without unit stays strict
  assert.equal(status({ type: 'integer', value: '8', canonical: '8' }, '8 h'), 'invalid');
});

test('promptTable (D63): rectangular tables of non-empty strings only', () => {
  const base = { id: 'a', templateId: 't', templateVersion: 1, skillId: 's', signature: 'x', prompt: 'p', level: 1,
    hints: E.HINT_KINDS.map(k => ({ kind: k, text: 't' })), solution: { steps: ['s'], result: 'r' }, answer: { type: 'integer', value: '1', canonical: '1' } };
  assert.equal(E.validateQuestion({ ...base, promptTable: { columns: ['x', 'y'], rows: [['1', '2'], ['2', '4']] } }).ok, true);
  assert.match(E.validateQuestion({ ...base, promptTable: { columns: ['x', 'y'], rows: [['1']] } }).errors.join(), /row 0 malformed/);
  assert.match(E.validateQuestion({ ...base, promptTable: { columns: ['x', 'y'], rows: [['1', '']] } }).errors.join(), /row 0 malformed/);
  assert.match(E.validateQuestion({ ...base, promptTable: { columns: [], rows: [] } }).errors.join(), /bad promptTable/);
});

test('prop table fill: apples 1,80 €/kg — 7 kg = 12,60 €, 9 kg = 16,20 €, 9 € buy 5 kg', () => {
  const t = T('prop.recognize_compute.table');
  // hand: 2·1,8 = 3,6; 3·1,8 = 5,4; 5·1,8 = 9; 7·1,8 = 12,6; 9·1,8 = 16,2
  const rows = [['2', '3.6'], ['3', '5.4'], ['5', '9'], ['7', '12.6'], ['9', '16.2']];
  const p = { ask: 'fill', kind: 'prop', ctxSet: 'prop', ctx: 0, k: '1.8', xs: ['2', '3', '5', '7', '9'], hide: [null, null, 'x', 'y', 'y'], ref: 0, rows };
  const b = build(t, p, 2);
  assert.equal(b.answer.grid.rows.length, 5);
  const cell = id => b.answer.cells.find(c => c.id === id).spec;
  assert.equal(status(cell('x2'), '5'), 'correct');
  assert.equal(status(cell('y3'), '12,60'), 'correct');
  assert.equal(status(cell('y3'), '12,6 €'), 'correct');
  assert.equal(status(cell('y4'), '16,20'), 'correct');
  // misconceptions: antiproportional path 3,6·2:9 = 0,8 and additive 3,6 + (9 − 2) = 10,6
  assert.equal(res(cell('y4'), '0,80').errorCategory, 'concept_confusion');
  assert.equal(res(cell('y4'), '10,60').errorCategory, 'concept_confusion');
  // x cell: 9 · 1,8 = 16,2 (multiplied instead of divided)
  assert.match(res(cell('x2'), '16,2').feedback, /multipliziert/);
  assert.equal(E.validateAnswer(b.answer, { x2: '5', y3: '12,60', y4: '16,2' }).status, 'correct');
});

test('anti table fill: pumps, product 36 — 2→18 h, 3→12 h, 4→9 h, 6→6 h', () => {
  const t = T('antiprop.recognize_compute.table');
  const p = { ask: 'fill', kind: 'anti', ctxSet: 'anti', ctx: 1, c: '36', xs: ['2', '3', '4', '6'], hide: [null, 'y', 'y', 'y'], ref: 0, rows: [['2', '18'], ['3', '12'], ['4', '9'], ['6', '6']] };
  const b = build(t, p, 1);
  assert.equal(E.validateAnswer(b.answer, { y1: '12', y2: '9 h', y3: '6' }).status, 'correct');
  // proportional path from (2 | 18): 18 : 2 · 4 = 36
  assert.equal(res(b.answer.cells.find(c => c.id === 'y2').spec, '36').errorCategory, 'concept_confusion');
});

test('classify: products 12 → anti; candle (constant decrease) → neither; ages (constant difference) → not proportional', () => {
  const ta = T('antiprop.recognize_compute.table'), tp = T('prop.recognize_compute.table');
  const anti = { ask: 'check', kind: 'anti', ctxSet: 'anti', ctx: 3, c: '12', xs: ['2', '3', '4', '6'], rows: [['2', '6'], ['3', '4'], ['4', '3'], ['6', '2']] };
  let b = build(ta, anti, 1);
  assert.equal(b.answer.correct, 'a');
  assert.deepEqual(b.promptTable.rows[1], ['$3$', '$4$']);
  // candle 20 cm, 2 cm/h: 1→18, 2→16, 4→12, 5→10 — products 18, 32, 48, 50 differ
  const candle = { ask: 'check', kind: 'candle', ctxSet: 'candle', L: '20', k: '2', xs: ['1', '2', '4', '5'], rows: [['1', '18'], ['2', '16'], ['4', '12'], ['5', '10']] };
  b = build(ta, candle, 2);
  assert.equal(b.answer.correct, 'w');
  assert.match(b.answer.options.find(o => o.id === 'l').feedback, /Je mehr, desto weniger/);
  // ages: Lena 4, 6, 9, 12 → brother +3: 7, 9, 12, 15 — quotients 1,75; 1,5; …
  const ages = { ask: 'check', kind: 'additive', ctxSet: 'ages', d: '3', xs: ['4', '6', '9', '12'], rows: [['4', '7'], ['6', '9'], ['9', '12'], ['12', '15']] };
  b = build(tp, ages, 2);
  assert.equal(b.answer.correct, 'n');
  assert.equal(E.validateAnswer(b.answer, 'm').errorCategory, 'concept_confusion');
  assert.match(b.answer.options.find(o => o.id === 'm').feedback, /Je mehr, desto mehr/);
});

test('prop Dreisatz: 4 kg Äpfel = 6 € → 7 kg = 10,50 €; backwards 26,40 € for 16 l → 51,15 € buy 31 l', () => {
  const t = T('prop.recognize_compute.dreisatz');
  let b = build(t, { type: 'prop', ctx: 0, ask: 'y', r: '1.5', x1: '4', x2: '7' }, 2);
  assert.match(b.prompt, /^4 kg Äpfel kosten 6 €\. Wie viel kosten 7 kg Äpfel\?$/);
  for (const ok of ['10,50', '10,5', '10,50 €']) assert.equal(status(b.answer, ok), 'correct', ok);
  assert.equal(res(b.answer, '10,50 kg').errorCategory, 'unit_confusion');
  assert.equal(res(b.answer, '24/7').errorCategory, 'concept_confusion');      // antiproportional path 6·4:7
  assert.equal(res(b.answer, '9').errorCategory, 'concept_confusion');         // additive 6 + 3
  assert.equal(res(b.answer, '1,50').errorCategory, 'concept_confusion');      // only the value for 1 kg
  assert.equal(b.solution.result, '$10{,}50$ €');
  // 16 · 1,65 = 26,40; 51,15 : 1,65 = 31
  b = build(t, { type: 'prop', ctx: 1, ask: 'x', r: '1.65', x1: '16', x2: '31' }, 3);
  assert.match(b.prompt, /26,40 €.*51,15 €/);
  assert.equal(status(b.answer, '31 l'), 'correct');
});

test('anti Dreisatz: 4 pumps 6 h → 3 pumps 8 h; costs 120 €: 4 persons 30 € → 24 € each means 5 persons', () => {
  const t = T('antiprop.recognize_compute.dreisatz');
  let b = build(t, { type: 'anti', ctx: 1, ask: 'y', c: '24', x1: '4', x2: '3' }, 2);
  for (const ok of ['8', '8 h', '8 Stunden']) assert.equal(status(b.answer, ok), 'correct', ok);
  assert.equal(res(b.answer, '4,5').errorCategory, 'concept_confusion');       // proportional path 6:4·3
  assert.equal(res(b.answer, '8 min').errorCategory, 'unit_confusion');
  assert.equal(res(b.answer, '24').errorCategory, 'concept_confusion');        // only the product
  b = build(t, { type: 'anti', ctx: 0, ask: 'x', c: '120', x1: '4', x2: '5' }, 3);
  assert.match(b.prompt, /30 €.*24 €/);
  assert.equal(status(b.answer, '5'), 'correct');
  assert.equal(res(b.answer, '3,2').errorCategory, 'concept_confusion');       // proportional path 4·24:30
});

test('model check (L4): fitting model + correct claim → a; wrong claim → c; unfitting situation → b', () => {
  const t = T('prop.recognize_compute.dreisatz');
  const base = { type: 'prop', ctx: 1, ask: 'y', r: '1.8', x1: '20', x2: '30', name: 0 };
  // 20 l = 36 €, so 30 l = 54 € (ok); antiproportional slip: 36·20:30 = 24 € (err)
  let b = build(t, { ...base, mode: 'ok', wrong: 'other' }, 4);
  assert.match(b.prompt, /Dann kosten 30 l Benzin 54 €/);
  assert.equal(b.answer.correct, 'a');
  b = build(t, { ...base, mode: 'err', wrong: 'other' }, 4);
  assert.match(b.prompt, /Dann kosten 30 l Benzin 24 €/);
  assert.equal(b.answer.correct, 'c');
  for (let bad = 0; bad < 4; bad++) for (const type of ['prop', 'anti']) {
    const tt = T(`${type === 'prop' ? 'prop' : 'antiprop'}.recognize_compute.dreisatz`);
    let p = null;
    for (let seed = 1; seed < 50 && !p; seed++) { const c = { type, mode: 'bad', bad, seed, name: 1 }; if (tt.constraints(c, 4) === true) p = c; }
    assert.ok(p, `${type} bad ${bad}: some seed admissible`);
    b = build(tt, p, 4);
    assert.equal(b.answer.correct, 'b');
    assert.ok(b.solution.steps.length >= 2);
  }
});

test('graph: line through O and P(4 | 10) → Q(6 | 15); shapes of tables', () => {
  const t = T('prop.recognize_compute.graph');
  let b = build(t, { v: 'point', k: '2.5', a: '4', c: '6', ask: 'y' }, 2);
  for (const ok of ['15', 'y = 15', 'y=15']) assert.equal(status(b.answer, ok), 'correct', ok);
  assert.equal(res(b.answer, '12').errorCategory, 'concept_confusion');        // additive 10 + 2
  b = build(t, { v: 'point', k: '2.5', a: '4', c: '6', ask: 'x' }, 2);
  assert.equal(status(b.answer, 'x = 6'), 'correct');
  // y = 2x + 3 at 1..5: 5, 7, 9, 11, 13 — straight line, not through O
  b = build(t, { v: 'shape', kind: 'affine', k: '2', b: '3', xs: ['1', '2', '3', '4', '5'] }, 3);
  assert.equal(b.answer.correct, 'n');
  assert.deepEqual(b.promptTable.rows[0], ['$1$', '$5$']);
  b = build(t, { v: 'shape', kind: 'square', q: '1', xs: ['1', '2', '3', '4', '5'] }, 3);
  assert.equal(b.answer.correct, 's');
  b = build(t, { v: 'shape', kind: 'anti', c: '12', xs: ['1', '2', '3', '4', '6'] }, 3);
  assert.equal(b.answer.correct, 'h');
  b = build(t, { v: 'shape', kind: 'prop', k: '0.5', xs: ['1', '2', '4', '6', '8'] }, 3);
  assert.equal(b.answer.correct, 'g');
});

test('decide: taxi with base fee is neither; shared prize is antiproportional; mixed L3 does not state the type', () => {
  const t = T('antiprop.recognize_compute.decide');
  let b = build(t, { sit: 10, seed: 1 }, 1);
  assert.match(b.prompt, /Taxi/);
  assert.equal(b.answer.correct, 'neither');
  assert.match(E.validateAnswer(b.answer, 'prop').feedback, /Je mehr, desto mehr/);
  b = build(t, { sit: 5, seed: 1 }, 1);
  assert.equal(b.answer.correct, 'anti');
  b = build(t, { type: 'anti', ctx: 4, ask: 'y', c: '180', x1: '6', x2: '9' }, 3);   // 6 horses 30 days → 9 horses 20 days
  assert.doesNotMatch(b.prompt, /proportional/);
  assert.match(b.solution.steps[0], /antiproportional/);
  assert.equal(status(b.answer, '20 Tage'), 'correct');
  assert.equal(res(b.answer, '45').errorCategory, 'concept_confusion');        // proportional path 30:6·9
});

test('Chapter 2 questions print: given table on the student sheet, key results contain the answer in math', () => {
  const skills = E.skillsWithTemplates().filter(id => id.startsWith('ch2.'));
  const { worksheet, questions } = E.createWorksheet({ skills, levels: [1, 2, 3, 4], count: 20, baseSeed: 777, keyMode: 'worked', title: 'Zuordnungen' });
  const L = E.worksheetLayout(worksheet, questions);
  assert.ok(L.student.some(s => s.promptTable), 'some sheet item has a given table');
  L.student.forEach((s, i) => assert.deepEqual(s.promptTable, questions[i].promptTable));
  for (const k of L.key) assert.ok(k.result && k.result.length > 0);
});
