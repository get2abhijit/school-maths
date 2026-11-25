'use strict';
/**
 * Skill ch1.terms.simplify_products — two families added in Session 11 (book alignment G3, G6; LS7 I.4/I.5):
 *   quotient   rewrite a quotient such as (3x):2 or 20x:8 as a product; L3 a sum in the dividend split via DG
 *   term_type  name a term by its last operation (Summe, Differenz, Produkt, Quotient)
 * Independent solvers: polynomial normal form of the parsed task (quotient); the top node of the parsed
 * term (term_type).
 */
const U = require('../util');
const X = require('../../expr');
const { F, hints, tex, $, numTex, polyMachine, polyInput, exprDistractors } = U;

const SKILL = 'ch1.terms.simplify_products';

/** Divisor in LaTeX (negative divisors bracketed). */
const divTex = b => (b < 0 ? `\\left(${b}\\right)` : String(b));

/**
 * Template ch1.terms.simplify_products.quotient (family quotient)
 * Levels
 *  L1 Grundlagen    (a·x):b with b a divisor of a, positive numbers: (12x):3, 20x:4.
 *  L2 Standard      the result has a fraction coefficient, or the divisor/dividend is negative: (3x):2, (9x):(−6).
 *  L3 Anspruchsvoll a sum in the dividend (also as a fraction bar): (6x+8):2 = 3x + 4.
 * Answer form 'expanded_product' (D83): (3x):2 and 3x/2 are equivalent but not yet written as a product.
 * Misconceptions → distractors: dividing only the first summand (divide_first_only), dividing the wrong
 *  way round b/a (quotient_reversed), sign of the quotient wrong (product_sign).
 */
const quotient = {
  id: `${SKILL}.quotient`, version: 1, skillId: SKILL,
  families: ['quotient'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Quotient wie (12x):3, bei dem die Division aufgeht.',
    2: 'Ergebnis mit Bruch als Koeffizient oder negativer Divisor, z. B. (3x):2 oder (9x):(−6).',
    3: 'Summe im Dividenden oder im Zähler: (6x + 8):2 = 3x + 4.',
  },
  misconceptions: ['divide_first_only', 'quotient_reversed', 'product_sign'],
  sample(rng, level) {
    if (level === 1) { const b = rng.int(2, 9); return { a: b * rng.int(2, 9), c: 0, b, style: rng.pick(['bracket', 'plain']) }; }
    if (level === 2) {
      const b = rng.int(2, 9) * rng.pick([1, 1, -1]);
      return { a: rng.int(2, 30) * rng.pick([1, 1, -1]), c: 0, b, style: rng.pick(['bracket', 'plain']) };
    }
    const b = rng.int(2, 6);
    return { a: rng.int(2, 40), c: rng.int(2, 40) * rng.pick([1, -1]), b, style: rng.pick(['bracket', 'frac']) };
  },
  machine(p) { return `(${polyMachine([[p.a, 1], [p.c, 0]])})/(${p.b})`; },
  taskTex(p) {
    const num = tex(polyMachine([[p.a, 1], [p.c, 0]]));
    if (p.style === 'frac') return `\\frac{${num}}{${p.b}}`;
    if (p.style === 'plain' && p.c === 0) return `${num}:${divTex(p.b)}`;
    return `\\left(${num}\\right):${divTex(p.b)}`;
  },
  constraints(p, level) {
    const k = F(p.a).div(F(p.b));
    if (k.abs().eq(1)) return 'trivial';
    if (level === 1 && !k.isInteger()) return 'not divisible';
    if (level === 2) {
      if (k.isInteger() && p.a > 0 && p.b > 0) return 'nothing new at L2';
      if (k.d > 12n) return 'awkward fraction';
    }
    if (level === 3) {
      const c = F(p.c).div(F(p.b));
      if (!k.isInteger() && !c.isInteger()) return 'both summands fractional';
      if (k.d > 6n || c.d > 6n) return 'awkward fraction';
      if (p.a % p.b !== 0 && Math.abs(p.c) % p.b !== 0) return 'no clean part';
    }
    return true;
  },
  build(p, level) {
    const k = F(p.a).div(F(p.b)), c = F(p.c).div(F(p.b));
    const value = polyMachine([[k, 1], [c, 0]]);
    const task = this.taskTex(p);
    let steps, dis;
    if (level < 3) {
      steps = [
        `Die Zahl vor dem $x$ wird geteilt, das $x$ bleibt stehen: ${$(`${task} = \\left(${p.a}:${divTex(p.b)}\\right)\\cdot x`)}`,
        `Zahlen dividieren${p.a < 0 !== p.b < 0 ? ' (ungleiche Vorzeichen → Minus)' : ''}: ${$(`${p.a}:${divTex(p.b)} = ${numTex(k)}`)}`,
        `Ergebnis: ${$(tex(value))}`,
      ];
      dis = [
        { value: polyMachine([[F(p.b).div(F(p.a)), 1]]), category: 'concept_confusion', feedback: 'Geteilt wird die Zahl vor dem $x$ durch den Divisor, nicht umgekehrt.' },
        { value: polyMachine([[k.neg(), 1]]), category: 'sign_error', feedback: 'Achte auf das Vorzeichen: gleiche Vorzeichen → Plus, ungleiche → Minus.' },
        { value: polyMachine([[F(p.a * p.b), 1]]), category: 'concept_confusion', feedback: 'Hier muss geteilt werden, nicht multipliziert.' },
      ];
    } else {
      const op = p.c < 0 ? '-' : '+';
      steps = [
        `Jedes Glied der Summe wird durch ${$(String(p.b))} geteilt (Distributivgesetz): ${$(`${task} = ${tex(`${p.a}x`)}:${p.b} ${op} ${Math.abs(p.c)}:${p.b}`)}`,
        `${$(`${tex(`${p.a}x`)}:${p.b} = ${tex(polyMachine([[k, 1]]))}`)} und ${$(`${Math.abs(p.c)}:${p.b} = ${numTex(c.abs())}`)}`,
        `Ergebnis: ${$(tex(value))}`,
      ];
      dis = [
        { value: polyMachine([[k, 1], [p.c, 0]]), category: 'concept_confusion', feedback: 'Auch die Zahl ohne $x$ muss geteilt werden – jedes Glied der Summe wird durch den Divisor geteilt.' },
        { value: polyMachine([[p.a, 1], [c, 0]]), category: 'concept_confusion', feedback: 'Auch das $x$-Glied muss geteilt werden – jedes Glied der Summe wird durch den Divisor geteilt.' },
      ];
    }
    return {
      prompt: `Schreibe als Produkt bzw. Summe ohne Quotient und vereinfache: ${$(task)}`,
      instructions: 'Gib den vereinfachten Term ein, z. B. 3/2x oder 1,5x.',
      answer: { type: 'expression', value, canonical: polyInput([[k, 1], [c, 0]]), variables: ['x'], form: 'expanded_product', distractors: exprDistractors(value, dis) },
      hints: hints(
        'Durch eine Zahl teilen heißt: mit ihrem Kehrbruch multiplizieren, z. B. $:2$ ist dasselbe wie $\\cdot \\frac{1}{2}$.',
        level < 3 ? 'Teile die Zahl vor dem $x$ durch den Divisor; das $x$ bleibt stehen.' : 'Teile jedes Glied der Summe einzeln durch den Divisor.',
        steps[0],
        steps,
        level < 3 ? `Probe mit $x=${p.b < 0 ? -p.b : p.b}$: Setze ein und vergleiche beide Terme.`
          : 'Achtung: Das geht nur, wenn die Summe im Zähler (vor dem Geteiltzeichen) steht. Steht eine Summe im Nenner, z. B. $12:\\left(x+2\\right)$, darfst du nicht aufteilen.'),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) { return U.solveExpanded(this.machine(p)); },
};

// ---------------------------------------------------------------- term_type
const TYPES = ['sum', 'diff', 'prod', 'quot'];
const TYPE_NAME = { sum: 'Summe', diff: 'Differenz', prod: 'Produkt', quot: 'Quotient' };
const TYPE_LAST = { sum: 'addiert', diff: 'subtrahiert', prod: 'multipliziert', quot: 'dividiert' };
const NODE_TYPE = { add: 'sum', sub: 'diff', mul: 'prod', div: 'quot' };

/** Operand machine strings by kind (k, n, p, q are parameters). */
function operand(kind, v) {
  switch (kind) {
    case 'num': return String(v.n);
    case 'kx': return `${v.k}x`;
    case 'x': return 'x';
    case 'sum': return `(${v.p === 1 ? '' : v.p}x+${v.q})`;
    case 'diff': return `(${v.p === 1 ? '' : v.p}x-${v.q})`;
    case 'prodsum': return `${v.k}*(x+${v.q})`;
    default: throw new Error(kind);
  }
}
const OP = { sum: '+', diff: '-', prod: '*', quot: '/' };

/**
 * Template ch1.terms.simplify_products.term_type (family term_type) — L1 only.
 * Shows a term with one variable; the student names it by its LAST operation (Begriffstraining I.4).
 * Display uses „:“ for division, as in the book. Tricky cases: a sum whose summand is a product
 * (3·(x + 1) + 2 is a Summe), a product with a bracketed sum (3·(x + 5) is a Produkt).
 * Misconception → wrong options: naming the type by the first or the most visible operation (term_type_first_op).
 */
const termType = {
  id: `${SKILL}.term_type`, version: 1, skillId: SKILL,
  families: ['term_type'],
  levels: [1],
  levelNotes: { 1: 'Term nach der zuletzt ausgeführten Rechenart benennen: Summe, Differenz, Produkt oder Quotient.' },
  misconceptions: ['term_type_first_op'],
  sample(rng) {
    const top = rng.pick(TYPES);
    const kinds = top === 'sum' || top === 'diff' ? ['kx', 'prodsum', 'num', 'x', 'sum'] : ['num', 'sum', 'diff', 'kx'];
    const v = () => ({ n: rng.int(2, 15), k: rng.int(2, 9), p: rng.int(1, 6), q: rng.int(1, 12) });
    return { top, left: rng.pick(kinds), right: rng.pick(kinds), lv: v(), rv: v(), order: [rng.uint32(), rng.uint32()] };
  },
  signatureParams(p) { const { order: _o, ...rest } = p; return rest; },
  parts(p) { return { L: operand(p.left, p.lv), R: operand(p.right, p.rv) }; },
  machine(p) { const { L, R } = this.parts(p); return `${L}${OP[p.top]}${R}`; },
  display(p) {
    const { L, R } = this.parts(p);
    if (p.top !== 'quot') return tex(this.machine(p));
    const lt = tex(L), rt = tex(R);
    const wrapR = /[+-]/.test(rt) || /x/.test(rt) ? `\\left(${rt}\\right)` : rt;
    return `${/[+-]/.test(lt) && !/^\\left/.test(lt) ? `\\left(${lt}\\right)` : lt}:${wrapR}`;
  },
  constraints(p) {
    const { L, R } = this.parts(p);
    if (!/x/.test(L + R)) return 'no variable';
    if (p.left === 'num' && p.right === 'num') return 'number term';
    if (p.top === 'quot' && p.right !== 'num') return 'divide by a number only';
    if (p.top === 'diff' && p.left === p.right && JSON.stringify(p.lv) === JSON.stringify(p.rv)) return 'zero';
    if (p.top === 'prod' && (p.left === 'kx' || p.right === 'kx')) return 'x·x is not in the I.4 info box (D85)';
    if (p.top === 'prod' && !['sum', 'diff'].includes(p.left) && !['sum', 'diff'].includes(p.right)) return 'plain product';
    const node = X.strip(X.parse(this.machine(p)));
    if (NODE_TYPE[node.t] !== p.top) return 'top operation mismatch';
    return true;
  },
  options(p) {
    const raw = TYPES.map(t => ({ t, text: TYPE_NAME[t] }));
    const ordered = raw.map((o, i) => ({ o, k: (p.order[i % 2] ^ Math.imul(i + 1, 2654435761)) >>> 0 })).sort((a, b) => a.k - b.k).map(x => x.o);
    return ordered.map((o, i) => ({ id: 'abcd'[i], t: o.t, text: o.text }));
  },
  build(p) {
    const term = this.display(p);
    const opts = this.options(p);
    const options = opts.map(o => (o.t === p.top ? { id: o.id, text: o.text }
      : { id: o.id, text: o.text, category: 'concept_confusion', feedback: `Es kommt auf die Rechenart an, die zuletzt ausgeführt wird: hier wird zuletzt ${TYPE_LAST[p.top]}. Eine ${TYPE_NAME[o.t]} wäre es, wenn zuletzt ${TYPE_LAST[o.t]} würde.` }));
    const correct = options.find(o => !o.feedback);
    const steps = [
      `Rechne in Gedanken mit einer Zahl für $x$ und achte auf die Reihenfolge: Klammern zuerst, Punkt vor Strich.`,
      `Die letzte Rechnung in ${$(term)} ist: es wird ${TYPE_LAST[p.top]}.`,
      `Also ist der Term eine ${TYPE_NAME[p.top]}.`,
    ];
    return {
      prompt: `Welche Art von Term ist ${$(term)}?`,
      instructions: 'Entscheide nach der Rechenart, die zuletzt ausgeführt wird.',
      answer: { type: 'choice', options, correct: correct.id, canonical: correct.id },
      hints: hints(
        'Ein Term heißt Summe, Differenz, Produkt oder Quotient – je nachdem, welche Rechenart zuletzt ausgeführt wird.',
        'Setze in Gedanken eine Zahl für $x$ ein und rechne den Term aus. Welche Rechnung machst du ganz am Schluss?',
        'Klammern werden zuerst berechnet, dann Punktrechnung, dann Strichrechnung.',
        steps,
        'Beispiele: $3\\cdot \\left(x+5\\right)$ ist ein Produkt (zuletzt mal), $3x+5$ ist eine Summe (zuletzt plus), $\\left(x-2\\right):5$ ist ein Quotient.'),
      solution: { steps, result: TYPE_NAME[p.top] },
    };
  },
  /** Independent: top node of the parsed term → type → option with that name. */
  solve(p) {
    const t = NODE_TYPE[X.strip(X.parse(this.machine(p))).t];
    const o = this.options(p).find(op => op.t === t);
    return o ? o.id : 'none';
  },
};

module.exports = [quotient, termType];
