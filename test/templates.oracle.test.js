'use strict';
/**
 * Oracle tests: fixed parameters with expected results computed BY HAND (in comments),
 * independent of the engine. They pin the meaning of each template's parameters.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch1.${id}`];
const check = (spec, input) => E.validateAnswer(spec, input);
const ok = (spec, input) => assert.equal(check(spec, input).status, 'correct', `expected correct: ${input}`);
const wrong = (spec, input, category) => {
  const r = check(spec, input);
  assert.equal(r.status, 'incorrect', `expected incorrect: ${input}`);
  if (category) assert.equal(r.errorCategory, category, `${input} category`);
  return r;
};

test('engine additions: printer brackets non-leading negatives, decimals, factored_complete', () => {
  const L = s => E.toLatex(E.parse(s));
  assert.equal(L('5+(-3)*4'), '5+\\left(-3\\right)\\cdot 4');
  assert.equal(L('0.5*(-6x)'), '0{,}5\\cdot \\left(-6x\\right)');
  assert.equal(L('1/2x-3/4x'), '\\frac{1}{2}x-\\frac{3}{4}x');
  assert.equal(L('(-3)^2-3^2'), '\\left(-3\\right)^{2}-3^{2}');
  const f = s => E.checkForm(E.parse(s, { variables: ['x'] }), 'factored_complete');
  assert.equal(f('3(2x+3)').ok, true);
  assert.equal(f('-3(2x-3)').ok, true);
  assert.equal(f('2(6x+9)').reason, 'incomplete_factoring');   // 6 and 9 share 3
  assert.equal(f('3(2x+1.5)').reason, 'non_integer_inside');
  assert.equal(f('3(x+x+3)').reason, 'inner_not_simplified');
  assert.equal(f('6x+9').reason, 'not_a_product');
});

test('order_ops: 3 + 4·5 = 23; left-to-right 35 flagged', () => {
  const q = T('numterms.evaluate.order_ops').build({ shape: 'a+b*c', a: 3, b: 4, c: 5 }, 1);
  assert.equal(q.answer.value, '23');
  ok(q.answer, '23');
  wrong(q.answer, '35', 'order_of_operations');
});

test('order_ops: −3² + 4·5 = −9 + 20 = 11; (−3)² reading gives 29', () => {
  const q = T('numterms.evaluate.order_ops').build({ shape: 'negsq', a: 3, b: 4, c: 5, p: '1/10', q: '1/2' }, 3);
  ok(q.answer, '11');
  wrong(q.answer, '29', 'sign_error');
});

test('order_ops: 0,5 + ¾·2 = 0,5 + 1,5 = 2 (decimal shown with comma)', () => {
  const q = T('numterms.evaluate.order_ops').build({ shape: 'mixed', a: 2, b: 2, c: 2, p: '5/10', q: '3/4' }, 3);
  ok(q.answer, '2');
  assert.match(q.prompt, /0\{,\}5/);
  wrong(q.answer, '2,5', 'order_of_operations'); // (0,5 + 0,75)·2 = 2,5
});

test('insert_brackets: 2+3·4−5 has the unique bracketing 2+3·(4−5) = −1', () => {
  // spans in order (0,1)=15, (0,2)=9, (1,2)=9, (1,3)=9, (2,3)=−1; no brackets = 9
  const t = T('numterms.evaluate.insert_brackets');
  const p = { nums: [2, 3, 4, 5], ops: ['+', '*', '-'], target: 4, pick: [0, 1, 2] };
  assert.equal(t.constraints(p, 2), true);
  const q = t.build(p, 2);
  const correct = q.answer.options.find(o => o.id === q.answer.correct);
  assert.match(correct.text, /\\left\(4-5\\right\)/);
  assert.match(q.prompt, /-1/);
  assert.equal(t.solve(p, 2), q.answer.correct);
  // target 9 would be ambiguous → rejected
  assert.notEqual(t.constraints({ ...p, target: 1 }, 2), true);
});

test('phrase_to_term: "um 5 kleiner als x" = x − 5, not 5 − x', () => {
  const q = T('terms.translate.phrase_to_term').build({ pattern: 'less', a: 2, b: 5, c: 1 }, 1);
  ok(q.answer, 'x-5');
  ok(q.answer, '-5+x');
  wrong(q.answer, '5-x', 'concept_confusion');
});

test('phrase_to_term: "das Dreifache der Summe aus x und 4" = 3(x+4) = 3x+12', () => {
  const q = T('terms.translate.phrase_to_term').build({ pattern: 'timesSum', a: 3, b: 4, c: 1 }, 2);
  ok(q.answer, '3(x+4)');
  ok(q.answer, '3x+12');
  wrong(q.answer, '3x+4', 'order_of_operations');
});

test('phrase_to_term: rectangle x by x+3 has perimeter 4x + 6', () => {
  const q = T('terms.translate.phrase_to_term').build({ pattern: 'rectPerim', a: 2, b: 3, c: 1 }, 3);
  ok(q.answer, '4x+6');
  wrong(q.answer, '2x+3');
});

test('sequence_to_term: 3; 7; 11; 15 → 4n − 1', () => {
  const t = T('terms.translate.sequence_to_term');
  const q = t.build({ kind: 'lin', m: 4, c: -1 }, 2);
  assert.match(q.prompt, /3;\\ 7;\\ 11;\\ 15/);
  ok(q.answer, '4n-1');
  ok(q.answer, '4(n-1)+3');
  wrong(q.answer, '4n+3', 'concept_confusion');
  wrong(q.answer, 'n+4', 'concept_confusion');
});

test('sequence_to_term L4: equivalent forms are the correct multiselect set', () => {
  const t = T('terms.translate.sequence_to_term');
  const p = { kind: 'multi', m: 4, c: -1, order: 12345 };
  const q = t.build(p, 4);
  const okIds = q.answer.correct.slice().sort();
  // correct options are 4(n−1)+3 and −1+4n; wrong ones 4n+3 and n+4
  const textOf = id => q.answer.options.find(o => o.id === id).text;
  assert.deepEqual(okIds.map(textOf).sort(), ['$-1+4n$', '$4\\left(n-1\\right)+3$'].sort());
  assert.deepEqual(t.solve(p, 4).slice().sort(), okIds);
});

test('single_value: −x² + 4 at x = −3 is −5; (−x)² reading gives 13', () => {
  const q = T('terms.evaluate.single_value').build({ shape: '-x^2+b', a: 2, b: 4, x: '-3' }, 3);
  ok(q.answer, '-5');
  wrong(q.answer, '13', 'sign_error');
});

test('single_value: 3x + 2 at x = −4 is −10; sign lost 14; "3 + x" reading 1', () => {
  const q = T('terms.evaluate.single_value').build({ shape: 'ax+b', a: 3, b: 2, x: '-4' }, 2);
  ok(q.answer, '-10');
  wrong(q.answer, '14', 'sign_error');
  wrong(q.answer, '1', 'concept_confusion');
});

test('value_table: 2x − 1 for x = 0…3 gives −1, 1, 3, 5', () => {
  const q = T('terms.evaluate.value_table').build({ shape: 'ax-b', a: 2, b: 1, xs: ['0', '1', '2', '3'] }, 1);
  assert.equal(check(q.answer, { c0: '-1', c1: '1', c2: '3', c3: '5' }).status, 'correct');
  const r = check(q.answer, { c0: '-1', c1: '1', c2: '3', c3: '6' });
  assert.equal(r.status, 'incorrect');
  assert.equal(r.cells.c3.status, 'incorrect');
  assert.equal(check(q.answer, { c0: '-1', c1: '', c2: '3', c3: '5' }).status, 'invalid');
});

test('find_input: 3x + 2 and 5x − 6 are equal at x = 4 (both 14)', () => {
  const t = T('terms.evaluate.find_input');
  const p = { a1: 3, b1: 2, a2: 5, b2: -6, x: 4 };
  const q = t.build(p, 4);
  ok(q.answer, '4');
  wrong(q.answer, '-4', 'sign_error');
  assert.equal(t.solve(p, 4), '4');
});

test('collect: 3x + 5 − x + 2 = 2x + 7', () => {
  const p = { style: 'int', terms: [{ c: '3', p: 1 }, { c: '5', p: 0 }, { c: '-1', p: 1 }, { c: '2', p: 0 }] };
  const q = T('terms.collect_like.collect').build(p, 2);
  ok(q.answer, '2x+7');
  ok(q.answer, '7+2x');
  wrong(q.answer, '9x', 'concept_confusion');   // 3 + 5 − 1 + 2 = 9
  wrong(q.answer, '4x+7', 'sign_error');        // minus of −x lost
  const r = wrong(q.answer, '3x-x+7');
  assert.equal(r.equivalent, true);
  assert.equal(r.code, 'like_terms_not_collected');
});

test('spot_error: lost minus in line 1 is detected as z1', () => {
  const t = T('terms.collect_like.spot_error');
  const p = { style: 'int', terms: [{ c: '3', p: 1 }, { c: '5', p: 0 }, { c: '-1', p: 1 }, { c: '2', p: 0 }], err: 1, flip: 0, slip: 'kx' };
  const L = t.lines(p);
  assert.deepEqual(L, ['3x+5-x+2', '3x+x+5+2', '(3+1)x+(5+2)', '4x+7']);
  assert.equal(t.solve(p, 2), 'z1');
  assert.equal(t.build(p, 2).answer.correct, 'z1');
});

test('number_times_term: (−4)·3x = −12x', () => {
  const p = { factors: [{ k: '-4', x: false }, { k: '3', x: true }], dec: false };
  const q = T('terms.simplify_products.number_times_term').build(p, 2);
  ok(q.answer, '-12x');
  wrong(q.answer, '12x', 'sign_error');
  wrong(q.answer, '-x', 'concept_confusion');   // −4 + 3 = −1
  assert.equal(wrong(q.answer, '-4*3x').code, 'unsimplified_coefficient');
});

test('area_terms: triangle with base 2x and height 9 has area 9x', () => {
  const q = T('terms.simplify_products.area_terms').build({ shape: 'triangle', a: 9, b: 2, c: 2, d: 1 }, 3);
  ok(q.answer, '9x');
  wrong(q.answer, '18x', 'concept_confusion');
});

test('area_terms: cuboid 3 × 7 × x has surface 2(21 + 3x + 7x) = 20x + 42', () => {
  const q = T('terms.simplify_products.area_terms').build({ shape: 'surface', a: 3, b: 1, c: 7, d: 1 }, 4);
  ok(q.answer, '20x+42');
  wrong(q.answer, '10x+21', 'concept_confusion');
});

test('expand: 2(x + 3) = 2x + 6; −(x − 4) = −x + 4', () => {
  const t = T('terms.expand_factor.expand');
  const q1 = t.build({ parts: [{ k: '2', inner: [['1', 1], ['3', 0]] }] }, 1);
  ok(q1.answer, '2x+6');
  wrong(q1.answer, '2x+3', 'concept_confusion');
  assert.equal(wrong(q1.answer, '2(x+3)').code, 'brackets_remaining');
  const q2 = t.build({ parts: [{ k: '-1', inner: [['1', 1], ['-4', 0]] }] }, 2);
  ok(q2.answer, '-x+4');
  wrong(q2.answer, '-x-4', 'sign_error');
});

test('expand L3: 3(2x + 1) − 2(x − 4) = 6x + 3 − 2x + 8 = 4x + 11', () => {
  const q = T('terms.expand_factor.expand').build({ parts: [{ k: '3', inner: [['2', 1], ['1', 0]] }, { k: '-2', inner: [['1', 1], ['-4', 0]] }] }, 3);
  ok(q.answer, '4x+11');
  wrong(q.answer, '4x-5', 'sign_error'); // −2·(−4) taken as −8
});

test('factor_out: 6x + 9 = 3(2x + 3); incomplete and non-integer forms get specific feedback', () => {
  const t = T('terms.expand_factor.factor_out');
  const p = { shape: 'linear', k: 3, b: 2, c: 3, swap: false };
  const q = t.build(p, 2);
  assert.match(q.prompt, /6x\+9/);
  ok(q.answer, '3(2x+3)');
  ok(q.answer, '(2x+3)*3');
  ok(q.answer, '-3(-2x-3)');
  assert.equal(wrong(q.answer, '1(6x+9)').code, 'incomplete_factoring');
  assert.equal(wrong(q.answer, '1,5(4x+6)').code, 'incomplete_factoring');
  assert.equal(wrong(q.answer, '6(x+1,5)').code, 'non_integer_inside');
  assert.equal(wrong(q.answer, '6x+9').code, 'not_a_product');
  wrong(q.answer, '3(2x+9)', 'concept_confusion');
  assert.equal(t.solve(p, 2), '3(2x+3)');
});

test('factor_out L4: 17·38 + 17·62 = 17·100 = 1700; n + (n+1) + (n+2) = 3(n+1)', () => {
  const t = T('terms.expand_factor.factor_out');
  ok(t.build({ shape: 'advantage', k: 17, m: 38, n: 62, op: '+' }, 4).answer, '1700');
  const q = t.build({ shape: 'consecutive', count: 3, even: false }, 4);
  ok(q.answer, '3(n+1)');
  assert.equal(wrong(q.answer, '3n+3').code, 'not_a_product');
});
