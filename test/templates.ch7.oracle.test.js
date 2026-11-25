'use strict';
/**
 * Chapter 7 oracle tests: fixed parameters, expected results computed BY HAND (see comments), independent of the
 * engine's arithmetic. They also pin the generic addition of Session 8: the `probability` flag (D66).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch7.${id}`];
function build(t, p, level) {
  assert.equal(t.constraints(p, level), true, `${t.id}: constraints`);
  const body = t.build(p, level);
  assert.equal(E.validateAnswer(body.answer, t.solve(p, level)).status, 'correct', `${t.id}: independent solve`);
  return body;
}
const res = (spec, input) => E.validateAnswer(spec, input);
const status = (spec, input) => res(spec, input).status;
const correctText = b => b.answer.options.find(o => o.id === b.answer.correct).text;

test('probability flag (D66): fraction, decimal and percent accepted; range feedback; schema', () => {
  const s = { type: 'fraction', value: '3/8', probability: true, canonical: '3/8' };
  for (const ok of ['3/8', '6/16', '0,375', '0.375', '37,5 %', '37,5%', '37,5 Prozent']) assert.equal(status(s, ok), 'correct', ok);
  assert.equal(res(s, '3/2').code, 'prob_out_of_range');
  assert.equal(res(s, '3/2').errorCategory, 'concept_confusion');
  assert.equal(res(s, '37,5').code, 'prob_out_of_range');          // 37,5 without % is > 1
  assert.equal(res(s, '0,3').errorCategory, 'other');
  assert.equal(status(s, '%'), 'invalid');
  // without the flag a percentage is not a number
  assert.equal(status({ type: 'fraction', value: '3/8', canonical: '3/8' }, '37,5 %'), 'invalid');
  const q = { id: 'a', templateId: 't', templateVersion: 1, skillId: 's', signature: 'x', prompt: 'p', level: 1,
    hints: E.HINT_KINDS.map(k => ({ kind: k, text: 't' })), solution: { steps: ['s'], result: 'r' } };
  assert.equal(E.validateQuestion({ ...q, answer: s }).ok, true);
  assert.match(E.validateQuestion({ ...q, answer: { type: 'integer', value: '1', probability: true, canonical: '1' } }).errors.join(), /probability flag/);
  assert.match(E.validateQuestion({ ...q, answer: { ...s, unit: '%' } }).errors.join(), /probability flag/);
  assert.match(E.validateQuestion({ ...q, answer: { ...s, value: '3/2', canonical: '3/2' } }).errors.join(), /outside/);
});

test('data L1: median of 7, 3, 9, 1, 5 is 5 (sorted 1, 3, 5, 7, 9); the unsorted middle 9 is a targeted error', () => {
  const b = build(T('data.analyze.stats'), { level: 1, name: 'Lea', ctx: 0, ask: 'median', xs: [7, 3, 9, 1, 5] }, 1);
  assert.equal(status(b.answer, '5'), 'correct');
  assert.equal(res(b.answer, '9').errorCategory, 'concept_confusion');
  assert.match(res(b.answer, '9').feedback, /unsortierten/);
});

test('data L2: 5, 8, 6, 10, 2, 14 → Spannweite 12, Median (6+8):2 = 7, Mittelwert 45:6 = 7,5', () => {
  const b = build(T('data.analyze.stats'), { level: 2, name: 'Ben', ctx: 0, xs: [5, 8, 6, 10, 2, 14] }, 2);
  assert.equal(status(b.answer, { range: '12', median: '7', mean: '7,5' }), 'correct');
  const r = res(b.answer, { range: '14', median: '7', mean: '7' });
  assert.equal(r.cells.range.errorCategory, 'concept_confusion');   // maximum instead of range
  assert.equal(r.cells.mean.errorCategory, 'concept_confusion');    // median instead of mean
});

test('data L2 with negatives: −3, −3, 5, −6, −1, −4, 4, −4 → range 11, median −3, mean −12:8 = −1,5; no „+-“ in the solution', () => {
  const b = build(T('data.analyze.stats'), { level: 2, name: 'Mia', ctx: 3, xs: [-3, -3, 5, -6, -1, -4, 4, -4] }, 2);
  assert.equal(status(b.answer, { range: '11', median: '-3', mean: '-1,5' }), 'correct');
  const all = b.solution.steps.join(' ');
  assert.ok(all.includes('-3+\\left(-3\\right)'), all);
  assert.ok(!/\+-/.test(all));
});

test('data L3: frequency table 0..4 with 2, 5, 8, 3, 2 → N = 20, sum 38, mean 1,9, median 2; unweighted mean 2 is an error', () => {
  const b = build(T('data.analyze.stats'), { level: 3, mode: 'freq', fctx: 0, vals: [0, 1, 2, 3, 4], freq: [2, 5, 8, 3, 2] }, 3);
  assert.equal(status(b.answer, { mean: '1,9', median: '2' }), 'correct');
  assert.equal(res(b.answer, { mean: '2', median: '2' }).cells.mean.errorCategory, 'concept_confusion');
  assert.deepEqual(b.promptTable.columns, ['Anzahl der Geschwister', 'Anzahl']);
});

test('data L3: outlier 30 in 5, 6, 4, 7, 5, 30 → mean 57:6 = 9,5; without it 27:5 = 5,4; median (5+6):2 = 5,5', () => {
  const b = build(T('data.analyze.stats'), { level: 3, mode: 'outlier', name: 'Tom', ctx: 6, xs: [5, 6, 4, 7, 5, 30], out: 30 }, 3);
  assert.equal(status(b.answer, { meanAll: '9,5', meanOut: '5,4', medianAll: '5,5' }), 'correct');
  assert.equal(status(b.answer, { meanAll: '9,5 min', meanOut: '5,4', medianAll: '5,5' }), 'correct');
});

test('data L4: 2, 4, 4, 5, 20 — mean 7 > median 4 (true), range 18 (true), max+10 leaves mean (false), more than half > 4 (2 of 5, false)', () => {
  const st = [{ kind: 'meanGtMedian' }, { kind: 'rangeIs', v: 18 }, { kind: 'maxUpMean' }, { kind: 'halfAbove', v: 4 }];
  const b = build(T('data.analyze.judge'), { name: 'Sara', ctx: 0, xs: [2, 4, 4, 5, 20], st }, 4);
  assert.deepEqual(b.answer.correct, ['a', 'b']);
  assert.equal(status(b.answer, ['a']), 'incorrect');
});

test('experiments: die „gerade“ = {2; 4; 6}; „größer als 4“ = {5; 6} with trap {4; 5; 6}; wheel „Primzahl und größer als 4“ = {5; 7}', () => {
  const t = T('prob.experiments.events');
  const m = build(t, { mode: 'members', e: 0, ev: { kind: 'even', a: 0 } }, 1);
  assert.deepEqual(m.answer.correct, ['o2', 'o4', 'o6']);
  const s = build(t, { mode: 'set', e: 0, ev: { kind: 'gt', a: 4 }, order: [0, 1, 2, 3] }, 2);
  assert.equal(correctText(s), '$\\{5;\\ 6\\}$');
  const trap = s.answer.options.find(o => o.text === '$\\{4;\\ 5;\\ 6\\}$');
  assert.match(trap.feedback, /4 selbst gehört nicht dazu/);
  const c = build(t, { mode: 'comb', e: 2, c: { op: 'und', e1: { kind: 'prime', a: 0 }, e2: { kind: 'gt', a: 4 } }, order: [0, 1, 2, 3] }, 3);
  assert.equal(correctText(c), '$\\{5;\\ 7\\}$');
  const n = build(t, { mode: 'comb', e: 0, c: { op: 'nicht', e1: { kind: 'mult', a: 3 } }, order: [0, 1, 2, 3] }, 3);
  assert.equal(correctText(n), '$\\{1;\\ 2;\\ 4;\\ 5\\}$');
  assert.match(n.prompt, /ist nicht durch 3 teilbar/);
  const k = build(t, { mode: 'comb', e: 0, c: { op: 'nicht', e1: { kind: 'prime', a: 0 } }, order: [0, 1, 2, 3] }, 3);
  assert.match(k.prompt, /ist keine Primzahl/);
  assert.equal(correctText(k), '$\\{1;\\ 4;\\ 6\\}$');
});

test('experiments: Ergebnismenge of two coin throws {KK; KZ; ZK; ZZ} (trap without order); of the sum of two dice {2; …; 12}', () => {
  const t = T('prob.experiments.events');
  const c = build(t, { mode: 'omega', task: 'coins', k: 2, order: [0, 1, 2, 3] }, 1);
  assert.equal(correctText(c), '$\\{\\text{KK};\\ \\text{KZ};\\ \\text{ZK};\\ \\text{ZZ}\\}$');
  assert.ok(c.answer.options.some(o => o.text === '$\\{\\text{KK};\\ \\text{KZ};\\ \\text{ZZ}\\}$' && /Reihenfolge/.test(o.feedback)));
  const s = build(t, { mode: 'omega', task: 'sum', v: 0, order: [0, 1, 2, 3] }, 1);
  assert.equal(correctText(s), '$\\{2;\\ 3;\\ 4;\\ 5;\\ 6;\\ 7;\\ 8;\\ 9;\\ 10;\\ 11;\\ 12\\}$');
});

test('experiments L4: E = {5; 6} on a die fits „größer als 4“ and „mindestens 5“, not „gerade“ or „kleiner als 3“', () => {
  const ds = [{ kind: 'gt', a: 4 }, { kind: 'ge', a: 5 }, { kind: 'even', a: 0 }, { kind: 'lt', a: 3 }];
  const b = build(T('prob.experiments.events'), { mode: 'reverse', e: 0, ds, target: 0, order: [0, 1, 2, 3] }, 4);
  assert.deepEqual(b.answer.correct, ['a', 'b']);
});

test('determine L1: wheel rot 3/8, blau 1/8, gelb 4/8 → P(rot oder blau) = 4/8 = 1/2; product 3/64 is a targeted error', () => {
  const d = { die: false, labels: ['rot', 'blau', 'gelb'], D: 8, rep: 'frac', nums: [3, 1, 4] };
  const b = build(T('prob.determine.compute'), { mode: 'sum', d, pick: [0, 1] }, 1);
  for (const ok of ['1/2', '4/8', '0,5', '50 %']) assert.equal(status(b.answer, ok), 'correct', ok);
  assert.match(res(b.answer, '3/64').feedback, /addiert/);
});

test('determine L2: bus on time 85 % → late 15 % = 3/20; loaded die 0,1 0,15 0,2 0,25 0,15 ? → 0,15; P(nicht 1) = 0,9', () => {
  const t = T('prob.determine.compute');
  const b = build(t, { mode: 'ctx', ci: 0, p: '0.85', rep: 'pct' }, 2);
  assert.equal(status(b.answer, '15 %'), 'correct');
  assert.equal(res(b.answer, '85 %').errorCategory, 'concept_confusion');
  const d = { die: true, labels: [1, 2, 3, 4, 5, 6], D: 20, rep: 'dec', nums: [2, 3, 4, 5, 3, 3] };
  const m = build(t, { mode: 'missing', d, i: 5 }, 2);
  assert.equal(status(m.answer, '0,15'), 'correct');
  assert.equal(m.promptTable.rows[5][1], '?');
  const n = build(t, { mode: 'not', d, i: 0 }, 2);
  assert.equal(status(n.answer, '0,9'), 'correct');
  assert.equal(res(n.answer, '0,1').errorCategory, 'concept_confusion');
});

test('determine L3: 3 T-Shirts × 4 Hosen = 12 (7 = sum); 4 people in a row 4·3·2·1 = 24; places 1, 2 of 6: 6·5 = 30; lock 10·10·10 → P = 1/1000', () => {
  const t = T('prob.determine.counting');
  const outfit = { kind: 'product', factors: [3, 4], text: 'Lea hat 3 T-Shirts und 4 Hosen. Wie viele Kombinationen?', guess: null };
  const b = build(t, { kind: 'outfit', c: outfit, ask: 'count' }, 3);
  assert.equal(status(b.answer, '12'), 'correct');
  assert.equal(res(b.answer, '7').errorCategory, 'concept_confusion');
  const row = build(t, { kind: 'row', c: { kind: 'factorial', n: 4, text: '4 Freunde.', ask: 'Wie viele?', guess: null }, ask: 'count' }, 3);
  assert.equal(status(row.answer, '24'), 'correct');
  const med = build(t, { kind: 'medals', c: { kind: 'perm2', n: 6, text: '6 Kinder.', ask: 'Wie viele?', guess: null }, ask: 'count' }, 3);
  assert.equal(status(med.answer, '30'), 'correct');
  const lock = build(t, { kind: 'lock', c: { kind: 'power', base: 10, exp: 3, text: 'Schloss.', ask: 'Wie viele?', guess: 'Wahrscheinlichkeit?' }, ask: 'prob' }, 3);
  assert.equal(status(lock.answer, '1/1000'), 'correct');
  assert.equal(status(lock.answer, '0,1 %'), 'correct');
});

test('determine L4: wheel A 5 of 12 red (≈ 41,7 %) vs B 3 of 5 (60 %) → B, although A has more red fields', () => {
  const b = build(T('prob.determine.claims'), { sit: 'wheels', w: { n1: 12, r1: 5, n2: 5, r2: 3 }, order: [0, 1, 2] }, 4);
  assert.equal(correctText(b), 'Bei Rad B ist die Wahrscheinlichkeit für Rot größer.');
  assert.ok(b.answer.options.some(o => /Rad A .* mehr rote Felder/.test(o.text)));
  const c = build(T('prob.determine.claims'), { sit: 'coin', seed: 1, order: [0, 1, 2] }, 4);
  assert.match(correctText(c), /gleich wahrscheinlich/);
});

test('frequency: 18 of 50 → 9/25 = 36 %; 456 of 800 → 171 of 300; pooled 446/1000; stabilises at 0,68', () => {
  const t = T('prob.frequency.series');
  const a = build(t, { oi: 0, n: 50, k: 18 }, 1);
  assert.equal(status(a.answer, '36 %'), 'correct');
  assert.equal(res(a.answer, '18/32').errorCategory, 'concept_confusion');   // k : (n − k)
  const b = build(t, { oi: 5, n: 800, k: 456, m: 300 }, 2);
  assert.equal(status(b.answer, '171'), 'correct');                          // 300 · 0,57
  assert.equal(res(b.answer, '150').errorCategory, 'concept_confusion');     // „both equally likely“
  const c = build(t, { oi: 1, ns: [300, 150, 550], ks: [135, 69, 242], names: ['Aylin', 'Tom', 'Finn'] }, 3);
  assert.equal(status(c.answer, '0,446'), 'correct');                        // (135+69+242):(300+150+550)
  assert.equal(res(c.answer, '0,45').errorCategory, 'concept_confusion');    // mean of 0,45 0,46 0,44
  const d = build(t, { oi: 5, ns: [10, 50, 100, 500, 1000, 2000], ks: [8, 33, 70, 334, 670, 1363], order: [0, 1, 2] }, 4);
  assert.match(correctText(d), /etwa \$0\{,\}68\$/);                         // 1363 : 2000 = 0,6815
});

test('laplace: octahedron „mindestens 6“ = 3/8 (trap 2/8); ANANAS „A“ = 3/6 (not 1/3); 2 rot 5 blau 3 grün, rot oder grün = 5/10', () => {
  const t = T('prob.laplace.compute');
  const a = build(t, { mode: 'num', e: 1, ev: { kind: 'ge', a: 6 } }, 1);
  assert.equal(status(a.answer, '3/8'), 'correct');
  assert.equal(res(a.answer, '1/4').errorCategory, 'concept_confusion');
  assert.equal(res(a.answer, '3/5').errorCategory, 'concept_confusion');
  const w = build(t, { mode: 'word', w: 'ANANAS', ch: 'A' }, 2);
  assert.equal(status(w.answer, '1/2'), 'correct');
  assert.match(res(w.answer, '1/3').feedback, /Karten/);
  const u = build(t, { mode: 'urn', cols: ['rote', 'blaue', 'grüne'], ns: [2, 5, 3], ask: 'or', pick: [0, 2] }, 2);
  assert.match(u.prompt, /eine rote oder grüne Kugel/);
  assert.equal(status(u.answer, '5/10'), 'correct');
  assert.equal(res(u.answer, '2/3').errorCategory, 'concept_confusion');
});

test('laplace L3: two dice — sum 7: 6/36 (not 1/11); sum ≥ 10: 3+2+1 = 6/36; at least one 6: 11/36 (not 12/36); sum prime: 15/36; no 2: 25/36', () => {
  const t = T('prob.laplace.compute');
  const cases = [['sumEq', 7, '1/6', '1/11'], ['sumGe', 10, '1/6', null], ['atLeastOne', 6, '11/36', '1/3'], ['sumPrime', 0, '5/12', '5/11'], ['none', 2, '25/36', '11/36']];
  for (const [kind, x, ok, bad] of cases) {
    const b = build(t, { mode: 'dice', kind, x }, 3);
    assert.equal(status(b.answer, ok), 'correct', kind);
    if (bad) assert.equal(res(b.answer, bad).errorCategory, 'concept_confusion', kind);
  }
});

test('laplace L4: a fair coin is Laplace; a thumbtack and the sum of two dice are not', () => {
  const b = build(T('prob.laplace.judge'), { li: 3, ls: 1, n1: 0, s1: 1, n2: 3, s2: 1, order: [0, 1, 2] }, 4);
  assert.match(correctText(b), /faire Münze/);
  assert.ok(b.answer.options.some(o => /Augensumme/.test(o.text) && /nicht gleich wahrscheinlich/.test(o.feedback)));
});
