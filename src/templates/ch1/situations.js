'use strict';
/**
 * Skill ch1.terms.translate — two templates added in Session 12 (book alignment G7 + planned family):
 *   match_term_situation  assign a term to a situation (forward) or a situation to a term (reverse)
 *   think_of_number       „Denke dir eine Zahl …“ chains → term → relation between start and end number (G7, L4)
 *
 * All contexts and wordings are original (no textbook exercises).
 *
 * Independent solvers
 *  - match_term_situation: every variant has a semantic function f(p, x) written separately from its machine
 *    term; the solver evaluates the shown terms with the expression engine at x = 0…5 and compares with f.
 *  - think_of_number: the solver runs the chain on concrete start numbers 0, 1, 2 with exact fractions
 *    (an interpreter of the op list), derives m·x + c from these values and checks a fourth start number.
 *    `build` instead tracks the linear form symbolically.
 */
const U = require('../util');
const { F, hints, tex, $, polyMachine, numTex } = U;

const SKILL = 'ch1.terms.translate';
const IDS = ['a', 'b', 'c', 'd'];

/** Deterministic order from a uint32 key (presentation only; not part of the signature). */
function arrange(list, key) {
  return list.map((c, i) => ({ c, k: (key ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0 })).sort((x, y) => x.k - y.k).map(o => o.c);
}

// ---------------------------------------------------------------- contexts for match_term_situation
/*
 * Each context: x (meaning of the variable), level (min level), check(p) extra parameter constraint,
 * main: the situation asked about; wrong: three other situations in the same setting, each with
 * term (machine), f (semantic value), category and feedback (why it does not fit the main situation).
 */
const CONTEXTS = {
  bike: {
    x: '$x$ ist die Anzahl der Stunden, die man ein Fahrrad ausleiht.',
    unit: '€',
    check: p => p.a !== p.b,
    main: { story: p => `der Preis in €, wenn die Grundgebühr $${p.a}$ € beträgt und jede Stunde $${p.b}$ € kostet`, term: p => `${p.a}+${p.b}x`, f: (p, x) => x.mul(p.b).add(p.a) },
    wrong: [
      { story: p => `der Preis in €, wenn die Grundgebühr $${p.b}$ € beträgt und jede Stunde $${p.a}$ € kostet`, term: p => `${p.b}+${p.a}x`, f: (p, x) => x.mul(p.a).add(p.b),
        category: 'concept_confusion', fb: () => 'Grundgebühr und Preis pro Stunde sind vertauscht. Nur der Preis pro Stunde wird mit $x$ multipliziert.' },
      { story: p => `der Preis in €, wenn jede Stunde $${p.a}$ € Miete und $${p.b}$ € Helmgebühr kostet`, term: p => `(${p.a}+${p.b})x`, f: (p, x) => x.mul(p.a + p.b),
        category: 'order_of_operations', fb: () => 'Die Grundgebühr zahlt man nur einmal – sie wird nicht mit der Anzahl der Stunden multipliziert.' },
      { story: p => `der Preis in €, wenn es keine Grundgebühr gibt und jede Stunde $${p.b}$ € kostet`, term: p => `${p.b}x`, f: (p, x) => x.mul(p.b),
        category: 'concept_confusion', fb: p => `Die Grundgebühr von $${p.a}$ € fehlt im Term.` },
    ],
  },
  prepaid: {
    x: '$x$ ist die Anzahl der Anrufe mit einer Prepaid-Karte.',
    unit: '€',
    check: p => p.a > 4 * p.b,
    main: { story: p => `das Restguthaben in €, wenn die Karte mit $${p.a}$ € aufgeladen ist und jeder Anruf $${p.b}$ € kostet`, term: p => `${p.a}-${p.b}x`, f: (p, x) => F(p.a).sub(x.mul(p.b)) },
    wrong: [
      { story: p => `das Guthaben in €, wenn die Karte mit $${p.a}$ € aufgeladen ist und es für jeden Anruf $${p.b}$ € Bonus gibt`, term: p => `${p.a}+${p.b}x`, f: (p, x) => x.mul(p.b).add(p.a),
        category: 'sign_error', fb: () => 'Jeder Anruf verringert das Guthaben – die Kosten werden abgezogen, nicht addiert.' },
      { story: p => `die Kosten in € für $x$ Anrufe zu je $${p.b}$ €`, term: p => `${p.b}x`, f: (p, x) => x.mul(p.b),
        category: 'concept_confusion', fb: () => 'Dieser Term gibt nur die Kosten der Anrufe an, nicht das Guthaben, das übrig bleibt.' },
      { story: p => `das Restguthaben in €, wenn die Karte mit $${p.a}$ € aufgeladen ist und jeder Anruf $1$ € kostet`, term: p => `${p.a}-x`, f: (p, x) => F(p.a).sub(x),
        category: 'concept_confusion', fb: p => `Jeder Anruf kostet $${p.b}$ €. Deshalb muss $x$ mit $${p.b}$ multipliziert werden.` },
    ],
  },
  cinema: {
    x: '$x$ ist die Anzahl der Kinder einer Gruppe im Kino.',
    unit: '€',
    check: p => p.a !== p.b && p.b < p.a,
    main: { story: p => `der Gesamtpreis in €, wenn jedes Kind $${p.a}$ € Eintritt zahlt und die Gruppe einmal $${p.b}$ € für Popcorn ausgibt`, term: p => `${p.a}x+${p.b}`, f: (p, x) => x.mul(p.a).add(p.b) },
    wrong: [
      { story: p => `der Gesamtpreis in €, wenn jedes Kind $${p.a}$ € Eintritt und $${p.b}$ € für Popcorn zahlt`, term: p => `(${p.a}+${p.b})x`, f: (p, x) => x.mul(p.a + p.b),
        category: 'order_of_operations', fb: () => 'Das Popcorn wird nur einmal für die ganze Gruppe gekauft. Dieser Betrag wird nicht mit $x$ multipliziert.' },
      { story: p => `der Gesamtpreis in €, wenn jedes Kind und zusätzlich eine Begleitperson je $${p.a}$ € Eintritt zahlen`, term: p => `${p.a}(x+1)`, f: (p, x) => x.add(1).mul(p.a),
        category: 'concept_confusion', fb: p => `Hier zahlt eine weitere Person Eintritt. In der Situation kommen aber $${p.b}$ € für Popcorn dazu.` },
      { story: p => `der Gesamtpreis in €, wenn jedes Kind $${p.a}$ € Eintritt zahlt und jedes Kind $${p.b}$ € Rabatt bekommt`, term: p => `(${p.a}-${p.b})x`, f: (p, x) => x.mul(p.a - p.b),
        category: 'sign_error', fb: () => 'Popcorn kostet zusätzlich – es wird nichts abgezogen.' },
    ],
  },
  cookies: {
    x: '$x$ ist die Anzahl der Kekspackungen, die Tim hat.',
    unit: '',
    check: p => p.b < p.a,
    main: { story: p => `die Anzahl der Kekse, wenn in jeder Packung $${p.a}$ Kekse sind und Tim insgesamt $${p.b}$ Kekse isst`, term: p => `${p.a}x-${p.b}`, f: (p, x) => x.mul(p.a).sub(p.b) },
    wrong: [
      { story: p => `die Anzahl der Kekse, wenn in jeder Packung $${p.a}$ Kekse sind und Tim aus jeder Packung $${p.b}$ Kekse isst`, term: p => `(${p.a}-${p.b})x`, f: (p, x) => x.mul(p.a - p.b),
        category: 'order_of_operations', fb: p => `Tim isst insgesamt $${p.b}$ Kekse, nicht $${p.b}$ aus jeder Packung.` },
      { story: p => `die Anzahl der Kekse, wenn in jeder Packung $${p.a}$ Kekse sind und Tim noch $${p.b}$ einzelne Kekse dazulegt`, term: p => `${p.a}x+${p.b}`, f: (p, x) => x.mul(p.a).add(p.b),
        category: 'sign_error', fb: () => 'Gegessene Kekse fehlen danach – sie werden abgezogen.' },
      { story: p => `die Anzahl der Kekse, wenn in jeder Packung $${p.a}$ Kekse sind und Tim $${p.b}$ ganze Packungen verschenkt`, term: p => `${p.a}(x-${p.b})`, f: (p, x) => x.sub(p.b).mul(p.a),
        category: 'order_of_operations', fb: p => `Tim isst $${p.b}$ einzelne Kekse, nicht $${p.b}$ ganze Packungen. Ohne Klammer: erst $${p.a}x$, dann $${p.b}$ abziehen.` },
    ],
  },
  age: {
    x: '$x$ ist Bens Alter in Jahren.',
    unit: '',
    check: () => true,
    main: { story: p => `das Alter von Bens Mutter in $${p.b}$ Jahren, wenn sie jetzt $${p.a}$-mal so alt ist wie Ben`, term: p => `${p.a}x+${p.b}`, f: (p, x) => x.mul(p.a).add(p.b) },
    wrong: [
      { story: p => `das $${p.a}$-Fache von Bens Alter in $${p.b}$ Jahren`, term: p => `${p.a}(x+${p.b})`, f: (p, x) => x.add(p.b).mul(p.a),
        category: 'order_of_operations', fb: p => `Die $${p.b}$ Jahre kommen zum Alter der Mutter dazu. Sie werden nicht mit $${p.a}$ multipliziert – keine Klammer.` },
      { story: p => `Bens Alter in $${p.b}$ Jahren`, term: p => `x+${p.b}`, f: (p, x) => x.add(p.b),
        category: 'concept_confusion', fb: () => 'Gesucht ist das Alter der Mutter, nicht das Alter von Ben.' },
      { story: p => `das Alter von Bens Mutter vor $${p.b}$ Jahren, wenn sie jetzt $${p.a}$-mal so alt ist wie Ben`, term: p => `${p.a}x-${p.b}`, f: (p, x) => x.mul(p.a).sub(p.b),
        category: 'sign_error', fb: p => `In $${p.b}$ Jahren ist man älter – die Jahre werden addiert.` },
    ],
  },
};
const L1_CONTEXTS = ['bike', 'prepaid', 'cinema'];

const XS = [0, 1, 2, 3, 4, 5].map(F);
const sameFn = (f, g) => XS.every(x => f(x).eq(g(x)));

/**
 * Template ch1.terms.translate.match_term_situation (family match_term_situation)
 * Levels
 *  L1 Grundlagen    situation → term, 3 options; settings with a base amount plus/minus an amount per unit.
 *  L2 Standard      situation → term, 4 options; all settings including „in … Jahren“ and „ganze Packungen“,
 *                   so bracket / no bracket decides.
 *  L3 Anspruchsvoll reverse: term → situation, 4 descriptions in the same setting.
 * Misconceptions: one_time_amount_multiplied (a one-time amount multiplied by x, missing/unneeded bracket),
 *  sum_product_confusion (base fee and rate swapped), sign errors (adding what is used up).
 */
const matchTermSituation = {
  id: `${SKILL}.match_term_situation`, version: 1, skillId: SKILL,
  families: ['match_term_situation'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Situation → Term, drei Terme zur Auswahl (Grundbetrag plus/minus Betrag pro Stück).',
    2: 'Situation → Term, vier Terme zur Auswahl; ob eine Klammer nötig ist, entscheidet.',
    3: 'Umgekehrt: Zu einem Term die passende Situation auswählen.',
  },
  misconceptions: ['one_time_amount_multiplied', 'sum_product_confusion'],
  sample(rng, level) {
    const ctx = rng.pick(level === 1 ? L1_CONTEXTS : Object.keys(CONTEXTS));
    const a = rng.int(2, 9), b = rng.int(2, 9);
    const p = { ctx, a, b, dir: level === 3 ? 'reverse' : 'forward', order: rng.uint32() };
    if (ctx === 'prepaid') { p.a = rng.int(3, 8) * 5; p.b = rng.int(2, 3); }
    if (ctx === 'age') p.a = rng.int(2, 4);
    if (ctx === 'cookies') p.a = rng.int(6, 12);
    // L1: two of the three wrong situations
    p.wrong = level === 1 ? rng.shuffle([0, 1, 2]).slice(0, 2).sort() : [0, 1, 2];
    return p;
  },
  signatureParams(p) { return { ctx: p.ctx, a: p.a, b: p.b, dir: p.dir, wrong: p.wrong }; },
  candidates(p) {
    const C = CONTEXTS[p.ctx];
    const main = { ...C.main, ok: true };
    return arrange([main, ...p.wrong.map(i => ({ ...C.wrong[i], ok: false }))], p.order);
  },
  constraints(p) {
    const C = CONTEXTS[p.ctx];
    if (!C.check(p)) return 'context constraint';
    const fs = [C.main, ...p.wrong.map(i => C.wrong[i])].map(v => x => v.f(p, x));
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) if (sameFn(fs[i], fs[j])) return 'two situations give the same term';
    return true;
  },
  build(p, level) {
    const C = CONTEXTS[p.ctx];
    const cands = this.candidates(p);
    const ids = IDS.slice(0, cands.length);
    const correctId = ids[cands.findIndex(c => c.ok)];
    const mainTerm = C.main.term(p);
    const x2 = C.main.f(p, F(2));
    const unit = C.unit ? ` ${C.unit}` : '';
    const check2 = `Probe mit $x=2$: Der Term ${$(tex(mainTerm))} ergibt ${$(numTex(x2))}${unit}; das passt zur Situation.`;
    if (p.dir === 'forward') {
      const options = cands.map((c, i) => ({ id: ids[i], text: $(tex(c.term(p))), ...(c.ok ? {} : { category: c.category, feedback: c.fb(p) }) }));
      const steps = [
        'Überlege, welcher Betrag für jedes Stück (also $x$-mal) vorkommt und welcher Betrag nur einmal vorkommt.',
        `Hier: ${C.main.story(p)}.`,
        check2,
        `Passender Term: ${$(tex(mainTerm))}`,
      ];
      return {
        prompt: `${C.x} Gesucht ist ${C.main.story(p)}. Welcher Term passt?`,
        instructions: 'Wähle den passenden Term aus.',
        answer: { type: 'choice', options, correct: correctId, canonical: correctId },
        hints: hints(
          'Lies genau: Was wird für jedes Stück bezahlt oder verbraucht, und was nur einmal?',
          'Ein Betrag, der für jedes Stück anfällt, wird mit $x$ multipliziert. Ein einmaliger Betrag wird nur addiert oder subtrahiert.',
          'Setze eine Zahl für $x$ ein, z. B. $x=2$, und rechne die Situation im Kopf aus. Welcher Term liefert denselben Wert?',
          steps,
          'Stelle dir eine Tabelle vor: $x = 0;\\ 1;\\ 2$. Rechne für jede Zeile den Wert der Situation aus und vergleiche mit den Termen.'),
        solution: { steps, result: $(tex(mainTerm)) },
      };
    }
    const options = cands.map((c, i) => {
      const s = c.story(p);
      return { id: ids[i], text: s[0].toUpperCase() + s.slice(1), ...(c.ok ? {} : { category: c.category, feedback: `Zu dieser Beschreibung passt der Term ${$(tex(c.term(p)))}.` }) };
    });
    const steps = [
      `Im Term ${$(tex(mainTerm))} siehst du, welche Zahl mit $x$ multipliziert wird und welche nur einmal vorkommt.`,
      check2,
      `Passende Beschreibung: ${C.main.story(p)}.`,
    ];
    return {
      prompt: `${C.x} Welche Beschreibung passt zum Term ${$(tex(mainTerm))}?`,
      instructions: 'Wähle die passende Beschreibung aus.',
      answer: { type: 'choice', options, correct: correctId, canonical: correctId },
      hints: hints(
        'Zerlege den Term: Was wird mit $x$ multipliziert, was wird nur einmal addiert oder subtrahiert?',
        'Übersetze jede Beschreibung selbst in einen Term und vergleiche mit dem gegebenen Term.',
        'Setze $x=2$ in den Term ein. Rechne dann jede Beschreibung für $x=2$ aus.',
        steps,
        'Achte auf die Wörter „jede“, „insgesamt“, „einmal“: Sie entscheiden, ob mit $x$ multipliziert wird.'),
      solution: { steps, result: `${C.main.story(p)[0].toUpperCase()}${C.main.story(p).slice(1)}` },
    };
  },
  solve(p) {
    const C = CONTEXTS[p.ctx];
    const cands = this.candidates(p);
    let hits;
    if (p.dir === 'forward') {
      // the shown terms (parsed by the expression engine) against the semantic value of the asked situation
      hits = cands.map((c, i) => (XS.every(x => U.evalMachine(c.term(p), { x }).eq(C.main.f(p, x))) ? IDS[i] : null)).filter(Boolean);
    } else {
      const given = C.main.term(p);
      hits = cands.map((c, i) => (XS.every(x => U.evalMachine(given, { x }).eq(c.f(p, x))) ? IDS[i] : null)).filter(Boolean);
    }
    return hits.length === 1 ? hits[0] : null;
  },
};

// ---------------------------------------------------------------- think_of_number (G7)
const OP_TEXT = {
  mul: k => `Multipliziere sie mit $${k}$.`,
  mulR: k => `Multipliziere das Ergebnis mit $${k}$.`,
  add: k => `Addiere $${k}$.`,
  sub: k => `Subtrahiere $${k}$.`,
  div: k => `Teile das Ergebnis durch $${k}$.`,
  addX: () => 'Addiere die gedachte Zahl.',
  subX: () => 'Subtrahiere die gedachte Zahl.',
};
/** Symbolic step on the linear form [m, c] (used by build). */
function applyLinear([m, c], op) {
  switch (op.t) {
    case 'mul': return [m.mul(op.k), c.mul(op.k)];
    case 'add': return [m, c.add(op.k)];
    case 'sub': return [m, c.sub(op.k)];
    case 'div': return [m.div(op.k), c.div(op.k)];
    case 'addX': return [m.add(1), c];
    case 'subX': return [m.sub(1), c];
    default: throw new Error('bad op');
  }
}
/** Same chain with the typical error: × and : act on the x-part only (bracket forgotten). */
function applyForgetful([m, c], op) {
  if (op.t === 'mul') return [m.mul(op.k), c];
  if (op.t === 'div') return [m.div(op.k), c];
  return applyLinear([m, c], op);
}
/** Interpreter on a concrete start number (used by solve). */
function runChain(ops, start) {
  let v = F(start);
  for (const op of ops) {
    if (op.t === 'mul') v = v.mul(op.k);
    else if (op.t === 'add') v = v.add(op.k);
    else if (op.t === 'sub') v = v.sub(op.k);
    else if (op.t === 'div') v = v.div(op.k);
    else if (op.t === 'addX') v = v.add(start);
    else if (op.t === 'subX') v = v.sub(start);
  }
  return v;
}
const lin = (m, c) => polyMachine([[m, 1], [c, 0]]);
/** German statement for the relation start → end number „Ergebnis = m·x + c“. */
function relText(m, c) {
  m = F(m); c = F(c);
  const abs = $(numTex(c.abs()));
  if (m.isZero()) return `Das Ergebnis ist immer ${$(numTex(c))} – egal, welche Zahl man sich denkt.`;
  const base = m.eq(1) ? 'die gedachte Zahl' : m.eq(2) ? 'das Doppelte der gedachten Zahl' : m.eq(3) ? 'das Dreifache der gedachten Zahl' : `das ${$(numTex(m))}-Fache der gedachten Zahl`;
  const baseIst = m.eq(1) ? 'gleich der gedachten Zahl' : base;
  if (c.isZero()) return `Das Ergebnis ist ${baseIst}.`;
  return `Das Ergebnis ist um ${abs} ${c.sign() > 0 ? 'größer' : 'kleiner'} als ${base}.`;
}

/**
 * Template ch1.terms.translate.think_of_number (family phrase_to_term, L4 — book alignment G7)
 * A „Denke dir eine Zahl“ chain of 4–5 instructions (×, +, −, :, ± the thought number) whose end result is
 * m·x + c with m ∈ {0, 1, 2}. Two task kinds at L4 Transfer:
 *   term      set up the term for the end result and simplify it (form expanded)
 *   relation  choose the statement that describes the relation between start and end number
 * Misconceptions: bracket_forgotten_chain (× or : applied to the x-part only), one test number as proof
 *  (feedback asks for two start numbers), sign errors.
 */
const thinkOfNumber = {
  id: `${SKILL}.think_of_number`, version: 1, skillId: SKILL,
  families: ['phrase_to_term'],
  levels: [4],
  levelNotes: {
    4: '„Denke dir eine Zahl“: Rechenkette als Term aufstellen, vereinfachen und den Zusammenhang zwischen Start- und Endzahl beschreiben.',
  },
  misconceptions: ['bracket_forgotten_chain'],
  sample(rng) {
    const ops = [];
    const first = rng.int(1, 10) <= 7 ? { t: 'mul', k: rng.int(2, 5) } : { t: 'add', k: rng.int(2, 12) };
    ops.push(first);
    const n = rng.int(4, 5);
    let state = applyLinear([F(1), F(0)], first);
    while (ops.length < n) {
      const last = ops.length === n - 1;
      const choices = [];
      const prev = ops[ops.length - 1].t;
      if (prev !== 'add' && prev !== 'sub') choices.push('add', 'sub');
      if (prev !== 'mul' && prev !== 'div' && (state[0].abs().cmp(F(2)) <= 0)) choices.push('mul');
      const g = U.gcd(Number(state[0].isInteger() ? state[0].n : 0n), Number(state[1].isInteger() ? state[1].n : 0n));
      const ds = [];
      for (let d = 2; d <= Math.min(g, 6); d++) if (g % d === 0) ds.push(d);
      if (prev !== 'mul' && prev !== 'div' && ds.length && state[0].isInteger() && state[1].isInteger()) choices.push('div', 'div');
      if ((state[0].cmp(F(1)) >= 0) && prev !== 'addX' && prev !== 'subX') choices.push('subX', 'subX');
      if (prev !== 'addX' && prev !== 'subX' && (state[0].cmp(F(1)) <= 0)) choices.push('addX');
      if (last && (state[0].cmp(F(1)) >= 0) && prev !== 'subX' && prev !== 'addX' && rng.bool()) choices.splice(0, choices.length, 'subX');
      if (!choices.length) break;
      const t = rng.pick(choices);
      let op;
      if (t === 'add' || t === 'sub') op = { t, k: rng.int(1, 12) };
      else if (t === 'mul') op = { t, k: rng.int(2, 4) };
      else if (t === 'div') op = { t, k: rng.pick(ds) };
      else op = { t };
      ops.push(op);
      state = applyLinear(state, op);
    }
    return { ops, kind: rng.bool() ? 'term' : 'relation', order: rng.uint32() };
  },
  signatureParams(p) { return { ops: p.ops, kind: p.kind }; },
  states(p) {
    const out = [[F(1), F(0)]];
    for (const op of p.ops) out.push(applyLinear(out[out.length - 1], op));
    return out;
  },
  relationOptions(p) {
    const [m, c] = this.states(p).pop();
    let fz = [F(1), F(0)];
    for (const op of p.ops) fz = applyForgetful(fz, op);
    const pool = [
      { m, c, ok: true },
      { m: fz[0], c: fz[1], category: 'order_of_operations', fb: 'Beim Multiplizieren oder Teilen gilt das für das ganze Zwischenergebnis, nicht nur für den Teil mit der gedachten Zahl. Setze Klammern.' },
      { m: m.isZero() ? F(1) : F(0), c, category: 'concept_confusion', fb: 'Teste mit zwei verschiedenen Startzahlen, z. B. $1$ und $10$. Vergleiche die Ergebnisse.' },
      { m, c: c.neg(), category: 'sign_error', fb: 'Prüfe das Vorzeichen: Setze eine Startzahl ein und vergleiche das Ergebnis mit der Startzahl.' },
      { m: m.add(1), c, category: 'concept_confusion', fb: 'Teste mit einer Startzahl: Das Ergebnis passt nicht zu dieser Aussage.' },
      { m, c: c.add(1), category: 'concept_confusion', fb: 'Teste mit einer Startzahl: Das Ergebnis passt nicht zu dieser Aussage.' },
    ];
    const kept = [];
    for (const o of pool) {
      if (kept.some(k => k.m.eq(o.m) && k.c.eq(o.c))) continue;
      if (kept.length && relText(o.m, o.c) === relText(kept[0].m, kept[0].c)) continue;
      kept.push(o);
      if (kept.length === 4) break;
    }
    return arrange(kept, p.order);
  },
  constraints(p) {
    if (p.ops.length < 4) return 'chain too short';
    if (!p.ops.some(o => o.t === 'div' || o.t === 'subX' || o.t === 'addX')) return 'no trick step';
    const st = this.states(p);
    for (const [m, c] of st) if (!m.isInteger() || !c.isInteger()) return 'non-integer intermediate';
    const [m, c] = st[st.length - 1];
    if (!((m.cmp(F(0)) >= 0) && (m.cmp(F(2)) <= 0))) return 'end factor not 0..2';
    if (m.eq(1) && c.isZero()) return 'trivial chain';
    if ((c.abs().cmp(F(30)) > 0)) return 'constant too large';
    // every intermediate term must differ from the one before (no idle steps)
    for (let i = 1; i < st.length; i++) if (st[i][0].eq(st[i - 1][0]) && st[i][1].eq(st[i - 1][1])) return 'idle step';
    if (p.kind === 'relation') {
      const opts = this.relationOptions(p);
      if (opts.length < 4) return 'not enough distinct statements';
      if (new Set(opts.map(o => relText(o.m, o.c))).size !== 4) return 'duplicate statements';
    }
    return true;
  },
  build(p) {
    const st = this.states(p);
    const [m, c] = st[st.length - 1];
    const result = lin(m, c);
    const lines = ['Denke dir eine Zahl.', ...p.ops.map((op, i) => (op.t === 'mul' && i > 0 ? OP_TEXT.mulR(op.k) : OP_TEXT[op.t](op.k)))];
    // worked steps: term after each instruction, with the bracketed form where × or : act on a sum
    const steps = ['Die gedachte Zahl heißt $x$.'];
    for (let i = 0; i < p.ops.length; i++) {
      const op = p.ops[i], before = lin(...st[i]), after = lin(...st[i + 1]);
      const multiTerm = !st[i][1].isZero() && !st[i][0].isZero();
      let rawTex = null;
      if (op.t === 'mul') rawTex = multiTerm ? tex(`${op.k}(${before})`) : (st[i][0].isZero() ? `${op.k}\\cdot ${st[i][1].sign() < 0 ? `\\left(${tex(before)}\\right)` : tex(before)}` : null);
      else if (op.t === 'div') rawTex = multiTerm ? `\\left(${tex(before)}\\right):${op.k}` : `${tex(before)}:${op.k}`;
      else if (op.t === 'add') rawTex = tex(`${before}+${op.k}`);
      else if (op.t === 'sub') rawTex = tex(`${before}-${op.k}`);
      else if (op.t === 'addX') rawTex = tex(`${before}+x`);
      else rawTex = tex(`${before}-x`);
      const shown = rawTex && rawTex !== tex(after) ? `${rawTex} = ${tex(after)}` : tex(after);
      steps.push(`${lines[i + 1].replace(/\.$/, '')}: ${$(shown)}`);
    }
    steps.push(`Ergebnis: ${$(tex(result))}. ${relText(m, c)}`);
    const v1 = runChain(p.ops, 1), v10 = runChain(p.ops, 10);
    const alt = `Probiere zwei Startzahlen aus: Mit $1$ erhältst du ${$(numTex(v1))}, mit $10$ erhältst du ${$(numTex(v10))}. Eine Probe zeigt einen Zusammenhang, beweist ihn aber nicht – das macht erst der Term.`;
    const common = {
      promptLines: lines,
      hints: hints(
        'Nenne die gedachte Zahl $x$ und schreibe nach jedem Rechenschritt einen Term auf.',
        'Wenn ein ganzes Zwischenergebnis multipliziert oder geteilt wird, gehört es in eine Klammer. Vereinfache nach jedem Schritt.',
        `Nach dem ersten Schritt hast du ${$(tex(lin(...st[1])))}${p.ops.length > 1 ? `, nach dem zweiten ${$(tex(lin(...st[2])))}` : ''}.`,
        steps, alt),
    };
    if (p.kind === 'term') {
      let fz = [F(1), F(0)];
      for (const op of p.ops) fz = applyForgetful(fz, op);
      const dis = U.exprDistractors(result, [
        { value: lin(...fz), category: 'order_of_operations', feedback: 'Beim Multiplizieren oder Teilen gilt das für das ganze Zwischenergebnis. Setze Klammern.' },
        { value: lin(m, c.neg()), category: 'sign_error', feedback: 'Prüfe die Vorzeichen: Setze eine Startzahl ein und rechne die Anleitung nach.' },
      ]);
      return {
        prompt: 'Spiele den Zahlentrick mit der Variablen $x$ für die gedachte Zahl durch. Gib einen möglichst einfachen Term für das Ergebnis an.',
        instructions: 'Vereinfache den Term vollständig (keine Klammern, gleichartige Glieder zusammengefasst).',
        ...common,
        answer: { type: 'expression', value: result, canonical: U.polyInput([[m, 1], [c, 0]]), variables: ['x'], form: 'expanded', distractors: dis },
        solution: { steps, result: $(tex(result)) },
      };
    }
    const opts = this.relationOptions(p);
    const options = opts.map((o, i) => ({ id: IDS[i], text: relText(o.m, o.c), ...(o.ok ? {} : { category: o.category, feedback: o.fb }) }));
    const correctId = IDS[opts.findIndex(o => o.ok)];
    return {
      prompt: 'Untersuche den Zahlentrick. Welche Aussage über das Ergebnis ist für jede gedachte Zahl richtig?',
      instructions: 'Stelle zuerst einen Term für das Ergebnis auf und vereinfache ihn.',
      ...common,
      answer: { type: 'choice', options, correct: correctId, canonical: correctId },
      solution: { steps, result: relText(m, c) },
    };
  },
  solve(p) {
    // concrete runs with exact numbers; m and c from starts 0 and 1, checked at 2 and 7
    const v0 = runChain(p.ops, 0), v1 = runChain(p.ops, 1);
    const m = v1.sub(v0), c = v0;
    if (![2, 7].every(s => runChain(p.ops, s).eq(m.mul(s).add(c)))) return null;
    if (p.kind === 'term') return lin(m, c);
    const want = relText(m, c);
    const q = this.build(p);
    const hit = q.answer.options.filter(o => o.text === want);
    return hit.length === 1 ? hit[0].id : null;
  },
};

module.exports = [matchTermSituation, thinkOfNumber];
