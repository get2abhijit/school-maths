'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const hints = () => E.HINT_KINDS.map(kind => ({ kind, text: `Hinweis (${kind})` }));
const exprSpec = (value, form = 'expanded', distractors = []) => ({ type: 'expression', value, canonical: value, variables: ['x'], form, distractors });

// ---------------------------------------------------------------- validators
test('machine numbers vs student numbers', () => {
  assert.equal(E.Fraction.of('1.000').toString(), '1');           // machine: dot is decimal
  assert.equal(E.parseNumber('1.000').code, 'ambiguous_separator'); // student: ambiguous
});

test('integer: correct / wrong / invalid are distinguished', () => {
  const spec = { type: 'integer', value: '-12', canonical: '-12', distractors: [{ value: '12', category: 'sign_error', feedback: 'Vorzeichen prüfen.' }] };
  assert.equal(E.validateAnswer(spec, '-12').status, 'correct');
  assert.equal(E.validateAnswer(spec, '\u221212').status, 'correct');
  const w = E.validateAnswer(spec, '12');
  assert.equal(w.status, 'incorrect');
  assert.equal(w.errorCategory, 'sign_error');
  assert.equal(E.validateAnswer(spec, '13').errorCategory, 'other');
  const inv = E.validateAnswer(spec, 'zwölf');
  assert.equal(inv.status, 'invalid');
  assert.ok(inv.message);
  assert.equal(E.validateAnswer(spec, '').status, 'invalid');
});

test('fraction: equivalence and optional reduced form', () => {
  const spec = { type: 'fraction', value: '3/4', canonical: '3/4' };
  for (const s of ['3/4', '6/8', '0,75', '0.75']) assert.equal(E.validateAnswer(spec, s).status, 'correct', s);
  const strict = { ...spec, requireReduced: true };
  const r = E.validateAnswer(strict, '6/8');
  assert.equal(r.status, 'incorrect');
  assert.equal(r.equivalent, true);
  assert.equal(r.code, 'not_reduced');
});

test('decimal: exact tolerance, rounding category for near misses', () => {
  const spec = { type: 'decimal', value: '2.35', tolerance: '0.005', canonical: '2,35' };
  assert.equal(E.validateAnswer(spec, '2,35').status, 'correct');
  assert.equal(E.validateAnswer(spec, '2,354').status, 'correct');
  assert.equal(E.validateAnswer(spec, '2,355').status, 'correct');    // boundary inclusive
  assert.equal(E.validateAnswer(spec, '2,36').errorCategory, 'rounding');
  assert.equal(E.validateAnswer(spec, '5').errorCategory, 'other');
});

test('expression: equivalence + form, with misconception feedback', () => {
  const spec = exprSpec('2x+6', 'expanded', [{ value: '2x+3', category: 'concept_confusion', feedback: 'Multipliziere jedes Glied in der Klammer.' }]);
  assert.equal(E.validateAnswer(spec, '6+2x').status, 'correct');
  assert.equal(E.validateAnswer(spec, '2·x + 6').status, 'correct');
  const notExpanded = E.validateAnswer(spec, '2(x+3)');
  assert.equal(notExpanded.status, 'incorrect');
  assert.equal(notExpanded.equivalent, true);
  assert.equal(notExpanded.code, 'brackets_remaining');
  const mis = E.validateAnswer(spec, '3+2x');
  assert.equal(mis.status, 'incorrect');
  assert.equal(mis.errorCategory, 'concept_confusion');
  assert.equal(E.validateAnswer(spec, '2y+6').status, 'invalid');
  assert.equal(E.validateAnswer(spec, '2x+').status, 'invalid');
});

test('choice / multiselect / ordering', () => {
  const ch = { type: 'choice', canonical: 'b', correct: 'b', options: [{ id: 'a', text: '5x', category: 'concept_confusion' }, { id: 'b', text: '3x+2' }] };
  assert.equal(E.validateAnswer(ch, 'b').status, 'correct');
  assert.equal(E.validateAnswer(ch, 'a').errorCategory, 'concept_confusion');
  assert.equal(E.validateAnswer(ch, 'z').status, 'invalid');
  assert.equal(E.validateAnswer(ch, null).status, 'invalid');
  const ms = { type: 'multiselect', canonical: ['a', 'c'], correct: ['a', 'c'], options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }, { id: 'c', text: '3' }] };
  assert.equal(E.validateAnswer(ms, ['c', 'a']).status, 'correct');
  assert.equal(E.validateAnswer(ms, ['a']).status, 'incorrect');
  assert.equal(E.validateAnswer(ms, []).status, 'invalid');
  const ord = { type: 'ordering', canonical: ['c', 'a', 'b'], correct: ['c', 'a', 'b'], items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] };
  assert.equal(E.validateAnswer(ord, ['c', 'a', 'b']).status, 'correct');
  assert.equal(E.validateAnswer(ord, ['a', 'c', 'b']).firstWrongPosition, 0);
  assert.equal(E.validateAnswer(ord, ['a', 'a', 'b']).status, 'invalid');
});

test('table: per-cell results', () => {
  const spec = { type: 'table', cells: [
    { id: 'x1', spec: { type: 'integer', value: '5', canonical: '5' } },
    { id: 'x2', spec: { type: 'integer', value: '8', canonical: '8' } },
  ] };
  assert.equal(E.validateAnswer(spec, { x1: '5', x2: '8' }).status, 'correct');
  const r = E.validateAnswer(spec, { x1: '5', x2: '9' });
  assert.equal(r.status, 'incorrect');
  assert.equal(r.cells.x1.status, 'correct');
  assert.equal(E.validateAnswer(spec, { x1: '5' }).status, 'invalid');
});

// ---------------------------------------------------------------- toy templates
/** Toy template: expand a(x+b). Used only to test the pipeline (real generators come in S2). */
const toyExpand = {
  id: 'toy.expand', version: 1, skillId: 'ch1.terms.expand_factor', levels: [1, 2],
  sample(rng, level) { return { a: level === 1 ? rng.int(2, 9) : rng.intExcept(-9, 9, [0, 1, -1]), b: rng.intExcept(-9, 9, [0]) }; },
  constraints(p) { return p.a * p.b !== p.b ? true : 'degenerate'; },
  build(p) {
    const value = `${p.a}x${p.a * p.b >= 0 ? '+' : ''}${p.a * p.b}`;
    return {
      prompt: `Multipliziere aus: $${p.a}(x${p.b >= 0 ? '+' : ''}${p.b})$`,
      answer: exprSpec(value, 'expanded', [{ value: `${p.a}x${p.b >= 0 ? '+' : ''}${p.b}`, category: 'concept_confusion', feedback: 'Jedes Glied multiplizieren.' }]),
      hints: hints(),
      solution: { steps: ['Distributivgesetz anwenden.'], result: `$${value}$` },
    };
  },
  // Independent path: via the polynomial engine, not string building.
  solve(p) { return E.polyToString(E.toPoly(E.parse(`${p.a}*(x+(${p.b}))`, { variables: ['x'] }))); },
};

test('generate: deterministic from (template, version, seed, level)', () => {
  const a = E.generate(toyExpand, 12345, 2), b = E.generate(toyExpand, 12345, 2);
  assert.deepEqual(a, b);
  assert.equal(a.id, 'toy.expand@1/L2/12345');
  assert.match(a.signature, /^[0-9a-f]{8}$/);
  assert.ok(E.validateQuestion(a).ok);
  const c = E.generate(toyExpand, 12346, 2);
  assert.notEqual(a.id, c.id);
});

test('generate: rejected parameters regenerate with derived seeds', () => {
  let calls = 0;
  const t = { ...toyExpand, id: 'toy.reject', constraints: (p) => (++calls < 4 ? 'forced' : true) };
  const q = E.generate(t, 1, 1);
  assert.equal(q.meta.attempts, 4);
  assert.equal(q.meta.effectiveSeed, E.deriveSeed(1, 3));
});

test('generate: a template whose independent solution disagrees never publishes', () => {
  const broken = { ...toyExpand, id: 'toy.broken', solve: (p) => `${p.a}x+${p.b}` }; // wrong on purpose
  assert.throws(() => E.generate(broken, 99, 1), E.GenerationError);
});

test('generate: ambiguous distractors and missing hints are rejected', () => {
  const ambiguous = { ...toyExpand, id: 'toy.amb', build(p) { const q = toyExpand.build(p); q.answer.distractors = [{ value: q.answer.value, category: 'other' }]; return q; } };
  assert.throws(() => E.generate(ambiguous, 5, 1), E.GenerationError);
  const noHints = { ...toyExpand, id: 'toy.nohints', build(p) { const q = toyExpand.build(p); q.hints = q.hints.slice(0, 3); return q; } };
  assert.throws(() => E.generate(noHints, 5, 1), E.GenerationError);
  assert.throws(() => E.generate(toyExpand, 5, 4), E.GenerationError); // unsupported level
});

test('evaluateQuestion is the single entry point and tags results', () => {
  const q = E.generate(toyExpand, 777, 1);
  const r = E.evaluateQuestion(q, q.answer.canonical);
  assert.equal(r.status, 'correct');
  assert.equal(r.questionId, q.id);
});

test('regenerate checks template versions', () => {
  const q = E.generate(toyExpand, 42, 1);
  const ref = { templateId: q.templateId, templateVersion: q.templateVersion, seed: q.seed, level: q.level };
  assert.deepEqual(E.regenerate({ 'toy.expand': toyExpand }, ref), q);
  assert.throws(() => E.regenerate({ 'toy.expand': { ...toyExpand, version: 2 } }, ref), E.GenerationError);
});

test('generateSession: no duplicate signatures, reproducible', () => {
  const s1 = E.generateSession([toyExpand], { baseSeed: 2026, count: 20, level: [1, 2] });
  const s2 = E.generateSession([toyExpand], { baseSeed: 2026, count: 20, level: [1, 2] });
  assert.equal(s1.length, 20);
  assert.equal(new Set(s1.map(q => q.signature)).size, 20);
  assert.deepEqual(s1.map(q => q.id), s2.map(q => q.id));
});

test('property: 500 seeds of the toy template are all valid and self-consistent', () => {
  for (let seed = 0; seed < 500; seed++) {
    for (const level of [1, 2]) {
      const q = E.generate(toyExpand, seed, level);
      assert.ok(E.validateQuestion(q).ok);
      assert.equal(E.evaluateQuestion(q, toyExpand.solve(q.meta.params, level)).status, 'correct');
    }
  }
});
