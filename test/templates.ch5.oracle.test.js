'use strict';
/** Session 12 — hand-computed oracle tests for Chapter V (angles at lines, angle sum in a triangle). */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const T = id => E.REGISTRY[id];
const run = (id, p, level) => { const t = T(id); assert.equal(t.constraints(p, level), true); return t.build(p, level); };
const check = (q, raw) => E.validateAnswer(q.answer, raw);
const optionId = (q, text) => { const o = q.answer.options.find(x => x.text === text); assert.ok(o, `option „${text}“ missing`); return o.id; };
const CHASE = 'ch5.angles.lines.angle_chase', NAME = 'ch5.angles.lines.name_relation';
const MISS = 'ch5.angles.triangle_sum.missing_angle', PROOF = 'ch5.angles.triangle_sum.proof_order';

test('angle_chase L1: α = 63° → β = 117° (Nebenwinkel), γ = 63° (Scheitelwinkel); degree sign accepted', () => {
  const qb = run(CHASE, { th: 63, g: [1, 0], a: [1, 1] }, 1);
  assert.equal(qb.prompt, 'Die Geraden $g$ und $t$ schneiden sich. Es ist $\\alpha$ $= 63^\\circ$. Berechne $\\beta$.');
  for (const raw of ['117', '117°', '117 Grad']) assert.equal(check(qb, raw).status, 'correct', raw);
  const r = check(qb, '63');
  assert.equal(r.status, 'incorrect'); assert.equal(r.errorCategory, 'concept_confusion');
  assert.equal(T(CHASE).solve({ th: 63, g: [1, 0], a: [1, 1] }, 1), '117', 'measured from the drawing');
  const qg = run(CHASE, { th: 63, g: [1, 0], a: [1, 2] }, 1);
  assert.equal(check(qg, '63').status, 'correct');
  assert.equal(check(qg, '117').errorCategory, 'concept_confusion');
});

test('angle_chase L2: g ∥ h, t at 70°: α = 70° → β′ = 110° (Stufenwinkel, then Nebenwinkel)', () => {
  const p = { th: 70, g: [1, 0], a: [2, 1] };
  const q = run(CHASE, p, 2);
  assert.equal(check(q, '110').status, 'correct');
  assert.equal(T(CHASE).solve(p, 2), '110');
  assert.ok(q.solution.steps[0].includes("Stufenwinkel"));
});

test('angle_chase L3: α = (3x + 30)°, α′ = (2x + 40)° as Stufenwinkel at 60° → x = 10, α = 60°', () => {
  const p = { th: 60, g: [1, 0], a: [2, 0], x: 10, a1: 3, a2: 2 };
  const q = run(CHASE, p, 3);
  assert.match(q.prompt, /\\left\(3x\+30\\right\)\^\\circ.*\\left\(2x\+40\\right\)\^\\circ/);
  assert.equal(check(q, { x: '10', w: '60' }).status, 'correct');
  assert.equal(check(q, { x: 'x = 10', w: '60°' }).status, 'correct');
  assert.equal(check(q, { x: '10', w: '120' }).status, 'incorrect');
  assert.deepEqual(T(CHASE).solve(p, 3), { x: '10', w: '60' });
});

test('name_relation L1: (γ, α′) is a Wechselwinkel pair, (α, α′) a Stufenwinkel pair', () => {
  const q1 = run(NAME, { th: 55, kind: 'wechsel', g: [1, 2], a: [2, 0], phi: 0, order: 1 }, 1);
  assert.equal(q1.answer.correct, optionId(q1, 'Wechselwinkel'));
  assert.equal(T(NAME).solve({ th: 55, kind: 'wechsel', g: [1, 2], a: [2, 0], phi: 0, order: 1 }, 1), q1.answer.correct);
  const r = check(q1, optionId(q1, 'Stufenwinkel'));
  assert.match(r.feedback, /Z-Figur/);
  const q2 = run(NAME, { th: 120, kind: 'stufen', g: [1, 0], a: [2, 0], phi: 0, order: 1 }, 1);
  assert.equal(q2.answer.correct, optionId(q2, 'Stufenwinkel'));
});

test('name_relation L3 (Umkehrung): δ = 120°, δ′ = 115° → not parallel; equal sizes → parallel', () => {
  const pNo = { th: 60, kind: 'stufen', g: [1, 3], a: [2, 3], phi: -5, order: 4 };
  const q = run(NAME, pNo, 3);
  assert.match(q.prompt, /\$\\delta\$ \$= 120\^\\circ\$ und \$\\delta'\$ \$= 115\^\\circ\$/);
  assert.equal(q.answer.correct, optionId(q, "Nein. $\\delta$ und $\\delta'$ sind Stufenwinkel, aber nicht gleich groß."));
  assert.equal(T(NAME).solve(pNo, 3), q.answer.correct);
  const qYes = run(NAME, { ...pNo, phi: 0 }, 3);
  assert.equal(qYes.answer.correct, optionId(qYes, "Ja. $\\delta$ und $\\delta'$ sind Stufenwinkel und gleich groß."));
  assert.equal(check(qYes, optionId(qYes, 'Ja. Die Geraden sehen in der Zeichnung parallel aus.')).status, 'incorrect');
  assert.equal(q.diagram.elements.filter(e => e.t === 'parallel').length, 0, 'no parallel marks when parallelism is the question');
});

test('name_relation L4: the justification needs the relation AND „an den Parallelen“', () => {
  const p = { th: 70, kind: 'wechsel', g: [1, 3], a: [2, 1], phi: 0, order: 2 };
  const q = run(NAME, p, 4);
  const right = optionId(q, "$\\beta'$ $= 110^\\circ$, weil $\\delta$ und $\\beta'$ Wechselwinkel an den Parallelen $g$ und $h$ sind.");
  assert.equal(q.answer.correct, right);
  assert.equal(T(NAME).solve(p, 4), right);
  assert.match(check(q, optionId(q, "$\\beta'$ $= 110^\\circ$, weil Wechselwinkel immer gleich groß sind.")).feedback, /nur an Parallelen/);
});

test('missing_angle L1: α = 50°, β = 60° → γ = 70°; 250° is the 360°-misconception', () => {
  const p = { level: 1, a: 50, b: 60, asked: 'C' };
  const q = run(MISS, p, 1);
  assert.equal(check(q, '70°').status, 'correct');
  assert.match(check(q, '250').feedback, /180\^\\circ\$, nicht \$360/);
  assert.equal(T(MISS).solve(p, 1), '70', 'measured from the drawing');
});

test('missing_angle L2: α = x, β = 2x + 10, γ = 3x + 50 → 6x + 60 = 180, x = 20 (20°, 50°, 110°)', () => {
  const p = { level: 2, x: 20, k: [1, 2, 3], b1: 0, b2: 10, perm: 0 };
  const q = run(MISS, p, 2);
  assert.match(q.prompt, /\\alpha = \\left\(x\\right\)\^\\circ\$, \$\\beta = \\left\(2x\+10\\right\)\^\\circ\$ und \$\\gamma = \\left\(3x\+50\\right\)\^\\circ\$/);
  assert.equal(check(q, { x: '20', a: '20', b: '50', c: '110' }).status, 'correct');
  assert.deepEqual(T(MISS).solve(p, 2), { x: '20', a: '20', b: '50', c: '110' });
});

test('missing_angle L3: β = 70°, Außenwinkel ε = 110° → γ = 70°, α = 40°', () => {
  const p = { level: 3, a: 40, b: 70, asked: 'A' };
  const q = run(MISS, p, 3);
  assert.match(q.prompt, /\\beta = 70\^\\circ\$ und der Außenwinkel \$\\varepsilon = 110\^\\circ/);
  assert.equal(check(q, '40').status, 'correct');
  assert.match(check(q, '70').feedback, /Das ist \$\\gamma\$/);
  assert.equal(T(MISS).solve(p, 3), '40');
});

test('proof_order: correct order accepted, conclusion first is wrong at position 1', () => {
  const p = { variant: 'wechsel', a: 50, b: 60, order: 12345 };
  const q = run(PROOF, p, 4);
  assert.equal(q.answer.type, 'ordering');
  const texts = q.answer.correct.map(id => q.answer.items.find(i => i.id === id).text);
  assert.match(texts[0], /^Zeichne durch \$C\$ die Parallele/);
  assert.match(texts[4], /^Setzt man ein/);
  assert.equal(check(q, q.answer.correct).status, 'correct');
  assert.deepEqual(T(PROOF).solve(p, 4), q.answer.correct);
  const wrong = [q.answer.correct[4], ...q.answer.correct.slice(0, 4)];
  const r = check(q, wrong);
  assert.equal(r.status, 'incorrect'); assert.equal(r.firstWrongPosition, 0);
  assert.equal(q.diagram.kind, 'schematic');
});
