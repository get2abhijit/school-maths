'use strict';
/**
 * Skill ch4.eq.setup_trial — Gleichungen aufstellen und Lösungen finden (LS7 IV.1).
 */
const X = require('../../expr');
const U = require('../util');
const Lq = require('./linear');
const { sampleEquation, equationCheck } = require('./solve');
const { F, hints, tex, $, numTex, FACH } = U;

const SKILL = 'ch4.eq.setup_trial';

/** Value of a machine expression in x at v (independent evaluation via expr.js). */
const at = (m, v) => X.evaluate(X.parse(m, { variables: ['x'] }), { x: F(v) });
/** \"links 2·3+5 = 11, rechts 11\" for x = v. */
function sidesAt(Lm, Rm, v) {
  const one = m => {
    const ast = X.parse(m, { variables: ['x'] });
    const val = at(m, v);
    return X.collectVars(ast).size ? `$${X.toLatex(U.substitute(ast, 'x', F(v)), { explicitMul: true })} = ${numTex(val)}$` : `$${numTex(val)}$`;
  };
  return `links ${one(Lm)}, rechts ${one(Rm)}`;
}
const holds = (Lm, Rm, v) => at(Lm, v).eq(at(Rm, v));

// ---------------------------------------------------------------- is_solution
const NONLINEAR = {
  // machine L, R, solutions (integers) — all evaluate fine at any integer
  sq: r => ({ L: 'x^2', R: String(r * r), sols: [-r, r] }),
  sq_plus: (r, b) => ({ L: `x^2+${b}`, R: String(r * r + b), sols: [-r, r] }),
  prod_zero: r => ({ L: `x(x-${r})`, R: '0', sols: [0, r] }),
  sq_eq_lin: r => ({ L: 'x^2', R: `${r}x`, sols: [0, r] }),
};

/**
 * Template ch4.eq.setup_trial.is_solution (family is_solution)
 * Levels
 *  L1 Grundlagen    one- or two-step linear equation; which of four numbers is the solution? (substitute and compare)
 *  L2 Standard      x on both sides, negative numbers; six consecutive integers to try systematically (table).
 *  L4 Transfer      equations with x² or a product (x² = 16, x(x − 3) = 0, x² = 5x): find ALL solutions among six numbers;
 *                   an equation can have more than one solution.
 * Misconceptions: equation_vs_term (substituting into one side only), one_solution_only (stops after the first hit).
 * Independent solver: evaluates both sides of the displayed machine strings with expr.js for every candidate.
 */
const isSolution = {
  id: `${SKILL}.is_solution`, version: 1, skillId: SKILL,
  families: ['is_solution'],
  levels: [1, 2, 4],
  levelNotes: {
    1: 'Lineare Gleichung mit ein bis zwei Schritten; welche von vier Zahlen ist die Lösung? Einsetzen und vergleichen.',
    2: 'x auf beiden Seiten, negative Zahlen; sechs aufeinanderfolgende Zahlen systematisch durchprobieren.',
    4: 'Gleichungen mit x² oder einem Produkt: alle Lösungen unter sechs Zahlen finden (es kann mehrere geben).',
  },
  misconceptions: ['equation_vs_term', 'one_solution_only'],
  sample(rng, level) {
    if (level === 4) {
      const kind = rng.pick(Object.keys(NONLINEAR));
      const r = rng.int(2, 6), b = rng.int(1, 9);
      const extra = rng.shuffle([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 7);
      return { level, kind, r, b, extra };
    }
    const shape = level === 1 ? rng.pick(['ax+b=c', 'ax-b=c', 'x+a=b', 'ax=b']) : rng.pick(['ax+b=cx+d', 'ax+b+cx=d']);
    const eq = sampleEquation(rng, shape);
    return { level, shape, ...eq, offs: rng.shuffle([-2, -1, 1, 2, 3, -3]).slice(0, 3), lo: rng.int(0, 5) };
  },
  /** {Lm, Rm, candidates:[numbers], sols:[numbers]} — sols from the construction (build path). */
  setup(p) {
    if (p.level === 4) {
      const e = NONLINEAR[p.kind](p.r, p.b);
      const others = p.extra.filter(v => !e.sols.includes(v)).slice(0, 4);
      return { Lm: e.L, Rm: e.R, candidates: [...e.sols, ...others].sort((a, b) => a - b), sols: e.sols };
    }
    const eq = { L: p.L, R: p.R };
    const [Lm, Rm] = Lq.eqMachine(eq);
    const s = Number(Lq.chain(eq).value.toString());
    const candidates = p.level === 1 ? [s, ...p.offs.map(o => s + o)].sort((a, b) => a - b) : Array.from({ length: 6 }, (_, i) => s - p.lo + i);
    return { Lm, Rm, candidates, sols: [s] };
  },
  constraints(p, level) {
    if (level !== 4) {
      const c = equationCheck({ L: p.L, R: p.R }, p.shape, Math.min(level, 2));
      if (c !== true) return c;
    }
    const st = this.setup(p);
    if (st.candidates.length !== (level === 1 ? 4 : 6)) return 'candidate count';
    if (new Set(st.candidates).size !== st.candidates.length) return 'duplicate candidates';
    if (level === 4 && st.sols.some(v => !st.candidates.includes(v))) return 'solution missing';
    if (level === 1 && st.candidates.some(v => v < 0)) return 'negative candidate at L1';
    return true;
  },
  build(p, level) {
    const st = this.setup(p);
    const eqT = `${tex(st.Lm)} = ${tex(st.Rm)}`;
    const isSol = v => st.sols.includes(v);
    const options = st.candidates.map((v, i) => ({
      id: `k${i + 1}`, text: $(`x = ${numTex(v)}`),
      ...(isSol(v) ? {} : { category: 'concept_confusion', feedback: `Setze ein: ${sidesAt(st.Lm, st.Rm, v)} – die Seiten sind nicht gleich.` }),
    }));
    const correct = st.candidates.map((v, i) => (isSol(v) ? `k${i + 1}` : null)).filter(Boolean);
    const table = st.candidates.map(v => `${$(`x = ${numTex(v)}`)}: ${sidesAt(st.Lm, st.Rm, v)}${isSol(v) ? ' ✓' : ''}`);
    const sTex = st.sols.map(v => $(`x = ${numTex(v)}`)).join(' und ');
    const steps = [...table, level === 4 ? `Lösungen sind ${sTex}: Nur dort sind beide Seiten gleich.` : `Nur für ${sTex} sind beide Seiten gleich.`];
    const multi = level === 4;
    return {
      prompt: multi ? `Welche der Zahlen sind Lösungen der Gleichung ${$(eqT)}?` : `Welche der Zahlen ist eine Lösung der Gleichung ${$(eqT)}?`,
      instructions: multi ? 'Es kann mehr als eine Lösung geben. Wähle alle Lösungen.' : (level === 2 ? 'Probiere systematisch: Lege eine Tabelle an.' : 'Setze ein und vergleiche beide Seiten.'),
      answer: multi
        ? { type: 'multiselect', options, correct, canonical: correct }
        : { type: 'choice', options, correct: correct[0], canonical: correct[0] },
      hints: hints(
        'Eine Zahl ist eine Lösung, wenn die Gleichung nach dem Einsetzen eine wahre Aussage ist: Beide Seiten haben denselben Wert.',
        level === 2 ? 'Berechne für jede Zahl die linke und die rechte Seite – am besten in einer Tabelle mit zwei Zeilen.'
          : 'Setze jede Zahl für $x$ ein. Berechne die linke und die rechte Seite getrennt.',
        `Zum Beispiel ${$(`x = ${numTex(st.candidates[0])}`)}: ${sidesAt(st.Lm, st.Rm, st.candidates[0])}.`,
        steps,
        multi ? 'Bei $x^2$ haben eine Zahl und ihre Gegenzahl dasselbe Quadrat, z. B. $3^2 = \\left(-3\\right)^2 = 9$. Und ein Produkt ergibt $0$, wenn einer der Faktoren $0$ ist. Hör also nicht nach der ersten Lösung auf.'
          : 'Du kannst die Gleichung auch durch Umformen lösen und dann die passende Zahl auswählen.'),
      solution: { steps, result: sTex },
    };
  },
  /** Independent: evaluate both displayed sides for every candidate. */
  solve(p, level) {
    const st = this.setup(p);
    const ids = st.candidates.map((v, i) => (holds(st.Lm, st.Rm, v) ? `k${i + 1}` : null)).filter(Boolean);
    return level === 4 ? ids : ids[0];
  },
};

// ---------------------------------------------------------------- text_to_equation
const Q = s => `„${s}“`;
/**
 * Number riddles. Each kind: numbers(rng) → params; text(p, r) → riddle; story(p) → r computed from the secret
 * number n by plain arithmetic (narrative order); correct(p, r) → [L, R]; wrong(p, r) → [{eq:[L,R], category, feedback}];
 * pieces(p, r) → [[phrase, machine]] for the worked translation.
 */
const RIDDLES = {
  mul: {
    level: 1,
    numbers: rng => ({ k: rng.int(2, 9), n: rng.int(2, 15) }),
    story: p => p.k * p.n,
    text: (p, r) => `Das ${FACH[p.k]} einer Zahl ist ${r}.`,
    correct: (p, r) => [`${p.k}x`, `${r}`],
    wrong: (p, r) => [
      { eq: [`x+${p.k}`, `${r}`], category: 'concept_confusion', feedback: `Das ${FACH[p.k]} heißt „mal ${p.k}“, nicht „plus ${p.k}“.` },
      { eq: [`1/${p.k}x`, `${r}`], category: 'concept_confusion', feedback: `Das ${FACH[p.k]} heißt „mal ${p.k}“, nicht „geteilt durch ${p.k}“.` },
      { eq: [`${p.k}x`, `x+${r}`], category: 'concept_confusion', feedback: `„ist ${r}“ bedeutet: Auf der anderen Seite steht nur die Zahl ${r}.` },
    ],
    pieces: (p, r) => [[`das ${FACH[p.k]} einer Zahl`, `${p.k}x`], [`ist ${r}`, null]],
  },
  add: {
    level: 1,
    numbers: rng => ({ a: rng.int(2, 30), n: rng.int(2, 40) }),
    story: p => p.n + p.a,
    text: (p, r) => `Addiert man zu einer Zahl ${p.a}, so erhält man ${r}.`,
    correct: (p, r) => [`x+${p.a}`, `${r}`],
    wrong: (p, r) => [
      { eq: [`${p.a}x`, `${r}`], category: 'concept_confusion', feedback: '„Addieren“ heißt plus, nicht mal.' },
      { eq: [`x-${p.a}`, `${r}`], category: 'sign_error', feedback: '„Addieren“ heißt plus, nicht minus.' },
      { eq: [`x`, `${r}+${p.a}`], category: 'concept_confusion', feedback: `Die ${p.a} wird zur gesuchten Zahl addiert; das Ergebnis ist ${r}.` },
    ],
    pieces: (p, r) => [[`zu einer Zahl ${p.a} addieren`, `x+${p.a}`], [`man erhält ${r}`, null]],
  },
  sub: {
    level: 1,
    numbers: rng => ({ a: rng.int(2, 20), n: rng.int(2, 40) }),
    story: p => p.n - p.a,
    text: (p, r) => `Subtrahiert man von einer Zahl ${p.a}, so erhält man ${r}.`,
    correct: (p, r) => [`x-${p.a}`, `${r}`],
    wrong: (p, r) => [
      { eq: [`${p.a}-x`, `${r}`], category: 'order_of_operations', feedback: `„Von einer Zahl ${p.a} subtrahieren“ heißt: Zahl minus ${p.a}. Die Reihenfolge ist wichtig.` },
      { eq: [`x+${p.a}`, `${r}`], category: 'sign_error', feedback: '„Subtrahieren“ heißt minus.' },
      { eq: [`${p.a}x`, `${r}`], category: 'concept_confusion', feedback: '„Subtrahieren“ heißt minus, nicht mal.' },
    ],
    pieces: (p, r) => [[`von einer Zahl ${p.a} subtrahieren`, `x-${p.a}`], [`man erhält ${r}`, null]],
  },
  mul_add: {
    level: 2,
    numbers: rng => ({ k: rng.int(2, 9), a: rng.int(2, 20), n: rng.int(1, 15) }),
    story: p => p.n * p.k + p.a,
    text: (p, r) => `Multipliziert man eine Zahl mit ${p.k} und addiert dann ${p.a}, so erhält man ${r}.`,
    correct: (p, r) => [`${p.k}x+${p.a}`, `${r}`],
    wrong: (p, r) => [
      { eq: [`${p.k}(x+${p.a})`, `${r}`], category: 'order_of_operations', feedback: `Hier wird zuerst multipliziert und danach ${p.a} addiert. Eine Klammer würde bedeuten, dass die Summe multipliziert wird.` },
      { eq: [`${p.a}x+${p.k}`, `${r}`], category: 'concept_confusion', feedback: `Die Zahl wird mit ${p.k} multipliziert, nicht mit ${p.a}.` },
      { eq: [`${p.k}x-${p.a}`, `${r}`], category: 'sign_error', feedback: '„Addieren“ heißt plus.' },
    ],
    pieces: (p, r) => [[`eine Zahl mit ${p.k} multiplizieren`, `${p.k}x`], [`dann ${p.a} addieren`, `${p.k}x+${p.a}`], [`man erhält ${r}`, null]],
  },
  add_mul: {
    level: 2,
    numbers: rng => ({ k: rng.int(2, 9), a: rng.int(2, 12), n: rng.int(1, 12) }),
    story: p => (p.n + p.a) * p.k,
    text: (p, r) => `Addiert man zu einer Zahl ${p.a} und multipliziert die Summe mit ${p.k}, so erhält man ${r}.`,
    correct: (p, r) => [`${p.k}(x+${p.a})`, `${r}`],
    wrong: (p, r) => [
      { eq: [`${p.k}x+${p.a}`, `${r}`], category: 'order_of_operations', feedback: 'Die ganze Summe wird multipliziert. Dafür brauchst du eine Klammer.' },
      { eq: [`${p.a}(x+${p.k})`, `${r}`], category: 'concept_confusion', feedback: `Zur Zahl wird ${p.a} addiert, und mit ${p.k} wird multipliziert – nicht umgekehrt.` },
      { eq: [`${p.k}(x-${p.a})`, `${r}`], category: 'sign_error', feedback: '„Addieren“ heißt plus.' },
    ],
    pieces: (p, r) => [[`zu einer Zahl ${p.a} addieren`, `x+${p.a}`], [`die Summe mit ${p.k} multiplizieren`, `${p.k}(x+${p.a})`], [`man erhält ${r}`, null]],
  },
  fach_minus: {
    level: 2,
    numbers: rng => ({ k: rng.int(2, 9), a: rng.int(2, 20), n: rng.int(3, 15) }),
    story: p => p.k * p.n - p.a,
    text: (p, r) => `Vermindert man das ${FACH[p.k]} einer Zahl um ${p.a}, so erhält man ${r}.`,
    correct: (p, r) => [`${p.k}x-${p.a}`, `${r}`],
    wrong: (p, r) => [
      { eq: [`${p.k}(x-${p.a})`, `${r}`], category: 'order_of_operations', feedback: `Zuerst wird das ${FACH[p.k]} gebildet, dann ${p.a} abgezogen. Eine Klammer passt hier nicht.` },
      { eq: [`${p.a}-${p.k}x`, `${r}`], category: 'order_of_operations', feedback: `„Um ${p.a} vermindern“ heißt: ${p.a} abziehen. Die ${p.a} steht hinter dem Minus.` },
      { eq: [`${p.k}x+${p.a}`, `${r}`], category: 'sign_error', feedback: '„Vermindern“ heißt minus.' },
    ],
    pieces: (p, r) => [[`das ${FACH[p.k]} einer Zahl`, `${p.k}x`], [`um ${p.a} vermindern`, `${p.k}x-${p.a}`], [`man erhält ${r}`, null]],
  },
  both: {
    level: 3,
    numbers: rng => { const k = rng.int(3, 9), n = rng.int(2, 12); return { k, n, a: rng.int(1, Math.min(15, (k - 2) * n - 1)) }; },
    story: p => p.k * p.n - (2 * p.n + p.a), // the subtracted number b, chosen so that both computations agree
    text: (p, b) => `Verdoppelt man eine Zahl und addiert ${p.a}, so erhält man dasselbe, wie wenn man die Zahl mit ${p.k} multipliziert und dann ${b} subtrahiert.`,
    correct: (p, b) => [`2x+${p.a}`, `${p.k}x-${b}`],
    wrong: (p, b) => [
      { eq: [`2(x+${p.a})`, `${p.k}x-${b}`], category: 'order_of_operations', feedback: `Zuerst wird verdoppelt, dann ${p.a} addiert – ohne Klammer.` },
      { eq: [`2x+${p.a}`, `${p.k}(x-${b})`], category: 'order_of_operations', feedback: `Zuerst wird mit ${p.k} multipliziert, dann ${b} subtrahiert – ohne Klammer.` },
      { eq: [`2x+${p.a}`, `${b}-${p.k}x`], category: 'order_of_operations', feedback: `Von dem Produkt wird ${b} subtrahiert: ${p.k}x minus ${b}.` },
    ],
    pieces: (p, b) => [[`eine Zahl verdoppeln und ${p.a} addieren`, `2x+${p.a}`], ['dasselbe wie', null], [`die Zahl mit ${p.k} multiplizieren und ${b} subtrahieren`, `${p.k}x-${b}`]],
  },
  sum_mul: {
    level: 3,
    // k(n + a) = m·n with m = k + d  ⇔  k·a = d·n; choose a = d·t so that n = k·t is a natural number
    numbers: rng => { const k = rng.int(2, 6), d = rng.int(1, 4), t = rng.int(1, 5); return { k, a: d * t, m: k + d }; },
    story: p => p.m, // the right-hand multiplier is fixed; the secret number follows from k(n + a) = m·n
    text: p => `Addiert man zu einer Zahl ${p.a} und multipliziert das Ergebnis mit ${p.k}, so erhält man das ${FACH[p.m]} der Zahl.`,
    correct: p => [`${p.k}(x+${p.a})`, `${p.m}x`],
    wrong: p => [
      { eq: [`${p.k}x+${p.a}`, `${p.m}x`], category: 'order_of_operations', feedback: 'Das Ergebnis der Addition wird multipliziert. Dafür brauchst du eine Klammer.' },
      { eq: [`${p.k}(x+${p.a})`, `x+${p.m}`], category: 'concept_confusion', feedback: `Das ${FACH[p.m]} der Zahl heißt „${p.m} mal die Zahl“.` },
      { eq: [`${p.k}(x+${p.a})`, `${p.m}(x+${p.a})`], category: 'concept_confusion', feedback: `Rechts steht das ${FACH[p.m]} der Zahl selbst, nicht der Summe.` },
    ],
    pieces: p => [[`zu einer Zahl ${p.a} addieren`, `x+${p.a}`], [`das Ergebnis mit ${p.k} multiplizieren`, `${p.k}(x+${p.a})`], [`das ${FACH[p.m]} der Zahl`, `${p.m}x`]],
  },
  consecutive: {
    level: 3,
    numbers: rng => ({ n: rng.int(5, 60), three: rng.bool() }),
    story: p => (p.three ? (p.n - 1) + p.n + (p.n + 1) : p.n + (p.n + 1)),
    text: (p, r) => (p.three ? `Die Summe aus einer Zahl, ihrem Vorgänger und ihrem Nachfolger ist ${r}.` : `Die Summe aus einer Zahl und ihrem Nachfolger ist ${r}.`),
    correct: (p, r) => [p.three ? 'x+(x-1)+(x+1)' : 'x+(x+1)', `${r}`],
    wrong: (p, r) => (p.three ? [
      { eq: ['x+(x+1)+(x+2)', `${r}`], category: 'concept_confusion', feedback: 'Der Vorgänger einer Zahl ist um 1 kleiner: $x-1$.' },
      { eq: ['x-1+x+1', `${r}`], category: 'concept_confusion', feedback: 'Es sind drei Zahlen: die Zahl selbst, ihr Vorgänger und ihr Nachfolger.' },
      { eq: ['x+(x+1)', `${r}`], category: 'concept_confusion', feedback: 'Der Vorgänger fehlt. Es sind drei Summanden.' },
    ] : [
      { eq: ['x+1', `${r}`], category: 'concept_confusion', feedback: 'Die Zahl selbst gehört auch zur Summe: $x + \\left(x+1\\right)$.' },
      { eq: ['x+(x-1)', `${r}`], category: 'concept_confusion', feedback: 'Der Nachfolger ist um 1 größer: $x+1$.' },
      { eq: ['2x', `${r}+1`], category: 'sign_error', feedback: 'Fasse $x + \\left(x+1\\right)$ richtig zusammen: $2x+1$.' },
    ]),
    pieces: (p, r) => (p.three
      ? [['die Zahl, ihr Vorgänger und ihr Nachfolger', 'x+(x-1)+(x+1)'], [`die Summe ist ${r}`, null]]
      : [['die Zahl und ihr Nachfolger', 'x+(x+1)'], [`die Summe ist ${r}`, null]]),
  },
};
const RIDDLE_KINDS = { 1: ['mul', 'add', 'sub'], 2: ['mul_add', 'add_mul', 'fach_minus'], 3: ['both', 'sum_mul', 'consecutive'] };
const STRATEGY_TTE_DE = {
  1: 'Achte auf die Signalwörter: „das Dreifache“ = mal 3, „addieren“ = plus, „subtrahieren von“ = minus, „ist“ / „erhält man“ = Gleichheitszeichen.',
  2: 'Achte auf die Reihenfolge: Wird das Ergebnis einer Summe weiterverrechnet, brauchst du eine Klammer.',
  3: 'Übersetze beide Seiten getrennt in Terme. „Dasselbe wie“ oder „erhält man“ wird zum Gleichheitszeichen.',
};

/**
 * Template ch4.eq.setup_trial.text_to_equation (family text_to_equation)
 * Choose the equation that matches a number riddle (the unknown number is x).
 * Levels
 *  L1 Grundlagen    one operation (das Dreifache, addieren, subtrahieren von).
 *  L2 Standard      two operations in a fixed order (mal-dann-plus vs. Summe-mal) – bracket or not.
 *  L3 Anspruchsvoll x on both sides (two descriptions of the same number), consecutive numbers.
 * Misconceptions: equation_vs_term, order_in_text (Klammer / Reihenfolge), word_operation (wrong operation for a word).
 * Independent solver: computes the riddle's number from its narrative by plain arithmetic and returns the only option
 *   whose equation (parsed with expr.js) is true for that number.
 */
const textToEquation = {
  id: `${SKILL}.text_to_equation`, version: 1, skillId: SKILL,
  families: ['text_to_equation'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Eine Rechenoperation: das Vielfache, addieren, subtrahieren von.',
    2: 'Zwei Rechenoperationen in fester Reihenfolge: mit oder ohne Klammer.',
    3: 'x auf beiden Seiten (zwei Beschreibungen derselben Zahl), aufeinanderfolgende Zahlen.',
  },
  misconceptions: ['equation_vs_term', 'order_in_text', 'word_operation'],
  sample(rng, level) {
    const kind = rng.pick(RIDDLE_KINDS[level]);
    const p = { kind, ...RIDDLES[kind].numbers(rng), order: rng.shuffle([0, 1, 2, 3]) };
    return p;
  },
  /** The secret number of the riddle, by plain arithmetic on the narrative (sum_mul: from k(n + a) = m·n). */
  secret(p) {
    if (p.kind === 'sum_mul') { const d = p.m - p.k; return d > 0 && (p.k * p.a) % d === 0 ? (p.k * p.a) / d : null; }
    return p.n;
  },
  options(p) {
    const R = RIDDLES[p.kind], r = R.story(p);
    const all = [{ id: 'g0', eq: R.correct(p, r) }, ...R.wrong(p, r).map((w, i) => ({ id: `g${i + 1}`, ...w }))];
    return p.order.map(i => all[i]);
  },
  constraints(p) {
    const R = RIDDLES[p.kind], r = R.story(p);
    const n = this.secret(p);
    if (n === null || n <= 0 || n > 60) return 'no natural secret number';
    if (p.kind === 'sum_mul' && p.m > 10) return 'multiplier word missing';
    if (r <= 0 || r > 400) return 'result out of range';
    if (p.kind === 'both' && p.k === 2) return 'k must differ from 2';
    const opts = this.options(p);
    const sat = opts.filter(o => holds(o.eq[0], o.eq[1], n));
    if (sat.length !== 1) return `${sat.length} options fit the secret number`;
    const texts = opts.map(o => `${tex(o.eq[0])}=${tex(o.eq[1])}`);
    if (new Set(texts).size !== texts.length) return 'duplicate option';
    return true;
  },
  build(p, level) {
    const R = RIDDLES[p.kind], r = R.story(p), n = this.secret(p);
    const opts = this.options(p);
    const eqT = eq => `${tex(eq[0])} = ${tex(eq[1])}`;
    const options = opts.map(o => ({ id: o.id, text: $(eqT(o.eq)), ...(o.category ? { category: o.category, feedback: o.feedback } : {}) }));
    const correct = R.correct(p, r);
    const pieces = R.pieces(p, r);
    const steps = [
      ...pieces.map(([phrase, m]) => (m ? `${Q(phrase)}: ${$(tex(m))}` : `${Q(phrase)}: Gleichheitszeichen`)),
      `Gleichung: ${$(eqT(correct))}`,
      `Kontrolle mit der gesuchten Zahl ${$(`x = ${n}`)}: ${sidesAt(correct[0], correct[1], n)} ✓`,
    ];
    const [ph0, m0] = pieces[0];
    return {
      prompt: `Welche Gleichung passt zu diesem Zahlenrätsel? ${Q(R.text(p, r))}`,
      instructions: 'Die gesuchte Zahl heißt $x$.',
      answer: { type: 'choice', options, correct: 'g0', canonical: 'g0' },
      hints: hints(
        'Übersetze den Text Stück für Stück. Die gesuchte Zahl ist $x$; „ist“, „erhält man“ oder „dasselbe wie“ wird zum Gleichheitszeichen.',
        STRATEGY_TTE_DE[level],
        `Beginne mit ${Q(ph0)}: ${$(tex(m0))}.`,
        steps,
        `Rückwärts geprüft: Die gesuchte Zahl ist ${n}. Setze sie in jede Gleichung ein – nur die passende Gleichung wird eine wahre Aussage.`),
      solution: { steps, result: $(eqT(correct)) },
    };
  },
  /** Independent: the riddle's number (narrative arithmetic) satisfies exactly one displayed equation. */
  solve(p) {
    const n = this.secret(p);
    const hit = this.options(p).filter(o => holds(o.eq[0], o.eq[1], n));
    return hit.length === 1 ? hit[0].id : 'none';
  },
  signatureParams(p) { const { order, ...rest } = p; return rest; },
};

module.exports = [isSolution, textToEquation];
