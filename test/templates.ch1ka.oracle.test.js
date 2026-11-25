'use strict';
/**
 * Oracle tests for the Chapter I families added in Session 11 (book alignment G1, G2, G3, G5, G6).
 * Fixed parameters; expected results computed BY HAND (in comments), independent of the engine.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch1.${id}`];
const ok = (spec, input) => assert.equal(E.validateAnswer(spec, input).status, 'correct', `expected correct: ${input}`);
const wrong = (spec, input, category) => {
  const r = E.validateAnswer(spec, input);
  assert.equal(r.status, 'incorrect', `expected incorrect: ${input}`);
  if (category) assert.equal(r.errorCategory, category, `${input} category`);
  return r;
};
const textOf = (q, id) => q.answer.options.find(o => o.id === id).text;

test('name_law L1: (22 + 36) + 60 = 22 + (36 + 60) is AG+ (KG+ offered as the confusable option)', () => {
  const t = T('numterms.evaluate.name_law');
  const p = { law: 'AG+', style: 'int', chain: 0, variant: 1, nums: ['22', '36', '60'], order: [1, 2] };
  assert.equal(t.constraints(p, 1), true);
  const q = t.build(p, 1);
  assert.match(textOf(q, q.answer.correct), /Assoziativgesetz der Addition/);
  assert.equal(t.solve(p, 1), q.answer.correct);
  const kg = q.answer.options.find(o => /Kommutativgesetz der Addition/.test(o.text));
  assert.ok(kg && kg.feedback, 'KG+ is a wrong option with feedback');
});

test('name_law L2: 3/4·(8 + 12) = 3/4·8 + 3/4·12 is DG; 5 + (9 − 2) = 5 + 9 − 2 is the Plusklammerregel', () => {
  const t = T('numterms.evaluate.name_law');
  const dg = { law: 'DG', style: 'frac', chain: 0, variant: 0, nums: ['3/4', '8', '12'], order: [3, 4] };
  assert.equal(t.constraints(dg, 2), true);
  assert.match(textOf(t.build(dg, 2), t.solve(dg, 2)), /Distributivgesetz/);
  const plus = { law: 'PLUS', style: 'dec', chain: 0, variant: 1, nums: ['5', '9', '2'], order: [3, 4] };
  assert.equal(t.constraints(plus, 2), true);
  const q = t.build(plus, 2);
  assert.equal(textOf(q, t.solve(plus, 2)), 'Plusklammerregel');
  // misconception plus_rule_as_dg: the DG option is offered and explained
  assert.ok(q.answer.options.some(o => /Distributivgesetz/.test(o.text) && /fällt eine Klammer weg/.test(o.feedback)));
});

test('name_law L2: 20 − (7 − 3) = 20 − 7 + 3 is the Minusklammerregel', () => {
  const t = T('numterms.evaluate.name_law');
  const p = { law: 'MINUS', style: 'dec', chain: 0, variant: 1, nums: ['20', '7', '3'], order: [5, 6] };
  assert.equal(t.constraints(p, 2), true);
  assert.equal(textOf(t.build(p, 2), t.solve(p, 2)), 'Minusklammerregel');
});

test('name_law L3: 25 + 37 + 75 → 37 + 25 + 75 → 37 + (25 + 75) is „erst KG+, dann AG+“; swapped order is wrong', () => {
  const t = T('numterms.evaluate.name_law');
  const p = { law: 'KG+', style: 'int', chain: 0, variant: 0, nums: ['25', '37', '75'], order: [7, 8] };
  assert.equal(t.constraints(p, 3), true);
  const q = t.build(p, 3);
  assert.equal(textOf(q, q.answer.correct), 'erst KG+, dann AG+');
  assert.equal(t.solve(p, 3), q.answer.correct);
  const swapped = q.answer.options.find(o => o.text === 'erst AG+, dann KG+');
  assert.ok(swapped && /anderen Reihenfolge/.test(swapped.feedback));
});

test('compute_cleverly L2: 25·17·4 = (25·4)·17 = 1700; 0,7 + 1,9 + 0,3 = 2,9', () => {
  const t = T('numterms.evaluate.compute_cleverly');
  const prod = { kind: 'prod', pair: ['25', '4'], b: '17', dec: false, order: [1, 2], cleverFirst: true };
  assert.equal(t.constraints(prod, 2), true);
  const q = t.build(prod, 2);
  ok(q.answer, '1700');
  const sum = { kind: 'sum', pair: ['0.7', '0.3'], b: '1.9', dec: true, order: [1, 2], cleverFirst: true };
  assert.equal(t.constraints(sum, 2), true);
  const q2 = t.build(sum, 2);
  ok(q2.answer, '2,9');
  ok(q2.answer, '29/10');
  wrong(q2.answer, '3');
});

test('compute_cleverly L3: 3/7·5 + 3/7·9 = 3/7·14 = 6; forgetting the factor (15/7 + 9 = 78/7) is flagged', () => {
  const t = T('numterms.evaluate.compute_cleverly');
  const p = { kind: 'dg', f: '3/7', op: '+', b: 5, c: 9, dec: false, order: [1, 2], cleverFirst: true };
  assert.equal(t.constraints(p, 3), true);
  const q = t.build(p, 3);
  ok(q.answer, '6');
  wrong(q.answer, '78/7', 'concept_confusion');
});

test('compute_cleverly L4: 0,4·32 + 0,4·28 — the Ausklammern route (0,4·60 = 24) is cleverer than 12,8 + 11,2', () => {
  const t = T('numterms.evaluate.compute_cleverly');
  const p = { kind: 'dg', f: '0.4', op: '+', b: 32, c: 28, dec: true, order: [9, 9], cleverFirst: false };
  assert.equal(t.constraints(p, 4), true);
  const q = t.build(p, 4);
  // cleverFirst false → the clever route is Weg B
  assert.match(textOf(q, q.answer.correct), /^Weg B, weil/);
  assert.equal(t.solve(p, 4), q.answer.correct);
  assert.ok(q.promptLines[1].includes('60'), 'Weg B shows 0,4·60');
});

test('quotient: (12x):3 = 4x; (3x):2 = 3/2·x = 1,5x; (9x):(−6) = −3/2·x; (6x + 8):2 = 3x + 4', () => {
  const t = T('terms.simplify_products.quotient');
  const q1 = t.build({ a: 12, c: 0, b: 3, style: 'bracket' }, 1);
  ok(q1.answer, '4x');
  wrong(q1.answer, '36x', 'concept_confusion');
  const q2 = t.build({ a: 3, c: 0, b: 2, style: 'bracket' }, 2);
  ok(q2.answer, '3/2x');
  ok(q2.answer, '1,5x');
  ok(q2.answer, '3/2*x');
  const r = E.validateAnswer(q2.answer, '(3x):2');
  assert.equal(r.status, 'incorrect');
  assert.equal(r.code, 'quotient_not_product'); // equivalent, but still a quotient (D83)
  wrong(q2.answer, '2/3x', 'concept_confusion');
  const q3 = t.build({ a: 9, c: 0, b: -6, style: 'bracket' }, 2);
  ok(q3.answer, '-1,5x');
  wrong(q3.answer, '1,5x', 'sign_error');
  const q4 = t.build({ a: 6, c: 8, b: 2, style: 'bracket' }, 3);
  ok(q4.answer, '3x+4');
  wrong(q4.answer, '3x+8', 'concept_confusion'); // only the first summand divided
});

test('fill_missing: □·(2x + 7) = 6x + 21 → 3; 4·(3x − □) = 12x − 8 → 2; −(□x − 4) = −7x + 4 → 7; □·(2x − 5) = −6x + 15 → −3', () => {
  const t = T('terms.expand_factor.fill_missing');
  const cases = [
    [{ kind: 'factor', a: 3, b: 2, c: 7, s: '+' }, 1, '3'],
    [{ kind: 'inner_const', a: 4, b: 3, c: 2, s: '-' }, 2, '2'],
    [{ kind: 'minus_coef', a: 2, b: 7, c: 4, s: '-' }, 3, '7'],
    [{ kind: 'neg_factor', a: 3, b: 2, c: 5, s: '-' }, 3, '-3'],
  ];
  for (const [p, level, want] of cases) {
    assert.equal(t.constraints(p, level), true, JSON.stringify(p));
    const q = t.build(p, level);
    assert.equal(q.answer.value, want);
    assert.equal(t.solve(p, level), want);
  }
  wrong(t.build(cases[2][0], 3).answer, '-7', 'sign_error');
  wrong(t.build(cases[3][0], 3).answer, '3', 'sign_error');
});

test('term_type: 4·(x + 10) − 10 is a Differenz; 3·(x + 5) a Produkt; (x + 2):5 a Quotient; 9x + (3x + 8) a Summe', () => {
  const t = T('terms.simplify_products.term_type');
  const v = (n, k, p, q) => ({ n, k, p, q });
  const cases = [
    [{ top: 'diff', left: 'prodsum', right: 'num', lv: v(2, 4, 1, 10), rv: v(10, 2, 1, 1), order: [1, 2] }, 'Differenz'],
    [{ top: 'prod', left: 'num', right: 'sum', lv: v(3, 2, 1, 1), rv: v(2, 2, 1, 5), order: [1, 2] }, 'Produkt'],
    [{ top: 'quot', left: 'sum', right: 'num', lv: v(2, 2, 1, 2), rv: v(5, 2, 1, 1), order: [1, 2] }, 'Quotient'],
    [{ top: 'sum', left: 'kx', right: 'sum', lv: v(2, 9, 1, 1), rv: v(2, 2, 3, 8), order: [1, 2] }, 'Summe'],
  ];
  for (const [p, name] of cases) {
    assert.equal(t.constraints(p, 1), true, JSON.stringify(p));
    const q = t.build(p, 1);
    assert.equal(textOf(q, q.answer.correct), name);
    assert.equal(t.solve(p, 1), q.answer.correct);
  }
  assert.match(t.build(cases[2][0], 1).prompt, /\\left\(x\+2\\right\):5/);
});

test('catalog: x·x and sum×sum are marked outside the book scope; the new families are validated', () => {
  const cat = require('../catalog.json');
  const skills = Object.fromEntries(cat.chapters.flatMap(c => c.topics.flatMap(t => t.skills)).map(s => [s.id, s]));
  const fam = (s, f) => skills[s].families.find(x => x.id === f);
  assert.equal(fam('ch1.terms.simplify_products', 'term_times_term').inBookScope, false);
  assert.equal(fam('ch1.terms.expand_factor', 'sum_times_sum').inBookScope, false);
  for (const [s, f] of [['ch1.numterms.evaluate', 'name_law'], ['ch1.numterms.evaluate', 'compute_cleverly'], ['ch1.terms.simplify_products', 'quotient'],
    ['ch1.terms.simplify_products', 'term_type'], ['ch1.terms.expand_factor', 'fill_missing']]) assert.equal(fam(s, f).status, 'validated', f);
});
