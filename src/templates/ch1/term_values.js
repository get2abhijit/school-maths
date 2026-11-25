'use strict';
/**
 * Skill ch1.terms.evaluate — Termwerte berechnen (LS7 I.2).
 */
const X = require('../../expr');
const U = require('../util');
const { F, hints, tex, $, numTex, numInput, numMachine, reduceSteps, substitute, evalMachine, numDistractors } = U;

const SKILL = 'ch1.terms.evaluate';
const nb = n => numMachine(n, { bracket: true });

/** Term shapes per level (machine strings with variable x). */
function termMachine(p) {
  const { a, b } = p;
  switch (p.shape) {
    case 'ax+b': return U.polyMachine([[a, 1], [b, 0]]);
    case 'ax-b': return U.polyMachine([[a, 1], [-b, 0]]);
    case 'a(x+b)': return `${a}(x+${b})`;
    case 'a(x-b)': return `${a}(x-${b})`;
    case 'a-bx': return U.polyMachine([[a, 0], [-b, 1]]);
    case 'x^2+b': return `x^2${b < 0 ? '' : '+'}${b}`;
    case '-x^2+b': return `-x^2${b < 0 ? '' : '+'}${b}`;
    case 'ax^2+bx': return U.polyMachine([[a, 2], [b, 1]]);
    default: throw new Error(p.shape);
  }
}
const SHAPES = {
  1: ['ax+b', 'ax-b', 'a(x+b)'],
  2: ['ax+b', 'a-bx', 'a(x-b)'],
  3: ['ax+b', 'x^2+b', '-x^2+b', 'ax^2+bx'],
};
const L3_VALUES = ['1/2', '-1/2', '1/3', '-2/3', '3/4', '-3/4', '3/2', '-5/2', '0.5', '-1.5', '2.5', '-0.2', '-3', '-4'];

function sampleTerm(rng, level) {
  const shape = rng.pick(SHAPES[level]);
  const a = rng.int(2, 9);
  let b;
  if (level === 1) b = rng.int(1, 12);
  else if (level === 2) b = shape === 'ax+b' ? rng.intExcept(-12, 12, [0]) : rng.int(1, 12);
  else b = rng.intExcept(-9, 9, [0]);
  return { shape, a, b };
}
function valueOpts(x) { return { dec: /\./.test(String(x)) }; }
/** Misconception values for one substitution. */
function termDistractors(p, x) {
  const xv = F(x), m = termMachine(p), out = [];
  const val = v => X.evaluate(X.parse(m), { x: v });
  if (xv.sign() < 0) out.push({ value: val(xv.neg()), category: 'sign_error', feedback: 'Setze die negative Zahl mit ihrem Vorzeichen in Klammern ein.' });
  if (p.shape === '-x^2+b') out.push({ value: xv.mul(xv).add(p.b), category: 'sign_error', feedback: 'Bei $-x^2$ wird zuerst quadriert, das Minus davor bleibt: $-x^2 = -(x^2)$.' });
  if (p.shape === 'ax+b' && xv.isInteger()) out.push({ value: F(p.a).add(xv).add(p.b), category: 'concept_confusion', feedback: `$${p.a}x$ bedeutet $${p.a}\\cdot x$.` });
  return out;
}
function substitutionSteps(p, x) {
  const ast = X.parse(termMachine(p), { variables: ['x'] });
  return reduceSteps(substitute(ast, 'x', F(x), valueOpts(x)), { explicitMul: true });
}

/**
 * Template ch1.terms.evaluate.single_value (family single_value)
 * Levels
 *  L1 Grundlagen    natural x = 1…10 into a·x ± b or a(x + b).
 *  L2 Standard      negative integers x = −9…−1 into a·x + b, a − b·x, a(x − b).
 *  L3 Anspruchsvoll fractions/decimals or negative integers into terms with x² (incl. −x²).
 * Misconceptions: concat_coefficient (3x read as 3 + x), neg_power (−x² vs (−x)²), sign lost on substitution.
 * Independent solver: X.evaluate on the parsed term with an environment (no step reducer).
 */
const singleValue = {
  id: `${SKILL}.single_value`, version: 1, skillId: SKILL,
  families: ['single_value'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Natürliche Zahlen 1–10 einsetzen in a·x ± b oder a(x + b).',
    2: 'Negative ganze Zahlen einsetzen.',
    3: 'Brüche, Dezimalzahlen oder negative Zahlen in Terme mit x² einsetzen.',
  },
  misconceptions: ['concat_coefficient', 'neg_power'],
  sample(rng, level) {
    const t = sampleTerm(rng, level);
    const x = level === 1 ? String(rng.int(1, 10)) : level === 2 ? String(-rng.int(1, 9)) : rng.pick(L3_VALUES);
    return { ...t, x };
  },
  constraints(p, level) {
    const v = evalMachine(termMachine(p), { x: F(p.x) });
    if (level === 1 && v.sign() < 0) return 'negative at L1';
    if (v.abs().cmp(F(300)) > 0) return 'too large';
    if (level === 3 && !v.isInteger() && v.d > 100n) return 'awkward denominator';
    return true;
  },
  build(p, level) {
    const m = termMachine(p);
    const { lines, value } = substitutionSteps(p, p.x);
    const o = valueOpts(p.x);
    const answer = level === 3
      ? { type: 'fraction', value: value.toString(), canonical: numInput(value, o) }
      : { type: 'integer', value: value.toString(), canonical: value.toString() };
    answer.distractors = numDistractors(value, termDistractors(p, p.x));
    const xTex = numTex(p.x, o);
    const steps = [`Einsetzen: ${$(`${tex(m)} = ${lines[0]}`)}`, ...lines.slice(1).map(l => $(`= ${l}`))];
    return {
      prompt: `Berechne den Wert des Terms ${$(tex(m))} für ${$(`x = ${xTex}`)}.`,
      instructions: level === 3 ? 'Gib das Ergebnis als Bruch, ganze Zahl oder Dezimalzahl an.' : 'Gib das Ergebnis als ganze Zahl an.',
      answer,
      hints: hints(
        'Ersetze jedes $x$ im Term durch die gegebene Zahl und berechne dann den Zahlterm.',
        F(p.x).sign() < 0 || !F(p.x).isInteger() ? 'Setze die Zahl in Klammern ein. Beachte Potenz vor Punkt vor Strich.' : 'Beachte: Zwischen Zahl und Variable steht ein unsichtbarer Malpunkt.',
        `Nach dem Einsetzen steht da: ${$(lines[0])}.`,
        steps,
        level === 3 && /\./.test(p.x) ? `Rechne mit dem Bruch: ${$(`${xTex} = ${F(p.x).toLatex()}`)}.`
          : `Kontrolliere mit einer Wertetabelle: Berechne den Term auch für eine benachbarte Zahl und prüfe, ob sich der Wert plausibel ändert.`),
      solution: { steps, result: $(numTex(value, o)) },
    };
  },
  solve(p) { return evalMachine(termMachine(p), { x: F(p.x) }).toString(); },
};

/**
 * Template ch1.terms.evaluate.value_table (family value_table)
 * Same term shapes and value ranges as single_value, three or four x-values in a table.
 * Levels
 *  L1 Grundlagen    x = 0…6 (consecutive).
 *  L2 Standard      x from −3…3 incl. negatives.
 *  L3 Anspruchsvoll mixed fractions/decimals and negatives, terms with x².
 * Independent solver: X.evaluate per cell.
 */
const valueTable = {
  id: `${SKILL}.value_table`, version: 1, skillId: SKILL,
  families: ['value_table'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Natürliche x-Werte 0–6 (aufeinanderfolgend).',
    2: 'x-Werte von −3 bis 3, mit negativen Zahlen.',
    3: 'Brüche, Dezimalzahlen und negative Zahlen; Terme mit x².',
  },
  misconceptions: ['concat_coefficient', 'neg_power'],
  sample(rng, level) {
    const t = sampleTerm(rng, level);
    let xs;
    if (level === 1) { const s = rng.int(0, 3); xs = [s, s + 1, s + 2, s + 3].map(String); }
    else if (level === 2) { const s = rng.int(-3, 0); xs = [s, s + 1, s + 2, s + 3].map(String); }
    else xs = rng.shuffle(L3_VALUES).slice(0, 3).sort((u, v) => F(u).cmp(F(v)));
    return { ...t, xs };
  },
  constraints(p, level) {
    for (const x of p.xs) {
      const v = evalMachine(termMachine(p), { x: F(x) });
      if (level === 1 && v.sign() < 0) return 'negative at L1';
      if (v.abs().cmp(F(300)) > 0) return 'too large';
      if (level === 3 && !v.isInteger() && v.d > 100n) return 'awkward denominator';
    }
    if (level === 3 && new Set(p.xs.map(x => F(x).toString())).size !== p.xs.length) return 'equal x values';
    return true;
  },
  build(p, level) {
    const m = termMachine(p);
    const cells = [], steps = [];
    p.xs.forEach((x, i) => {
      const o = valueOpts(x);
      const { lines, value } = substitutionSteps(p, x);
      const spec = level === 3
        ? { type: 'fraction', value: value.toString(), canonical: numInput(value, o) }
        : { type: 'integer', value: value.toString(), canonical: value.toString() };
      spec.distractors = numDistractors(value, termDistractors(p, x));
      cells.push({ id: `c${i}`, label: $(`x = ${numTex(x, o)}`), spec });
      steps.push(`${$(`x = ${numTex(x, o)}`)}: ${$(lines.join(' = '))}`);
    });
    const first = substitutionSteps(p, p.xs[0]);
    return {
      prompt: `Fülle die Wertetabelle für den Term ${$(tex(m))} aus.`,
      instructions: level === 3 ? 'Brüche, ganze Zahlen oder Dezimalzahlen sind erlaubt.' : 'Trage ganze Zahlen ein.',
      answer: { type: 'table', cells },
      hints: hints(
        'Für jede Spalte setzt du den x-Wert in den Term ein.',
        'Setze negative Zahlen und Brüche in Klammern ein. Beachte Potenz vor Punkt vor Strich.',
        `Erste Spalte: ${$(first.lines[0])}.`,
        steps,
        'Bei Termen ohne $x^2$ ändert sich der Wert von Spalte zu Spalte immer um gleich viel, wenn $x$ immer um 1 wächst. Damit kannst du deine Ergebnisse kontrollieren.'),
      solution: { steps, result: cells.map(c => `${c.label}: ${$(numTex(c.spec.value, valueOpts(p.xs[Number(c.id.slice(1))])))}`).join(', ') },
    };
  },
  solve(p) {
    const out = {};
    p.xs.forEach((x, i) => { out[`c${i}`] = evalMachine(termMachine(p), { x: F(x) }).toString(); });
    return out;
  },
};

/**
 * Template ch1.terms.evaluate.find_input (families find_input, compare_terms_table)
 * Reverse direction: find x by systematic trying (no equation solving required – Ch. 4 comes later).
 * Levels
 *  L2 Standard      natural x = 1…10, term a·x + b reaches a target value.
 *  L3 Anspruchsvoll integer x = −10…10 (≠ 0), terms a·x + b, a(x − b), b − a·x.
 *  L4 Transfer      two linear terms; find the integer x where both have the same value.
 * Misconception: sign of x lost (answer −x).
 * Independent solver: brute force over the integers −50…50 with X.evaluate; must be unique.
 */
const findInput = {
  id: `${SKILL}.find_input`, version: 1, skillId: SKILL,
  families: ['find_input', 'compare_terms_table'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Natürliches x (1–10) gesucht, Term a·x + b.',
    3: 'Ganzzahliges x (−10…10) gesucht; Terme a·x + b, a(x − b), b − a·x.',
    4: 'Zwei Terme vergleichen: für welches x sind beide Werte gleich?',
  },
  misconceptions: ['sign_lost'],
  sample(rng, level) {
    if (level === 4) {
      const a1 = rng.intExcept(-6, 9, [0]), a2 = rng.intExcept(-6, 9, [0, a1]);
      const x = rng.intExcept(-8, 8, [0]);
      const b1 = rng.int(-15, 15);
      return { a1, a2, b1, b2: (a1 - a2) * x + b1, x };
    }
    const shape = level === 2 ? 'ax+b' : rng.pick(['ax+b', 'a(x-b)', 'a-bx']);
    const x = level === 2 ? rng.int(1, 10) : rng.intExcept(-10, 10, [0]);
    return { shape, a: rng.int(2, 9), b: level === 2 ? rng.int(1, 12) : rng.intExcept(-12, 12, [0]), x };
  },
  terms(p, level) {
    if (level === 4) return [U.polyMachine([[p.a1, 1], [p.b1, 0]]), U.polyMachine([[p.a2, 1], [p.b2, 0]])];
    const q = { ...p };
    if (p.shape !== 'ax+b' && p.b < 0) return null;
    return [termMachine(q)];
  },
  constraints(p, level) {
    const t = this.terms(p, level);
    if (!t) return 'negative b in shape';
    if (level === 4) {
      if (Math.abs(p.b2) > 40) return 'b2 too large';
      if (p.b1 === 0 || p.b2 === 0) return 'zero constant';
    }
    if (level === 3 && p.shape === 'a-bx' && p.b === 1) return 'b = 1';
    return true;
  },
  build(p, level) {
    const t = this.terms(p, level);
    const x = F(p.x);
    const val = (m, v) => evalMachine(m, { x: F(v) });
    const distractors = numDistractors(x, [{ value: x.neg(), category: 'sign_error', feedback: 'Setze deine Zahl zur Probe ein – achte auf das Vorzeichen.' }]);
    const answer = { type: 'integer', value: x.toString(), canonical: x.toString(), distractors };
    if (level === 4) {
      const [m1, m2] = t;
      const rows = [p.x - 1, p.x, p.x + 1].map(v => `${$(`x = ${v}`)}: ${$(`${tex(m1)} = ${numTex(val(m1, v))}`)}, ${$(`${tex(m2)} = ${numTex(val(m2, v))}`)}`);
      const steps = [...rows, `Für ${$(`x = ${p.x}`)} haben beide Terme den Wert ${$(numTex(val(m1, p.x)))}.`];
      const d0 = val(m1, 0).sub(val(m2, 0)), d1 = val(m1, 1).sub(val(m2, 1));
      return {
        prompt: `Für welche ganze Zahl $x$ haben die Terme ${$(tex(m1))} und ${$(tex(m2))} denselben Wert?`,
        instructions: 'Probiere systematisch, z. B. mit einer Wertetabelle. Gib die ganze Zahl an.',
        answer,
        hints: hints(
          'Gesucht ist ein $x$, für das beide Terme dasselbe Ergebnis liefern.',
          'Lege eine Wertetabelle für beide Terme an und beobachte, wie sich der Unterschied der Werte ändert.',
          `Für $x=0$ ist der Unterschied ${$(numTex(d0))}, für $x=1$ ist er ${$(numTex(d1))}. Der Unterschied ändert sich pro Schritt um ${$(numTex(d1.sub(d0)))}. In welche Richtung musst du gehen?`,
          steps,
          'Der Unterschied der beiden Terme ändert sich bei jedem Schritt um gleich viel. Zähle, wie viele Schritte du bis zum Unterschied 0 brauchst.'),
        solution: { steps, result: $(`x = ${p.x}`) },
      };
    }
    const [m] = t;
    const target = val(m, p.x);
    const v0 = val(m, 0), v1 = val(m, 1);
    const steps = [p.x - 1, p.x].map(v => `${$(`x = ${v}`)}: ${$(`${tex(m)} = ${numTex(val(m, v))}`)}${v === p.x ? ' ✓' : ''}`);
    steps.push(`Also ist ${$(`x = ${p.x}`)}.`);
    return {
      prompt: `Für welche ${level === 2 ? 'natürliche' : 'ganze'} Zahl $x$ hat der Term ${$(tex(m))} den Wert ${$(numTex(target))}?`,
      instructions: 'Probiere systematisch und gib die Zahl an.',
      answer,
      hints: hints(
        'Du suchst die Zahl, die du für $x$ einsetzen musst, damit der Term den gegebenen Wert hat.',
        'Probiere systematisch: Setze $x = 0, 1, 2, …$ (oder $-1, -2, …$) ein und beobachte, wie sich der Wert ändert.',
        `Für $x=0$ ergibt sich ${$(numTex(v0))}, für $x=1$ ergibt sich ${$(numTex(v1))}. Der Wert ändert sich pro Schritt um ${$(numTex(v1.sub(v0)))}.`,
        steps,
        `Rechne rückwärts: Wie oft musst du ${$(numTex(v1.sub(v0)))} zu ${$(numTex(v0))} addieren, um ${$(numTex(target))} zu erhalten?`),
      solution: { steps, result: $(`x = ${p.x}`) },
    };
  },
  solve(p, level) {
    const t = this.terms(p, level);
    const asts = t.map(m => X.parse(m, { variables: ['x'] }));
    const target = level === 4 ? null : X.evaluate(asts[0], { x: F(p.x) });
    const hits = [];
    for (let k = -50; k <= 50; k++) {
      const env = { x: F(k) };
      const v = X.evaluate(asts[0], env);
      if (level === 4 ? v.eq(X.evaluate(asts[1], env)) : v.eq(target)) hits.push(k);
    }
    if (level === 2) return hits.filter(k => k > 0).length === 1 ? String(hits.find(k => k > 0)) : null;
    return hits.length === 1 ? String(hits[0]) : null;
  },
};

module.exports = [singleValue, valueTable, findInput];
