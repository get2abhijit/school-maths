'use strict';
/**
 * Skill ch1.terms.collect_like — Summen mit einer Variable vereinfachen (LS7 I.3).
 */
const U = require('../util');
const { F, hints, tex, $, numTex, polyMachine, polyInput, exprDistractors } = U;

const SKILL = 'ch1.terms.collect_like';

const FRACS = ['1/2', '1/4', '3/4', '1/3', '2/3', '3/2', '5/4'];
const DECS = ['0.5', '1.5', '2.5', '0.2', '1.2', '0.8', '3.5'];

/** Sample an ordered list of summands [{c, p}] (coefficients as strings). */
function sampleSummands(rng, level, long) {
  const sign = () => rng.pick([1, -1]);
  if (level === 1) {
    const n = rng.pick([2, 2, 3]);
    return { style: 'int', terms: Array.from({ length: n }, (_, i) => ({ c: String((i === 0 ? 1 : sign()) * rng.int(1, 12)), p: 1 })) };
  }
  if (level === 2) {
    const ts = [{ c: String(rng.int(1, 12)), p: 1 }, { c: String(sign() * rng.int(1, 12)), p: 0 },
      { c: String(sign() * rng.int(1, 9)), p: 1 }, { c: String(sign() * rng.int(1, 12)), p: 0 }];
    return { style: 'int', terms: [ts[0], ...rng.shuffle(ts.slice(1))] };
  }
  const style = rng.pick(['frac', 'dec']);
  const pool = style === 'frac' ? FRACS : DECS;
  const coef = () => (rng.int(0, 2) === 0 ? String(rng.int(1, 9)) : rng.pick(pool));
  const n = long ? 6 : rng.pick([4, 5]);
  const terms = [];
  for (let i = 0; i < n; i++) {
    const c = coef();
    terms.push({ c: (i === 0 ? '' : (sign() < 0 ? '-' : '')) + c, p: i % 2 === 0 ? 1 : 0 });
  }
  return { style, terms: [terms[0], ...rng.shuffle(terms.slice(1))] };
}
const opts = st => ({ dec: st.style === 'dec' });
const machineOf = (terms, st) => polyMachine(terms.map(t => [t.c, t.p]), opts(st));
function sums(terms) {
  let kx = F(0), k0 = F(0);
  for (const t of terms) { if (t.p === 1) kx = kx.add(F(t.c)); else k0 = k0.add(F(t.c)); }
  return { kx, k0 };
}
function summandCheck(st, level) {
  const { kx, k0 } = sums(st.terms);
  if (kx.isZero()) return 'x terms cancel';
  if (level >= 2 && k0.isZero()) return 'constants cancel';
  if (level >= 2 && st.terms.filter(t => t.p === 1).length < 2) return 'need two x terms';
  if (level >= 2 && st.terms.filter(t => t.p === 0).length < 2) return 'need two constants';
  if (level >= 2 && !st.terms.some(t => F(t.c).sign() < 0)) return 'no negative summand';
  if (level === 1 && kx.eq(1)) return 'trivial coefficient';
  return true;
}

/**
 * Template ch1.terms.collect_like.collect (family collect)
 * Levels
 *  L1 Grundlagen    two or three like terms with integer coefficients (a·x ± b·x).
 *  L2 Standard      two x-terms and two constants, mixed order and signs.
 *  L3 Anspruchsvoll four or five summands with fraction OR decimal coefficients, negative signs.
 * Misconceptions → distractors: merge_unlike (3x + 2 → 5x), lost_minus (minus dropped when reordering).
 * Answer form 'expanded' (any order; x/2 and ½x both fine). Independent solver: polynomial normal form.
 */
const collect = {
  id: `${SKILL}.collect`, version: 1, skillId: SKILL,
  families: ['collect'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Zwei oder drei gleichartige Glieder mit ganzzahligen Koeffizienten.',
    2: 'Zwei x-Glieder und zwei Zahlglieder, gemischte Reihenfolge und Vorzeichen.',
    3: 'Vier bis fünf Summanden mit Brüchen oder Dezimalzahlen, negative Vorzeichen.',
  },
  misconceptions: ['merge_unlike', 'lost_minus'],
  sample(rng, level) { return sampleSummands(rng, level, false); },
  constraints(p, level) { return summandCheck(p, level); },
  build(p, level) {
    const o = opts(p);
    const task = machineOf(p.terms, p);
    const { kx, k0 } = sums(p.terms);
    const value = polyMachine([[kx, 1], [k0, 0]], o);
    const xs = p.terms.filter(t => t.p === 1), cs = p.terms.filter(t => t.p === 0);
    const ordered = machineOf([...xs, ...cs], p);
    const coefList = list => list.map((t, i) => (i === 0 ? numTex(t.c, o) : `${F(t.c).sign() < 0 ? '-' : '+'}${numTex(F(t.c).abs(), o)}`)).join('');
    const steps = [];
    if (cs.length) steps.push(`Ordnen: ${$(`${tex(task)} = ${tex(ordered)}`)}`);
    steps.push(`x-Glieder: ${$(`${coefList(xs)} = ${numTex(kx, o)}`)}${cs.length ? `, Zahlglieder: ${$(`${coefList(cs)} = ${numTex(k0, o)}`)}` : ''}`);
    steps.push(`Ergebnis: ${$(tex(value))}`);
    const absSums = sums(p.terms.map(t => ({ ...t, c: F(t.c).abs().toString() })));
    const dis = [];
    if (cs.length) dis.push({ value: polyMachine([[kx.add(k0), 1]], o), category: 'concept_confusion', feedback: 'Nur gleichartige Glieder darf man zusammenfassen: x-Glieder mit x-Gliedern, Zahlen mit Zahlen.' });
    dis.push({ value: polyMachine([[absSums.kx, 1], [absSums.k0, 0]], o), category: 'sign_error', feedback: 'Das Rechenzeichen vor einem Glied gehört zu diesem Glied und wandert beim Umordnen mit.' });
    return {
      prompt: `Vereinfache den Term ${$(tex(task))}.`,
      instructions: 'Fasse gleichartige Glieder zusammen.',
      answer: { type: 'expression', value, canonical: polyInput([[kx, 1], [k0, 0]], o), variables: ['x'], form: 'expanded', distractors: exprDistractors(value, dis) },
      hints: hints(
        'Gleichartige Glieder sind Glieder mit derselben Variablen (hier: $x$-Glieder) oder reine Zahlen. Nur sie darf man zusammenfassen.',
        'Ordne zuerst: alle $x$-Glieder nach vorne, alle Zahlen nach hinten. Das Rechenzeichen wandert mit.',
        cs.length ? `Geordnet: ${$(tex(ordered))}.` : `Addiere die Koeffizienten: ${$(coefList(xs))}.`,
        steps,
        `Stell dir $x$ als Gegenstand vor, z. B. Äpfel: ${$(tex(machineOf(xs, p)))} sind zusammen ${$(tex(polyMachine([[kx, 1]], o)))}. Zahlen ohne $x$ bleiben getrennt.`),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) { return U.solveExpanded(machineOf(p.terms, p)); },
};

/**
 * Template ch1.terms.collect_like.spot_error (family spot_error)
 * A three-line simplification with exactly one wrong line (later lines continue correctly from the
 * wrong line). Choice: Zeile 1 / 2 / 3 / „Kein Fehler“.
 * Error kinds: line 1 sign lost while reordering (lost_minus), line 2 unlike terms merged
 * (merge_unlike), line 3 arithmetic slip in a coefficient.
 * Levels
 *  L2 Standard      two x-terms, two constants, integers.
 *  L3 Anspruchsvoll four–five summands with fractions or decimals.
 *  L4 Transfer      six summands with fractions or decimals; feedback explains the error type.
 * Independent solver: algebraic equivalence check (expr.equivalent) between consecutive lines.
 */
const spotError = {
  id: `${SKILL}.spot_error`, version: 1, skillId: SKILL,
  families: ['spot_error'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Ganzzahlige Rechnung mit vier Summanden.',
    3: 'Vier bis fünf Summanden mit Brüchen oder Dezimalzahlen.',
    4: 'Sechs Summanden mit Brüchen oder Dezimalzahlen.',
  },
  misconceptions: ['merge_unlike', 'lost_minus'],
  sample(rng, level) {
    const st = sampleSummands(rng, level === 4 ? 3 : level, level === 4);
    return { ...st, err: rng.int(1, 3), flip: rng.int(0, 9), slip: rng.pick(['kx', 'k0']) };
  },
  lines(p) {
    const o = opts(p);
    const xs0 = p.terms.filter(t => t.p === 1), cs0 = p.terms.filter(t => t.p === 0);
    let ordered = [...xs0, ...cs0];
    if (p.err === 1) {
      const negIdx = ordered.map((t, i) => (F(t.c).sign() < 0 ? i : -1)).filter(i => i >= 0);
      const k = negIdx[p.flip % negIdx.length];
      ordered = ordered.map((t, i) => (i === k ? { ...t, c: F(t.c).neg().toString() } : t));
    }
    const xs = ordered.filter(t => t.p === 1), cs = ordered.filter(t => t.p === 0);
    const group = list => list.map((t, i) => (i === 0 ? U.numMachine(t.c, o) : `${F(t.c).sign() < 0 ? '-' : '+'}${U.numMachine(F(t.c).abs(), o)}`)).join('');
    const { kx, k0 } = sums(ordered);
    let line2, line3;
    if (p.err === 2) {
      line2 = `(${group([...xs, ...cs])})x`;
      line3 = polyMachine([[kx.add(k0), 1]], o);
    } else {
      line2 = `(${group(xs)})x+(${group(cs)})`;
      let rk = kx, r0 = k0;
      if (p.err === 3) { if (p.slip === 'kx') rk = kx.add(1); else r0 = k0.neg(); }
      line3 = polyMachine([[rk, 1], [r0, 0]], o);
    }
    return [machineOf(p.terms, p), machineOf(ordered, p), line2, line3];
  },
  constraints(p, level) {
    const c = summandCheck(p, level === 4 ? 3 : level);
    if (c !== true) return c;
    if (level === 4 && p.terms.length !== 6) return 'need six summands';
    const L = this.lines(p);
    const xs = p.terms.filter(t => t.p === 1), cs = p.terms.filter(t => t.p === 0);
    if (machineOf([...xs, ...cs], p) === L[0]) return 'task already ordered (line 1 would repeat it)';
    for (let i = 1; i < 4; i++) {
      const ok = U.equiv(L[i - 1], L[i]);
      if ((i === p.err) === ok) return `line ${i} equivalence does not match the planted error`;
    }
    return true;
  },
  build(p, level) {
    const o = opts(p);
    const L = this.lines(p);
    const two = F(2);
    const at2 = m => U.evalMachine(m, { x: two });
    const what = {
      1: 'Beim Umordnen ist ein Minuszeichen verloren gegangen. Das Rechenzeichen gehört zum Glied dahinter.',
      2: 'Hier wurden $x$-Glieder und Zahlen zusammengefasst. Das ist nicht erlaubt – sie sind nicht gleichartig.',
      3: 'Hier wurde falsch gerechnet: Die Klammern ergeben einen anderen Wert.',
    }[p.err];
    const options = [1, 2, 3].map(i => ({ id: `z${i}`, text: `Zeile ${i}`, ...(i === p.err ? {} : { category: 'concept_confusion', feedback: `Zeile ${i} ist gleichwertig zur Zeile davor. Setze zur Kontrolle $x=2$ ein.` }) }));
    options.push({ id: 'none', text: 'Es gibt keinen Fehler.', category: 'concept_confusion', feedback: 'Setze $x=2$ in alle Zeilen ein: Die Werte sind nicht alle gleich.' });
    const steps = [
      `Werte für $x=2$: ${L.map((m, i) => `${i === 0 ? 'Term' : `Zeile ${i}`}: ${$(numTex(at2(m), o))}`).join(', ')}.`,
      `Der Wert ändert sich zum ersten Mal in Zeile ${p.err}. ${what}`,
    ];
    return {
      prompt: 'In der folgenden Rechnung steckt genau ein Fehler. In welcher Zeile steht er zum ersten Mal?',
      promptLines: [$(tex(L[0])), ...L.slice(1).map((m, i) => `Zeile ${i + 1}: ${$(`= ${tex(m)}`)}`)],
      instructions: 'Wähle die Zeile mit dem ersten Fehler.',
      answer: { type: 'choice', options, correct: `z${p.err}`, canonical: `z${p.err}` },
      hints: hints(
        'Jede Zeile muss gleichwertig zur vorherigen sein. Suche die erste Zeile, bei der das nicht mehr stimmt.',
        'Setze eine Zahl, z. B. $x=2$, in den Term und in jede Zeile ein. Ab der fehlerhaften Zeile ändert sich der Wert.',
        `Für $x=2$ hat der Ausgangsterm den Wert ${$(numTex(at2(L[0]), o))}.`,
        steps,
        'Typische Fehler: ein Minus geht beim Umordnen verloren, $x$-Glieder und Zahlen werden zusammengefasst, oder man verrechnet sich beim Addieren der Koeffizienten.'),
      solution: { steps, result: `Zeile ${p.err}` },
    };
  },
  /** Independent: first line that is not algebraically equivalent to its predecessor. */
  solve(p) {
    const L = this.lines(p);
    for (let i = 1; i < L.length; i++) if (!U.equiv(L[i - 1], L[i])) return `z${i}`;
    return 'none';
  },
};

module.exports = [collect, spotError];
