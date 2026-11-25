'use strict';
/**
 * Templates for LS7 VII.5 „Laplace-Experimente“ (skill ch7.prob.laplace; Bildungsplan 3.2.5(8), (9)). All situations
 * are original. P(E) = Anzahl der günstigen Ergebnisse : Anzahl der möglichen Ergebnisse, only where all outcomes are
 * equally likely. Two dice are counted in a 6 × 6 scheme of ordered pairs — no Baumdiagramm/Pfadregel.
 *
 * ch7.prob.laplace.compute (family laplace_basic)
 *  L1 Grundlagen     Die, eight-sided die, wheel with ten equal fields, urn with twelve numbered balls: an event in
 *                    words (traps: „größer als“/„mindestens“, complement, ratio favourable : unfavourable).
 *  L2 Standard       Urn with coloured balls (one colour, „nicht …“, „… oder …“) or letter cards of a word.
 *  L3 Anspruchsvoll  Two dice: Augensumme, Pasch, „mindestens eine …“, difference of the numbers — by counting the
 *                    36 equally likely ordered pairs (trap: the 11 sums as equally likely).
 * ch7.prob.laplace.judge (family is_laplace)
 *  L4 Transfer       Which experiment is a Laplace-Experiment? Exactly one of three (traps: thumbtack, unequal
 *                    sectors, colours of an urn with unequal numbers, sum of two dice, number of heads in two throws).
 * Misconceptions: non_laplace, boundary, ratio_not_share, all_equal, order_ignored.
 * Independent solver: predicates on all outcomes / all 36 pairs (enumeration); build uses counting formulas.
 */
const { hints } = require('../util');
const Z = require('./zufall');
const EX = require('./experiments').helpers;
const { F, probTex, probSpec, probResult, PROB_INSTR, setTex } = Z;

const SKILL = 'ch7.prob.laplace';
const EXP = Z.NUM_EXPERIMENTS;
const LAPLACE = 'Bei einem Laplace-Experiment sind alle Ergebnisse gleich wahrscheinlich. Dann gilt: $P(E) = \\frac{\\text{Anzahl der günstigen Ergebnisse}}{\\text{Anzahl der möglichen Ergebnisse}}$.';

// ---------------------------------------------------------------- L2 data
const COLS = ['rote', 'blaue', 'grüne', 'gelbe'];
const COL1 = { rote: 'rot', blaue: 'blau', grüne: 'grün', gelbe: 'gelb' };
const WORDS = ['ANANAS', 'BANANE', 'KAKADU', 'MAMMUT', 'TOMATE', 'RHABARBER', 'PAPAGEI', 'KAROTTE', 'ERDBEERE', 'HIMBEERE'];
const countIn = (w, ch) => [...w].filter(c => c === ch).length;

// ---------------------------------------------------------------- L3 two dice
/** Events on ordered pairs (a, b). count: BUILD formula; test: SOLVE predicate. */
const DICE = {
  sumEq: { text: s => `Die Augensumme ist ${s}.`, params: [3, 4, 5, 6, 7, 8, 9, 10, 11], count: s => 6 - Math.abs(s - 7), test: (a, b, s) => a + b === s },
  sumGe: { text: s => `Die Augensumme ist mindestens ${s}.`, params: [8, 9, 10, 11], count: s => Z.stepList(s, 12, 1).reduce((t, x) => t + 6 - Math.abs(x - 7), 0), test: (a, b, s) => a + b >= s },
  sumLe: { text: s => `Die Augensumme ist höchstens ${s}.`, params: [3, 4, 5, 6], count: s => Z.stepList(2, s, 1).reduce((t, x) => t + 6 - Math.abs(x - 7), 0), test: (a, b, s) => a + b <= s },
  pasch: { text: () => 'Beide Würfel zeigen dieselbe Augenzahl (Pasch).', params: [0], count: () => 6, test: (a, b) => a === b },
  atLeastOne: { text: d => `Mindestens ein Würfel zeigt eine ${d}.`, params: [1, 2, 3, 4, 5, 6], count: () => 11, test: (a, b, d) => a === d || b === d },
  diff: { text: k => `Die Augenzahlen unterscheiden sich um genau ${k}.`, params: [1, 2, 3, 4], count: k => 2 * (6 - k), test: (a, b, k) => Math.abs(a - b) === k },
  none: { text: d => `Keiner der beiden Würfel zeigt eine ${d}.`, params: [1, 2, 3, 4, 5, 6], count: () => 25, test: (a, b, d) => a !== d && b !== d },
  bothGe: { text: k => `Beide Würfel zeigen mindestens eine ${k}.`, params: [2, 3, 4, 5], count: k => (7 - k) ** 2, test: (a, b, k) => a >= k && b >= k },
  redGreater: { text: () => 'Der rote Würfel zeigt eine größere Augenzahl als der blaue.', params: [0], count: () => 15, test: (a, b) => a > b },
  sumPrime: { text: () => 'Die Augensumme ist eine Primzahl.', params: [0], count: () => 1 + 2 + 4 + 6 + 2, test: (a, b) => [2, 3, 5, 7, 11].includes(a + b) },
};
function diceWrong(kind, x) {
  if (kind === 'sumEq') return [{ value: F(1).div(11), category: 'concept_confusion', feedback: 'Die elf Augensummen von 2 bis 12 sind nicht gleich wahrscheinlich. Zähle die gleich wahrscheinlichen Paare (erster Würfel; zweiter Würfel).' },
    { value: F(Math.ceil(DICE.sumEq.count(x) / 2)).div(36), category: 'concept_confusion', feedback: 'Die Reihenfolge zählt: (1; 2) und (2; 1) sind verschiedene Ergebnisse.' }];
  if (kind === 'atLeastOne') return [{ value: F(12).div(36), category: 'concept_confusion', feedback: `Das Paar (${x}; ${x}) hast du doppelt gezählt.` }, { value: F(1).div(6), category: 'concept_confusion', feedback: 'Es gibt zwei Würfel: Die Zahl kann auf dem ersten oder auf dem zweiten Würfel liegen.' }];
  if (kind === 'pasch') return [{ value: F(1).div(36), category: 'concept_confusion', feedback: 'Das ist die Wahrscheinlichkeit für einen bestimmten Pasch. Es gibt sechs verschiedene Paschs.' }];
  if (kind === 'diff') return [{ value: F(6 - x).div(36), category: 'concept_confusion', feedback: `Die Reihenfolge zählt: (1; ${1 + x}) und (${1 + x}; 1) sind verschiedene Ergebnisse.` }];
  if (kind === 'none') return [{ value: F(11).div(36), category: 'concept_confusion', feedback: `Das ist die Wahrscheinlichkeit für „mindestens eine ${x}“, also das Gegenereignis.` }, { value: F(5).div(6), category: 'concept_confusion', feedback: 'Es gibt zwei Würfel: Beide dürfen die Zahl nicht zeigen.' }];
  if (kind === 'bothGe') return [{ value: F(7 - x).div(6), category: 'concept_confusion', feedback: 'Das gilt nur für einen Würfel. Beide Würfel müssen die Bedingung erfüllen.' }];
  if (kind === 'redGreater') return [{ value: F(1).div(2), category: 'concept_confusion', feedback: 'Vergiss die Paschs nicht: Bei 6 der 36 Paare sind beide Augenzahlen gleich.' }];
  if (kind === 'sumPrime') return [{ value: F(5).div(11), category: 'concept_confusion', feedback: 'Die Augensummen 2 bis 12 sind nicht gleich wahrscheinlich. Zähle die passenden Paare.' }];
  return [{ value: F(DICE[kind].count(x)).div(11), category: 'concept_confusion', feedback: 'Es gibt 36 gleich wahrscheinliche Paare, nicht 11 Augensummen.' }];
}

const compute = {
  id: `${SKILL}.compute`, version: 1, skillId: SKILL,
  families: ['laplace_basic'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Würfel, Achterwürfel, Glücksrad mit gleich großen Feldern, Urne mit Nummern: P(E) = günstige : mögliche Ergebnisse.',
    2: 'Urne mit farbigen Kugeln (eine Farbe, „nicht …“, „… oder …“) oder Buchstabenkarten eines Wortes.',
    3: 'Zwei Würfel: Augensumme, Pasch, „mindestens eine …“, Unterschied — durch Abzählen der 36 Paare.',
  },
  misconceptions: ['non_laplace', 'boundary', 'ratio_not_share', 'all_equal', 'order_ignored'],
  sample(rng, level) {
    if (level === 1) {
      const e = rng.int(0, EXP.length - 1), kind = rng.pick(['even', 'odd', 'gt', 'ge', 'lt', 'le', 'mult', 'prime', 'divisor']);
      return { mode: 'num', e, ev: { kind, a: rng.pick(Z.kindParams(kind, EXP[e].n)) } };
    }
    if (level === 2) {
      if (rng.int(0, 2) === 0) { const w = rng.pick(WORDS); return { mode: 'word', w, ch: rng.pick([...new Set(w)]) }; }
      const k = rng.pick([3, 3, 4]), cols = rng.shuffle(COLS).slice(0, k), ns = cols.map(() => rng.int(1, 9));
      const ask = rng.pick(['one', 'one', 'not', 'or']);
      const pick = ask === 'or' ? rng.shuffle([...cols.keys()]).slice(0, 2).sort() : [rng.int(0, k - 1)];
      return { mode: 'urn', cols, ns, ask, pick };
    }
    const kind = rng.pick(Object.keys(DICE));
    return { mode: 'dice', kind, x: rng.pick(DICE[kind].params) };
  },
  constraints(p) {
    if (p.mode === 'num') { const s = Z.eventBuild(EXP[p.e].n, p.ev); return s.length && s.length < EXP[p.e].n ? true : 'trivial'; }
    if (p.mode === 'urn') {
      if (new Set(p.ns).size < 2) return 'all equal counts (would be Laplace for colours)';
      const fav = p.pick.reduce((a, i) => a + p.ns[i], 0), N = p.ns.reduce((a, b) => a + b, 0);
      if (fav === N || F(fav).div(N).eq(F(1).div(p.cols.length))) return 'no trap';
    }
    if (p.mode === 'word' && countIn(p.w, p.ch) === 1 && p.w.length < 7) return 'too easy';
    return true;
  },
  build(p) {
    if (p.mode === 'num') {
      const e = EXP[p.e], n = e.n, s = Z.eventBuild(n, p.ev), v = F(s.length).div(n), trap = EX.trapFor(n, p.ev).set;
      const steps = [`Mögliche Ergebnisse: $${n}$ (alle gleich wahrscheinlich).`, `Günstige Ergebnisse: E = $${setTex(s)}$, also $${s.length}$.`, `$P(E) = \\frac{${s.length}}{${n}}${v.eq(F(s.length).div(n)) && F(s.length).div(n).d !== BigInt(n) ? ` = ${probTex(v)}` : ''}$.`];
      return {
        prompt: `${e.text} Bestimme die Wahrscheinlichkeit des Ereignisses E: Die ${e.what} ist ${Z.eventAdj(p.ev)}.`,
        instructions: PROB_INSTR,
        answer: probSpec(v, [
          { value: F(trap.length).div(n), category: 'concept_confusion', feedback: 'Prüfe genau, welche Ergebnisse zu E gehören (Grenzen, Teiler/Vielfache, 1 ist keine Primzahl).' },
          { value: F(n - s.length).div(n), category: 'concept_confusion', feedback: 'Das ist die Wahrscheinlichkeit des Gegenereignisses.' },
          { value: F(s.length).div(n - s.length), category: 'concept_confusion', feedback: 'Teile die Anzahl der günstigen Ergebnisse durch die Anzahl ALLER möglichen Ergebnisse.' }]),
        hints: hints(LAPLACE, 'Zähle die möglichen Ergebnisse und die günstigen Ergebnisse (die zu E gehören).', steps[1], steps,
          `Kontrolle mit dem Gegenereignis: $P(\\text{nicht }E) = \\frac{${n - s.length}}{${n}}$, zusammen ergibt das 1.`),
        solution: { steps, result: probResult('P(E) =', v) },
      };
    }
    if (p.mode === 'word') {
      const n = p.w.length, k = countIn(p.w, p.ch), v = F(k).div(n), distinct = new Set(p.w).size;
      const steps = [`Das Wort ${p.w} hat ${n} Buchstaben, also ${n} gleich wahrscheinliche Karten.`, `Der Buchstabe ${p.ch} kommt ${k}-mal vor.`, `$P = \\frac{${k}}{${n}}${F(k).div(n).d !== BigInt(n) ? ` = ${probTex(v)}` : ''}$.`];
      return {
        prompt: `Die Buchstaben des Wortes ${p.w} stehen einzeln auf ${n} gleichen Karten. Eine Karte wird verdeckt gezogen. Wie groß ist die Wahrscheinlichkeit, ein ${p.ch} zu ziehen?`,
        instructions: PROB_INSTR,
        answer: probSpec(v, [{ value: F(1).div(distinct), category: 'concept_confusion', feedback: 'Die verschiedenen Buchstaben sind nicht gleich wahrscheinlich. Gleich wahrscheinlich sind die einzelnen Karten.' },
          { value: F(k).div(n - k), category: 'concept_confusion', feedback: 'Teile durch die Anzahl aller Karten.' }]),
        hints: hints(LAPLACE, 'Jede Karte ist ein Ergebnis. Zähle alle Karten und die Karten mit dem gesuchten Buchstaben.', steps[1], steps,
          'Schreibe das Wort hin und markiere den Buchstaben jedes Mal, wenn er vorkommt.'),
        solution: { steps, result: probResult('P =', v) },
      };
    }
    if (p.mode === 'urn') {
      const N = p.ns.reduce((a, b) => a + b, 0), fav = p.pick.reduce((a, i) => a + p.ns[i], 0);
      const desc = p.cols.map((c, i) => `${p.ns[i]} ${c}`).join(', ').replace(/, ([^,]*)$/, ' und $1');
      const evText = p.ask === 'one' ? `eine ${p.cols[p.pick[0]]} Kugel` : p.ask === 'not' ? `keine ${p.cols[p.pick[0]]} Kugel` : `eine ${COL1[p.cols[p.pick[0]]]}e oder ${COL1[p.cols[p.pick[1]]]}e Kugel`;
      const good = p.ask === 'not' ? N - fav : fav, v = F(good).div(N);
      const distractors = [{ value: F(good).div(N - good), category: 'concept_confusion', feedback: 'Teile durch die Anzahl ALLER Kugeln, nicht durch die Anzahl der übrigen Kugeln.' },
        { value: p.ask === 'not' ? F(fav).div(N) : F(N - good).div(N), category: 'concept_confusion', feedback: p.ask === 'not' ? 'Gesucht ist die Wahrscheinlichkeit, dass diese Farbe NICHT gezogen wird.' : 'Das ist die Wahrscheinlichkeit des Gegenereignisses.' },
        { value: F(p.ask === 'or' ? 2 : p.ask === 'not' ? p.cols.length - 1 : 1).div(p.cols.length), category: 'concept_confusion', feedback: 'Die Farben sind nicht gleich wahrscheinlich, weil es von jeder Farbe unterschiedlich viele Kugeln gibt. Gleich wahrscheinlich sind die einzelnen Kugeln.' }];
      const steps = [`Insgesamt: $${p.ns.join(' + ')} = ${N}$ Kugeln, jede gleich wahrscheinlich.`,
        p.ask === 'not' ? `Günstig sind alle Kugeln außer den ${p.cols[p.pick[0]]}n: $${N} - ${fav} = ${good}$.` : p.ask === 'or' ? `Günstig: $${p.ns[p.pick[0]]} + ${p.ns[p.pick[1]]} = ${good}$ Kugeln.` : `Günstig: $${good}$ Kugeln.`,
        `$P = \\frac{${good}}{${N}}${F(good).div(N).d !== BigInt(N) ? ` = ${probTex(v)}` : ''}$.`];
      return {
        prompt: `In einer Urne liegen ${desc} Kugeln, sonst gleich. Eine Kugel wird blind gezogen. Wie groß ist die Wahrscheinlichkeit für ${evText}?`,
        instructions: PROB_INSTR, answer: probSpec(v, distractors),
        hints: hints(LAPLACE, 'Jede einzelne Kugel ist ein gleich wahrscheinliches Ergebnis. Zähle alle Kugeln und die günstigen Kugeln.', steps[0], steps,
          'Stell dir vor, die Kugeln sind nummeriert: Dann ist jede Nummer gleich wahrscheinlich.'),
        solution: { steps, result: probResult('P =', v) },
      };
    }
    // dice
    const D = DICE[p.kind], c = D.count(p.x), v = F(c).div(36);
    const pairs = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (D.test(a, b, p.x)) pairs.push(`(${a};\\ ${b})`);
    const list = pairs.length <= 12 ? `Günstige Paare: $${pairs.join(',\\ ')}$, also ${c}.` : `Günstige Paare: ${c}.`;
    const steps = ['Zwei Würfel: $6 \\cdot 6 = 36$ gleich wahrscheinliche Paare (erster Würfel; zweiter Würfel).', list, `$P = \\frac{${c}}{36}${F(c).div(36).d !== 36n ? ` = ${probTex(v)}` : ''}$.`];
    return {
      prompt: `Zwei faire Würfel (ein roter und ein blauer) werden gleichzeitig geworfen. Bestimme die Wahrscheinlichkeit des Ereignisses: ${D.text(p.x)}`,
      instructions: PROB_INSTR,
      answer: probSpec(v, diceWrong(p.kind, p.x)),
      hints: hints('Die Augensummen sind nicht gleich wahrscheinlich – die 36 Paare (rot; blau) dagegen schon.',
        'Zeichne eine 6 × 6-Tabelle (rot in den Zeilen, blau in den Spalten) und markiere alle günstigen Felder.', steps[0], steps,
        'Zähle systematisch: Gehe die Augenzahl des roten Würfels von 1 bis 6 durch und notiere jeweils die passenden blauen Augenzahlen.'),
      solution: { steps, result: probResult('P =', v) },
    };
  },
  /** Independent: brute-force enumeration with predicates (outcomes 1..n, letters, balls, 36 pairs). */
  solve(p) {
    if (p.mode === 'num') { const n = EXP[p.e].n; return `${Z.eventSolve(n, p.ev).length}/${n}`; }
    if (p.mode === 'word') { let k = 0; for (const c of p.w) if (c === p.ch) k++; return `${k}/${p.w.length}`; }
    if (p.mode === 'urn') {
      const balls = p.ns.flatMap((m, i) => new Array(m).fill(i));
      const good = balls.filter(b => (p.ask === 'not' ? b !== p.pick[0] : p.pick.includes(b))).length;
      return `${good}/${balls.length}`;
    }
    let k = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (DICE[p.kind].test(a, b, p.x)) k++;
    return `${k}/36`;
  },
};

// ---------------------------------------------------------------- L4 is_laplace
const LAP = [
  rng => { const n = rng.pick([4, 6, 8, 12, 20]); return { key: `die${n}`, text: `Ein fairer Würfel mit ${n} gleich großen Flächen (Zahlen 1 bis ${n}) wird geworfen; beobachtet wird die Zahl.` }; },
  rng => { const n = rng.pick([10, 15, 20, 25, 30]); return { key: `urnnum${n}`, text: `Aus einer Urne mit ${n} gleichen, von 1 bis ${n} nummerierten Kugeln wird eine gezogen; beobachtet wird die Nummer.` }; },
  rng => { const n = rng.pick([5, 8, 10, 12]); return { key: `wheel${n}`, text: `Ein Glücksrad mit ${n} gleich großen Feldern (Zahlen 1 bis ${n}) wird gedreht; beobachtet wird die Zahl.` }; },
  () => ({ key: 'coin', text: 'Eine faire Münze wird geworfen; beobachtet wird, ob Kopf oder Zahl oben liegt.' }),
];
const NONLAP = [
  () => ({ key: 'pin', text: 'Eine Reißzwecke wird geworfen; beobachtet wird, ob die Spitze nach oben zeigt.', why: 'Die beiden Lagen einer Reißzwecke sind nicht gleich wahrscheinlich; man kann die Wahrscheinlichkeit nur durch Versuchsreihen schätzen.' }),
  rng => { const a = rng.int(1, 3), b = rng.int(4, 7); return { key: `sect${a}-${b}`, text: `Ein Glücksrad hat ${a + b} gleich große Felder: ${a} rot und ${b} blau. Beobachtet wird die Farbe.`, why: `Rot und Blau sind nicht gleich wahrscheinlich: Blau hat ${b}, Rot nur ${a} Felder.` }; },
  rng => { const r = rng.int(2, 5), b = r + rng.int(2, 5); return { key: `urncol${r}-${b}`, text: `Aus einer Urne mit ${r} roten und ${b} blauen Kugeln wird eine gezogen; beobachtet wird die Farbe.`, why: 'Die Farben sind nicht gleich wahrscheinlich, weil es unterschiedlich viele Kugeln jeder Farbe gibt.' }; },
  () => ({ key: 'sum', text: 'Zwei Würfel werden geworfen; beobachtet wird die Augensumme (2 bis 12).', why: 'Die Augensummen sind nicht gleich wahrscheinlich: Die 7 entsteht aus sechs Paaren, die 2 nur aus einem.' }),
  () => ({ key: 'heads', text: 'Eine Münze wird zweimal geworfen; beobachtet wird die Anzahl der Würfe mit Kopf (0, 1 oder 2).', why: '„Einmal Kopf“ entsteht auf zwei Arten (KZ und ZK), „zweimal Kopf“ nur auf eine. Die Ergebnisse 0, 1, 2 sind also nicht gleich wahrscheinlich.' }),
  () => ({ key: 'lego', text: 'Ein Legostein wird geworfen; beobachtet wird, auf welcher Seite er liegen bleibt.', why: 'Die Seiten eines Legosteins sind verschieden groß und geformt; sie sind nicht gleich wahrscheinlich.' }),
];

const judge = {
  id: `${SKILL}.judge`, version: 1, skillId: SKILL,
  families: ['is_laplace'],
  levels: [4],
  levelNotes: { 4: 'Entscheiden, bei welchem Zufallsexperiment alle Ergebnisse gleich wahrscheinlich sind und die Laplace-Regel gilt (genau eines von drei).' },
  misconceptions: ['non_laplace', 'all_equal', 'order_ignored'],
  sample(rng) {
    const li = rng.int(0, LAP.length - 1), [n1, n2] = rng.shuffle([...NONLAP.keys()]).slice(0, 2);
    return { li, ls: rng.int(0, 1e6), n1, n2, s1: rng.int(0, 1e6), s2: rng.int(0, 1e6), order: rng.shuffle([0, 1, 2]) };
  },
  constraints() { return true; },
  signatureParams(p) { const it = items(p); return { keys: [it.lap.key, it.a.key, it.b.key].sort() }; },
  build(p) {
    const it = items(p);
    const raw = [{ id: 'g', text: it.lap.text }, { id: 'f0', text: it.a.text, category: 'concept_confusion', feedback: it.a.why }, { id: 'f1', text: it.b.text, category: 'concept_confusion', feedback: it.b.why }];
    const options = p.order.map(i => raw[i]);
    const steps = [`Laplace-Experiment: ${it.lap.text} Alle Ergebnisse sind gleich wahrscheinlich.`, `Kein Laplace-Experiment: ${it.a.why}`, `Kein Laplace-Experiment: ${it.b.why}`];
    return {
      prompt: 'Bei welchem Zufallsexperiment sind alle Ergebnisse gleich wahrscheinlich, sodass man die Laplace-Regel anwenden darf?',
      instructions: 'Wähle das Laplace-Experiment.',
      answer: { type: 'choice', options, correct: 'g', canonical: 'g' },
      hints: hints(LAPLACE, 'Prüfe bei jedem Experiment: Gibt es einen Grund, warum ein Ergebnis häufiger vorkommen sollte als ein anderes?',
        'Achte darauf, was beobachtet wird: Bei einer Farbe oder einer Summe können mehrere gleich wahrscheinliche Möglichkeiten zusammenfallen.', steps,
        'Ein Experiment ist ein Laplace-Experiment, wenn es aus Symmetriegründen keinen Unterschied zwischen den Ergebnissen gibt (faire Würfel, gleich große Felder, gleiche Kugeln mit Nummern).'),
      solution: { steps, result: it.lap.text },
    };
  },
  /** Independent: the Laplace property is decided from the item's structure (symmetric objects with one outcome per
   *  equally likely element), not from build's option ids. */
  solve(p) {
    const it = items(p);
    const isLap = x => /^(die\d+|urnnum\d+|wheel\d+|coin)$/.test(x.key);
    const raw = [['g', it.lap], ['f0', it.a], ['f1', it.b]];
    const hit = raw.filter(([, x]) => isLap(x));
    return hit.length === 1 ? hit[0][0] : null;
  },
};
function items(p) {
  const R = s => new (require('../../core').Rng)(s >>> 0);
  return { lap: LAP[p.li](R(p.ls)), a: NONLAP[p.n1](R(p.s1)), b: NONLAP[p.n2](R(p.s2)) };
}

module.exports = [compute, judge];
module.exports.helpers = { DICE };
