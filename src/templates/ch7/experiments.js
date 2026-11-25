'use strict';
/**
 * Template ch7.prob.experiments.events for LS7 VII.2 „Zufallsexperimente“ (Bildungsplan 3.2.5(4) Ergebnis/Ereignis,
 * (5) Ereignisse in Mengenschreibweise). All experiments are original. Sets use semicolons (D67).
 * Levels
 *  L1 Grundlagen     Either the Ergebnismenge of an experiment (choice; family outcome_event: die, octahedron, wheel,
 *                    urn, colour wheel with unequal sectors, coin two or three times, sum of two dice) or tick the
 *                    outcomes that belong to an event in words (multiselect; family set_notation).
 *  L2 Standard       Choose the set that describes an event in words (traps: „größer als“ vs „mindestens“, 1 as a
 *                    prime, Teiler vs Vielfache, complement, the whole Ergebnismenge).
 *  L3 Anspruchsvoll  Combined events with „und“, „oder“, „nicht“ (traps: und/oder swapped, only the first condition,
 *                    complement).
 *  L4 Transfer       Reverse direction: a set is given; tick every description that fits (equivalent descriptions
 *                    such as „größer als 4“ = „mindestens 5“ are both correct).
 * Misconceptions: outcome_event_confusion, order_ignored (KZ = ZK), boundary (größer als vs mindestens),
 * prime_one, divisor_multiple, and_or.
 * Independent solver: every outcome tested with the event's predicate (Z.holds); build lists events constructively.
 */
const { hints } = require('../util');
const Z = require('./zufall');
const { setTex, sameSet } = Z;

const SKILL = 'ch7.prob.experiments';
const EXP = Z.NUM_EXPERIMENTS;
const COLORS = ['rot', 'blau', 'gelb', 'grün', 'weiß'];

// ---------------------------------------------------------------- Ergebnismengen (family outcome_event)
/** Omega tasks: (p) → {text, omega:[...], traps:[{set, feedback}]}. BUILD path: listed directly. */
function coinsOmega(k) { let out = ['']; for (let i = 0; i < k; i++) out = out.flatMap(s => [`${s}K`, `${s}Z`]); return out; }
const OMEGA = {
  num(p) {
    const e = EXP[p.e], all = Z.stepList(1, e.n, 1);
    return { text: `${e.text} Welche Menge ist die Ergebnismenge (die Menge aller möglichen Ergebnisse)?`, omega: all, traps: [
      { set: Z.stepList(0, e.n, 1), feedback: `Die ${e.what} $0$ kann nicht vorkommen.` },
      { set: all.slice(0, -1), feedback: 'Es fehlt ein mögliches Ergebnis.' },
      { set: Z.eventBuild(e.n, { kind: 'even' }), feedback: 'Das ist nur ein Ereignis (eine Teilmenge). Die Ergebnismenge enthält alle möglichen Ergebnisse.' }] };
  },
  coins(p) {
    const k = p.k, all = coinsOmega(k);
    const unordered = Z.stepList(0, k, 1).map(c => 'Z'.repeat(c).padStart(k, 'K'));
    return { text: `Eine Münze wird ${k === 2 ? 'zweimal' : 'dreimal'} nacheinander geworfen. Notiert wird die Folge, z. B. ${k === 2 ? 'KZ' : 'KZK'} (K für Kopf, Z für Zahl). Welche Menge ist die Ergebnismenge?`, omega: all, traps: [
      { set: unordered, feedback: `Die Reihenfolge zählt: ${k === 2 ? 'KZ und ZK' : 'KKZ, KZK und ZKK'} sind verschiedene Ergebnisse.` },
      { set: ['K', 'Z'], feedback: 'Das sind die Ergebnisse eines einzelnen Wurfs. Hier wird die ganze Folge notiert.' },
      { set: all.filter(s => s !== 'Z'.repeat(k) && s !== 'K'.repeat(k)), feedback: 'Auch „immer Kopf“ und „immer Zahl“ sind mögliche Ergebnisse.' }] };
  },
  colors(p) {
    const cols = p.cols, sectors = p.sectors;
    const desc = cols.map((c, i) => `${sectors[i]} ${sectors[i] === 1 ? 'Feld' : 'Felder'} ${c}`).join(', ');
    const repeated = cols.flatMap((c, i) => new Array(Math.min(sectors[i], 2)).fill(c));
    return { text: `Ein Glücksrad hat ${sectors.reduce((a, b) => a + b, 0)} gleich große Felder: ${desc}. Beobachtet wird die Farbe. Welche Menge ist die Ergebnismenge?`, omega: cols, traps: [
      { set: repeated, feedback: 'In einer Menge wird jedes Ergebnis nur einmal aufgeschrieben, auch wenn es auf mehreren Feldern steht.' },
      { set: cols.slice(1), feedback: `Es fehlt die Farbe ${cols[0]}.` },
      { set: [...cols, COLORS.find(c => !cols.includes(c))], feedback: 'Eine Farbe, die nicht auf dem Glücksrad steht, kann nicht vorkommen.' }] };
  },
  sum(p) {
    const all = Z.stepList(2, 12, 1);
    return { text: `Zwei faire Würfel werden geworfen. Beobachtet wird die Augensumme${p.v ? ' (die Summe beider Augenzahlen)' : ''}. Welche Menge ist die Ergebnismenge?`, omega: all, traps: [
      { set: Z.stepList(1, 12, 1), feedback: 'Mit zwei Würfeln ist die kleinste Augensumme $1+1 = 2$.' },
      { set: Z.stepList(2, 6, 1), feedback: 'Die größte Augensumme ist $6+6 = 12$.' },
      { set: Z.stepList(1, 6, 1), feedback: 'Das sind die Augenzahlen eines Würfels. Beobachtet wird die Summe.' }] };
  },
};
/** SOLVE path for Ω: brute force from the experiment's mechanics. */
function omegaSolve(p) {
  if (p.task === 'num') return Z.stepList(1, EXP[p.e].n, 1);
  if (p.task === 'coins') { const out = []; for (let m = 0; m < 2 ** p.k; m++) { let s = ''; for (let b = p.k - 1; b >= 0; b--) s += (m >> b) & 1 ? 'Z' : 'K'; out.push(s); } return out; }
  if (p.task === 'colors') return [...new Set(p.cols.flatMap((c, i) => new Array(p.sectors[i]).fill(c)))];
  const s = new Set(); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) s.add(a + b); return [...s];
}

// ---------------------------------------------------------------- events on numbers
const ALL_KINDS = ['even', 'odd', 'gt', 'ge', 'lt', 'le', 'mult', 'prime', 'divisor'];
function randomEvent(rng, n, kinds = ALL_KINDS) {
  const kind = rng.pick(kinds);
  return { kind, a: rng.pick(Z.kindParams(kind, n)) };
}
/** Sentence: „E: Die Augenzahl ist größer als 3.“ */
const evSentence = (e, ev) => `Die ${e.what} ist ${Z.eventAdj(ev)}.`;
/** Trap set for an event in words (L2). */
function trapFor(n, ev) {
  const B = x => Z.eventBuild(n, x);
  switch (ev.kind) {
    case 'gt': return { set: B({ kind: 'ge', a: ev.a }), feedback: `„Größer als ${ev.a}“ heißt: ${ev.a} selbst gehört nicht dazu.` };
    case 'ge': return { set: B({ kind: 'gt', a: ev.a }), feedback: `„Mindestens ${ev.a}“ heißt: ${ev.a} selbst gehört dazu.` };
    case 'lt': return { set: B({ kind: 'le', a: ev.a }), feedback: `„Kleiner als ${ev.a}“ heißt: ${ev.a} selbst gehört nicht dazu.` };
    case 'le': return { set: B({ kind: 'lt', a: ev.a }), feedback: `„Höchstens ${ev.a}“ heißt: ${ev.a} selbst gehört dazu.` };
    case 'prime': return { set: [1, ...B(ev)], feedback: '$1$ ist keine Primzahl: Eine Primzahl hat genau zwei Teiler.' };
    case 'mult': return { set: Z.stepList(1, Math.min(n, ev.a), 1).filter(d => ev.a % d === 0), feedback: `Das sind die Teiler von ${ev.a}. Gesucht sind die Zahlen, die durch ${ev.a} teilbar sind (Vielfache von ${ev.a}).` };
    case 'divisor': return { set: B(ev).filter(x => x !== 1), feedback: `Prüfe jede Zahl: Teilt sie ${ev.a} ohne Rest? Auch $1$ ist ein Teiler von ${ev.a}.` };
    default: return { set: Z.stepList(1, n, 1), feedback: 'Das ist die ganze Ergebnismenge, nicht nur das Ereignis.' };
  }
}
const complement = (n, set) => Z.stepList(1, n, 1).filter(x => !set.includes(x));
/** Combined event: BUILD path (set operations on constructive lists). */
function combBuild(n, c) {
  const A = Z.eventBuild(n, c.e1);
  if (c.op === 'nicht') return complement(n, A);
  const B = Z.eventBuild(n, c.e2);
  return c.op === 'und' ? A.filter(x => B.includes(x)) : Z.stepList(1, n, 1).filter(x => A.includes(x) || B.includes(x));
}
/** Combined event: SOLVE path (predicates). */
function combSolve(n, c) {
  return Z.stepList(1, n, 1).filter(x => (c.op === 'nicht' ? !Z.holds(x, c.e1) : c.op === 'und' ? Z.holds(x, c.e1) && Z.holds(x, c.e2) : Z.holds(x, c.e1) || Z.holds(x, c.e2)));
}
/** Negated adjective: „nicht gerade“, „keine Primzahl“, „kein Teiler von 12“. */
const notAdj = ev => { const a = Z.eventAdj(ev); return /^eine? /.test(a) ? `k${a}` : `nicht ${a}`; };
const combSentence = (e, c) => (c.op === 'nicht' ? `Die ${e.what} ist ${notAdj(c.e1)}.` : `Die ${e.what} ist ${Z.eventAdj(c.e1)} ${c.op} ${Z.eventAdj(c.e2)}.`);

/** Choice options from {set, feedback} candidates; drops duplicates and sets equal to the correct one. */
function setOptions(correct, traps, order) {
  const opts = [{ id: 'k', set: correct }];
  for (const t of traps) if (!opts.some(o => sameSet(o.set, t.set))) opts.push({ id: `t${opts.length}`, set: t.set, feedback: t.feedback });
  const ordered = order.map(i => opts[i]).filter(Boolean).concat(opts.filter((_, i) => !order.includes(i)));
  return ordered.map(o => (o.id === 'k' ? { id: o.id, text: setText(o.set) } : { id: o.id, text: setText(o.set), category: 'concept_confusion', feedback: o.feedback }));
}
/** Canonical display of a set: numbers ascending, words in code-point order (so equal sets print equally). */
const canon = set => set.slice().sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
const setText = set => `$${setTex(canon(set))}$`;
const listText = set => (set.length ? set.map(x => `$${Z.elTex(x)}$`).join(', ') : 'kein Ergebnis');

const events = {
  id: `${SKILL}.events`, version: 1, skillId: SKILL,
  families: ['outcome_event', 'set_notation'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Ergebnismenge auswählen (Würfel, Glücksrad, Münze mehrmals, Augensumme) oder die Ergebnisse eines Ereignisses ankreuzen.',
    2: 'Die passende Menge zu einem Ereignis in Worten wählen (Fallen: „größer als“/„mindestens“, 1 als Primzahl, Teiler/Vielfache).',
    3: 'Zusammengesetzte Ereignisse mit „und“, „oder“, „nicht“ als Menge angeben.',
    4: 'Umgekehrt: Zu einer gegebenen Menge alle passenden Beschreibungen ankreuzen (auch gleichwertige Beschreibungen).',
  },
  misconceptions: ['outcome_event_confusion', 'order_ignored', 'boundary', 'prime_one', 'divisor_multiple', 'and_or'],
  sample(rng, level) {
    const order = rng.shuffle([0, 1, 2, 3]);
    if (level === 1) {
      if (rng.int(0, 2) === 0) {
        const task = rng.pick(['num', 'num', 'coins', 'colors', 'colors', 'sum']);
        const p = { mode: 'omega', task, order };
        if (task === 'num') p.e = rng.int(0, EXP.length - 1);
        if (task === 'coins') p.k = rng.pick([2, 3]);
        if (task === 'colors') { p.cols = rng.shuffle(COLORS).slice(0, rng.pick([3, 4])); p.sectors = p.cols.map(() => rng.int(1, 4)); }
        if (task === 'sum') p.v = rng.int(0, 1);
        return p;
      }
      const ei = rng.int(0, 2);
      return { mode: 'members', e: ei, ev: randomEvent(rng, EXP[ei].n) };
    }
    const ei = rng.int(0, EXP.length - 1), n = EXP[ei].n;
    if (level === 2) return { mode: 'set', e: ei, ev: randomEvent(rng, n), order };
    if (level === 3) {
      const op = rng.pick(['und', 'und', 'oder', 'oder', 'nicht']);
      const e1 = randomEvent(rng, n), TH = ['gt', 'ge', 'lt', 'le'],
        e2 = randomEvent(rng, n, ALL_KINDS.filter(k => k !== e1.kind && !(TH.includes(e1.kind) && TH.includes(k)) && !(['even', 'odd'].includes(e1.kind) && ['even', 'odd'].includes(k))));
      return { mode: 'comb', e: ei, c: op === 'nicht' ? { op, e1 } : { op, e1, e2 }, order };
    }
    const ds = [0, 1, 2, 3].map(() => randomEvent(rng, n)), target = rng.int(0, 3);
    // often add an equivalent description of the same set (e.g. „größer als 4“ / „mindestens 5“)
    const tset = Z.eventBuild(n, ds[target]);
    const twins = ALL_KINDS.flatMap(kind => Z.kindParams(kind, n).map(a => ({ kind, a })))
      .filter(d => sameSet(Z.eventBuild(n, d), tset) && Z.eventAdj(d) !== Z.eventAdj(ds[target]));
    if (twins.length && rng.int(0, 2) > 0) ds[(target + 1) % 4] = rng.pick(twins);
    return { mode: 'reverse', e: ei, ds, target, order };
  },
  constraints(p, level) {
    if (p.mode === 'omega') return OMEGA[p.task](p).traps.length >= 2 ? true : 'traps';
    const n = EXP[p.e].n;
    if (p.mode === 'members' || p.mode === 'set') {
      const s = Z.eventBuild(n, p.ev);
      if (!s.length || s.length === n) return 'trivial event';
      if (p.mode === 'set' && sameSet(trapFor(n, p.ev).set, s)) return 'trap equals event';
      return true;
    }
    if (p.mode === 'comb') {
      const s = combBuild(n, p.c);
      if (!s.length || s.length === n) return 'trivial combined event';
      if (p.c.op !== 'nicht') {
        const other = combBuild(n, { ...p.c, op: p.c.op === 'und' ? 'oder' : 'und' });
        if (sameSet(other, s) || sameSet(Z.eventBuild(n, p.c.e1), s) || sameSet(Z.eventBuild(n, p.c.e2), s)) return 'combination not informative';
      }
      return true;
    }
    // reverse
    const sets = p.ds.map(d => Z.eventBuild(n, d)), t = sets[p.target];
    if (!t.length || t.length === n) return 'trivial target';
    if (new Set(p.ds.map(d => Z.eventAdj(d))).size < 4) return 'duplicate description';
    if (sets.every(s => sameSet(s, t))) return 'all descriptions fit';
    return true;
  },
  signatureParams(p) { const { order, ...rest } = p; return rest; },
  build(p, level) {
    if (p.mode === 'omega') {
      const o = OMEGA[p.task](p);
      const options = setOptions(o.omega, o.traps, p.order);
      const steps = [`Alle möglichen Ergebnisse: ${listText(canon(o.omega))}.`, `Ergebnismenge: ${setText(o.omega)}.`];
      return {
        prompt: o.text, instructions: 'Wähle eine Menge aus.',
        answer: { type: 'choice', options, correct: 'k', canonical: 'k' },
        hints: hints('Ein Ergebnis ist ein möglicher Ausgang des Zufallsexperiments. Die Ergebnismenge enthält alle Ergebnisse, jedes genau einmal.',
          'Überlege genau, was beobachtet wird, und zähle alle Möglichkeiten systematisch auf.',
          p.task === 'coins' ? 'Schreibe die Folgen geordnet auf: zuerst alle, die mit K beginnen, dann alle, die mit Z beginnen.' : 'Prüfe: Fehlt ein Ergebnis? Steht etwas in der Menge, das gar nicht vorkommen kann?',
          steps, 'Ein Ereignis ist eine Teilmenge der Ergebnismenge. Die Ergebnismenge selbst ist das sichere Ereignis.'),
        solution: { steps, result: `Ergebnismenge: ${setText(o.omega)}` },
      };
    }
    const e = EXP[p.e], n = e.n;
    if (p.mode === 'members') {
      const s = Z.eventBuild(n, p.ev);
      const options = Z.stepList(1, n, 1).map(x => ({ id: `o${x}`, text: `$${x}$` }));
      const correct = s.map(x => `o${x}`);
      const steps = [`Prüfe jede Zahl von $1$ bis $${n}$: Ist sie ${Z.eventAdj(p.ev)}?`, `E = $${setTex(s)}$.`];
      return {
        prompt: `${e.text} Ereignis E: ${evSentence(e, p.ev)} Welche Ergebnisse gehören zu E?`, instructions: 'Kreuze alle Ergebnisse an, die zu E gehören.',
        answer: { type: 'multiselect', options, correct, canonical: correct },
        hints: hints('Ein Ereignis fasst mehrere Ergebnisse zusammen. Es tritt ein, wenn eines seiner Ergebnisse eintritt.',
          `Gehe alle möglichen Ergebnisse $1$ bis $${n}$ der Reihe nach durch.`,
          `Zu E gehören ${s.length} Ergebnisse.`, steps, `Probe: Die übrigen Zahlen ${listText(complement(n, s))} sind nicht ${Z.eventAdj(p.ev)}.`),
        solution: { steps, result: `E = $${setTex(s)}$` },
      };
    }
    if (p.mode === 'set') {
      const s = Z.eventBuild(n, p.ev), trap = trapFor(n, p.ev);
      const traps = [trap, { set: complement(n, s), feedback: 'Das ist das Gegenereignis: Es enthält genau die Ergebnisse, die nicht zu E gehören.' },
        { set: Z.stepList(1, n, 1), feedback: 'Das ist die ganze Ergebnismenge. E enthält nur die passenden Ergebnisse.' }];
      const options = setOptions(s, traps, p.order);
      const steps = [`Ergebnismenge: $${setTex(Z.stepList(1, n, 1))}$.`, `Davon ${s.length === 1 ? 'passt' : 'passen'}: ${listText(s)}.`, `E = $${setTex(s)}$.`];
      return {
        prompt: `${e.text} Ereignis E: ${evSentence(e, p.ev)} Welche Menge beschreibt E?`, instructions: 'Wähle eine Menge aus.',
        answer: { type: 'choice', options, correct: 'k', canonical: 'k' },
        hints: hints('Ein Ereignis schreibt man als Menge der Ergebnisse, bei denen es eintritt.',
          'Schreibe zuerst die Ergebnismenge auf und streiche alle Ergebnisse, die nicht passen.',
          ['gt', 'ge', 'lt', 'le'].includes(p.ev.kind) ? `Achte auf die Grenze: Gehört $${p.ev.a}$ selbst dazu?` : `Prüfe jede Zahl einzeln: Ist sie ${Z.eventAdj(p.ev)}?`,
          steps, 'Kontrolle: Jede Zahl in deiner Menge muss die Beschreibung erfüllen, jede andere Zahl nicht.'),
        solution: { steps, result: `E = $${setTex(s)}$` },
      };
    }
    if (p.mode === 'comb') {
      const s = combBuild(n, p.c), A = Z.eventBuild(n, p.c.e1);
      const traps = p.c.op === 'nicht'
        ? [{ set: A, feedback: '„Nicht“ bedeutet: Es gehören genau die Ergebnisse dazu, die die Bedingung nicht erfüllen.' },
          { set: trapFor(n, p.c.e1).set.length < n ? complement(n, trapFor(n, p.c.e1).set) : [], feedback: 'Achte genau auf die Bedingung, bevor du das Gegenteil bildest.' }]
        : [{ set: combBuild(n, { ...p.c, op: p.c.op === 'und' ? 'oder' : 'und' }), feedback: p.c.op === 'und' ? '„Und“ heißt: Beide Bedingungen müssen gleichzeitig erfüllt sein.' : '„Oder“ heißt: Mindestens eine der beiden Bedingungen muss erfüllt sein.' },
          { set: A, feedback: 'Du hast nur die erste Bedingung beachtet.' },
          { set: complement(n, s), feedback: 'Das sind genau die Ergebnisse, die nicht zum Ereignis gehören.' }];
      const options = setOptions(s, traps.filter(t => t.set.length), p.order);
      const B = p.c.e2 ? Z.eventBuild(n, p.c.e2) : null;
      const steps = p.c.op === 'nicht'
        ? [`${Z.eventAdj(p.c.e1)[0].toUpperCase()}${Z.eventAdj(p.c.e1).slice(1)}: $${setTex(A)}$.`, `Alle übrigen Ergebnisse: E = $${setTex(s)}$.`]
        : [`${Z.eventAdj(p.c.e1)[0].toUpperCase()}${Z.eventAdj(p.c.e1).slice(1)}: $${setTex(A)}$.`, `${Z.eventAdj(p.c.e2)[0].toUpperCase()}${Z.eventAdj(p.c.e2).slice(1)}: $${setTex(B)}$.`,
          p.c.op === 'und' ? `In beiden Mengen: E = $${setTex(s)}$.` : `In mindestens einer der beiden Mengen: E = $${setTex(s)}$.`];
      return {
        prompt: `${e.text} Ereignis E: ${combSentence(e, p.c)} Welche Menge beschreibt E?`, instructions: 'Wähle eine Menge aus.',
        answer: { type: 'choice', options, correct: 'k', canonical: 'k' },
        hints: hints('Zerlege das Ereignis in seine Bedingungen und schreibe für jede Bedingung die passende Menge auf.',
          p.c.op === 'und' ? '„Und“: Nimm nur Ergebnisse, die in beiden Mengen stehen.' : p.c.op === 'oder' ? '„Oder“: Nimm alle Ergebnisse, die in mindestens einer der Mengen stehen.' : '„Nicht“: Nimm alle Ergebnisse der Ergebnismenge, die die Bedingung nicht erfüllen.',
          steps[0], steps, 'Prüfe jedes Ergebnis der Ergebnismenge einzeln mit der ganzen Beschreibung.'),
        solution: { steps, result: `E = $${setTex(s)}$` },
      };
    }
    // reverse (L4)
    const sets = p.ds.map(d => Z.eventBuild(n, d)), t = sets[p.target], ids = ['a', 'b', 'c', 'd'];
    const options = p.order.map(i => ({ id: ids[i], text: `Die ${e.what} ist ${Z.eventAdj(p.ds[i])}.` }));
    const correct = ids.filter((_, i) => sameSet(sets[i], t));
    const steps = p.order.map(i => `„${Z.eventAdj(p.ds[i])}“: $${setTex(sets[i])}$ – ${sameSet(sets[i], t) ? 'passt' : 'passt nicht'}.`);
    return {
      prompt: `${e.text} Ein Ereignis ist E = $${setTex(t)}$. Welche Beschreibungen passen zu E?`, instructions: 'Kreuze alle passenden Beschreibungen an.',
      answer: { type: 'multiselect', options, correct, canonical: correct },
      hints: hints('Eine Beschreibung passt, wenn sie genau die Ergebnisse aus E erfasst – nicht mehr und nicht weniger.',
        'Schreibe zu jeder Beschreibung die zugehörige Menge auf und vergleiche sie mit E.',
        steps[0], steps, 'Verschiedene Beschreibungen können dasselbe Ereignis beschreiben, z. B. „größer als 4“ und „mindestens 5“.'),
      solution: { steps, result: `Passend: ${p.order.filter(i => sameSet(sets[i], t)).map(i => `„${Z.eventAdj(p.ds[i])}“`).join(', ')}` },
    };
  },
  /**
   * Independent: the set is computed on the SOLVE path (predicates on every outcome, brute-force Ω); for choice
   * tasks the solver returns the id of the option whose displayed set equals that set, so a wrong set marked as
   * correct by build is caught.
   */
  solve(p, level) {
    let s;
    if (p.mode === 'omega') s = omegaSolve(p);
    else if (p.mode === 'members') return Z.eventSolve(EXP[p.e].n, p.ev).map(x => `o${x}`);
    else if (p.mode === 'set') s = Z.eventSolve(EXP[p.e].n, p.ev);
    else if (p.mode === 'comb') s = combSolve(EXP[p.e].n, p.c);
    else {
      const n = EXP[p.e].n, t = Z.eventSolve(n, p.ds[p.target]);
      return ['a', 'b', 'c', 'd'].filter((_, i) => sameSet(Z.eventSolve(n, p.ds[i]), t));
    }
    const opt = events.build(p, level).answer.options.find(o => o.text === setText(s));
    return opt ? opt.id : null;
  },
};

module.exports = [events];
module.exports.helpers = { omegaSolve, combBuild, combSolve, trapFor };
