'use strict';
/**
 * Skill ch1.terms.collect_like — family equivalence_check (Session 12; LS7 I.3 „gleichwertige Terme“).
 *
 * Independent solver: the expression engine decides equivalence of the shown terms (X.equivalent: exact evaluation
 * at many rational points plus normal form) and, at L4, re-evaluates the values claimed in the options.
 * `build` decides by comparing the collected coefficients it tracked while constructing the terms.
 */
const U = require('../util');
const { F, hints, tex, $, numTex, polyMachine } = U;

const SKILL = 'ch1.terms.collect_like';
const IDS = ['a', 'b', 'c', 'd'];

function arrange(list, key) {
  return list.map((c, i) => ({ c, k: (key ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0 })).sort((x, y) => x.k - y.k).map(o => o.c);
}
const opt = p => ({ dec: !!p.dec });
const M = (p, terms) => polyMachine(terms, opt(p));
/** Collected coefficients of a summand list [[coef, power]]. */
function collected(list) {
  let m = F(0), c = F(0);
  for (const [k, pw] of list) { if (pw === 1) m = m.add(k); else c = c.add(k); }
  return [m, c];
}
const sameForm = (a, b) => a[0].eq(b[0]) && a[1].eq(b[1]);
/** Params survive a JSON round trip (question meta): coefficients may come back as strings. */
const normList = l => l.map(([k, pw]) => [F(k), pw]);
function norm(p) {
  if (p.level === 4) return { ...p, t1: normList(p.t1), t2: normList(p.t2) };
  return { ...p, list: normList(p.list) };
}

/** Random coefficient: integers (dec=false) or halves (dec=true), never 0. */
function coef(rng, lo, hi, dec) {
  if (!dec) return F(rng.intExcept(lo, hi, [0]));
  return F(rng.intExcept(2 * lo, 2 * hi, [0])).div(2);
}
/** Summand list with three or four summands (two x-summands, one or two constants), shuffled. */
function summands(rng, level, dec) {
  const neg = level >= 2;
  const lo = neg ? -9 : 1;
  const list = [[coef(rng, lo, 9, dec), 1], [coef(rng, lo, 9, dec), 1], [coef(rng, neg ? -12 : 1, 12, dec), 0]];
  if (level >= 2 && rng.bool()) list.push([coef(rng, -12, 12, dec), 0]);
  return rng.shuffle(list);
}
/** Wrong „simplifications“ of a summand list with their misconception. */
function wrongForms(list) {
  const [m, c] = collected(list);
  const out = [];
  if (!c.isZero()) out.push({ form: [m.add(c), F(0)], category: 'concept_confusion', fb: 'Zahlglieder und Glieder mit $x$ sind nicht gleichartig. Sie dürfen nicht zusammengefasst werden.' });
  const iNeg = list.findIndex(([k]) => k.sign() < 0);
  if (iNeg >= 0) {
    const flipped = list.map(([k, pw], i) => [i === iNeg ? k.neg() : k, pw]);
    out.push({ form: collected(flipped), category: 'sign_error', fb: 'Ein Minuszeichen ist verloren gegangen. Das Rechenzeichen gehört zum Glied dahinter.' });
  }
  const xs = list.filter(([, pw]) => pw === 1).map(([k]) => k);
  out.push({ form: [xs.reduce((a, b) => a.mul(b)), c], category: 'concept_confusion', fb: 'Gleichartige Glieder werden addiert, nicht multipliziert: $3x+2x=5x$.' });
  out.push({ form: [m, c.neg()], category: 'sign_error', fb: 'Prüfe das Vorzeichen der Zahl. Setze zur Kontrolle $x=0$ ein.' });
  return out;
}
/** Equivalent forms of a summand list, other than the list itself. */
function rightForms(list) {
  const [m, c] = collected(list);
  const xs = list.filter(([, pw]) => pw === 1);
  return [
    { terms: [[m, 1], [c, 0]] },
    { terms: [[c, 0], [m, 1]] },
    { terms: [xs[1], [c, 0], xs[0]] },
  ];
}

/**
 * Template ch1.terms.collect_like.equivalence_check (family equivalence_check)
 * Levels
 *  L1 Grundlagen    two terms with positive whole coefficients: gleichwertig – ja oder nein?
 *  L2 Standard      multiple select: which of four terms are equivalent to a sum (negative coefficients, 1–3 right).
 *  L3 Anspruchsvoll like L2 with decimal coefficients (halves).
 *  L4 Transfer      judge an argument „one substituted value is equal, so the terms are equivalent“ — one equal
 *                   value proves nothing; one different value disproves; collecting proves.
 * Misconceptions: merge_unlike (3x + 2 → 5x), lost_minus, multiply_like (3x + 2x → 6x),
 *  one_value_proof (equality at one value taken as proof).
 */
const equivalenceCheck = {
  id: `${SKILL}.equivalence_check`, version: 1, skillId: SKILL,
  families: ['equivalence_check'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Zwei Terme mit positiven ganzen Zahlen: gleichwertig – ja oder nein?',
    2: 'Mehrfachauswahl: Welche von vier Termen sind gleichwertig zu einer Summe? Negative Koeffizienten.',
    3: 'Wie Stufe 2, mit Dezimalzahlen (Halbe) als Koeffizienten.',
    4: 'Eine Begründung beurteilen: Ein gleicher Wert beim Einsetzen beweist keine Gleichwertigkeit.',
  },
  misconceptions: ['merge_unlike', 'lost_minus', 'one_value_proof'],
  sample(rng, level) {
    if (level === 4) {
      const eq = rng.bool();
      const m1 = rng.intExcept(-6, 9, [0]), c1 = rng.intExcept(-12, 12, [0]);
      const x0 = rng.int(1, 5);
      let m2 = m1, c2 = c1;
      if (!eq) { m2 = rng.intExcept(-6, 9, [0, m1]); c2 = c1 + (m1 - m2) * x0; }
      const split = (m, c) => { const a = rng.intExcept(-9, 9, [0, m]); const k = rng.intExcept(-12, 12, [0, c]); return rng.shuffle([[F(a), 1], [F(m - a), 1], [F(k), 0], [F(c - k), 0]]); };
      return { level, eq, x0, t1: split(m1, c1), t2: split(m2, c2), x1: x0 === 5 ? 2 : x0 + 1, order: rng.uint32() };
    }
    const dec = level === 3;
    const list = summands(rng, level, dec);
    if (level === 1) {
      const wantEq = rng.bool();
      return { level, dec, list, wantEq, pickR: rng.int(0, 2), pickW: rng.int(0, 3), order: rng.uint32() };
    }
    const nRight = rng.int(1, 3);
    return { level, dec, list, nRight, right: rng.shuffle([0, 1, 2]).slice(0, nRight).sort(), wrong: rng.shuffle([0, 1, 2, 3]).slice(0, 4 - nRight).sort(), order: rng.uint32() };
  },
  signatureParams(p) {
    if (p.level === 4) return { eq: p.eq, x0: p.x0, t1: p.t1, t2: p.t2 };
    if (p.level === 1) return { list: p.list, wantEq: p.wantEq, pickR: p.pickR, pickW: p.pickW };
    return { list: p.list, right: p.right, wrong: p.wrong };
  },
  /** Options for L2/L3 (and the second term for L1) with metadata. */
  pieces(p) {
    p = norm(p);
    const R = rightForms(p.list).map(r => ({ ...r, ok: true }));
    const W = wrongForms(p.list).map(w => ({ terms: [[w.form[0], 1], [w.form[1], 0]], category: w.category, fb: w.fb, ok: false }));
    return { R, W };
  },
  l4Options(p) {
    p = norm(p);
    const v = (t, x) => U.evalMachine(M(p, t), { x: F(x) });
    const [m1, c1] = collected(p.t1);
    const list = [
      { key: 'counter', ok: !p.eq },
      { key: 'one_value', ok: false, category: 'concept_confusion', fb: 'Ein gleicher Wert kann Zufall sein. Gleichwertig heißt: für jede Zahl derselbe Wert.' },
      { key: 'looks', ok: false, category: 'concept_confusion', fb: 'Gleichwertige Terme können verschieden aussehen, z. B. $2x+x$ und $3x$.' },
      { key: 'collect', ok: p.eq },
    ];
    for (const o of list) {
      if (o.key === 'counter') {
        o.text = p.eq ? `Nein. Für $x=${p.x1}$ ergeben sich verschiedene Werte.`
          : `Nein. Für $x=${p.x1}$ hat der erste Term den Wert ${$(numTex(v(p.t1, p.x1)))}, der zweite den Wert ${$(numTex(v(p.t2, p.x1)))}.`;
        if (p.eq) { o.category = 'concept_confusion'; o.fb = `Rechne nach: Für $x=${p.x1}$ haben beide Terme den Wert ${$(numTex(v(p.t1, p.x1)))}.`; }
      } else if (o.key === 'one_value') o.text = 'Ja. Ein gleicher Wert beim Einsetzen reicht als Begründung.';
      else if (o.key === 'looks') o.text = 'Nein. Gleichwertige Terme müssen genau gleich aussehen.';
      else {
        o.text = `Ja. Fasst man beide Terme zusammen, erhält man jeweils ${$(tex(M(p, [[m1, 1], [c1, 0]])))}.`;
        if (!p.eq) { o.category = 'concept_confusion'; o.fb = 'Fasse den zweiten Term selbst zusammen und vergleiche.'; }
      }
    }
    return arrange(list, p.order);
  },
  constraints(p) {
    p = norm(p);
    if (p.level === 4) {
      for (const t of [p.t1, p.t2]) if (t.some(([k]) => k.isZero())) return 'zero summand';
      const [m1, c1] = collected(p.t1), [m2, c2] = collected(p.t2);
      if (p.eq !== sameForm([m1, c1], [m2, c2])) return 'equivalence flag mismatch';
      if (M(p, p.t1) === M(p, p.t2)) return 'identical terms';
      if (Math.abs(Number(c2.n)) > 40) return 'constant too large';
      return true;
    }
    if (p.list.some(([k]) => k.isZero())) return 'zero summand';
    const [m, c] = collected(p.list);
    if (m.isZero() || c.isZero()) return 'collected form degenerate';
    const { R, W } = this.pieces(p);
    const task = M(p, p.list);
    const shown = p.level === 1 ? [p.wantEq ? R[p.pickR] : W[Math.min(p.pickW, W.length - 1)]] : [...p.right.map(i => R[i]), ...p.wrong.map(i => W[i])];
    if (shown.some(s => !s)) return 'missing form';
    const texts = shown.map(s => M(p, s.terms));
    if (new Set([task, ...texts]).size !== texts.length + 1) return 'duplicate texts';
    for (const s of shown.filter(x => !x.ok)) if (sameForm(collected(s.terms), [m, c])) return 'wrong form is equivalent';
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
      if (!shown[i].ok && !shown[j].ok && sameForm(collected(shown[i].terms), collected(shown[j].terms))) return 'two wrong forms coincide';
    }
    return true;
  },
  build(p, level) {
    p = norm(p);
    if (level === 4) {
      const opts = this.l4Options(p);
      const options = opts.map((o, i) => ({ id: IDS[i], text: o.text, ...(o.ok ? {} : { category: o.category, feedback: o.fb }) }));
      const correct = IDS[opts.findIndex(o => o.ok)];
      const t1 = $(tex(M(p, p.t1))), t2 = $(tex(M(p, p.t2)));
      const v0 = U.evalMachine(M(p, p.t1), { x: F(p.x0) });
      const [m1, c1] = collected(p.t1), [m2, c2] = collected(p.t2);
      const steps = [
        `Erster Term zusammengefasst: ${$(tex(M(p, [[m1, 1], [c1, 0]])))}. Zweiter Term zusammengefasst: ${$(tex(M(p, [[m2, 1], [c2, 0]])))}.`,
        p.eq ? 'Beide Terme haben dieselbe zusammengefasste Form. Sie sind gleichwertig – das zeigt das Zusammenfassen, nicht die eine Einsetzung.'
          : `Die zusammengefassten Terme sind verschieden. Für $x=${p.x0}$ passt es nur zufällig; für $x=${p.x1}$ ergeben sich verschiedene Werte. Also sind die Terme nicht gleichwertig.`,
        `Richtige Antwort: ${opts.find(o => o.ok).text}`,
      ];
      return {
        prompt: `Jan setzt $x=${p.x0}$ in die Terme ${t1} und ${t2} ein. Beide Male erhält er ${$(numTex(v0))}. Er sagt: „Die Terme sind gleichwertig.“ Welche Antwort ist richtig?`,
        instructions: 'Wähle die richtige Antwort aus.',
        answer: { type: 'choice', options, correct, canonical: correct },
        hints: hints(
          'Gleichwertig bedeutet: Für jede Zahl, die man für $x$ einsetzt, haben beide Terme denselben Wert.',
          'Fasse beide Terme zusammen. Gleiche zusammengefasste Terme sind gleichwertig. Ein einziges Gegenbeispiel zeigt, dass sie es nicht sind.',
          `Setze eine andere Zahl ein, z. B. $x=${p.x1}$, und vergleiche die Werte.`,
          steps,
          'Denke an zwei Geraden in einem Schaubild: Sie können sich in einem Punkt schneiden, ohne gleich zu sein. Ein gemeinsamer Wert ist so ein Schnittpunkt.'),
        solution: { steps, result: opts.find(o => o.ok).text },
      };
    }
    const task = M(p, p.list);
    const [m, c] = collected(p.list);
    const coll = M(p, [[m, 1], [c, 0]]);
    const steps = [
      `Ordne nach gleichartigen Gliedern und fasse zusammen: ${$(`${tex(task)} = ${tex(coll)}`)}.`,
      'Ein Term ist gleichwertig, wenn er zusammengefasst dasselbe ergibt.',
    ];
    const { R, W } = this.pieces(p);
    const help = hints(
      'Gleichwertige Terme haben für jede Zahl denselben Wert. Sie können verschieden aussehen.',
      'Fasse jeden Term zusammen: Glieder mit $x$ zusammen, Zahlen zusammen. Dann vergleiche.',
      `Der gegebene Term zusammengefasst: ${$(tex(coll))}.`,
      steps,
      'Kontrolle durch Einsetzen: Setze $x=0$ und $x=1$ ein. Haben zwei Terme bei einer Zahl verschiedene Werte, sind sie nicht gleichwertig.');
    if (level === 1) {
      const other = p.wantEq ? R[p.pickR] : W[Math.min(p.pickW, W.length - 1)];
      const otherM = M(p, other.terms);
      const options = [
        { id: 'ja', text: 'Ja, die Terme sind gleichwertig.', ...(p.wantEq ? {} : { category: other.category, feedback: other.fb }) },
        { id: 'nein', text: 'Nein, die Terme sind nicht gleichwertig.', ...(p.wantEq ? { category: 'concept_confusion', feedback: `Fasse den ersten Term zusammen: ${$(tex(coll))}. Das ist derselbe Term, nur anders geschrieben.` } : {}) },
      ];
      const correct = p.wantEq ? 'ja' : 'nein';
      const sol = [...steps, `Der zweite Term ${$(tex(otherM))} ist ${p.wantEq ? '' : 'nicht '}gleichwertig.`];
      return {
        prompt: `Sind die Terme ${$(tex(task))} und ${$(tex(otherM))} gleichwertig?`,
        instructions: 'Wähle aus.',
        answer: { type: 'choice', options, correct, canonical: correct },
        hints: help.map(h => (h.kind === 'solution' ? { ...h, text: sol.join(' \u2003 ') } : h)),
        solution: { steps: sol, result: options.find(o => o.id === correct).text },
      };
    }
    const shown = arrange([...p.right.map(i => R[i]), ...p.wrong.map(i => W[i])], p.order);
    const options = shown.map((s, i) => ({ id: IDS[i], text: $(tex(M(p, s.terms))), ...(s.ok ? {} : { category: s.category, feedback: s.fb }) }));
    const correct = shown.map((s, i) => (s.ok ? IDS[i] : null)).filter(Boolean);
    const sol = [...steps, `Gleichwertig sind: ${correct.map(id => options.find(o => o.id === id).text).join(', ')}.`];
    return {
      prompt: `Welche Terme sind gleichwertig zu ${$(tex(task))}? Wähle alle passenden aus.`,
      instructions: 'Es können mehrere Antworten richtig sein.',
      answer: { type: 'multiselect', options, correct, canonical: correct },
      hints: help.map(h => (h.kind === 'solution' ? { ...h, text: sol.join(' \u2003 ') } : h)),
      solution: { steps: sol, result: correct.map(id => options.find(o => o.id === id).text).join(', ') },
    };
  },
  solve(p, level) {
    p = norm(p);
    const q = this.build(p, level);
    if (level === 4) {
      // decide with the expression engine, then check the values claimed in the counterexample option
      const a = M(p, p.t1), b = M(p, p.t2);
      const eq = U.equiv(a, b);
      if (eq) return q.answer.options.find(o => o.text.startsWith('Ja. Fasst'))?.id || null;
      const v1 = U.evalMachine(a, { x: F(p.x1) }), v2 = U.evalMachine(b, { x: F(p.x1) });
      if (v1.eq(v2)) return null;
      const want = `Nein. Für $x=${p.x1}$ hat der erste Term den Wert ${$(numTex(v1))}, der zweite den Wert ${$(numTex(v2))}.`;
      return q.answer.options.find(o => o.text === want)?.id || null;
    }
    const task = M(p, p.list);
    // recover each shown term from the tracked forms by its LaTeX text, then judge it with the expression engine
    const { R, W } = this.pieces(p);
    const byText = new Map([...R, ...W].map(s => [$(tex(M(p, s.terms))), M(p, s.terms)]));
    if (level === 1) {
      const other = /und (\$[^$]+\$) gleichwertig/.exec(q.prompt);
      const m = other && byText.get(other[1]);
      if (!m) return null;
      return U.equiv(task, m) ? 'ja' : 'nein';
    }
    return q.answer.options.filter(o => byText.has(o.text) && U.equiv(task, byText.get(o.text))).map(o => o.id);
  },
};

module.exports = [equivalenceCheck];
