'use strict';
/**
 * Chapter 4 oracle tests: fixed parameters, expected results computed BY HAND (see comments), independent of the
 * engine. They pin the meaning of each template's parameters and the solution_set answer type.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[`ch4.eq.${id}`];
const x = c => ({ t: 'x', c: String(c) });
const n = c => ({ t: 'n', c: String(c) });
const br = (f, a, b) => ({ t: 'br', f: String(f), a: String(a), b: String(b) });
/** Build a question body from fixed params after checking the constraints. */
function build(t, p, level) {
  assert.equal(t.constraints(p, level), true, `${t.id}: constraints`);
  const body = t.build(p, level);
  return body;
}
const res = (spec, input) => E.validateAnswer(spec, input);
const status = (spec, input) => res(spec, input).status;

test('solution_set: input forms, invalid vs wrong, kind feedback', () => {
  const one = { type: 'solution_set', variable: 'x', kind: 'one', value: '3/2', canonical: { kind: 'one', value: '3/2' } };
  for (const ok of [{ kind: 'one', value: '1,5' }, { kind: 'one', value: 'x = 3/2' }, 'x=1.5', 'L = {3/2}', '{1,5}', '3/2']) assert.equal(status(one, ok), 'correct', JSON.stringify(ok));
  for (const inv of [{}, '', { kind: 'one' }, { kind: 'one', value: '' }, { kind: 'one', value: 'abc' }, { kind: 'maybe' }, null]) assert.equal(status(one, inv), 'invalid', JSON.stringify(inv));
  assert.equal(res(one, { kind: 'one', value: '2' }).status, 'incorrect');
  assert.equal(res(one, 'keine').code, 'kind_one_not_special');
  const all = { type: 'solution_set', variable: 'x', kind: 'all', canonical: { kind: 'all' } };
  for (const ok of ['unendlich viele', 'alle', 'jede Zahl', 'L = Q', 'ℚ', { kind: 'all' }]) assert.equal(status(all, ok), 'correct', JSON.stringify(ok));
  assert.equal(res(all, 'keine Lösung').code, 'kind_all_not_none');     // 0 = 0 is not "no solution"
  assert.equal(res(all, 'x = 0').code, 'kind_special_not_one');
  const none = { type: 'solution_set', variable: 'x', kind: 'none', canonical: { kind: 'none' } };
  for (const ok of ['keine', 'L = {}', '{}', '∅', { kind: 'none' }]) assert.equal(status(none, ok), 'correct', JSON.stringify(ok));
  assert.equal(res(none, { kind: 'all' }).code, 'kind_none_not_all');
  // numeric answers with a variable accept "x = …"
  assert.equal(status({ type: 'fraction', variable: 'x', value: '-8/5', canonical: '-8/5' }, 'x = -1,6'), 'correct');
  assert.equal(status({ type: 'integer', value: '3', canonical: '3' }, 'x = 3'), 'invalid'); // no variable → no prefix
  assert.equal(E.validateQuestion({ id: 'a', templateId: 't', templateVersion: 1, skillId: 's', signature: 'x', prompt: 'p', level: 1,
    hints: E.HINT_KINDS.map(k => ({ kind: k, text: 't' })), solution: { steps: ['s'], result: 'r' },
    answer: { type: 'solution_set', kind: 'none', value: '1', canonical: { kind: 'none' } } }).ok, false); // value only for kind one
});

test('solve: 3(x−2)+4 = −2(x+5) → x = −8/5; misconception values', () => {
  // 3x−6+4 = −2x−10 → 3x−2 = −2x−10 → 5x = −8 → x = −8/5
  const t = T('solve_equivalence.solve');
  const q = build(t, { shape: 'f(x+b)+c=g(x+e)', L: [br(3, 1, -2), n(4)], R: [br(-2, 1, 5)] }, 3);
  assert.equal(q.answer.value, '-8/5');
  for (const ok of ['-8/5', '-1,6', 'x = -1.6', '−8/5']) assert.equal(status(q.answer, ok), 'correct', ok);
  // sign of the number: (−10 − 2)/5 = −12/5; sign of the x-term: −8/(3 − 2) = −8; inverse division: 5/(−8)
  assert.equal(res(q.answer, '-12/5').errorCategory, 'sign_error');
  assert.equal(res(q.answer, '-8').errorCategory, 'sign_error');
  assert.equal(res(q.answer, '-5/8').errorCategory, 'concept_confusion');
  // only the first term multiplied: 3x−2+4 = −2x+5 → 5x = 3 → 3/5
  assert.equal(res(q.answer, '3/5').errorCategory, 'concept_confusion');
  // minus before the bracket ignored: −2(x+5) → −2x+10: 3x−2 = −2x+10 → x = 12/5
  assert.equal(res(q.answer, '12/5').errorCategory, 'sign_error');
  assert.equal(t.solve({ L: [br(3, 1, -2), n(4)], R: [br(-2, 1, 5)] }), '-8/5');
  assert.ok(q.solution.steps.some(s => s.includes('Klammern auflösen')));
  assert.ok(q.solution.steps[q.solution.steps.length - 1].startsWith('Probe'));
});

test('solve: ½x + 3 = ⅓x − 1 → ·6 → 3x + 18 = 2x − 6 → x = −24', () => {
  const q = build(T('solve_equivalence.solve'), { shape: 'frac', L: [x('1/2'), n(3)], R: [x('1/3'), n(-1)] }, 3);
  assert.equal(q.answer.value, '-24');
  assert.match(q.solution.steps[0], /\\cdot 6/);
  assert.match(q.solution.steps[1], /^\$3x\+18 = 2x-6/);
});

test('spot_error: 7x − 5 = x + 25, planted errors at the right step', () => {
  // correct: |−x → 6x−5 = 25 |+5 → 6x = 30 |:6 → x = 5
  const t = T('solve_equivalence.spot_error');
  const base = { shape: 'ax+b=cx+d', L: [x(7), n(-5)], R: [x(1), n(25)] };
  // pick 1 → wrong sign with the number: 6x = 25 − 5 = 20 (second transformation)
  let q = build(t, { ...base, pick: 1 }, 2);
  assert.equal(q.answer.correct, 's2');
  assert.match(q.promptLines[2], /^\(3\) \$6x = 20/);
  assert.equal(t.solve({ ...base, pick: 1 }, 2), 's2');
  // pick 0 → wrong sign with the x-term: 8x − 5 = 25 (first transformation)
  q = build(t, { ...base, pick: 0 }, 2);
  assert.equal(q.answer.correct, 's1');
  assert.match(q.promptLines[1], /^\(2\) \$8x-5 = 25/);
  // pick 2 → subtract instead of divide: x = 30 − 6 = 24
  q = build(t, { ...base, pick: 2 }, 2);
  assert.equal(q.answer.correct, 's3');
  assert.match(q.promptLines[3], /x = 24/);
});

test('is_solution L4: x(x − 3) = 0 has the solutions 0 and 3', () => {
  const t = T('setup_trial.is_solution');
  const p = { level: 4, kind: 'prod_zero', r: 3, b: 1, extra: [-2, 1, 5, -4, 0, 3, 7] };
  const q = build(t, p, 4);
  const pick = vals => q.answer.options.filter(o => vals.some(v => o.text === `$x = ${v}$`)).map(o => o.id);
  assert.equal(status(q.answer, pick([0, 3])), 'correct');
  assert.equal(status(q.answer, pick([3])), 'incorrect');        // stops after the first solution
  assert.deepEqual(t.solve(p, 4).sort(), pick([0, 3]).sort());
});

test('text_to_equation: "multiply by 3, then add 7, get 22" → 3x + 7 = 22 (secret number 5)', () => {
  const t = T('setup_trial.text_to_equation');
  const p = { kind: 'mul_add', k: 3, a: 7, n: 5, order: [3, 2, 1, 0] };
  const q = build(t, p, 2);
  const right = q.answer.options.find(o => o.id === q.answer.correct);
  assert.equal(right.text, '$3x+7 = 22$');
  assert.ok(q.answer.options.some(o => o.text === '$3\\left(x+7\\right) = 22$' && o.category === 'order_of_operations'));
  assert.equal(t.solve(p), q.answer.correct);
});

test('classify: none / all / one', () => {
  const t = T('solution_count.classify');
  // −4x − 8 = −3 − 4x  → −8 = −3 (false) → no solution
  let q = build(t, { kind: 'none', form: 'plain', L: [x(-4), n(-8)], R: [n(-3), x(-4)] }, 1);
  assert.equal(q.answer.kind, 'none');
  assert.equal(status(q.answer, 'keine Lösung'), 'correct');
  // 2(x + 3) = 2x + 6 → 6 = 6 (true) → every number
  q = build(t, { kind: 'all', form: 'bracket', L: [br(2, 1, 3)], R: [x(2), n(6)] }, 2);
  assert.equal(q.answer.kind, 'all');
  assert.equal(res(q.answer, { kind: 'one', value: '0' }).errorCategory, 'concept_confusion');
  assert.equal(q.solution.result, 'Unendlich viele Lösungen: Jede Zahl ist eine Lösung.');
  // 3x + 2 = x + 8 → 2x = 6 → x = 3
  q = build(t, { kind: 'one', form: 'plain', L: [x(3), n(2)], R: [x(1), n(8)] }, 1);
  assert.deepEqual([q.answer.kind, q.answer.value], ['one', '3']);
  assert.equal(status(q.answer, { kind: 'one', value: '3' }), 'correct');
  assert.equal(status(q.answer, { kind: 'none' }), 'incorrect');
});

test('parameter: a for no / infinitely many / a given solution', () => {
  const t = T('solution_count.parameter');
  // 3x + 5 = ax + 2: no solution iff a = 3
  assert.equal(build(t, { kind: 'coef_none', p: 3, b: 5, d: 2 }, 3).answer.value, '3');
  // 4(x − 2) = 4x + a: all iff a = −8
  assert.equal(build(t, { kind: 'const_all', f: 4, b: -2 }, 3).answer.value, '-8');
  // a(x + 2) = 5x + 10: all iff a = 5
  assert.equal(build(t, { kind: 'coef_all', p: 5, b: 2 }, 3).answer.value, '5');
  // ax − 1 = 5 with x = 2: 2a = 6 → a = 3
  const q = build(t, { kind: 'given_solution', s: 2, aa: 3, b: -1 }, 3);
  assert.equal(q.answer.value, '3');
  assert.equal(status(q.answer, 'a = 3'), 'correct');
  assert.equal(t.solve({ kind: 'given_solution', s: 2, aa: 3, b: -1 }), '3');
});

test('justify: 2(x + 3) = 2x + 6 → 6 = 6 → every number', () => {
  const t = T('solution_count.justify');
  const p = { kind: 'all', form: 'bracket', L: [br(2, 1, 3)], R: [x(2), n(6)], order: [0, 1, 2, 3], name: 'Mia' };
  const q = build(t, p, 4);
  assert.equal(q.answer.correct, 'c_all');
  assert.match(q.answer.options.find(o => o.id === 'c_all').text, /\$6 = 6\$ ist wahr/);
  assert.equal(t.solve(p), 'c_all');
});

test('contexts: ages 30 together, 4 years apart → younger 13, older 17', () => {
  const t = T('word_problems.contexts');
  const p = { kind: 'ages_sum', ask: 'other', d: 4, y: 13, names: 0 };   // Lea is 4 years older than Ben
  const q = build(t, p, 3);
  assert.match(q.prompt, /Zusammen sind beide 30 Jahre alt\. Wie alt ist Lea\?/);
  assert.equal(q.answer.value, '17');
  assert.equal(res(q.answer, '13').errorCategory, 'concept_confusion');  // answered x instead of the asked age
  assert.equal(t.solve(p), '17');
});

test('interpret: 20 people with 3× as many children → 5 adults; 22 people → no fitting solution; negative width', () => {
  const t = T('word_problems.interpret');
  const o = [0, 1, 2, 3];
  assert.equal(build(t, { kind: 'bus', S: 20, k: 3, order: o }, 4).answer.correct, 'c_val');   // 4x = 20 → 5
  assert.equal(build(t, { kind: 'bus', S: 22, k: 3, order: o }, 4).answer.correct, 'c_none');  // 4x = 22 → 5,5
  const r = build(t, { kind: 'rectangle', d: 10, P: 12, order: o }, 4);                         // 4x + 20 = 12 → x = −2
  assert.equal(r.answer.correct, 'c_none');
  assert.ok(r.answer.options.some(op => op.category === 'sign_error'));
  assert.equal(t.solve({ kind: 'consecutive', S: 100, order: o }), 'c_none');                   // 3x + 3 = 100 → 97/3
});
