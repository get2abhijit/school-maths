'use strict';
/**
 * Skill ch4.eq.solve_equivalence — Äquivalenzumformungen; lineare Gleichungen vereinfachen und lösen (LS7 IV.2–3).
 */
const U = require('../util');
const Lq = require('./linear');
const { F, hints, $, numTex, numInput, numDistractors } = U;

const SKILL = 'ch4.eq.solve_equivalence';
const x = c => ({ t: 'x', c: String(c) });
const n = c => ({ t: 'n', c: String(c) });
const br = (f, a, b) => ({ t: 'br', f: String(f), a: String(a), b: String(b) });

const FAMILY_OF = {
  'x+a=b': 'one_step', 'a+x=b': 'one_step', 'x-a=b': 'one_step', 'ax=b': 'one_step', 'x/a=b': 'one_step',
  'ax+b=c': 'two_step', 'ax-b=c': 'two_step', 'b-ax=c': 'two_step',
  'ax+b=cx+d': 'both_sides', 'ax+b+cx=d': 'both_sides', 'frac': 'both_sides', 'ax+b=cx+d/frac_sol': 'both_sides',
  'f(x+b)=c': 'brackets', 'f(x+b)+c=g(x+e)': 'brackets', 'f(x+b)-g(x+e)=c': 'brackets',
};
const SHAPES = {
  1: ['x+a=b', 'a+x=b', 'x-a=b', 'ax=b', 'x/a=b', 'ax+b=c', 'ax-b=c'],
  2: ['ax+b=cx+d', 'ax+b=cx+d', 'ax+b+cx=d', 'b-ax=c', 'f(x+b)=c'],
  3: ['f(x+b)+c=g(x+e)', 'f(x+b)-g(x+e)=c', 'frac', 'ax+b=cx+d/frac_sol'],
};
const FRACS = ['1/2', '1/3', '2/3', '1/4', '3/4', '1/5', '2/5', '1/6', '5/6', '3/2'];
const sgn = rng => (rng.bool() ? 1 : -1);

/** Sample an equation of the given shape as {shape, L, R}; the solution follows from the parameters. */
function sampleEquation(rng, shape) {
  const s = (lo, hi) => rng.int(lo, hi);
  switch (shape) {
    case 'x+a=b': { const a = s(2, 20), v = s(0, 20); return { L: [x(1), n(a)], R: [n(v + a)] }; }
    case 'a+x=b': { const a = s(2, 20), v = s(0, 20); return { L: [n(a), x(1)], R: [n(v + a)] }; }
    case 'x-a=b': { const a = s(2, 15), v = s(a, 30); return { L: [x(1), n(-a)], R: [n(v - a)] }; }
    case 'ax=b': { const a = s(2, 9), v = rng.intExcept(-6, 12, [0]); return { L: [x(a)], R: [n(a * v)] }; }
    case 'x/a=b': { const a = s(2, 9), v = s(1, 12); return { L: [x(`1/${a}`)], R: [n(v)] }; }
    case 'ax+b=c': { const a = s(2, 9), b = s(1, 20), v = s(0, 10); return { L: [x(a), n(b)], R: [n(a * v + b)] }; }
    case 'ax-b=c': { const a = s(2, 9), b = s(1, 20), v = s(Math.ceil(b / a), 12); return { L: [x(a), n(-b)], R: [n(a * v - b)] }; }
    case 'b-ax=c': { const a = s(2, 9), b = s(1, 30), v = rng.intExcept(-8, 10, [0]); return { L: [n(b), x(-a)], R: [n(b - a * v)] }; }
    case 'ax+b=cx+d': {
      const a = rng.intExcept(-9, 9, [0]), c = rng.intExcept(-9, 9, [0, a]), b = rng.intExcept(-20, 20, [0]), v = s(-10, 10);
      return { L: [x(a), n(b)], R: [x(c), n((a - c) * v + b)] };
    }
    case 'ax+b+cx=d': {
      const a = s(2, 9), c = rng.intExcept(-9, 9, [0, -a]), b = rng.intExcept(-15, 15, [0]), v = s(-8, 10);
      return { L: [x(a), n(b), x(c)], R: [n((a + c) * v + b)] };
    }
    case 'f(x+b)=c': { const f = s(2, 9) * sgn(rng), b = rng.intExcept(-9, 9, [0]), v = s(-8, 10); return { L: [br(f, 1, b)], R: [n(f * (v + b))] }; }
    case 'f(x+b)+c=g(x+e)': {
      const f = s(2, 8), g = s(2, 8) * sgn(rng), b = rng.intExcept(-9, 9, [0]), e = rng.intExcept(-9, 9, [0]), c = rng.intExcept(-20, 20, [0]);
      return { L: [br(f, 1, b), n(c)], R: [br(g, 1, e)] };
    }
    case 'f(x+b)-g(x+e)=c': {
      const f = s(2, 9), g = s(1, 8), b = rng.intExcept(-9, 9, [0]), e = rng.intExcept(-9, 9, [0]), c = rng.intExcept(-30, 30, [0]);
      return { L: [br(f, 1, b), br(-g, 1, e)], R: [n(c)] };
    }
    case 'frac': {
      const p = rng.pick(FRACS), q = rng.pick(FRACS.filter(t => t !== p)), b = rng.intExcept(-12, 12, [0]), d = rng.intExcept(-12, 12, [0, b]);
      return { L: [x(p), n(b)], R: [x(q), n(d)] };
    }
    case 'ax+b=cx+d/frac_sol': {
      const a = rng.intExcept(-9, 9, [0]), c = rng.intExcept(-9, 9, [0, a]), b = rng.intExcept(-20, 20, [0]), d = rng.intExcept(-20, 20, [0, b]);
      return { L: [x(a), n(b)], R: [x(c), n(d)] };
    }
    default: throw new Error(shape);
  }
}

/** Constraints shared by the solving and the error templates. Returns true or a reason. */
function equationCheck(eq, shape, level) {
  const ch = Lq.chain(eq);
  if (ch.kind !== 'one') return 'not exactly one solution';
  const v = ch.value;
  const lim = level === 3 ? 120 : level === 2 ? 60 : 40;
  if (Lq.chainMax(ch).cmp(F(lim)) > 0) return 'numbers too large';
  if (level < 3 && !v.isInteger()) return 'non-integer solution below L3';
  if (shape === 'ax+b=cx+d/frac_sol' && v.isInteger()) return 'frac_sol shape needs a fraction solution';
  if (v.d > 6n || v.abs().cmp(F(40)) > 0) return 'awkward solution';
  if (level === 1 && v.sign() < 0 && shape !== 'ax=b') return 'negative solution at L1';
  if (eq.R.some(p => p.t === 'n' && F(p.c).isZero())) return 'zero constant';
  return true;
}

/** Misconception values computed from the collected form A·x + B = C·x + D (and the raw brackets). */
function solveDistractors(eq, v) {
  const lE = Lq.lin(Lq.expand(eq.L)), rE = Lq.lin(Lq.expand(eq.R));
  const A = lE.a, B = lE.b, C = rE.a, D = rE.b;
  const out = [];
  const add = (num, den, category, feedback) => { if (!F(den).isZero()) out.push({ value: F(num).div(den), category, feedback }); };
  if (!B.isZero()) add(D.add(B), A.sub(C), 'sign_error', 'Achte auf das Vorzeichen: Um eine Zahl auf einer Seite wegzubekommen, rechnest du auf beiden Seiten die Gegenoperation.');
  if (!C.isZero()) add(D.sub(B), A.add(C), 'sign_error', 'Achte auf das Vorzeichen, wenn du ein $x$-Glied auf die andere Seite bringst: Du subtrahierst es auf beiden Seiten.');
  if (!D.sub(B).isZero()) add(A.sub(C), D.sub(B), 'concept_confusion', 'Du hast umgekehrt dividiert. Teile die Zahl durch den Faktor vor $x$.');
  if (!A.sub(C).eq(1) && !A.sub(C).isZero()) out.push({ value: D.sub(B).sub(A.sub(C)), category: 'concept_confusion', feedback: 'Den Faktor vor $x$ entfernst du durch Dividieren, nicht durch Subtrahieren.' });
  // bracket misconceptions: only the first term multiplied / minus before a bracket ignored
  const wrong = (side, fn) => side.map(p => (p.t === 'br' ? fn(p) : p));
  const solveParts = (L, R) => { const r = Lq.solveEq({ L: Lq.expand(L), R: Lq.expand(R) }); return r.kind === 'one' ? r.value : null; };
  if (Lq.hasBracket(eq.L) || Lq.hasBracket(eq.R)) {
    const firstOnly = p => [{ t: 'x', c: F(p.f).mul(p.a).toString() }, { t: 'n', c: p.b }];
    const flat = side => side.flatMap(p => (p.t === 'br' ? firstOnly(p) : [p]));
    const w = solveParts(flat(eq.L), flat(eq.R));
    if (w) out.push({ value: w, category: 'concept_confusion', feedback: 'Beim Ausmultiplizieren wird jedes Glied in der Klammer mit dem Faktor davor multipliziert.' });
    if ([...eq.L, ...eq.R].some(p => p.t === 'br' && F(p.f).sign() < 0)) {
      const minus = side => side.flatMap(p => (p.t === 'br' && F(p.f).sign() < 0 ? [{ t: 'x', c: F(p.f).mul(p.a).toString() }, { t: 'n', c: F(p.f).mul(p.b).neg().toString() }] : [p]));
      const m = solveParts(minus(eq.L), minus(eq.R));
      if (m) out.push({ value: m, category: 'sign_error', feedback: 'Steht ein Minus vor der Klammer, ändern sich beim Auflösen die Vorzeichen aller Glieder in der Klammer.' });
    }
  }
  return numDistractors(v, out);
}

const STRATEGY_DE = {
  one_step: 'Mache die Rechnung, die mit $x$ gemacht wurde, durch die Umkehroperation rückgängig – auf beiden Seiten.',
  two_step: 'Bringe zuerst die Zahl ohne $x$ auf die andere Seite. Dividiere danach durch die Zahl vor $x$.',
  both_sides: 'Bringe alle $x$-Glieder auf die linke Seite und alle Zahlen auf die rechte Seite. Fasse zusammen und dividiere zum Schluss.',
  brackets: 'Löse zuerst die Klammern auf (jedes Glied multiplizieren, auf ein Minus vor der Klammer achten) und fasse zusammen. Dann weiter wie gewohnt.',
  fractions: 'Multipliziere zuerst beide Seiten mit dem Hauptnenner. Dann stehen nur noch ganze Zahlen da.',
};

/**
 * Template ch4.eq.solve_equivalence.solve (families one_step, two_step, both_sides, brackets)
 * Levels
 *  L1 Grundlagen    x + a = b, a + x = b, x − a = b, a·x = b, x : a (as ⅟a·x) = b, a·x ± b = c; natural numbers, integer solution.
 *  L2 Standard      x on both sides (negative coefficients), collecting like terms, b − a·x = c, one bracket; integer solution.
 *  L3 Anspruchsvoll two brackets (incl. minus before a bracket), fraction coefficients (clear denominators),
 *                   solutions may be fractions (denominator ≤ 6).
 * Misconceptions: sign_when_moving (sign error when moving a term), divide_one_term (wrong inverse operation),
 *   bracket_expansion (only the first term multiplied; minus before a bracket ignored).
 * Build path: Lq.chain (arithmetic on parts, also the worked lines). Independent solver: Lq.solveMachine on the
 *   displayed machine strings (expr.js polynomial normal form of L − R).
 */
const solve = {
  id: `${SKILL}.solve`, version: 1, skillId: SKILL,
  families: ['one_step', 'two_step', 'both_sides', 'brackets'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Ein oder zwei Umformungsschritte mit natürlichen Zahlen: x + a = b, a·x = b, x : a = b, a·x + b = c.',
    2: 'x auf beiden Seiten, negative Zahlen, Zusammenfassen, eine Klammer; ganzzahlige Lösung.',
    3: 'Zwei Klammern (auch Minus vor der Klammer), Bruchkoeffizienten; Lösung auch als Bruch.',
  },
  misconceptions: ['sign_when_moving', 'divide_one_term', 'bracket_expansion'],
  sample(rng, level) {
    const shape = rng.pick(SHAPES[level]);
    return { shape, ...sampleEquation(rng, shape) };
  },
  constraints(p, level) { return equationCheck(p, p.shape, level); },
  build(p) {
    const eq = { L: p.L, R: p.R };
    const ch = Lq.chain(eq);
    const v = ch.value;
    const fam = FAMILY_OF[p.shape];
    const steps = [...ch.lines.map(l => Lq.lineText(l)), Lq.probeText(eq, v)];
    const first = ch.lines[0];
    return {
      prompt: `Löse die Gleichung ${$(Lq.eqTex(eq))}.`,
      instructions: 'Gib die Lösung an: eine ganze Zahl, einen Bruch oder eine Dezimalzahl.',
      answer: { type: 'fraction', variable: 'x', value: v.toString(), canonical: numInput(v), distractors: solveDistractors(eq, v) },
      hints: hints(
        'Gesucht ist die Zahl für $x$, die die Gleichung wahr macht. Forme so um, dass $x$ allein auf einer Seite steht – und rechne immer auf beiden Seiten dasselbe.',
        p.shape === 'frac' ? STRATEGY_DE.fractions : STRATEGY_DE[fam],
        ch.lines.length > 2 ? `${Lq.opWords(first.op)}: Aus ${$(Lq.eqTex(first.eq))} wird ${$(Lq.eqTex(ch.lines[1].eq))}.` : `${Lq.opWords(first.op)}.`,
        steps,
        fam === 'both_sides'
          ? 'Du kannst die $x$-Glieder auch auf der rechten Seite sammeln. Die Lösung ist dieselbe. Kontrolliere am Ende mit der Probe: Setze deine Zahl in beide Seiten der Ausgangsgleichung ein.'
          : 'Kontrolliere mit der Probe: Setze deine Zahl in beide Seiten der Ausgangsgleichung ein. Beide Seiten müssen denselben Wert ergeben.'),
      solution: { steps, result: $(`x = ${numTex(v)}`) },
    };
  },
  solve(p) { return Lq.solveEq({ L: p.L, R: p.R }).value.toString(); },
};

// ---------------------------------------------------------------- spot the error
const ERR_TEXT_DE = {
  sign_const: 'Beim Wegbringen der Zahl wurde mit dem falschen Vorzeichen gerechnet. Auf beiden Seiten muss dieselbe Gegenoperation stehen.',
  sign_x: 'Beim Wegbringen des $x$-Glieds wurde mit dem falschen Vorzeichen gerechnet. Auf beiden Seiten muss dasselbe subtrahiert werden.',
  wrong_op: 'Statt durch den Faktor vor $x$ zu dividieren, wurde er subtrahiert.',
  bracket_second: 'Beim Ausmultiplizieren wurde nur das erste Glied in der Klammer mit dem Faktor multipliziert.',
  minus_bracket: 'Vor der Klammer steht ein Minus: Beim Auflösen ändern sich die Vorzeichen aller Glieder in der Klammer.',
  mult_one_term: 'Beim Multiplizieren mit dem Hauptnenner wurde ein Glied vergessen. Jedes Glied auf beiden Seiten muss multipliziert werden.',
};
const SPOT_SHAPES = { 2: ['ax+b=cx+d', 'ax+b+cx=d', 'b-ax=c'], 3: ['f(x+b)+c=g(x+e)', 'f(x+b)-g(x+e)=c', 'f(x+b)=c'], 4: ['frac', 'f(x+b)-g(x+e)=c'] };
const ERR_FOR_OP = { add_n: ['sign_const'], add_x: ['sign_x'], div: ['wrong_op'], expand: ['bracket_second', 'minus_bracket'], mul: ['mult_one_term'] };
const opKey = op => (op.k === 'add' ? (op.x ? 'add_x' : 'add_n') : op.k);

/** The line after a planted error (same claimed operation, wrong result), or null if not applicable. */
function plantError(eq, op, err) {
  if (err === 'sign_const') {
    const v = F(op.v);
    return { L: Lq.collect([...eq.L, { t: 'n', c: v.toString() }]), R: Lq.collect([...eq.R, { t: 'n', c: v.neg().toString() }]) };
  }
  if (err === 'sign_x') {
    const v = F(op.v);
    return { L: Lq.collect([...eq.L, { t: 'x', c: v.neg().toString() }]), R: Lq.collect([...eq.R, { t: 'x', c: v.toString() }]) };
  }
  if (err === 'wrong_op') {
    const l = Lq.lin(eq.L), r = Lq.lin(eq.R);
    return { L: [{ t: 'x', c: '1' }], R: [{ t: 'n', c: r.b.sub(l.a).toString() }] };
  }
  if (err === 'bracket_second' || err === 'minus_bracket') {
    let done = false;
    const fix = side => side.flatMap(p => {
      if (p.t !== 'br') return [p];
      const target = err === 'minus_bracket' ? F(p.f).sign() < 0 : F(p.f).abs().cmp(F(1)) > 0;
      if (p.t !== 'br' || done || !target) return p.t === 'br' ? [{ t: 'x', c: F(p.f).mul(p.a).toString() }, { t: 'n', c: F(p.f).mul(p.b).toString() }] : [p];
      done = true;
      const second = err === 'bracket_second' ? F(p.b) : F(p.f).mul(p.b).neg();
      return [{ t: 'x', c: F(p.f).mul(p.a).toString() }, { t: 'n', c: second.toString() }];
    });
    const out = { L: fix(eq.L), R: fix(eq.R) };
    return done ? out : null;
  }
  if (err === 'mult_one_term') {
    const m = F(op.v);
    // the integer number term on the left keeps its value (not multiplied)
    const idx = eq.L.findIndex(p => p.t === 'n');
    if (idx < 0) return null;
    return { L: eq.L.map((p, i) => (i === idx ? p : { ...p, c: F(p.c).mul(m).toString() })), R: Lq.scale(eq.R, m) };
  }
  return null;
}

/**
 * Template ch4.eq.solve_equivalence.spot_error (family spot_error)
 * A worked solution with exactly one wrong transformation; the student picks the first wrong step.
 * Levels
 *  L2 Standard      x on both sides / collecting; error: sign when moving a number or an x-term, or subtracting instead of dividing.
 *  L3 Anspruchsvoll with brackets; error: only the first term multiplied, minus before a bracket, or a sign error.
 *  L4 Transfer      fraction coefficients or a minus bracket; error: a term not multiplied by the common denominator, or as L3.
 * Misconceptions: sign_when_moving, divide_one_term, bracket_expansion.
 * Independent solver: the first line whose solution set (expr.js, Lq.solveMachine) differs from the line before.
 */
const spotError = {
  id: `${SKILL}.spot_error`, version: 1, skillId: SKILL,
  families: ['spot_error'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'x auf beiden Seiten; Fehler beim Vorzeichen oder Subtrahieren statt Dividieren finden.',
    3: 'Mit Klammern; Fehler beim Ausmultiplizieren oder beim Vorzeichen finden.',
    4: 'Bruchkoeffizienten oder Minus vor der Klammer; vergessenes Glied beim Multiplizieren finden.',
  },
  misconceptions: ['sign_when_moving', 'divide_one_term', 'bracket_expansion'],
  sample(rng, level) {
    const shape = rng.pick(SPOT_SHAPES[level]);
    const eq = sampleEquation(rng, shape);
    return { shape, ...eq, pick: rng.int(0, 99) };
  },
  /** Planted chain: lines [{eq, op}], index of the wrong transition (0-based), error kind. */
  plan(p, level) {
    const eq0 = { L: p.L, R: p.R };
    const good = Lq.chain(eq0).lines;
    const cands = [];
    good.slice(0, -1).forEach((l, i) => {
      for (const err of ERR_FOR_OP[opKey(l.op)] || []) {
        if (level === 4 && p.shape === 'frac' && err !== 'mult_one_term' && err !== 'sign_x') continue;
        if (level === 4 && p.shape !== 'frac' && err !== 'minus_bracket') continue;
        if (level === 3 && err === 'mult_one_term') continue;
        cands.push({ i, err });
      }
    });
    if (!cands.length) return null;
    const { i, err } = cands[p.pick % cands.length];
    const wrongEq = plantError(good[i].eq, good[i].op, err);
    if (!wrongEq) return null;
    const cont = Lq.chain(wrongEq);
    if (cont.kind !== 'one') return null;
    const lines = [...good.slice(0, i + 1).map(l => ({ ...l })), ...cont.lines];
    return { lines, wrong: i, err, value: Lq.chain(eq0).value, wrongValue: cont.value };
  },
  constraints(p, level) {
    const base = equationCheck({ L: p.L, R: p.R }, p.shape, level === 4 ? 3 : level);
    if (base !== true) return base;
    const pl = this.plan(p, level);
    if (!pl) return 'no error applicable';
    if (pl.value.eq(pl.wrongValue)) return 'planted error does not change the solution';
    if (pl.lines.length > 7) return 'too many lines';
    if (pl.wrongValue.d > 12n || pl.wrongValue.abs().cmp(F(200)) > 0) return 'awkward wrong result';
    for (const l of pl.lines) if (Lq.maxAbsCoefficient(l.eq).cmp(F(200)) > 0) return 'numbers too large';
    return true;
  },
  build(p, level) {
    const pl = this.plan(p, level);
    const v = pl.value;
    const nTrans = pl.lines.length - 1;
    const options = Array.from({ length: nTrans }, (_, i) => ({
      id: `s${i + 1}`, text: `Von (${i + 1}) nach (${i + 2})`,
      ...(i === pl.wrong ? {} : { category: 'concept_confusion', feedback: `Diese Umformung ist richtig: ${$(`x = ${numTex(i < pl.wrong ? v : pl.wrongValue)}`)} erfüllt beide Zeilen.` }),
    }));
    options.push({ id: 'none', text: 'Alle Umformungen sind richtig.', category: 'concept_confusion', feedback: `Mache die Probe: ${$(`x = ${numTex(pl.wrongValue)}`)} erfüllt die Ausgangsgleichung nicht.` });
    const correctNext = Lq.chain(pl.lines[pl.wrong].eq).lines[1].eq;
    const valAt = (eq, side) => Lq.valueAt(Lq.sideMachine(eq[side]), v);
    const badEq = pl.lines[pl.wrong + 1].eq;
    const steps = [
      `Die Ausgangsgleichung hat die Lösung ${$(`x = ${numTex(v)}`)}. ${pl.wrong === 0 ? 'Sie erfüllt Zeile (1).' : `Sie erfüllt die Zeilen (1) bis (${pl.wrong + 1}).`}`,
      `In Zeile (${pl.wrong + 2}) ergibt ${$(`x = ${numTex(v)}`)} links ${$(numTex(valAt(badEq, 'L')))} und rechts ${$(numTex(valAt(badEq, 'R')))} – die Umformung von (${pl.wrong + 1}) nach (${pl.wrong + 2}) ist falsch.`,
      `${ERR_TEXT_DE[pl.err]} Richtig wäre ${$(Lq.eqTex(correctNext))}.`,
    ];
    return {
      prompt: 'In dieser Lösung steckt genau ein Fehler. Bei welcher Umformung passiert er?',
      promptLines: pl.lines.map((l, i) => Lq.lineText(l, `(${i + 1}) `)),
      instructions: 'Wähle die fehlerhafte Umformung.',
      answer: { type: 'choice', options, correct: `s${pl.wrong + 1}`, canonical: `s${pl.wrong + 1}` },
      hints: hints(
        'Eine Äquivalenzumformung ändert die Lösung nicht. Suche die erste Zeile, deren Lösung anders ist als die der Zeile davor.',
        'Löse die Ausgangsgleichung selbst. Setze dann deine Lösung in jede Zeile ein: Ab der fehlerhaften Zeile stimmt sie nicht mehr.',
        `Die richtige Lösung ist ${$(`x = ${numTex(v)}`)}. Prüfe damit jede Zeile.`,
        steps,
        'Prüfe jede Umformung einzeln: Wurde auf beiden Seiten dasselbe gerechnet? Wurde jedes Glied erfasst? Stimmen die Vorzeichen?'),
      solution: { steps, result: `Von (${pl.wrong + 1}) nach (${pl.wrong + 2})` },
    };
  },
  /** Independent: first transition where the solution (via expr.js) changes. */
  solve(p, level) {
    const pl = this.plan(p, level);
    for (let i = 1; i < pl.lines.length; i++) {
      const a = Lq.solveEq(pl.lines[i - 1].eq), b = Lq.solveEq(pl.lines[i].eq);
      if (a.kind !== b.kind || (a.kind === 'one' && !a.value.eq(b.value))) return `s${i}`;
    }
    return 'none';
  },
  /** Effective content: the equation and which error is planted where (not the raw pick number). */
  signatureParams(p, level) { const pl = this.plan(p, level); return { L: p.L, R: p.R, wrong: pl ? pl.wrong : -1, err: pl ? pl.err : '' }; },
};

module.exports = [solve, spotError];
module.exports.sampleEquation = sampleEquation;
module.exports.equationCheck = equationCheck;
