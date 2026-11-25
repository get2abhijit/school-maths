'use strict';
/**
 * Skill ch1.terms.expand_factor — family fill_missing, added in Session 11 (book alignment G5; LS7 I.5).
 * „Ergänze die fehlende Zahl“: an equation such as □·(2x + 7) = 6x + 21 where one number is missing.
 * Independent solver: brute force over the integers −100…100 — the candidate is substituted into the
 * parsed equation and both sides are compared with the equivalence checker (expr.js); exactly one
 * candidate may work (otherwise the instance is rejected).
 */
const U = require('../util');
const X = require('../../expr');
const { F, hints, tex, $, polyMachine } = U;

const SKILL = 'ch1.terms.expand_factor';
const SQ = '\\square ';
/** LaTeX of a machine string in which the variable y stands for the missing number. */
const holeTex = m => tex(m, { explicitMul: true }).replace(/y/g, SQ);
const withY = (m, v) => m.replace(/y/g, `(${v})`);

/**
 * Template ch1.terms.expand_factor.fill_missing (family fill_missing)
 * Levels
 *  L1 Grundlagen    the factor before the bracket is missing (□·(2x + 7) = 6x + 21), or a number on the expanded side.
 *  L2 Standard      a number inside the bracket is missing (3·(□x + 5) = 12x + 15, 4·(3x − □) = 12x − 8).
 *  L3 Anspruchsvoll negative factor or minus before the bracket (□·(2x − 5) = −6x + 15, −(□x − 4) = −7x + 4).
 * Misconceptions → distractors: multiplying only the first summand (distribute_first_only), sign rule of the
 *  Minusklammer (minus_bracket), subtracting instead of dividing.
 */
const fillMissing = {
  id: `${SKILL}.fill_missing`, version: 1, skillId: SKILL,
  families: ['fill_missing'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Fehlender Faktor vor der Klammer oder fehlende Zahl im ausmultiplizierten Term.',
    2: 'Fehlende Zahl in der Klammer.',
    3: 'Negativer Faktor oder Minus vor der Klammer.',
  },
  misconceptions: ['distribute_first_only', 'minus_bracket'],
  sample(rng, level) {
    const kind = level === 1 ? rng.pick(['factor', 'factor', 'rhs']) : level === 2 ? rng.pick(['inner_coef', 'inner_const']) : rng.pick(['neg_factor', 'minus_coef', 'neg_inner']);
    return { kind, a: rng.int(2, 9), b: rng.int(2, 9), c: rng.int(1, 12), s: rng.pick(['+', '-']) };
  },
  /** {left, right, answer} — machine strings with y for the hole, and the intended number. */
  equation(p) {
    const { a, b, c, s } = p, sg = s === '+' ? 1 : -1;
    switch (p.kind) {
      case 'factor': return { left: `y*(${b}x${s}${c})`, right: polyMachine([[a * b, 1], [sg * a * c, 0]]), answer: a };
      case 'rhs': return { left: `${a}*(${b}x${s}${c})`, right: `${a * b}x${s}y`, answer: a * c };
      case 'inner_coef': return { left: `${a}*(yx${s}${c})`, right: polyMachine([[a * b, 1], [sg * a * c, 0]]), answer: b };
      case 'inner_const': return { left: `${a}*(${b}x${s}y)`, right: polyMachine([[a * b, 1], [sg * a * c, 0]]), answer: c };
      case 'neg_factor': return { left: `y*(${b}x${s}${c})`, right: polyMachine([[-a * b, 1], [-sg * a * c, 0]]), answer: -a };
      case 'minus_coef': return { left: `-(yx${s}${c})`, right: polyMachine([[-b, 1], [-sg * c, 0]]), answer: b };
      case 'neg_inner': return { left: `-${a}*(${b}x${s}y)`, right: polyMachine([[-a * b, 1], [-sg * a * c, 0]]), answer: c };
      default: throw new Error(p.kind);
    }
  },
  constraints(p) {
    const e = this.equation(p);
    const sols = solutions(e);
    if (sols.length !== 1 || sols[0] !== e.answer) return `not uniquely solvable (${sols.join(',')})`;
    if (p.kind === 'rhs' && p.a * p.c > 99) return 'too large';
    return true;
  },
  build(p) {
    const e = this.equation(p);
    const full = e.left.replace(/y/g, String(e.answer)); // display only: no brackets needed (y leads or is positive)
    const eqTex = `${holeTex(e.left)} = ${holeTex(e.right)}`;
    const expanded = tex(U.solveExpanded(full));
    const steps = [
      `Fehlende Zahl: ${$(String(e.answer))}`,
      `Probe durch Ausmultiplizieren: ${$(`${tex(full, { explicitMul: true })} = ${expanded}`)}`,
    ];
    const minus = /^-/.test(e.left);
    const dis = [];
    if (p.kind === 'factor') dis.push({ value: String(p.a * p.b - p.b), category: 'concept_confusion', feedback: 'Der Faktor vor der Klammer wird mit jedem Glied multipliziert, nicht addiert. Teile die Zahl vor dem $x$ rechts durch die Zahl vor dem $x$ in der Klammer.' });
    if (p.kind === 'rhs') dis.push({ value: String(p.c), category: 'concept_confusion', feedback: 'Auch das zweite Glied der Klammer wird mit dem Faktor multipliziert.' });
    if (p.kind === 'inner_coef') dis.push({ value: String(p.a * p.b), category: 'concept_confusion', feedback: 'In der Klammer steht die Zahl vor dem Ausmultiplizieren. Teile durch den Faktor vor der Klammer.' });
    if (p.kind === 'inner_const' || p.kind === 'neg_inner') dis.push({ value: String(p.a * p.c), category: 'concept_confusion', feedback: 'In der Klammer steht die Zahl vor dem Ausmultiplizieren. Teile durch den Faktor vor der Klammer.' });
    if (p.kind === 'neg_factor') dis.push({ value: String(p.a), category: 'sign_error', feedback: 'Rechts steht vor dem $x$ ein Minus – der Faktor vor der Klammer muss negativ sein.' });
    if (p.kind === 'minus_coef') dis.push({ value: String(-p.b), category: 'sign_error', feedback: 'Das Minus vor der Klammer dreht alle Vorzeichen in der Klammer um. In die Klammer gehört deshalb die Zahl mit dem anderen Vorzeichen.' });
    if (p.kind === 'neg_inner') dis.push({ value: String(-p.c), category: 'sign_error', feedback: 'Achte auf das Minus vor dem Faktor: es dreht das Vorzeichen jedes Glieds in der Klammer um.' });
    return {
      prompt: `Ergänze die fehlende Zahl im Kästchen: ${$(eqTex)}`,
      instructions: 'Gib die fehlende Zahl ein.',
      answer: { type: 'integer', value: String(e.answer), canonical: String(e.answer), distractors: U.numDistractors(F(e.answer), dis) },
      hints: hints(
        'Links steht ein Produkt mit Klammer, rechts der ausmultiplizierte Term. Beide Seiten müssen gleichwertig sein.',
        'Multipliziere die linke Seite in Gedanken aus und vergleiche Glied für Glied mit der rechten Seite: das $x$-Glied mit dem $x$-Glied, die Zahl mit der Zahl.',
        minus ? 'Ein Minus vor der Klammer dreht jedes Vorzeichen in der Klammer um.' : 'Jedes Glied in der Klammer wird mit dem Faktor vor der Klammer multipliziert.',
        steps,
        'Probe: Setze deine Zahl ein, multipliziere aus und vergleiche mit der rechten Seite. Oder setze $x=1$ ein – beide Seiten müssen dann denselben Wert haben.'),
      solution: { steps, result: $(String(e.answer)) },
    };
  },
  solve(p) { const s = solutions(this.equation(p)); return s.length === 1 ? String(s[0]) : 'keine'; },
};

/** All integers v in −100…100 for which left(v) and right(v) are equivalent terms in x. */
function solutions(e) {
  const out = [];
  for (let v = -100; v <= 100; v++) {
    const l = X.parse(withY(e.left, v), { variables: ['x'] }), r = X.parse(withY(e.right, v), { variables: ['x'] });
    if (X.equivalent(l, r, ['x']).equivalent) out.push(v);
  }
  return out;
}

module.exports = [fillMissing];
