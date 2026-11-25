'use strict';
/**
 * Skill ch1.terms.translate — Terme aufstellen (LS7 I.2).
 */
const U = require('../util');
const { F, hints, tex, $, polyMachine, numTex, exprDistractors, FACH, FACHEN } = U;

const SKILL = 'ch1.terms.translate';

/*
 * Each phrase pattern: text(p), value(p) machine answer, f(p, x) semantic value (written
 * independently of `value`), distractors(p), strategy(p), step(p).
 */
const fr = x => F(x);
const PATTERNS = {
  // ---- L1: one operation
  times: { level: 1, text: p => `das ${FACH[p.a]} von $x$`, value: p => `${p.a}x`, f: (p, x) => x.mul(p.a),
    dis: p => [{ value: `x+${p.a}`, category: 'concept_confusion', feedback: `„das ${FACH[p.a]}“ bedeutet „${p.a} mal“, nicht „plus ${p.a}“.` }],
    strategy: p => `„das ${FACH[p.a]} von …“ heißt: ${$(`${p.a}\\cdot`)} …`, step: () => 'Schreibe die Zahl vor die Variable.' },
  plus: { level: 1, text: p => `die Summe aus $x$ und $${p.b}$`, value: p => `x+${p.b}`, f: (p, x) => x.add(p.b),
    dis: p => [{ value: `${p.b}x`, category: 'concept_confusion', feedback: 'Eine Summe entsteht durch Addieren, nicht durch Multiplizieren.' }],
    strategy: () => '„Summe“ bedeutet: die beiden Teile werden addiert.', step: () => 'Verbinde $x$ und die Zahl mit „+“.' },
  more: { level: 1, text: p => `die Zahl, die um $${p.b}$ größer ist als $x$`, value: p => `x+${p.b}`, f: (p, x) => x.add(p.b),
    dis: p => [{ value: `${p.b}x`, category: 'concept_confusion', feedback: '„um … größer“ bedeutet addieren.' }],
    strategy: () => '„um … größer als“ bedeutet: zu $x$ wird etwas addiert.', step: () => 'Beginne mit $x$ und addiere die Zahl.' },
  less: { level: 1, text: p => `die Zahl, die um $${p.b}$ kleiner ist als $x$`, value: p => `x-${p.b}`, f: (p, x) => x.sub(p.b),
    dis: p => [{ value: `${p.b}-x`, category: 'concept_confusion', feedback: `„um ${p.b} kleiner als $x$“: Von $x$ wird ${p.b} abgezogen, also $x-${p.b}$.` }],
    strategy: () => '„um … kleiner als $x$“ bedeutet: von $x$ wird etwas abgezogen.', step: () => 'Beginne mit $x$, dann kommt das Minuszeichen.' },
  diffRev: { level: 1, text: p => `die Differenz aus $${p.b}$ und $x$`, value: p => `${p.b}-x`, f: (p, x) => fr(p.b).sub(x),
    dis: p => [{ value: `x-${p.b}`, category: 'concept_confusion', feedback: 'Bei „Differenz aus A und B“ steht A vorne: A − B.' }],
    strategy: () => '„Differenz aus A und B“ bedeutet A − B. Die Reihenfolge ist wichtig.', step: p => `Die erste genannte Zahl ist $${p.b}$. Sie steht vorne.` },
  quot: { level: 1, text: p => `der Quotient aus $x$ und $${p.a}$`, value: p => `x/${p.a}`, f: (p, x) => x.div(p.a),
    dis: p => [{ value: `${p.a}/x`, category: 'concept_confusion', feedback: '„Quotient aus A und B“ bedeutet A : B. Hier steht $x$ vorne.' }, { value: `${p.a}x`, category: 'concept_confusion', feedback: 'Quotient bedeutet Teilen, nicht Multiplizieren.' }],
    strategy: () => '„Quotient aus A und B“ bedeutet A geteilt durch B.', step: () => 'Schreibe $x$ als Zähler.' },
  half: { level: 1, text: () => 'die Hälfte von $x$', value: () => 'x/2', f: (p, x) => x.div(2),
    dis: () => [{ value: '2x', category: 'concept_confusion', feedback: 'Die Hälfte bedeutet: durch 2 teilen.' }],
    strategy: () => '„die Hälfte von“ bedeutet: durch 2 teilen.', step: () => 'Du kannst $x:2$, $\\frac{x}{2}$ oder $\\frac{1}{2}x$ schreiben.' },
  // ---- L2: two operations, order matters
  timesSum: { level: 2, text: p => `das ${FACH[p.a]} der Summe aus $x$ und $${p.b}$`, value: p => `${p.a}(x+${p.b})`, f: (p, x) => x.add(p.b).mul(p.a),
    dis: p => [{ value: `${p.a}x+${p.b}`, category: 'order_of_operations', feedback: 'Die ganze Summe wird vervielfacht – sie gehört in eine Klammer.' }],
    strategy: () => 'Was wird vervielfacht? Die ganze Summe. Also kommt die Summe in eine Klammer.', step: p => `Die Summe ist $(x+${p.b})$. Davon das ${FACH[p.a]}.` },
  sumTimes: { level: 2, text: p => `die Summe aus dem ${FACHEN[p.a]} von $x$ und $${p.b}$`, value: p => `${p.a}x+${p.b}`, f: (p, x) => x.mul(p.a).add(p.b),
    dis: p => [{ value: `${p.a}(x+${p.b})`, category: 'order_of_operations', feedback: 'Nur $x$ wird vervielfacht, danach wird addiert. Keine Klammer nötig.' }],
    strategy: () => 'Die Summe hat zwei Teile: „das …fache von $x$“ und die Zahl.', step: p => `Erster Teil: $${p.a}x$. Zweiter Teil: $${p.b}$.` },
  timesDiff: { level: 2, text: p => `das ${FACH[p.a]} der Differenz aus $x$ und $${p.b}$`, value: p => `${p.a}(x-${p.b})`, f: (p, x) => x.sub(p.b).mul(p.a),
    dis: p => [{ value: `${p.a}x-${p.b}`, category: 'order_of_operations', feedback: 'Die ganze Differenz wird vervielfacht – sie gehört in eine Klammer.' }, { value: `${p.a}(${p.b}-x)`, category: 'concept_confusion', feedback: 'Differenz aus $x$ und der Zahl: $x$ steht vorne.' }],
    strategy: () => 'Was wird vervielfacht? Die ganze Differenz – also Klammer.', step: p => `Die Differenz ist $(x-${p.b})$.` },
  lessTimes: { level: 2, text: p => `die Zahl, die um $${p.b}$ kleiner ist als das ${FACH[p.a]} von $x$`, value: p => `${p.a}x-${p.b}`, f: (p, x) => x.mul(p.a).sub(p.b),
    dis: p => [{ value: `${p.b}-${p.a}x`, category: 'concept_confusion', feedback: '„um … kleiner als“: Vom …fachen wird die Zahl abgezogen.' }, { value: `${p.a}(x-${p.b})`, category: 'order_of_operations', feedback: 'Erst vervielfachen, dann abziehen – ohne Klammer.' }],
    strategy: () => 'Zuerst das …fache von $x$ bilden, dann davon abziehen.', step: p => `Das ${FACH[p.a]} von $x$ ist $${p.a}x$.` },
  sumDiv: { level: 2, text: p => `die Summe aus $x$ und $${p.b}$, geteilt durch $${p.a}$`, value: p => `(x+${p.b})/${p.a}`, f: (p, x) => x.add(p.b).div(p.a),
    dis: p => [{ value: `x+${p.b}/${p.a}`, category: 'order_of_operations', feedback: 'Die ganze Summe wird geteilt – Klammer setzen oder Bruchstrich verwenden.' }],
    strategy: () => 'Zuerst die Summe bilden, dann die ganze Summe teilen.', step: p => `Die Summe ist $(x+${p.b})$.` },
  // ---- L3: figures described in words, three operations
  rectPerim: { level: 3, text: p => `Ein Rechteck ist $x$ cm breit und $${p.b}$ cm länger als breit. Gib einen Term für den Umfang in cm an.`, value: p => `2x+2(x+${p.b})`, f: (p, x) => x.mul(2).add(x.add(p.b).mul(2)),
    dis: p => [{ value: `x+(x+${p.b})`, category: 'concept_confusion', feedback: 'Ein Rechteck hat vier Seiten: je zwei gleich lange.' }, { value: `4x+${p.b}`, category: 'concept_confusion', feedback: 'Die Verlängerung kommt bei beiden langen Seiten vor.' }],
    strategy: () => 'Umfang = Summe aller vier Seiten. Stelle zuerst Terme für Breite und Länge auf.', step: p => `Breite: $x$, Länge: $x+${p.b}$.` },
  squarePerim: { level: 3, text: p => `Jede Seite eines Quadrats ist $${p.b}$ cm länger als $x$ cm. Gib einen Term für den Umfang in cm an.`, value: p => `4(x+${p.b})`, f: (p, x) => x.add(p.b).mul(4),
    dis: p => [{ value: `4x+${p.b}`, category: 'order_of_operations', feedback: 'Jede der vier Seiten ist länger – die Summe gehört in eine Klammer.' }],
    strategy: () => 'Ein Quadrat hat vier gleich lange Seiten.', step: p => `Eine Seite: $x+${p.b}$.` },
  isoTri: { level: 3, text: p => `Ein gleichschenkliges Dreieck hat die Basis $x$ cm. Jeder Schenkel ist $${p.b}$ cm länger als die Basis. Gib einen Term für den Umfang in cm an.`, value: p => `x+2(x+${p.b})`, f: (p, x) => x.add(x.add(p.b).mul(2)),
    dis: p => [{ value: `3x+${p.b}`, category: 'concept_confusion', feedback: 'Es gibt zwei Schenkel, beide sind länger als die Basis.' }, { value: `x+(x+${p.b})`, category: 'concept_confusion', feedback: 'Ein Dreieck hat drei Seiten: Basis und zwei Schenkel.' }],
    strategy: () => 'Umfang = Basis + zwei Schenkel.', step: p => `Ein Schenkel: $x+${p.b}$.` },
  rectMult: { level: 3, text: p => `Ein Rechteck ist $x$ cm breit. Die Länge ist das ${FACH[p.a]} der Breite. Gib einen Term für den Umfang in cm an.`, value: p => `2x+2*${p.a}x`, f: (p, x) => x.mul(2).add(x.mul(p.a).mul(2)),
    dis: p => [{ value: `x+${p.a}x`, category: 'concept_confusion', feedback: 'Ein Rechteck hat vier Seiten: je zwei gleich lange.' }],
    strategy: () => 'Umfang = 2 · Breite + 2 · Länge.', step: p => `Länge: $${p.a}x$.` },
  threeOps: { level: 3, text: p => `das ${FACH[p.a]} der Summe aus $x$ und $${p.b}$, vermindert um $${p.c}$`, value: p => `${p.a}(x+${p.b})-${p.c}`, f: (p, x) => x.add(p.b).mul(p.a).sub(p.c),
    dis: p => [{ value: `${p.a}x+${p.b}-${p.c}`, category: 'order_of_operations', feedback: 'Die ganze Summe wird vervielfacht – Klammer setzen.' }, { value: `${p.a}(x+${p.b}-${p.c})`, category: 'order_of_operations', feedback: 'Erst vervielfachen, dann um die Zahl vermindern.' }],
    strategy: () => 'Gehe von innen nach außen: Summe → vervielfachen → vermindern.', step: p => `Die Summe ist $(x+${p.b})$, davon das ${FACH[p.a]}: $${p.a}(x+${p.b})$.` },
};

/**
 * Template ch1.terms.translate.phrase_to_term (families: phrase_to_term, figure_to_term)
 * Levels
 *  L1 Grundlagen    one operation in words (Vielfaches, Summe, um … größer/kleiner, Differenz, Quotient, Hälfte).
 *  L2 Standard      two operations; the order (bracket or not) is decisive.
 *  L3 Anspruchsvoll perimeter of rectangle/square/isosceles triangle described in words; three operations.
 * Misconceptions: less_than_reversed („5 weniger als x“ → 5 − x), sum_product_confusion
 *  (Doppelte vs. „um 2 mehr“), missing bracket (order_of_operations), half perimeter.
 * Any equivalent term is accepted (form 'any'); the task is setting up, not simplifying.
 * Independent solver: each pattern's semantic function f is evaluated at x = 0, 1, 2 to obtain the
 * linear term m·x + c; that string must be accepted by the built answer spec.
 */
const phraseToTerm = {
  id: `${SKILL}.phrase_to_term`, version: 1, skillId: SKILL,
  families: ['phrase_to_term', 'figure_to_term'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Eine Rechenoperation in Worten.',
    2: 'Zwei Rechenoperationen; ob eine Klammer nötig ist, entscheidet.',
    3: 'Umfang von Figuren in Worten beschrieben; drei Rechenoperationen.',
  },
  misconceptions: ['less_than_reversed', 'sum_product_confusion'],
  sample(rng, level) {
    const keys = Object.keys(PATTERNS).filter(k => PATTERNS[k].level === level);
    return { pattern: rng.pick(keys), a: rng.int(2, 9), b: rng.int(2, 15), c: rng.int(1, 12) };
  },
  constraints(p) {
    if (p.pattern === 'threeOps' && p.c === p.b) return 'c equals b';
    return true;
  },
  build(p, level) {
    const P = PATTERNS[p.pattern];
    const value = P.value(p);
    const x10 = P.f(p, F(10));
    const prompt = level === 3 ? P.text(p) : `Schreibe als Term mit der Variablen $x$: ${P.text(p)}.`;
    const steps = [P.step(p), `Term: ${$(tex(value))}`];
    return {
      prompt,
      instructions: 'Jeder gleichwertige Term ist richtig. Malpunkte darfst du weglassen, z. B. 3x.',
      answer: { type: 'expression', value, canonical: value, variables: ['x'], form: 'any', distractors: exprDistractors(value, P.dis(p)) },
      hints: hints(
        level === 3 ? 'Übersetze die Beschreibung in Seitenlängen und addiere alle Seiten.' : 'Übersetze den Text Stück für Stück in Rechenzeichen. Achte darauf, was zuerst gerechnet wird.',
        P.strategy(p), P.step(p), steps,
        `Teste deinen Term mit einer Zahl: Für $x=10$ muss er den Wert ${$(numTex(x10))} haben.`),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) {
    const P = PATTERNS[p.pattern];
    const c = P.f(p, F(0)), m = P.f(p, F(1)).sub(c);
    if (!P.f(p, F(2)).eq(c.add(m.mul(2)))) return null;
    return polyMachine([[m, 1], [c, 0]]);
  },
};

/**
 * Template ch1.terms.translate.sequence_to_term (family sequence_to_term)
 * Sequence a_n = m·n + c, n = 1, 2, 3, …; variable n.
 * Levels
 *  L1 Grundlagen    one operation: multiples m·n or shifted counting n + c.
 *  L2 Standard      m·n + c with c ≠ 0 (first term ≥ 1).
 *  L3 Anspruchsvoll decreasing sequences (m < 0) or the n-th odd / even number.
 *  L4 Transfer      multiselect: which of several different-looking terms describe the sequence
 *                   (equivalent forms vs. off-by-one / swapped roles).
 * Misconceptions: step added instead of multiplied (n + m), off-by-one (m·n + a₁).
 * Independent solver: brute-force check of every candidate term against the first five members.
 */
const sequenceToTerm = {
  id: `${SKILL}.sequence_to_term`, version: 1, skillId: SKILL,
  families: ['sequence_to_term'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Eine Rechenoperation: Vielfachenfolgen m·n oder verschobene Folgen n + c.',
    2: 'm·n + c mit c ≠ 0.',
    3: 'Fallende Folgen oder die n-te gerade/ungerade Zahl.',
    4: 'Mehrfachauswahl: Welche verschieden aussehenden Terme beschreiben dieselbe Folge?',
  },
  misconceptions: ['step_added', 'off_by_one'],
  sample(rng, level) {
    if (level === 1) return rng.bool() ? { kind: 'mult', m: rng.int(2, 20), c: 0 } : { kind: 'shift', m: 1, c: rng.int(1, 20) };
    if (level === 2) { const m = rng.int(2, 9); return { kind: 'lin', m, c: rng.intExcept(1 - m, 12, [0]) }; }
    if (level === 3) {
      const kind = rng.pick(['dec', 'dec', 'odd', 'even']);
      if (kind === 'odd') return { kind, m: 2, c: -1 };
      if (kind === 'even') return { kind, m: 2, c: 0 };
      const m = -rng.int(2, 7);
      return { kind, m, c: rng.int(-5 * m + 1, -5 * m + 20) };
    }
    const m = rng.intExcept(-6, 9, [0, 1, -1]);
    return { kind: 'multi', m, c: m > 0 ? rng.intExcept(1 - m, 12, [0]) : rng.int(-5 * m + 1, -5 * m + 15), order: rng.uint32() };
  },
  signatureParams(p) { return { kind: p.kind, m: p.m, c: p.c }; },
  seq(p, k = 5) { return Array.from({ length: k }, (_, i) => p.m * (i + 1) + p.c); },
  termM(p) { return polyMachine([[p.m, 1], [p.c, 0]], { v: 'n' }); },
  candidates(p) {
    const a1 = p.m + p.c;
    const right = [
      { m: polyMachine([[p.m, 1], [p.c, 0]], { v: 'n' }) },
      { m: `${p.m}(n-1)+${a1}` },
      { m: `${polyMachine([[p.c, 0]], { v: 'n' })}${p.m < 0 ? '-' : '+'}${Math.abs(p.m)}n` },
    ];
    const wrong = [
      { m: polyMachine([[p.m, 1], [a1, 0]], { v: 'n' }), fb: 'Prüfe mit $n=1$: Der Term muss die erste Zahl ergeben.' },
      { m: polyMachine([[1, 1], [p.m, 0]], { v: 'n' }), fb: 'Der Abstand gehört als Faktor vor $n$, er wird nicht addiert.' },
      { m: polyMachine([[a1, 1], [p.m, 0]], { v: 'n' }), fb: 'Erste Zahl und Abstand sind vertauscht.' },
    ];
    return { right, wrong };
  },
  constraints(p, level) {
    const s = this.seq(p);
    if (s[0] < 1) return 'first member < 1';
    if (level === 3 && p.kind === 'dec' && s[4] < 1) return 'members not positive';
    if (level === 4) {
      const { right, wrong } = this.candidates(p);
      const texts = [...right, ...wrong].map(c => tex(c.m));
      if (new Set(texts).size !== texts.length) return 'duplicate option texts';
      for (const w of wrong) if (U.equiv(w.m, right[0].m, ['n'])) return 'wrong option equivalent';
    }
    return true;
  },
  build(p, level) {
    const s = this.seq(p);
    const seqTex = `${$(`${s.slice(0, 4).join(';\\ ')};\\ \\ldots`)}.`;
    const term = this.termM(p);
    const a1 = s[0];
    const mn = tex(polyMachine([[p.m, 1]], { v: 'n' }));
    const corr = p.c === 0 ? 'Es ist keine Korrektur nötig.'
      : `Du musst also noch ${$(String(Math.abs(p.c)))} ${p.c > 0 ? 'addieren' : 'subtrahieren'}.`;
    const steps = [
      `Von Zahl zu Zahl ändert sich der Wert um ${$(numTex(p.m))}. Also steht ${$(mn)} im Term.`,
      `Für $n=1$ ergibt ${$(mn)} den Wert ${$(String(p.m))}; die erste Zahl ist ${$(String(a1))}. ${corr}`,
      `Term: ${$(tex(term))}`,
    ];
    const strategy = 'Bestimme den Abstand zwischen zwei aufeinanderfolgenden Zahlen. Er wird mit $n$ multipliziert.';
    const alt = `Lege eine Tabelle an: In der ersten Zeile $n = 1;\\ 2;\\ 3;\\ 4$, darunter die Zahlen der Folge. Vergleiche jede Zahl mit ${$(mn)}.`;
    const orientation = p.kind === 'odd' ? 'Gesucht ist ein Term für die $n$-te ungerade Zahl. Ungerade Zahlen liegen genau 1 neben geraden Zahlen.'
      : p.kind === 'even' ? 'Gesucht ist ein Term für die $n$-te gerade Zahl. Gerade Zahlen sind Vielfache von 2.'
        : 'Gesucht ist ein Term, der für $n=1$ die erste Zahl, für $n=2$ die zweite Zahl usw. liefert.';
    const step = `Für $n=1$ muss der Term ${$(String(a1))} ergeben, für $n=2$ den Wert ${$(String(s[1]))}.`;
    if (level === 4) {
      const { right, wrong } = this.candidates(p);
      const pickedRight = [right[1], right[2]];
      const all = [...pickedRight.map(c => ({ ...c, ok: true })), ...wrong.slice(0, 2).map(c => ({ ...c, ok: false }))];
      const keyed = all.map((c, i) => ({ c, k: (p.order ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0 })).sort((x, y) => x.k - y.k).map(o => o.c);
      const ids = ['a', 'b', 'c', 'd'];
      const options = keyed.map((c, i) => ({ id: ids[i], text: $(tex(c.m)), ...(c.ok ? {} : { category: 'concept_confusion', feedback: c.fb }) }));
      const correct = keyed.map((c, i) => (c.ok ? ids[i] : null)).filter(Boolean);
      const sol = [...steps, `Die richtigen Terme sind gleichwertig zu ${$(tex(term))}: ${correct.map(id => options.find(o => o.id === id).text).join(' und ')}.`];
      return {
        prompt: `Eine Zahlenfolge beginnt mit ${seqTex} Welche Terme beschreiben die $n$-te Zahl der Folge? Wähle alle passenden aus.`,
        instructions: 'Es können mehrere Antworten richtig sein.',
        answer: { type: 'multiselect', options, correct, canonical: correct },
        hints: hints(orientation, 'Setze $n=1$, $n=2$ und $n=3$ in jeden Term ein und vergleiche mit der Folge.', step, sol,
          'Du kannst jeden Term auch vereinfachen (ausmultiplizieren, zusammenfassen) und mit dem einfachsten Term vergleichen.'),
        solution: { steps: sol, result: correct.map(id => options.find(o => o.id === id).text).join(', ') },
      };
    }
    const dis = [
      { value: polyMachine([[1, 1], [p.m, 0]], { v: 'n' }), category: 'concept_confusion', feedback: 'Der Abstand gehört als Faktor vor $n$, er wird nicht addiert.' },
      { value: polyMachine([[p.m, 1], [a1, 0]], { v: 'n' }), category: 'concept_confusion', feedback: 'Prüfe mit $n=1$: Der Term muss die erste Zahl ergeben.' },
    ];
    const kindText = p.kind === 'odd' ? 'Die ungeraden Zahlen' : p.kind === 'even' ? 'Die geraden Zahlen' : 'Eine Zahlenfolge';
    return {
      prompt: `${kindText} ${p.kind === 'odd' || p.kind === 'even' ? 'lauten' : 'beginnt mit'} ${seqTex} Gib einen Term für die $n$-te Zahl an.`,
      instructions: 'Verwende die Variable $n$ (Nummer der Zahl). Jeder gleichwertige Term ist richtig.',
      answer: { type: 'expression', value: term, canonical: term, variables: ['n'], form: 'any', distractors: exprDistractors(term, dis, ['n']) },
      hints: hints(orientation, strategy, step, steps, alt),
      solution: { steps, result: $(tex(term)) },
    };
  },
  solve(p, level) {
    const s = this.seq(p);
    const fits = m => s.every((v, i) => U.evalMachine(m, { n: F(i + 1) }).eq(v));
    if (level === 4) {
      const q = this.build(p, level);
      const { right, wrong } = this.candidates(p);
      const all = [...right, ...wrong];
      return q.answer.options.filter(o => { const c = all.find(cc => $(tex(cc.m)) === o.text); return c && fits(c.m); }).map(o => o.id);
    }
    // derive the term from the displayed members alone (difference and first member), then check all five
    const d = s[1] - s[0], c = s[0] - d;
    const cand = polyMachine([[d, 1], [c, 0]], { v: 'n' });
    return fits(cand) ? cand : null;
  },
};

module.exports = [phraseToTerm, sequenceToTerm];
