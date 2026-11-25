'use strict';
/**
 * Templates for LS7 VII.3 „Wahrscheinlichkeiten bestimmen“ (skill ch7.prob.determine; Bildungsplan 3.2.5(3), (8),
 * (10)). All situations are original. No Baumdiagramme or Pfadregeln (3.2.5(11), (12) have no LS7 section).
 *
 * ch7.prob.determine.compute (families outcome_sum, complement)
 *  L1 Grundlagen     A probability table (colour wheel with unequal sectors or a loaded die): P(event) as the sum of
 *                    the listed outcome probabilities (all in one representation: fractions with one denominator,
 *                    decimals or percentages).
 *  L2 Standard       Gegenereignis: P(nicht A) = 1 − P(A) in a context; a missing table entry (sum = 1); or „nicht …“
 *                    for a table with mixed representations.
 * ch7.prob.determine.counting (family counting)
 *  L3 Anspruchsvoll  Count possibilities by combinatorial reasoning (product rule, arrangements, ordered choices
 *                    without repetition); sometimes the probability of guessing right at the first try (1 : number).
 * ch7.prob.determine.claims (family judge_claim)
 *  L4 Transfer       Everyday probability statements: exactly one of three statements is correct (gambler's fallacy,
 *                    „1/6 means exactly once in six throws“, rain forecasts, lottery tips, comparing two wheels).
 * Misconceptions: add_vs_multiply, complement_forgotten, sum_not_one, counting_sum (adds instead of multiplying),
 * gamblers_fallacy, prob_as_certainty, absolute_vs_relative.
 * Independent solver: the expression engine on the DISPLAYED values (L1/L2), brute-force enumeration of all
 * possibilities (L3), exact comparison by cross-multiplication (L4 wheels) / the statement key (L4 fixed facts).
 */
const { hints } = require('../util');
const Z = require('./zufall');
const { F, deNum, texNum, probTex, probSpec, probResult, PROB_INSTR } = Z;

const SKILL = 'ch7.prob.determine';
const COLORS = ['rot', 'blau', 'gelb', 'grün'];

// ---------------------------------------------------------------- representations
/** Display of a probability in a fixed representation: 'frac' (with denominator D), 'dec', 'pct'. */
function show(num, D, rep) {
  const f = F(num).div(D);
  if (rep === 'frac') return `\\frac{${num}}{${D}}`;
  if (rep === 'dec') return texNum(f);
  return `${texNum(f.mul(100))}\\,\\%`;
}
/** SOLVE path: the displayed TeX number → machine literal for the expression engine. */
function texToMachine(t) {
  let m = /^\\frac\{(\d+)\}\{(\d+)\}$/.exec(t);
  if (m) return `(${m[1]}/${m[2]})`;
  m = /^([\d{},]+)\\,\\%$/.exec(t);
  if (m) return `(${Z.mach(F(m[1].replace('{,}', '.')))}/100)`;
  return Z.mach(F(t.replace('{,}', '.')));
}
const viaShown = shown => Z.viaExpr(shown.map(texToMachine).join('+'));

/** Positive integer numerators summing to D (each ≥ 1), k parts. */
function split(rng, D, k) {
  for (;;) {
    const cuts = Z.stepList(1, D - 1, 1);
    const pick = rng.shuffle(cuts).slice(0, k - 1).sort((a, b) => a - b);
    const parts = [...pick, D].map((c, i) => c - (i ? pick[i - 1] : 0));
    if (parts.every(x => x >= 1)) return parts;
  }
}
const DEN = { frac: [8, 10, 12, 16, 20], dec: [20, 100], pct: [20, 100] };

/** Distribution contexts: colour wheel (3–4 colours) or loaded die (6 faces). */
function sampleDist(rng, rep) {
  const die = rng.int(0, 2) === 0;
  const D = rng.pick(DEN[rep]);
  if (die) return { die: true, labels: [1, 2, 3, 4, 5, 6], D: D < 12 ? 20 : D, rep, nums: null };
  const labels = rng.shuffle(COLORS).slice(0, rng.pick([3, 4]));
  return { die: false, labels, D, rep, nums: null };
}
const distIntro = d => (d.die
  ? 'Ein Würfel ist gezinkt: Nicht alle Augenzahlen sind gleich wahrscheinlich. Die Tabelle zeigt die Wahrscheinlichkeiten.'
  : 'Ein Glücksrad hat verschieden große Felder. Die Tabelle zeigt die Wahrscheinlichkeiten der Farben.');
const distTable = (d, missing) => ({ columns: [d.die ? 'Augenzahl' : 'Farbe', 'Wahrscheinlichkeit'], rows: d.labels.map((l, i) => [d.die ? `$${l}$` : l, i === missing ? '?' : `$${show(d.nums[i], d.D, d.rep)}$`]) });
const lbl = (d, i) => (d.die ? `$${d.labels[i]}$` : d.labels[i]);

// ---------------------------------------------------------------- compute (L1, L2)
const CONTEXTS = [
  { a: 'der Bus pünktlich ist', na: 'der Bus nicht pünktlich ist', ps: ['0.85', '0.9', '0.75', '0.8'] },
  { a: 'Jonas beim Freiwurf trifft', na: 'Jonas beim Freiwurf nicht trifft', ps: ['0.7', '0.65', '0.6', '0.55'] },
  { a: 'ein Los ein Gewinn ist', na: 'ein Los eine Niete ist', ps: ['3/20', '1/8', '2/25', '1/5'] },
  { a: 'es morgen regnet', na: 'es morgen nicht regnet', ps: ['0.3', '0.45', '0.2', '0.65'] },
  { a: 'eine Lampe aus der Lieferung defekt ist', na: 'eine Lampe aus der Lieferung nicht defekt ist', ps: ['0.02', '0.05', '0.04', '0.03'] },
  { a: 'die Ampel auf Grün steht', na: 'die Ampel nicht auf Grün steht', ps: ['2/5', '3/8', '1/3', '5/12'] },
];
function ctxShow(f, rep) {
  f = F(f);
  if (rep === 'frac' || !f.isTerminatingDecimal()) return probTex(f);
  if (rep === 'dec') return texNum(f);
  return `${texNum(f.mul(100))}\\,\\%`;
}

const compute = {
  id: `${SKILL}.compute`, version: 1, skillId: SKILL,
  families: ['outcome_sum', 'complement'],
  levels: [1, 2],
  levelNotes: {
    1: 'Wahrscheinlichkeit eines Ereignisses als Summe der Wahrscheinlichkeiten seiner Ergebnisse (Tabelle in einer Darstellung).',
    2: 'Gegenereignis: 1 − P(A); fehlender Tabellenwert (Summe 1); „nicht …“ bei gemischten Darstellungen.',
  },
  misconceptions: ['add_vs_multiply', 'complement_forgotten', 'sum_not_one'],
  sample(rng, level) {
    if (level === 1) {
      const d = sampleDist(rng, rng.pick(['frac', 'dec', 'pct']));
      d.nums = split(rng, d.D, d.labels.length);
      const k = d.die ? 3 : 2;
      const pick = d.die ? rng.pick([[1, 3, 5], [0, 2, 4], [3, 4, 5], [0, 1, 2]]) : rng.shuffle([...d.labels.keys()]).slice(0, k).sort();
      return { mode: 'sum', d, pick };
    }
    const mode = rng.pick(['ctx', 'ctx', 'missing', 'not']);
    if (mode === 'ctx') { const ci = rng.int(0, CONTEXTS.length - 1); return { mode, ci, p: rng.pick(CONTEXTS[ci].ps), rep: rng.pick(['frac', 'dec', 'pct']) }; }
    const d = sampleDist(rng, rng.pick(['frac', 'dec', 'pct']));
    d.nums = split(rng, d.D, d.labels.length);
    return { mode, d, i: rng.int(0, d.labels.length - 1) };
  },
  constraints(p) {
    if (p.mode === 'ctx') { const f = F(p.p); return p.rep !== 'frac' && !f.isTerminatingDecimal() ? 'not representable' : true; }
    if (p.mode === 'sum' && p.pick.length === 2 && F(p.d.nums[p.pick[0]]).eq(p.d.nums[p.pick[1]])) return 'equal parts';
    return true;
  },
  build(p, level) {
    if (p.mode === 'ctx') return buildCtx(p);
    const d = p.d, D = d.D;
    if (p.mode === 'sum') {
      const v = F(p.pick.reduce((a, i) => a + d.nums[i], 0)).div(D);
      const parts = p.pick.map(i => show(d.nums[i], D, d.rep));
      const ev = d.die ? eventWordsDie(p.pick) : p.pick.map(i => d.labels[i]).join(' oder ');
      const prod = p.pick.reduce((a, i) => a.mul(F(d.nums[i]).div(D)), F(1));
      const answer = probSpec(v, [
        { value: prod, category: 'concept_confusion', feedback: 'Bei „oder“ werden die Wahrscheinlichkeiten der einzelnen Ergebnisse addiert, nicht multipliziert.' },
        { value: F(1).sub(v), category: 'concept_confusion', feedback: 'Das ist die Wahrscheinlichkeit des Gegenereignisses.' },
        { value: F(d.nums[p.pick[0]]).div(D), category: 'other', feedback: 'Zum Ereignis gehören mehrere Ergebnisse. Addiere alle ihre Wahrscheinlichkeiten.' }]);
      const steps = [`Zum Ereignis gehören: ${p.pick.map(i => lbl(d, i)).join(', ')}.`, `$P = ${parts.join(' + ')} = ${showSum(v, d.rep)}$.`];
      return {
        prompt: `${distIntro(d)} Bestimme die Wahrscheinlichkeit für ${d.die ? `das Ereignis „${ev}“` : `„${ev}“`}.`,
        promptTable: distTable(d), instructions: PROB_INSTR, answer,
        hints: hints('Die Wahrscheinlichkeit eines Ereignisses ist die Summe der Wahrscheinlichkeiten seiner Ergebnisse.',
          'Suche alle Ergebnisse, die zum Ereignis gehören, und addiere ihre Wahrscheinlichkeiten aus der Tabelle.',
          steps[0], steps, 'Kontrolle: Alle Wahrscheinlichkeiten der Tabelle zusammen ergeben 1. Dein Ergebnis muss kleiner sein.'),
        solution: { steps, result: probResult('P =', v) },
      };
    }
    // missing / not
    const i = p.i, pi = F(d.nums[i]).div(D);
    const others = d.labels.map((_, j) => j).filter(j => j !== i);
    if (p.mode === 'missing') {
      const sumO = F(others.reduce((a, j) => a + d.nums[j], 0)).div(D);
      const answer = probSpec(pi, [{ value: sumO, category: 'concept_confusion', feedback: 'Das ist die Summe der übrigen Wahrscheinlichkeiten. Die gesuchte Wahrscheinlichkeit ergänzt sie zu 1.' }]);
      const steps = [`Summe der bekannten Werte: $${others.map(j => show(d.nums[j], D, d.rep)).join(' + ')} = ${showSum(sumO, d.rep)}$.`, `Alle zusammen ergeben 1: $1 - ${showSum(sumO, d.rep)} = ${showSum(pi, d.rep)}$.`];
      return {
        prompt: `${distIntro(d)} Ein Wert fehlt. Bestimme die fehlende Wahrscheinlichkeit für ${lbl(d, i)}.`,
        promptTable: distTable(d, i), instructions: PROB_INSTR, answer,
        hints: hints('Bei einem Zufallsexperiment ergeben die Wahrscheinlichkeiten aller Ergebnisse zusammen 1 (also 100 %).',
          'Addiere die bekannten Wahrscheinlichkeiten und ergänze bis 1.', steps[0], steps,
          `Probe: Addiere deine Lösung zu den übrigen Werten. Es muss genau 1 herauskommen.`),
        solution: { steps, result: probResult(`P(${d.die ? d.labels[i] : d.labels[i]}) =`, pi) },
      };
    }
    // not: P(nicht X) = 1 − P(X)
    const v = F(1).sub(pi);
    const answer = probSpec(v, [{ value: pi, category: 'concept_confusion', feedback: `Das ist die Wahrscheinlichkeit für ${d.die ? 'diese Augenzahl' : d.labels[i]} selbst. Gesucht ist das Gegenereignis.` }]);
    const steps = [`Gegenereignis: ${d.die ? `„nicht ${d.labels[i]}“` : `„nicht ${d.labels[i]}“`} hat die Wahrscheinlichkeit $1 - P(${d.die ? d.labels[i] : `\\text{${d.labels[i]}}`})$.`, `$1 - ${show(d.nums[i], D, d.rep)} = ${showSum(v, d.rep)}$.`];
    return {
      prompt: `${distIntro(d)} Bestimme die Wahrscheinlichkeit dafür, dass ${d.die ? `nicht die Augenzahl ${d.labels[i]} fällt` : `nicht ${d.labels[i]} erscheint`}.`,
      promptTable: distTable(d), instructions: `Tipp: Du musst nicht alle anderen Werte addieren. ${PROB_INSTR}`, answer,
      hints: hints('„Nicht …“ ist das Gegenereignis. Ein Ereignis und sein Gegenereignis haben zusammen die Wahrscheinlichkeit 1.',
        'Rechne 1 minus die Wahrscheinlichkeit des Ereignisses.', steps[0], steps,
        'Alternative: Addiere die Wahrscheinlichkeiten aller übrigen Ergebnisse – das gibt dasselbe, ist aber länger.'),
      solution: { steps, result: probResult('P =', v) },
    };
  },
  solve(p) {
    if (p.mode === 'ctx') return Z.viaExpr(`1-${texToMachine(ctxShow(p.p, p.rep))}`).toString();
    const t = distTable(p.d, p.mode === 'missing' ? p.i : undefined), cells = t.rows.map(r => r[1]);
    const strip = s => s.replace(/^\$|\$$/g, '');
    if (p.mode === 'sum') return viaShown(p.pick.map(i => strip(cells[i]))).toString();
    if (p.mode === 'missing') return Z.viaExpr(`1-(${cells.filter((_, j) => j !== p.i).map(c => texToMachine(strip(c))).join('+')})`).toString();
    return Z.viaExpr(`1-${texToMachine(strip(cells[p.i]))}`).toString();
  },
};
function eventWordsDie(pick) {
  const key = pick.join(',');
  return { '1,3,5': 'gerade Augenzahl', '0,2,4': 'ungerade Augenzahl', '3,4,5': 'Augenzahl größer als 3', '0,1,2': 'Augenzahl höchstens 3' }[key];
}
/** A sum shown in the table's representation (fractions reduced when possible). */
function showSum(f, rep) {
  f = F(f);
  if (rep === 'frac') return probTex(f);
  if (rep === 'dec') return texNum(f);
  return `${texNum(f.mul(100))}\\,\\%`;
}
function buildCtx(p) {
  const c = CONTEXTS[p.ci], f = F(p.p), v = F(1).sub(f), shown = ctxShow(f, p.rep);
  const answer = probSpec(v, [{ value: f, category: 'concept_confusion', feedback: 'Das ist die gegebene Wahrscheinlichkeit. Gesucht ist die Wahrscheinlichkeit des Gegenereignisses.' }]);
  const steps = [`Das Gegenereignis zu „${c.a}“ ist „${c.na}“.`, `$1 - ${shown} = ${ctxShow(v, p.rep)}$.`];
  return {
    prompt: `Die Wahrscheinlichkeit, dass ${c.a}, beträgt $${shown}$. Wie groß ist die Wahrscheinlichkeit, dass ${c.na}?`,
    instructions: PROB_INSTR, answer,
    hints: hints('Ein Ereignis und sein Gegenereignis ergänzen sich: Zusammen haben sie die Wahrscheinlichkeit 1 (also 100 %).',
      'Rechne 1 minus die gegebene Wahrscheinlichkeit.', steps[0], steps,
      p.rep === 'pct' ? 'In Prozent: 100 % minus den gegebenen Prozentsatz.' : 'Denke an 100 gleiche Situationen: Wie oft tritt das Gegenereignis ein?'),
    solution: { steps, result: probResult('P =', v) },
  };
}

// ---------------------------------------------------------------- counting (L3)
const COUNT = {
  outfit: rng => { const a = rng.int(2, 5), b = rng.int(2, 4), c = rng.pick([0, 2, 3]); return { kind: 'product', factors: c ? [a, b, c] : [a, b], text: `${rng.pick(Z.NAMES)} hat ${a} T-Shirts, ${b} Hosen${c ? ` und ${c} Paar Schuhe` : ''}. Wie viele verschiedene Kombinationen aus ${c ? 'T-Shirt, Hose und Schuhen' : 'T-Shirt und Hose'} sind möglich?`, guess: null }; },
  menu: rng => { const a = rng.int(2, 4), b = rng.int(3, 5), c = rng.int(2, 4); return { kind: 'product', factors: [a, b, c], text: `Eine Mensa bietet ${a} Vorspeisen, ${b} Hauptgerichte und ${c} Nachspeisen an. Ein Menü besteht aus je einer Vorspeise, einem Hauptgericht und einer Nachspeise. Wie viele verschiedene Menüs gibt es?`, guess: null }; },
  lock: rng => { const r = rng.pick([2, 3]), k = rng.pick([4, 5, 6, 10]); return { kind: 'power', base: k, exp: r, text: `Ein Zahlenschloss hat ${r} Ringe, jeder mit den Ziffern ${k === 10 ? '0 bis 9' : `1 bis ${k}`}.`, ask: 'Wie viele verschiedene Zahlencodes gibt es?', guess: `Wie groß ist die Wahrscheinlichkeit, den richtigen Code beim ersten zufälligen Versuch zu treffen?` }; },
  row: rng => { const n = rng.pick([3, 4, 5]); return { kind: 'factorial', n, text: `${n} Freunde stellen sich für ein Foto nebeneinander in eine Reihe.`, ask: 'Wie viele verschiedene Reihenfolgen gibt es?', guess: null }; },
  medals: rng => { const n = rng.int(5, 9); return { kind: 'perm2', n, text: `Bei einem Lauf starten ${n} Kinder. Es werden ein erster und ein zweiter Platz vergeben (kein gleichzeitiges Ankommen).`, ask: 'Wie viele Möglichkeiten gibt es für die Plätze 1 und 2?', guess: null }; },
  pin: rng => { const k = rng.pick([3, 4, 5]), r = rng.pick([2, 3]); const L = ['A', 'B', 'C', 'D', 'E'].slice(0, k); return { kind: 'power', base: k, exp: r, text: `Ein Code besteht aus ${r} Buchstaben. Jeder Buchstabe ist einer von ${L.join(', ')}; Buchstaben dürfen sich wiederholen.`, ask: 'Wie viele verschiedene Codes gibt es?', guess: 'Wie groß ist die Wahrscheinlichkeit, einen solchen Code beim ersten zufälligen Versuch richtig zu raten?' }; },
  route: rng => { const a = rng.int(2, 4), b = rng.int(2, 5); return { kind: 'product', factors: [a, b], text: `Von Neustadt nach Altheim gibt es ${a} Radwege, von Altheim nach Bergen ${b} Radwege. Wie viele verschiedene Strecken gibt es von Neustadt über Altheim nach Bergen?`, guess: null }; },
};
/** BUILD path: closed counting formulas. */
function countB(c) {
  if (c.kind === 'product') return c.factors.reduce((a, b) => a * b, 1);
  if (c.kind === 'power') return c.base ** c.exp;
  if (c.kind === 'factorial') { let f = 1; for (let i = 2; i <= c.n; i++) f *= i; return f; }
  return c.n * (c.n - 1);
}
/** SOLVE path: enumerate all possibilities and count them. */
function countS(c) {
  const tuples = dims => dims.reduce((acc, m) => acc.flatMap(t => Z.stepList(1, m, 1).map(x => [...t, x])), [[]]);
  if (c.kind === 'product') return tuples(c.factors).length;
  if (c.kind === 'power') return tuples(new Array(c.exp).fill(c.base)).length;
  if (c.kind === 'factorial') return tuples(new Array(c.n).fill(c.n)).filter(t => new Set(t).size === t.length).length;
  return tuples([c.n, c.n]).filter(t => t[0] !== t[1]).length;
}
function countTerm(c) {
  if (c.kind === 'product') return c.factors.join(' \\cdot ');
  if (c.kind === 'power') return new Array(c.exp).fill(c.base).join(' \\cdot ');
  if (c.kind === 'factorial') return Z.stepList(1, c.n, 1).reverse().join(' \\cdot ');
  return `${c.n} \\cdot ${c.n - 1}`;
}
function countWrong(c) {
  if (c.kind === 'product') return c.factors.reduce((a, b) => a + b, 0);
  if (c.kind === 'power') return c.base * c.exp;
  if (c.kind === 'factorial') return c.n * c.n;
  return c.n * c.n;
}

const counting = {
  id: `${SKILL}.counting`, version: 1, skillId: SKILL,
  families: ['counting'],
  levels: [3],
  levelNotes: { 3: 'Anzahl der Möglichkeiten durch kombinatorische Überlegungen (Produktregel, Reihenfolgen, Plätze ohne Wiederholung); auch Wahrscheinlichkeit beim ersten Rateversuch.' },
  misconceptions: ['counting_sum'],
  sample(rng) {
    const kind = rng.pick(Object.keys(COUNT)), c = COUNT[kind](rng);
    return { kind, c, ask: c.guess && rng.int(0, 2) === 0 ? 'prob' : 'count' };
  },
  constraints(p) { return countB(p.c) <= 1000 ? true : 'too many'; },
  build(p) {
    const c = p.c, N = countB(c), term = countTerm(c);
    const why = c.kind === 'product' ? 'Jede Wahl der ersten Stufe lässt sich mit jeder Wahl der nächsten Stufe kombinieren.'
      : c.kind === 'power' ? `Für jede Stelle gibt es ${c.base} Möglichkeiten, unabhängig von den anderen Stellen.`
        : c.kind === 'factorial' ? `Für den ersten Platz gibt es ${c.n} Möglichkeiten, für den zweiten nur noch ${c.n - 1} usw.`
          : `Für Platz 1 gibt es ${c.n} Möglichkeiten, für Platz 2 nur noch ${c.n - 1}.`;
    const steps = [why, `Anzahl: $${term} = ${N}$.`];
    const question = c.ask ? `${c.text} ${c.ask}` : c.text;
    if (p.ask === 'prob') {
      const v = F(1).div(N);
      steps.push(`Nur einer der ${N} Codes ist richtig: $P = ${probTex(v)}$.`);
      return {
        prompt: `${c.text} ${c.guess}`, instructions: PROB_INSTR,
        answer: probSpec(v, [{ value: F(1).div(countWrong(c)), category: 'concept_confusion', feedback: 'Die Anzahl der Codes ist zu klein: Die Möglichkeiten der Stellen werden multipliziert, nicht addiert.' }]),
        hints: hints('Zähle zuerst, wie viele Codes es insgesamt gibt. Alle sind gleich wahrscheinlich.', why, `Es gibt $${term} = ${N}$ Codes.`, steps,
          'Stell dir vor, du probierst alle Codes der Reihe nach aus: Wie viele davon sind richtig?'),
        solution: { steps, result: probResult('P =', v) },
      };
    }
    return {
      prompt: question, instructions: 'Gib eine ganze Zahl ein.',
      answer: { type: 'integer', value: String(N), canonical: String(N), distractors: Z.ndist(N, [{ value: countWrong(c), category: 'concept_confusion', feedback: c.kind === 'product' || c.kind === 'power' ? 'Die Möglichkeiten der einzelnen Stufen werden multipliziert, nicht addiert.' : 'Ein Platz, der schon vergeben ist, steht nicht mehr zur Wahl.' }]) },
      hints: hints('Überlege, in welchen Schritten (Stufen) eine Möglichkeit entsteht.', why, `Schreibe die Anzahl als Produkt: $${term}$.`, steps,
        'Bei kleinen Anzahlen kannst du alle Möglichkeiten systematisch aufschreiben und abzählen (zum Beispiel in einer Tabelle oder Liste).'),
      solution: { steps, result: `Anzahl: $${N}$` },
    };
  },
  solve(p) { const N = countS(p.c); return p.ask === 'prob' ? `1/${N}` : String(N); },
};

// ---------------------------------------------------------------- claims (L4)
/** Situations with exactly one true statement among three. `truth` is a fixed key only for conceptual facts. */
const CLAIMS = {
  coin: rng => { const k = rng.int(4, 8), side = rng.pick(['Kopf', 'Zahl']), other = side === 'Kopf' ? 'Zahl' : 'Kopf'; return {
    text: `Eine faire Münze hat ${k}-mal hintereinander ${side} gezeigt. Welche Aussage über den nächsten Wurf ist richtig?`,
    good: `${side} und ${other} sind beim nächsten Wurf gleich wahrscheinlich, beide mit $\\frac{1}{2}$.`,
    bad: [[`Jetzt ist ${other} wahrscheinlicher, weil ${other} „an der Reihe“ ist.`, 'Die Münze hat kein Gedächtnis: Jeder Wurf ist unabhängig von den vorherigen.'],
      [`${side} ist wahrscheinlicher, weil ${side} gerade so oft kommt.`, 'Bei einer fairen Münze bleibt die Wahrscheinlichkeit bei jedem Wurf $\\frac{1}{2}$.']] }; },
  rain: rng => { const p = rng.pick([20, 30, 40, 60, 70, 80]); return {
    text: `Der Wetterbericht meldet für morgen eine Regenwahrscheinlichkeit von $${p}\\,\\%$. Welche Aussage ist richtig?`,
    good: `Bei vielen Tagen mit dieser Vorhersage regnet es an ungefähr ${p} von 100 Tagen.`,
    bad: [[p > 50 ? 'Morgen regnet es sicher, weil der Wert über 50 % liegt.' : 'Morgen regnet es sicher nicht, weil der Wert unter 50 % liegt.', 'Eine Wahrscheinlichkeit zwischen 0 und 1 bedeutet: Das Ereignis kann eintreten oder nicht – sicher ist nichts.'],
      [`Morgen regnet es genau ${p} % des Tages.`, 'Die Angabe beschreibt, wie wahrscheinlich Regen ist, nicht wie lange es regnet.']] }; },
  six: rng => { const n = rng.pick([60, 120, 300, 600, 1200]); return {
    text: `Bei einem fairen Würfel ist die Wahrscheinlichkeit für eine Sechs $\\frac{1}{6}$. Jemand wirft ${n}-mal. Welche Aussage ist richtig?`,
    good: `Man erwartet ungefähr ${n / 6} Sechsen; es können aber auch etwas mehr oder weniger sein.`,
    bad: [[`Es fallen genau ${n / 6} Sechsen.`, 'Die Wahrscheinlichkeit sagt nur, was man ungefähr erwartet. Genau vorhersagen kann man Zufallsergebnisse nicht.'],
      ['Nach fünf Würfen ohne Sechs kommt beim sechsten Wurf sicher eine Sechs.', 'Der Würfel hat kein Gedächtnis: Auch nach fünf Würfen ohne Sechs ist die Wahrscheinlichkeit $\\frac{1}{6}$.']] }; },
  lotto: rng => { const a = rng.pick([1, 2, 3, 4]), b = rng.pick([7, 13, 21, 34]); const t1 = Z.stepList(a, a + 5, 1).join(', '); return {
    text: `Bei einer Ziehung werden 6 von 49 Kugeln (Nummern 1 bis 49) blind gezogen. Ben tippt ${t1}. Mia tippt ${[3, b === 7 ? 11 : 7, b, 28, 40, 46].sort((x, y) => x - y).join(', ')}. Welche Aussage ist richtig?`,
    good: 'Beide Tipps haben dieselbe Gewinnwahrscheinlichkeit, weil jede Auswahl von 6 Kugeln gleich wahrscheinlich ist.',
    bad: [['Mias Tipp ist wahrscheinlicher, weil die Zahlen „zufälliger“ aussehen.', 'Jede bestimmte Auswahl von sechs Kugeln ist gleich wahrscheinlich – auch eine mit aufeinanderfolgenden Zahlen.'],
      ['Bens Tipp ist wahrscheinlicher, weil kleine Zahlen öfter gezogen werden.', 'Alle Kugeln haben bei jeder Ziehung dieselbe Chance.']] }; },
};
/** Wheels comparison: numbers vary; the true statement is found by cross-multiplication (both paths). */
function wheels(rng) {
  const n1 = rng.pick([6, 8, 10, 12]), n2 = rng.pick([5, 9, 15, 16, 20]);
  const r1 = rng.int(2, n1 - 2), r2 = rng.int(2, n2 - 2);
  return { n1, n2, r1, r2 };
}

const claims = {
  id: `${SKILL}.claims`, version: 1, skillId: SKILL,
  families: ['judge_claim'],
  levels: [4],
  levelNotes: { 4: 'Wahrscheinlichkeitsaussagen aus dem Alltag beurteilen (Spielerfehlschluss, Regenwahrscheinlichkeit, Erwartung bei vielen Würfen, Lottotipps, zwei Glücksräder vergleichen); genau eine Aussage ist richtig.' },
  misconceptions: ['gamblers_fallacy', 'prob_as_certainty', 'absolute_vs_relative'],
  sample(rng) {
    const sit = rng.pick(['coin', 'rain', 'six', 'lotto', 'wheels', 'wheels', 'wheels']);
    const order = rng.shuffle([0, 1, 2]);
    if (sit === 'wheels') return { sit, w: wheels(rng), order };
    return { sit, seed: rng.int(0, 1e6), order };
  },
  constraints(p) {
    if (p.sit !== 'wheels') return true;
    const { n1, n2, r1, r2 } = p.w;
    if (r1 * n2 === r2 * n1) return 'equal probabilities';
    if ((r1 > r2) === (r1 * n2 > r2 * n1)) return 'absolute count already decides (no trap)';
    return true;
  },
  /** Effective content only: the situation's text and true statement (the sub-seed may give identical wording). */
  signatureParams(p) {
    if (p.sit === 'wheels') return { sit: p.sit, w: p.w };
    const s = claimSituation(p);
    return { sit: p.sit, text: s.text, good: s.good };
  },
  build(p) {
    const s = p.sit === 'wheels' ? wheelClaims(p.w) : claimSituation(p);
    const raw = [{ id: 'g', text: s.good }, ...s.bad.map(([text, feedback], i) => ({ id: `f${i}`, text, category: 'concept_confusion', feedback }))];
    const options = p.order.map(i => raw[i]);
    const steps = [s.good, ...(s.why ? [s.why] : [])];
    return {
      prompt: s.text, instructions: 'Wähle die richtige Aussage.',
      answer: { type: 'choice', options, correct: 'g', canonical: 'g' },
      hints: hints('Eine Wahrscheinlichkeit beschreibt, was auf lange Sicht ungefähr passiert – nicht, was im Einzelfall sicher passiert.',
        p.sit === 'wheels' ? 'Vergleiche Anteile, nicht Anzahlen: Welcher Anteil der Felder ist rot?' : 'Prüfe bei jeder Aussage: Behauptet sie etwas Sicheres oder Genaues, obwohl es um Zufall geht?',
        p.sit === 'wheels' ? `Rad A: $\\frac{${p.w.r1}}{${p.w.n1}}$, Rad B: $\\frac{${p.w.r2}}{${p.w.n2}}$.` : 'Zufallsgeräte wie Münzen und Würfel haben kein Gedächtnis.',
        steps, p.sit === 'wheels' ? 'Bringe beide Brüche auf einen gemeinsamen Nenner oder rechne sie in Prozent um.' : 'Denke an sehr viele Wiederholungen: Was würde man dann ungefähr beobachten?'),
      solution: { steps, result: s.good },
    };
  },
  /** Independent: wheels by cross-multiplication on the shown numbers; conceptual situations by their fixed key. */
  solve(p) {
    if (p.sit !== 'wheels') return 'g';
    const { n1, n2, r1, r2 } = p.w;
    const aBetter = BigInt(r1) * BigInt(n2) > BigInt(r2) * BigInt(n1);
    const s = wheelClaims(p.w);
    const want = aBetter ? 'Bei Rad A' : 'Bei Rad B';
    const all = [{ id: 'g', text: s.good }, ...s.bad.map(([text], i) => ({ id: `f${i}`, text }))];
    const hit = all.find(o => o.text.startsWith(want) && o.text.includes('größer'));
    return hit ? hit.id : null;
  },
};
function claimSituation(p) { return CLAIMS[p.sit](new (require('../../core').Rng)(p.seed >>> 0)); }
function wheelClaims(w) {
  const { n1, n2, r1, r2 } = w;
  const pA = F(r1).div(n1), pB = F(r2).div(n2), aBetter = pA.cmp(pB) > 0;
  const more = r1 > r2 ? 'A' : 'B';
  const better = aBetter ? 'A' : 'B', worse = aBetter ? 'B' : 'A';
  const pct = f => deNum(f.mul(100).round(1));
  return {
    text: `Rad A hat ${n1} gleich große Felder, davon ${r1} rot. Rad B hat ${n2} gleich große Felder, davon ${r2} rot. Welche Aussage ist richtig?`,
    good: `Bei Rad ${better} ist die Wahrscheinlichkeit für Rot größer.`,
    why: `Rad A: $\\frac{${r1}}{${n1}}$ (etwa ${pct(pA)} %), Rad B: $\\frac{${r2}}{${n2}}$ (etwa ${pct(pB)} %).`,
    bad: [[`Bei Rad ${worse} ist die Wahrscheinlichkeit für Rot größer, weil es ${more === worse ? 'mehr rote Felder' : 'weniger Felder insgesamt'} hat.`, 'Entscheidend ist der Anteil der roten Felder an allen Feldern, nicht die Anzahl.'],
      ['Bei beiden Rädern ist die Wahrscheinlichkeit für Rot gleich groß.', 'Rechne beide Anteile aus und vergleiche sie.']],
  };
}

module.exports = [compute, counting, claims];
module.exports.helpers = { countB, countS, texToMachine };
