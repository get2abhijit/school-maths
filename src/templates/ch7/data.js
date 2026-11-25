'use strict';
/**
 * Templates for LS7 VII.1 „Daten auswerten“ (skill ch7.data.analyze). All data sets and contexts are original.
 * Kenngrößen are the ones known from Kl. 5/6 (Minimum, Maximum, Spannweite, Median, Mittelwert; Bildungsplan
 * 3.1.5(4)); Kl. 7 uses them to extract information and judge statements (3.2.5(1), (2)). No Boxplots, no
 * Quartile (not in the standards for Kl. 7/8).
 *
 * ch7.data.analyze.stats (family statistics)
 *  L1 Grundlagen     An unsorted list (5, 7 or 9 values): one Kenngröße (Spannweite, Median or Mittelwert; the mean
 *                    is a whole number).
 *  L2 Standard       An even number of values: Spannweite, Median (may be „x,5“) and Mittelwert (≤ 1 decimal) in a
 *                    table answer.
 *  L3 Anspruchsvoll  Either a frequency table (Wert | Anzahl): Mittelwert rounded to one decimal and Median; or a list
 *                    with one outlier: Mittelwert with and without the outlier, Median with it.
 * ch7.data.analyze.judge (family judge_statement)
 *  L4 Transfer       Four statements about a data set; tick every true one (at least one true, at least one false).
 * Misconceptions: mean_median (swaps mean and median), unsorted_median (middle of the unsorted list),
 * range_as_max (Spannweite = Maximum), unweighted_mean (frequency table: mean of the distinct values),
 * outlier_effect (believes the median reacts like the mean to an outlier).
 * Independent solver: ranks by counting (no sort) for the median, the expression engine for sums and means,
 * a single pass for min/max; build sorts and indexes.
 */
const { hints, $ } = require('../util');
const Z = require('./zufall');
const { F, deNum, texNum, numSpec, ndist } = Z;

const SKILL = 'ch7.data.analyze';

/** Contexts: label (column header / words), value range, unit key for answers (D56 units only) or null. */
const LISTS = [
  { id: 'quiz', text: 'Die Punktzahlen einer Gruppe in einem Mathe-Quiz', label: 'Punkte', lo: 4, hi: 20, unit: null },
  { id: 'homework', text: 'Die Zeit für die Hausaufgaben an mehreren Tagen (in Minuten)', label: 'Minuten', lo: 15, hi: 55, unit: 'min', outlier: true },
  { id: 'handball', text: 'Die Tore einer Handballmannschaft in den letzten Spielen', label: 'Tore', lo: 18, hi: 34, unit: null },
  { id: 'temp', text: 'Die Temperatur um 7 Uhr morgens an mehreren Tagen (in °C)', label: '°C', lo: -6, hi: 9, unit: null },
  { id: 'books', text: 'Die Anzahl der im letzten Jahr gelesenen Bücher in einer Gruppe', label: 'Bücher', lo: 0, hi: 14, unit: null, outlier: true },
  { id: 'height', text: 'Die Körpergrößen einer Gruppe (in cm)', label: 'cm', lo: 142, hi: 171, unit: null },
  { id: 'bus', text: 'Die Wartezeit an einer Bushaltestelle an mehreren Tagen (in Minuten)', label: 'Minuten', lo: 2, hi: 12, unit: 'min', outlier: true },
  { id: 'throw', text: 'Die Weiten beim Schlagballwurf in einer Gruppe (in m)', label: 'm', lo: 18, hi: 44, unit: 'm', outlier: true },
];
const FREQ = [
  { id: 'siblings', text: 'In einer Klasse wurde gefragt, wie viele Geschwister jedes Kind hat.', col: 'Anzahl der Geschwister', from: 0, to: 4 },
  { id: 'goals', text: 'Ein Fußballverein hat notiert, wie viele Tore seine Jugendmannschaft in den Spielen einer Saison geschossen hat.', col: 'Tore im Spiel', from: 0, to: 5 },
  { id: 'pets', text: 'In einer Umfrage gaben Jugendliche an, wie viele Haustiere sie haben.', col: 'Anzahl der Haustiere', from: 0, to: 3 },
  { id: 'grades', text: 'Die Noten einer Klassenarbeit wurden in einer Tabelle zusammengefasst.', col: 'Note', from: 1, to: 6 },
];
const KN = { range: 'die Spannweite', median: 'den Median', mean: 'den Mittelwert (das arithmetische Mittel)' };
const KN_LABEL = { range: 'Spannweite', median: 'Median', mean: 'Mittelwert', meanR: 'Mittelwert (gerundet auf eine Nachkommastelle)', meanAll: 'Mittelwert mit allen Werten', meanOut: 'Mittelwert ohne den Ausreißer', medianAll: 'Median mit allen Werten' };

// ---------------------------------------------------------------- BUILD path (sort and index)
const sorted = xs => xs.slice().sort((a, b) => a - b);
function medianB(xs) { const s = sorted(xs), n = s.length; return n % 2 ? F(s[(n - 1) / 2]) : F(s[n / 2 - 1] + s[n / 2]).div(2); }
const sumB = xs => xs.reduce((a, b) => a + b, 0);
const meanB = xs => F(sumB(xs)).div(xs.length);
const rangeB = xs => { const s = sorted(xs); return F(s[s.length - 1] - s[0]); };
/** Expand a frequency table to the raw list. */
const expand = (vals, freq) => vals.flatMap((v, i) => new Array(freq[i]).fill(v));

// ---------------------------------------------------------------- SOLVE path (counting ranks, expression engine)
function medianS(xs) {
  // the k-th smallest value is the v with #(< v) < k ≤ #(≤ v)
  const n = xs.length;
  const kth = k => xs.find(v => xs.filter(w => w < v).length < k && k <= xs.filter(w => w <= v).length);
  return n % 2 ? F(kth((n + 1) / 2)) : Z.viaExpr(`(${Z.mach(kth(n / 2))}+${Z.mach(kth(n / 2 + 1))})/2`);
}
const meanS = xs => Z.viaExpr(`(${xs.map(x => Z.mach(x)).join('+')})/${xs.length}`);
function rangeS(xs) { let lo = Infinity, hi = -Infinity; for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; } return Z.viaExpr(`${Z.mach(hi)}-${Z.mach(lo)}`); }

// ---------------------------------------------------------------- display
/** Second summand: negatives in brackets, „(−3+(−3))“. */
const brk = x => (x < 0 ? `\\left(${texNum(F(x))}\\right)` : texNum(F(x)));
const listTex = xs => xs.map(x => texNum(F(x))).join(';\\ ');
const sortedTex = xs => listTex(sorted(xs));
function medianSteps(xs) {
  const s = sorted(xs), n = s.length, m = medianB(xs);
  if (n % 2) return `Sortiert: $${sortedTex(xs)}$. Bei ${n} Werten steht der Median an Stelle ${(n + 1) / 2}: $${texNum(m)}$.`;
  return `Sortiert: $${sortedTex(xs)}$. Bei ${n} Werten liegt der Median zwischen dem ${n / 2}. und ${n / 2 + 1}. Wert: $(${texNum(F(s[n / 2 - 1]))}+${brk(s[n / 2])}) : 2 = ${texNum(m)}$.`;
}
function meanSteps(xs, round) {
  const m = meanB(xs);
  const exact = Z.places(m) >= 0 && Z.places(m) <= 4 ? texNum(m) : null;
  const r = round ? m.round(1) : null;
  const tail = round ? (exact !== null && r.eq(m) ? ` = ${exact}` : ` \\approx ${texNum(r)}`) : ` = ${texNum(m)}`;
  return `Summe: $${texNum(F(sumB(xs)))}$. Mittelwert: $${texNum(F(sumB(xs)))} : ${xs.length}${tail}$.`;
}
const rangeStep = xs => { const s = sorted(xs); return `Spannweite = Maximum − Minimum: $${texNum(F(s[s.length - 1]))} - ${s[0] < 0 ? `(${texNum(F(s[0]))})` : texNum(F(s[0]))} = ${texNum(rangeB(xs))}$.`; };

// ---------------------------------------------------------------- distractors
const unsortedMid = xs => (xs.length % 2 ? F(xs[(xs.length - 1) / 2]) : F(xs[xs.length / 2 - 1] + xs[xs.length / 2]).div(2));
function distFor(kind, xs) {
  const s = sorted(xs);
  if (kind === 'range') return [{ value: F(s[s.length - 1]), category: 'concept_confusion', feedback: 'Das ist das Maximum. Die Spannweite ist der Unterschied zwischen größtem und kleinstem Wert.' },
    { value: F(s[s.length - 1] + s[0]), category: 'sign_error', feedback: 'Die Spannweite ist eine Differenz: größter Wert minus kleinster Wert.' }];
  if (kind === 'median') return [{ value: unsortedMid(xs), category: 'concept_confusion', feedback: 'Das ist der mittlere Wert der unsortierten Liste. Sortiere die Werte zuerst der Größe nach.' },
    { value: meanB(xs), category: 'concept_confusion', feedback: 'Das ist der Mittelwert. Der Median ist der Wert in der Mitte der sortierten Liste.' }];
  return [{ value: medianB(xs), category: 'concept_confusion', feedback: 'Das ist der Median. Für den Mittelwert teilst du die Summe aller Werte durch ihre Anzahl.' },
    { value: F(sumB(xs)).div(xs.length - 1), category: 'other', feedback: 'Teile die Summe durch die Anzahl aller Werte.' }];
}
/** The unrounded mean, when rounding to one decimal is required. */
const RND = m => ({ value: m, category: 'rounding', feedback: 'Der Wert stimmt, aber du sollst auf eine Nachkommastelle runden.' });
/** Keep only distractors that a decimal spec can represent exactly as listed (terminating). */
const term = list => list.filter(d => Z.places(d.value) >= 0);

// ---------------------------------------------------------------- sampling
function sampleList(rng, ctx, n, mod) {
  // n−1 free values, then a last value making sum·mod divisible by n (mean with few decimals)
  const xs = []; for (let i = 0; i < n - 1; i++) xs.push(rng.int(ctx.lo, ctx.hi));
  const s = sumB(xs);
  const cands = Z.stepList(ctx.lo, ctx.hi, 1).filter(v => ((s + v) * mod) % n === 0);
  xs.push(cands.length ? rng.pick(cands) : ctx.lo);
  return rng.shuffle(xs);
}

const stats = {
  id: `${SKILL}.stats`, version: 1, skillId: SKILL,
  families: ['statistics'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Eine Kenngröße (Spannweite, Median oder Mittelwert) aus einer unsortierten Liste mit ungerader Anzahl.',
    2: 'Spannweite, Median und Mittelwert bei gerader Anzahl (Median auch „x,5“, Mittelwert mit höchstens einer Nachkommastelle).',
    3: 'Häufigkeitstabelle (Mittelwert gerundet, Median) oder Liste mit Ausreißer (Mittelwert mit/ohne Ausreißer, Median).',
  },
  misconceptions: ['mean_median', 'unsorted_median', 'range_as_max', 'unweighted_mean', 'outlier_effect'],
  sample(rng, level) {
    const name = rng.pick(Z.NAMES);
    if (level === 1) {
      const ci = rng.int(0, LISTS.length - 1), ask = rng.pick(['range', 'median', 'mean']);
      return { level, name, ctx: ci, ask, xs: sampleList(rng, LISTS[ci], rng.pick([5, 7, 9]), 1) };
    }
    if (level === 2) { const ci = rng.int(0, LISTS.length - 1); return { level, name, ctx: ci, xs: sampleList(rng, LISTS[ci], rng.pick([6, 8, 10]), 10) }; }
    if (rng.int(0, 1) === 0) {
      const fi = rng.int(0, FREQ.length - 1), fc = FREQ[fi];
      const vals = Z.stepList(fc.from, fc.to, 1);
      return { level, mode: 'freq', fctx: fi, vals, freq: vals.map(() => rng.int(1, 9)) };
    }
    const outs = LISTS.map((c, i) => i).filter(i => LISTS[i].outlier), ci = rng.pick(outs), c = LISTS[ci];
    const base = []; const n = rng.pick([6, 7, 8]);
    const mid = rng.int(c.lo, Math.floor((c.lo + c.hi) / 2));
    for (let i = 0; i < n - 1; i++) base.push(rng.int(Math.max(c.lo, mid - 4), mid + 4));
    const out = c.hi + rng.int(Math.ceil((c.hi - c.lo) / 2), c.hi - c.lo + 10);
    const xs = rng.shuffle([...base, out]);
    return { level, mode: 'outlier', name, ctx: ci, xs, out };
  },
  constraints(p, level) {
    if (level === 1 && p.ask === 'mean' && !meanB(p.xs).isInteger()) return 'mean not integer';
    if (level === 1 && p.ask === 'median' && unsortedMid(p.xs).eq(medianB(p.xs))) return 'unsorted middle equals median';
    if (level <= 2 && new Set(p.xs).size < 3) return 'too few distinct values';
    if (level === 2 && Z.places(meanB(p.xs)) > 1) return 'mean has more than one decimal';
    if (level === 2 && meanB(p.xs).eq(medianB(p.xs))) return 'mean equals median';
    if (level === 3 && p.mode === 'freq') {
      const xs = expand(p.vals, p.freq), un = F(sumB(p.vals)).div(p.vals.length);
      if (meanB(xs).round(1).eq(un.round(1))) return 'weighted mean equals unweighted';
      if (xs.length < 12) return 'too few data';
    }
    if (level === 3 && p.mode === 'outlier') {
      const rest = p.xs.filter((x, i) => i !== p.xs.indexOf(p.out));
      if (rest.some(x => x >= p.out)) return 'outlier not unique maximum';
      if (meanB(p.xs).round(1).eq(meanB(rest).round(1))) return 'outlier without effect';
    }
    return true;
  },
  signatureParams(p) { const { name, ...rest } = p; return rest; },
  build(p, level) {
    if (level === 1) return buildOne(p);
    if (level === 2) return buildThree(p);
    return p.mode === 'freq' ? buildFreq(p) : buildOutlier(p);
  },
  solve(p, level) {
    if (level === 1) return Z.numSpec(p.ask === 'range' ? rangeS(p.xs) : p.ask === 'median' ? medianS(p.xs) : meanS(p.xs)).canonical;
    if (level === 2) return { range: inp(rangeS(p.xs)), median: inp(medianS(p.xs)), mean: inp(meanS(p.xs)) };
    if (p.mode === 'freq') { const xs = expand(p.vals, p.freq); return { mean: inp(meanS(xs).round(1)), median: inp(medianS(xs)) }; }
    const rest = p.xs.slice(); rest.splice(p.xs.indexOf(Math.max(...p.xs)), 1);
    return { meanAll: inp(meanS(p.xs).round(1)), meanOut: inp(meanS(rest).round(1)), medianAll: inp(medianS(p.xs)) };
  },
};
const inp = f => deNum(f);
const unitOf = ctx => (ctx.unit ? { unit: ctx.unit } : {});
const unitWord = ctx => (ctx.unit ? ` Die Einheit ${ctx.unit} kannst du weglassen.` : '');

function buildOne(p) {
  const ctx = LISTS[p.ctx], xs = p.xs, kind = p.ask;
  const v = kind === 'range' ? rangeB(xs) : kind === 'median' ? medianB(xs) : meanB(xs);
  const spec = numSpec(v, { ...unitOf(ctx), distractors: term(ndist(v, distFor(kind, xs))) });
  const step = kind === 'range' ? rangeStep(xs) : kind === 'median' ? medianSteps(xs) : meanSteps(xs);
  const steps = [step];
  return {
    prompt: `${p.name} hat Daten gesammelt. ${ctx.text}: $${listTex(xs)}$. Bestimme ${KN[kind]}.`,
    instructions: `Gib eine Zahl ein.${unitWord(ctx)}`,
    answer: spec,
    hints: hints(
      kind === 'range' ? 'Die Spannweite sagt, wie weit die Werte auseinanderliegen.' : kind === 'median' ? 'Der Median ist der Wert in der Mitte, wenn man die Werte der Größe nach ordnet.' : 'Der Mittelwert verteilt die Summe gleichmäßig auf alle Werte.',
      kind === 'range' ? 'Suche den größten und den kleinsten Wert und bilde die Differenz.' : kind === 'median' ? 'Sortiere die Werte zuerst. Bei ungerader Anzahl gibt es genau einen mittleren Wert.' : 'Addiere alle Werte und teile durch ihre Anzahl.',
      kind === 'median' ? `Sortiert: $${sortedTex(xs)}$.` : kind === 'mean' ? `Die Summe ist $${texNum(F(sumB(xs)))}$, die Anzahl ist ${xs.length}.` : `Größter Wert: $${texNum(F(Math.max(...xs)))}$, kleinster Wert: $${texNum(F(Math.min(...xs)))}$.`,
      steps,
      kind === 'mean' ? 'Probe: Wenn jeder Wert gleich dem Mittelwert wäre, käme dieselbe Summe heraus.' : kind === 'median' ? 'Streiche abwechselnd den kleinsten und den größten Wert, bis einer übrig bleibt.' : 'Ordne die Werte; die Spannweite ist der Abstand vom ersten zum letzten Wert.'),
    solution: { steps, result: `${KN_LABEL[kind]}: $${texNum(v)}$${ctx.unit ? ` ${ctx.unit}` : ''}` },
  };
}

function cell(id, v, distractors, extra = {}) {
  return { id, label: KN_LABEL[id], spec: numSpec(v, { ...extra, distractors: term(ndist(v, distractors)) }) };
}
function buildThree(p) {
  const ctx = LISTS[p.ctx], xs = p.xs;
  const cells = [cell('range', rangeB(xs), distFor('range', xs), unitOf(ctx)), cell('median', medianB(xs), distFor('median', xs), unitOf(ctx)), cell('mean', meanB(xs), distFor('mean', xs), unitOf(ctx))];
  const steps = [rangeStep(xs), medianSteps(xs), meanSteps(xs)];
  return {
    prompt: `${p.name} hat Daten gesammelt. ${ctx.text}: $${listTex(xs)}$. Bestimme Spannweite, Median und Mittelwert.`,
    instructions: `Fülle alle drei Felder aus.${unitWord(ctx)}`,
    answer: { type: 'table', cells },
    hints: hints('Alle drei Kenngrößen werden leichter, wenn du die Werte zuerst der Größe nach ordnest.',
      `Bei ${xs.length} Werten (gerade Anzahl) gibt es zwei mittlere Werte; der Median liegt genau zwischen ihnen.`,
      `Sortiert: $${sortedTex(xs)}$. Summe: $${texNum(F(sumB(xs)))}$.`,
      steps, 'Kontrolle: Median und Mittelwert liegen beide zwischen dem kleinsten und dem größten Wert.'),
    solution: { steps, result: cells.map(c => `${c.label}: $${texNum(F(c.spec.value))}$`).join('; ') },
  };
}
function buildFreq(p) {
  const fc = FREQ[p.fctx], xs = expand(p.vals, p.freq), N = xs.length, m = meanB(xs), med = medianB(xs);
  const un = F(sumB(p.vals)).div(p.vals.length);
  const weighted = p.vals.map((v, i) => `${v}\\cdot ${p.freq[i]}`).join('+');
  const cells = [
    { id: 'mean', label: KN_LABEL.meanR, spec: numSpec(m.round(1), { distractors: term(ndist(m.round(1), [RND(m), { value: un.round(1), category: 'concept_confusion', feedback: 'Du hast nur die Werte der ersten Spalte gemittelt. Jeder Wert zählt so oft, wie es die Anzahl angibt.' }, { value: F(N).div(p.vals.length).round(1), category: 'concept_confusion', feedback: 'Das ist der Mittelwert der Anzahlen. Gesucht ist der Mittelwert der Werte.' }])) }) },
    { id: 'median', label: KN_LABEL.median, spec: numSpec(med, { distractors: term(ndist(med, [{ value: medianB(p.vals), category: 'concept_confusion', feedback: 'Das ist der mittlere Wert der ersten Spalte. Der Median ist der mittlere Wert aller Daten (alle Kinder bzw. Spiele).' }])) }) },
  ];
  const s = sorted(xs);
  const medTxt = N % 2 ? `Bei ${N} Werten ist der Median der ${(N + 1) / 2}. Wert der geordneten Liste: $${texNum(med)}$.` : `Bei ${N} Werten liegt der Median zwischen dem ${N / 2}. und ${N / 2 + 1}. Wert: $(${s[N / 2 - 1]}+${s[N / 2]}) : 2 = ${texNum(med)}$.`;
  const steps = [`Anzahl aller Daten: $${p.freq.join('+')} = ${N}$.`, `Summe: $${weighted} = ${sumB(xs)}$.`,
    `Mittelwert: $${sumB(xs)} : ${N} ${m.round(1).eq(m) ? '=' : '\\approx'} ${texNum(m.round(1))}$.`, medTxt];
  return {
    prompt: `${fc.text} Bestimme den Mittelwert und den Median.`,
    promptTable: { columns: [fc.col, 'Anzahl'], rows: p.vals.map((v, i) => [`$${v}$`, `$${p.freq[i]}$`]) },
    instructions: 'Runde den Mittelwert auf eine Nachkommastelle.',
    answer: { type: 'table', cells },
    hints: hints('Jeder Wert der ersten Spalte kommt so oft vor, wie die zweite Spalte angibt.',
      'Mittelwert: jeden Wert mit seiner Anzahl multiplizieren, alles addieren und durch die Anzahl aller Daten teilen. Median: Zähle in der Tabelle bis zur Mitte.',
      `Es gibt ${N} Daten, die Summe ist $${weighted} = ${sumB(xs)}$.`, steps,
      'Schreibe die Daten als geordnete Liste aus (z. B. „0, 0, 1, 1, 1, …“) und bestimme dann beide Kenngrößen.'),
    solution: { steps, result: `Mittelwert: $${texNum(m.round(1))}$; Median: $${texNum(med)}$` },
  };
}
function buildOutlier(p) {
  const ctx = LISTS[p.ctx], xs = p.xs, rest = xs.slice();
  rest.splice(xs.indexOf(p.out), 1);
  const mA = meanB(xs).round(1), mO = meanB(rest).round(1), med = medianB(xs);
  const cells = [
    { id: 'meanAll', label: KN_LABEL.meanAll, spec: numSpec(mA, { ...unitOf(ctx), distractors: term(ndist(mA, [RND(meanB(xs)), { value: mO, category: 'concept_confusion', feedback: 'Hier ist der Mittelwert mit allen Werten gefragt, also mit dem Ausreißer.' }])) }) },
    { id: 'meanOut', label: KN_LABEL.meanOut, spec: numSpec(mO, { ...unitOf(ctx), distractors: term(ndist(mO, [RND(meanB(rest)), { value: mA, category: 'concept_confusion', feedback: 'Lass den Ausreißer (den auffällig großen Wert) weg und teile durch die kleinere Anzahl.' }, { value: F(sumB(rest)).div(xs.length).round(1), category: 'other', feedback: 'Ohne den Ausreißer gibt es einen Wert weniger. Teile durch die neue Anzahl.' }])) }) },
    { id: 'medianAll', label: KN_LABEL.medianAll, spec: numSpec(med, { ...unitOf(ctx), distractors: term(ndist(med, [{ value: mA, category: 'concept_confusion', feedback: 'Das ist der Mittelwert. Der Median ist der Wert in der Mitte der sortierten Liste.' }, { value: unsortedMid(xs), category: 'concept_confusion', feedback: 'Sortiere die Werte zuerst der Größe nach.' }])) }) },
  ];
  const steps = [meanSteps(xs, true), `Der Ausreißer ist $${p.out}$. ${meanSteps(rest, true)}`, medianSteps(xs),
    'Der Ausreißer verändert den Mittelwert deutlich, den Median kaum.'];
  return {
    prompt: `${p.name} hat Daten gesammelt. ${ctx.text}: $${listTex(xs)}$. Ein Wert ist auffällig groß (ein Ausreißer).`,
    instructions: `Runde die Mittelwerte auf eine Nachkommastelle.${unitWord(ctx)}`,
    answer: { type: 'table', cells },
    hints: hints('Ein Ausreißer ist ein Wert, der weit von den übrigen Werten entfernt liegt.',
      'Berechne den Mittelwert zweimal: einmal mit allen Werten, einmal ohne den Ausreißer. Für den Median sortierst du alle Werte.',
      `Der Ausreißer ist $${p.out}$. Summe aller Werte: $${sumB(xs)}$, ohne den Ausreißer: $${sumB(rest)}$.`, steps,
      'Vergleiche: Der Mittelwert „spürt“ jeden Wert, der Median nur die Reihenfolge. Deshalb beschreibt der Median hier die typische Lage besser.'),
    solution: { steps, result: cells.map(c => `${c.label}: $${texNum(F(c.spec.value))}$`).join('; ') },
  };
}

// ---------------------------------------------------------------- L4 judge statements
/**
 * Statement makers: (xs, rng) → {text, truthB} where truthB uses the BUILD path; `truthS` (SOLVE path) is computed
 * separately from the statement's structured form {kind, v}.
 */
const ST = {
  meanGtMedian: { mk: () => ({ kind: 'meanGtMedian' }), text: () => 'Der Mittelwert ist größer als der Median.' },
  rangeIs: { mk: (xs, rng) => ({ kind: 'rangeIs', v: rng.bool() ? Number(rangeB(xs).n) : Math.max(...xs) }), text: s => `Die Spannweite beträgt $${texNum(F(s.v))}$.` },
  halfAbove: { mk: (xs, rng) => ({ kind: 'halfAbove', v: rng.pick(sorted(xs).slice(1, -1)) }), text: s => `Mehr als die Hälfte der Werte ist größer als $${texNum(F(s.v))}$.` },
  meanInList: { mk: () => ({ kind: 'meanInList' }), text: () => 'Der Mittelwert kommt selbst als Wert in der Liste vor.' },
  maxUpMedian: { mk: () => ({ kind: 'maxUpMedian' }), text: () => 'Erhöht man den größten Wert um $10$, ändert sich der Median nicht.' },
  maxUpMean: { mk: () => ({ kind: 'maxUpMean' }), text: () => 'Erhöht man den größten Wert um $10$, ändert sich der Mittelwert nicht.' },
  medianIs: { mk: (xs, rng) => ({ kind: 'medianIs', v: (rng.bool() ? medianB(xs) : unsortedMid(xs)).toString() }), text: s => `Der Median ist $${texNum(F(s.v))}$.` },
};
function truthB(s, xs) {
  switch (s.kind) {
    case 'meanGtMedian': return meanB(xs).cmp(medianB(xs)) > 0;
    case 'rangeIs': return rangeB(xs).eq(s.v);
    case 'halfAbove': return 2 * sorted(xs).filter(x => x > s.v).length > xs.length;
    case 'meanInList': return xs.some(x => meanB(xs).eq(x));
    case 'maxUpMedian': { const ys = sorted(xs); ys[ys.length - 1] += 10; return medianB(ys).eq(medianB(xs)); }
    case 'maxUpMean': return false;
    case 'medianIs': return medianB(xs).eq(F(s.v));
    default: throw new Error(s.kind);
  }
}
function truthS(s, xs) {
  switch (s.kind) {
    case 'meanGtMedian': return meanS(xs).cmp(medianS(xs)) > 0;
    case 'rangeIs': return rangeS(xs).eq(s.v);
    case 'halfAbove': { let c = 0; for (const x of xs) if (x > s.v) c++; return c / xs.length > 0.5; }
    case 'meanInList': { const m = meanS(xs); return xs.some(x => F(x).eq(m)); }
    case 'maxUpMedian': { const i = xs.indexOf(Math.max(...xs)); const ys = xs.map((x, j) => (j === i ? x + 10 : x)); return medianS(ys).eq(medianS(xs)); }
    case 'maxUpMean': { const i = xs.indexOf(Math.max(...xs)); const ys = xs.map((x, j) => (j === i ? x + 10 : x)); return meanS(ys).eq(meanS(xs)); }
    case 'medianIs': return medianS(xs).eq(F(s.v));
    default: throw new Error(s.kind);
  }
}
const ST_FEEDBACK = {
  meanGtMedian: xs => `Mittelwert $${texNum(meanB(xs).round(2))}$${Z.places(meanB(xs)) > 2 || Z.places(meanB(xs)) < 0 ? ' (gerundet)' : ''}, Median $${texNum(medianB(xs))}$.`,
  rangeIs: xs => `Spannweite: $${texNum(rangeB(xs))}$ (größter minus kleinster Wert).`,
  halfAbove: (xs, s) => `$${sorted(xs).filter(x => x > s.v).length}$ von $${xs.length}$ Werten sind größer als $${texNum(F(s.v))}$.`,
  meanInList: xs => `Der Mittelwert ist $${Z.places(meanB(xs)) >= 0 && Z.places(meanB(xs)) <= 2 ? texNum(meanB(xs)) : `${texNum(meanB(xs).round(2))}\\ldots`}$.`,
  maxUpMedian: () => 'Der Median hängt nur von den mittleren Werten der sortierten Liste ab; der größte Wert bleibt der größte.',
  maxUpMean: () => 'Die Summe wird um $10$ größer, also auch der Mittelwert.',
  medianIs: xs => `Sortiert: $${sortedTex(xs)}$; Median: $${texNum(medianB(xs))}$.`,
};

const judge = {
  id: `${SKILL}.judge`, version: 1, skillId: SKILL,
  families: ['judge_statement'],
  levels: [4],
  levelNotes: { 4: 'Aussagen über einen Datensatz beurteilen (Mittelwert/Median, Spannweite, Anteil über einem Wert, Wirkung eines Ausreißers); alle wahren Aussagen ankreuzen.' },
  misconceptions: ['mean_median', 'unsorted_median', 'range_as_max', 'outlier_effect'],
  sample(rng) {
    const ci = rng.pick([0, 1, 2, 4, 5, 6, 7]), xs = sampleList(rng, LISTS[ci], rng.pick([7, 8, 9]), 1);
    const kinds = rng.shuffle(Object.keys(ST)).slice(0, 4);
    return { name: rng.pick(Z.NAMES), ctx: ci, xs, st: kinds.map(k => ST[k].mk(xs, rng)) };
  },
  constraints(p) {
    const t = p.st.map(s => truthB(s, p.xs));
    if (!t.some(Boolean) || t.every(Boolean)) return 'need true and false statements';
    if (meanB(p.xs).eq(medianB(p.xs))) return 'mean equals median';
    if (new Set(p.xs).size < 4) return 'too few distinct values';
    if (p.st.some(s => s.kind === 'medianIs') && unsortedMid(p.xs).eq(medianB(p.xs))) return 'median trap not a trap';
    return true;
  },
  signatureParams(p) { const { name, ...rest } = p; return rest; },
  build(p) {
    const ctx = LISTS[p.ctx], ids = ['a', 'b', 'c', 'd'];
    const options = p.st.map((s, i) => ({ id: ids[i], text: ST[s.kind].text(s) }));
    const correct = ids.filter((_, i) => truthB(p.st[i], p.xs));
    const steps = p.st.map((s, i) => `${ids[i].toUpperCase()}: ${truthB(s, p.xs) ? 'wahr' : 'falsch'}. ${ST_FEEDBACK[s.kind](p.xs, s)}`);
    return {
      prompt: `${p.name} hat Daten gesammelt. ${ctx.text}: $${listTex(p.xs)}$. Welche Aussagen sind wahr?`,
      instructions: 'Kreuze alle wahren Aussagen an.',
      answer: { type: 'multiselect', options, correct, canonical: correct },
      hints: hints('Prüfe jede Aussage einzeln mit den passenden Kenngrößen.',
        'Ordne die Werte zuerst; berechne dann Median, Mittelwert und Spannweite.',
        `Sortiert: $${sortedTex(p.xs)}$; Median $${texNum(medianB(p.xs))}$, Summe $${sumB(p.xs)}$ bei ${p.xs.length} Werten.`, steps,
        'Bei Aussagen über „was passiert, wenn …“: Ändere die Liste in Gedanken und vergleiche vorher und nachher.'),
      solution: { steps, result: `Wahr: ${correct.map(c => c.toUpperCase()).join(', ')}` },
    };
  },
  solve(p) { return ['a', 'b', 'c', 'd'].filter((_, i) => truthS(p.st[i], p.xs)); },
};

module.exports = [stats, judge];
module.exports.helpers = { medianB, medianS, meanB, meanS, rangeB, rangeS, expand };
