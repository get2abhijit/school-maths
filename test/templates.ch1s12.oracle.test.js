'use strict';
/**
 * Session 12 — hand-computed oracle tests for match_term_situation, think_of_number (G7) and equivalence_check,
 * plus their place in the KA blueprint (exams.json, D94).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const T = id => E.REGISTRY[id];
const F = x => E.Fraction.of(x);
const build = (id, p, level) => T(id).build(p, level);
const check = (q, raw) => E.validateAnswer(q.answer, raw);
const optionId = (q, text) => q.answer.options.find(o => o.text === text).id;

test('think_of_number: 3x → +6 → :3 → −x gives the constant 2', () => {
  const t = T('ch1.terms.translate.think_of_number');
  const p = { ops: [{ t: 'mul', k: 3 }, { t: 'add', k: 6 }, { t: 'div', k: 3 }, { t: 'subX' }], kind: 'term', order: 1 };
  assert.equal(t.constraints(p, 4), true);
  const q = build(t.id, p, 4);
  assert.deepEqual(q.promptLines, ['Denke dir eine Zahl.', 'Multipliziere sie mit $3$.', 'Addiere $6$.', 'Teile das Ergebnis durch $3$.', 'Subtrahiere die gedachte Zahl.']);
  assert.equal(check(q, '2').status, 'correct');
  // the unsimplified chain is equivalent but not simplified
  const u = check(q, '(3x+6):3-x');
  assert.equal(u.status, 'incorrect');
  assert.equal(u.equivalent, true);
  assert.equal(u.code, 'brackets_remaining');
  // forgotten bracket: 3x + 6 → x + 6 → 6
  const r = check(q, '6');
  assert.equal(r.status, 'incorrect');
  assert.equal(r.errorCategory, 'order_of_operations');
  assert.equal(t.solve(p, 4), '2');
  assert.ok(q.solution.steps.some(s => s.includes('\\left(3x+6\\right):3 = x+2')));
});

test('think_of_number: relation statement „um 1 kleiner“ for +2, ·2, −5, −x', () => {
  const t = T('ch1.terms.translate.think_of_number');
  const p = { ops: [{ t: 'add', k: 2 }, { t: 'mul', k: 2 }, { t: 'sub', k: 5 }, { t: 'subX' }], kind: 'relation', order: 7 };
  assert.equal(t.constraints(p, 4), true);
  const q = build(t.id, p, 4);
  // (x + 2)·2 − 5 − x = x − 1
  const right = optionId(q, 'Das Ergebnis ist um $1$ kleiner als die gedachte Zahl.');
  assert.equal(q.answer.correct, right);
  assert.equal(t.solve(p, 4), right);
  assert.equal(q.answer.options.length, 4);
  // forgetful chain: x + 2 → 2x + 2 → 2x − 3 → x − 3
  const forgetful = q.answer.options.find(o => o.text === 'Das Ergebnis ist um $3$ kleiner als die gedachte Zahl.');
  assert.ok(forgetful && forgetful.category === 'order_of_operations');
});

test('think_of_number: chains without a trick step or with fractions are rejected', () => {
  const t = T('ch1.terms.translate.think_of_number');
  assert.notEqual(t.constraints({ ops: [{ t: 'mul', k: 3 }, { t: 'add', k: 6 }, { t: 'sub', k: 2 }, { t: 'mul', k: 2 }], kind: 'term' }, 4), true);
  assert.notEqual(t.constraints({ ops: [{ t: 'mul', k: 3 }, { t: 'add', k: 5 }, { t: 'div', k: 3 }, { t: 'subX' }], kind: 'term' }, 4), true);
});

test('match_term_situation: forward and reverse oracle (Fahrradverleih 6 € + 7 € pro Stunde)', () => {
  const id = 'ch1.terms.translate.match_term_situation';
  const p = { ctx: 'bike', a: 6, b: 7, dir: 'forward', wrong: [0, 1, 2], order: 3 };
  assert.equal(T(id).constraints(p, 2), true);
  const q = build(id, p, 2);
  assert.match(q.prompt, /Gesucht ist der Preis in €, wenn die Grundgebühr \$6\$ € beträgt und jede Stunde \$7\$ € kostet\. Welcher Term passt\?/);
  assert.equal(q.answer.correct, optionId(q, '$6+7x$'));
  assert.equal(T(id).solve(p, 2), q.answer.correct);
  const r = check(q, optionId(q, '$\\left(6+7\\right)x$'));
  assert.equal(r.status, 'incorrect');
  assert.equal(r.errorCategory, 'order_of_operations');
  assert.equal(check(q, optionId(q, '$7+6x$')).errorCategory, 'concept_confusion');
  const pr = { ...p, dir: 'reverse' };
  const qr = build(id, pr, 3);
  assert.match(qr.prompt, /Welche Beschreibung passt zum Term \$6\+7x\$\?/);
  assert.equal(qr.answer.correct, optionId(qr, 'Der Preis in €, wenn die Grundgebühr $6$ € beträgt und jede Stunde $7$ € kostet'));
  assert.equal(T(id).solve(pr, 3), qr.answer.correct);
});

test('match_term_situation: a situation pair with the same term is rejected (Kino, Eintritt = Popcorn)', () => {
  const id = 'ch1.terms.translate.match_term_situation';
  // a(x+1) = ax + b when a = b
  assert.notEqual(T(id).constraints({ ctx: 'cinema', a: 5, b: 5, dir: 'forward', wrong: [0, 1, 2], order: 1 }, 2), true);
});

test('equivalence_check L1: 3x + 5 + 2x vs 10x → nein (merge_unlike)', () => {
  const id = 'ch1.terms.collect_like.equivalence_check';
  const p = { level: 1, dec: false, list: [[F(3), 1], [F(5), 0], [F(2), 1]], wantEq: false, pickR: 0, pickW: 0, order: 1 };
  assert.equal(T(id).constraints(p, 1), true);
  const q = build(id, p, 1);
  assert.equal(q.prompt, 'Sind die Terme $3x+5+2x$ und $10x$ gleichwertig?');
  assert.equal(q.answer.correct, 'nein');
  assert.equal(T(id).solve(p, 1), 'nein');
  assert.equal(check(q, 'ja').errorCategory, 'concept_confusion');
});

test('equivalence_check L2: 2x − 7x + 9 + 11 (= −5x + 20), right forms selected, wrong ones not', () => {
  const id = 'ch1.terms.collect_like.equivalence_check';
  const list = [[F(2), 1], [F(-7), 1], [F(9), 0], [F(11), 0]];
  const p = { level: 2, dec: false, list, nRight: 2, right: [0, 1], wrong: [0, 1], order: 5 };
  assert.equal(T(id).constraints(p, 2), true);
  const q = build(id, p, 2);
  const texts = q.answer.options.map(o => o.text).sort();
  // right: −5x + 20, 20 − 5x; wrong: (−5 + 20)x = 15x (merge), lost minus at −7x: 9x + 20
  assert.deepEqual(texts, ['$-5x+20$', '$15x$', '$20-5x$', '$9x+20$'].sort());
  const want = [optionId(q, '$-5x+20$'), optionId(q, '$20-5x$')].sort();
  assert.deepEqual(q.answer.correct.slice().sort(), want);
  assert.deepEqual(T(id).solve(p, 2).slice().sort(), want);
  assert.equal(check(q, want).status, 'correct');
  assert.equal(check(q, [want[0]]).status, 'incorrect');
});

test('equivalence_check L4: equal at x = 2 but not equivalent (5x + 11 vs 6x + 9)', () => {
  const id = 'ch1.terms.collect_like.equivalence_check';
  const p = { level: 4, eq: false, x0: 2, x1: 3, order: 9,
    t1: [[F(6), 1], [F(-1), 1], [F(5), 0], [F(6), 0]], t2: [[F(15), 1], [F(-9), 1], [F(-11), 0], [F(20), 0]] };
  assert.equal(T(id).constraints(p, 4), true);
  const q = build(id, p, 4);
  assert.match(q.prompt, /Beide Male erhält er \$21\$/);
  const right = optionId(q, 'Nein. Für $x=3$ hat der erste Term den Wert $26$, der zweite den Wert $27$.');
  assert.equal(q.answer.correct, right);
  assert.equal(T(id).solve(p, 4), right);
  assert.equal(check(q, optionId(q, 'Ja. Ein gleicher Wert beim Einsetzen reicht als Begründung.')).errorCategory, 'concept_confusion');
});

test('KA blueprint (D94): new families are targeted and reach the mock tasks', () => {
  const bp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exams.json'), 'utf8')).exams.find(e => e.id === 'ka1');
  assert.deepEqual(E.validateBlueprint(bp), []);
  const task = n => bp.mock.tasks.find(t => t.n === n);
  assert.ok(E.taskPool(bp, task(3), {}).map(t => t.id).includes('ch1.terms.translate.match_term_situation'));
  assert.ok(E.taskPool(bp, task(4), {}).map(t => t.id).includes('ch1.terms.collect_like.equivalence_check'));
  const pool8 = E.taskPool(bp, task(8), {}).map(t => t.id);
  assert.ok(pool8.includes('ch1.terms.translate.think_of_number'));
  assert.ok(pool8.includes('ch1.terms.collect_like.equivalence_check'));
  const sums = E.itemPractice(bp, 'ka1.sums', {}).find(g => g.skillId === 'ch1.terms.collect_like');
  assert.ok(sums.filter.templates.includes('ch1.terms.collect_like.equivalence_check'));
  const setup = E.itemPractice(bp, 'ka1.setup_evaluate', {}).find(g => g.skillId === 'ch1.terms.translate');
  assert.ok(setup.filter.templates.includes('ch1.terms.translate.match_term_situation'));
  // G7 is L4 only: it is practised through „Herausforderung“, not through the L1–L3 statement
  assert.ok(!setup.filter.templates.includes('ch1.terms.translate.think_of_number'));
  const challenge = E.itemPractice(bp, 'ka1.challenge', {}).find(g => g.skillId === 'ch1.terms.translate');
  assert.ok(challenge.filter.templates.includes('ch1.terms.translate.think_of_number'));
});
