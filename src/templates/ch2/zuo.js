'use strict';
/**
 * zuo.js — shared helpers for Chapter II (Proportionalität und Antiproportionalität). No randomness, no DOM.
 *
 * Two independent number paths (architecture rule 3):
 *  - BUILD path: Fractions from the model parameter (factor k for proportional, product c for antiproportional).
 *  - SOLVE path: only the numbers SHOWN to the student (a reference pair) through the expression engine
 *    (`viaExpr`, Dreisatz written as a term), and BigInt cross-multiplication for classifying tables (`classify`).
 *
 * All contexts are original. Units in answer specs are only those of question.UNITS (D56, D62); other units
 * (km/h, cm) appear in texts only.
 */
const { Fraction } = require('../../core');
const P = require('../ch6/pct');

const F = x => Fraction.of(typeof x === 'number' ? String(x) : x);
const { deNum, texNum, eur, eur2, eur2Tex } = P;
const NAMES = ['Lea', 'Ben', 'Aylin', 'Tom', 'Mia', 'Noah', 'Emma', 'Luca', 'Jonas', 'Sara'];

/** Decimal places of a terminating Fraction (≤ 6), else -1. */
function places(f) { f = F(f); let p = 0; while (p <= 6 && !f.round(p).eq(f)) p++; return p > 6 ? -1 : p; }
const fitsPlaces = (f, n) => { const p = places(f); return p >= 0 && p <= n; };
/** Fraction → machine decimal string "2.5" (params stay human-readable). */
const dstr = f => F(f).toDecimalString(places(f), '.');

// ---------------------------------------------------------------- quantities
/**
 * A quantity describes one side of a Zuordnung.
 *  label: column header, unit: UNITS key or null, money: euros, count: whole numbers only,
 *  text(v): value in running text, tex(v): value inside a table ($…$).
 */
function qty(label, opts = {}) {
  const q = { label, unit: opts.unit || (opts.money ? '€' : null), money: !!opts.money, count: !!opts.count };
  q.text = opts.text || (v => (q.money ? eur(v) : `${deNum(v)}${q.unit ? ` ${q.unit}` : ''}`));
  q.tex = v => `$${q.money ? eur2Tex(v) : texNum(v)}$`;
  return q;
}
const plural = (one, many) => v => `${deNum(v)} ${F(v).eq(1) ? one : many}`;

/** Answer spec for a number on side q (money: two decimals; counts and other integers: integer). */
function numSpec(v, q, extra = {}) {
  v = F(v);
  const unit = q && q.unit ? { unit: q.unit } : {};
  if (q && q.money) return { type: 'decimal', value: v.toString(), tolerance: '0', places: 2, canonical: eur2(v), ...unit, ...extra };
  if (v.isInteger()) return { type: 'integer', value: v.toString(), canonical: v.toString(), ...unit, ...extra };
  return { type: 'decimal', value: v.toString(), tolerance: '0', places: places(v), canonical: deNum(v), ...unit, ...extra };
}
/** Keep distractors that differ from the answer, are positive, finite decimals or fractions, and unique. */
function dist(answer, list) {
  const a = F(answer), out = [];
  for (const d of list) {
    if (d.value === null || d.value === undefined) continue;
    const x = F(d.value);
    if (x.eq(a) || x.sign() <= 0 || out.some(o => F(o.value).eq(x))) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}
/** Kind of a spec value for the instructions line. */
function unitHint(q) {
  if (!q) return '';
  if (q.money) return 'Die Einheit € kannst du weglassen.';
  if (q.unit) return `Die Einheit ${q.unit} kannst du weglassen.`;
  return '';
}

// ---------------------------------------------------------------- independent solve path
/** Exact value of a machine term built only from displayed numbers (expression engine, not Fraction ops). */
function viaExpr(machine) { return P.viaExpr(machine); }
const mach = P.mach;
/** Proportional Dreisatz from the displayed pair (x0 → y0): value for x. */
function propFrom(x0, y0, x) { return viaExpr(`${mach(y0)}/${mach(x0)}*${mach(x)}`); }
/** Proportional, backwards: x for value y. */
function propBack(x0, y0, y) { return viaExpr(`${mach(x0)}/${mach(y0)}*${mach(y)}`); }
/** Antiproportional Dreisatz from (x0 → y0): value for x (and, by symmetry, x for a value). */
function antiFrom(x0, y0, x) { return viaExpr(`${mach(x0)}*${mach(y0)}/${mach(x)}`); }

/** Decimal string → [BigInt mantissa, scale]. */
function big(str) { return P.scaled(dstr(str)); }
/** BigInt a·10^-sa compared with b·10^-sb → product as [BigInt, scale]. */
function mulScaled([a, sa], [b, sb]) { return [a * b, sa + sb]; }
function eqScaled([a, sa], [b, sb]) { const s = Math.max(sa, sb); return a * 10n ** BigInt(s - sa) === b * 10n ** BigInt(s - sb); }
/**
 * Independent classifier of a value table [[x, y], …] (decimal strings) by BigInt cross-multiplication:
 * 'prop' if y_i·x_j = y_j·x_i for all pairs, 'anti' if all products x_i·y_i agree, else 'neither'.
 */
function classify(pairs) {
  const B = pairs.map(([x, y]) => [big(x), big(y)]);
  let prop = true, anti = true;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    if (!eqScaled(mulScaled(B[i][1], B[j][0]), mulScaled(B[j][1], B[i][0]))) prop = false;
    if (!eqScaled(mulScaled(B[i][0], B[i][1]), mulScaled(B[j][0], B[j][1]))) anti = false;
  }
  return prop ? 'prop' : (anti ? 'anti' : 'neither');
}
/** Independent: true iff the points lie on ONE straight line (equal difference quotients, BigInt). */
function collinear(pairs) {
  const B = pairs.map(([x, y]) => [big(x), big(y)]);
  const sub = ([a, sa], [b, sb]) => { const s = Math.max(sa, sb); return [a * 10n ** BigInt(s - sa) - b * 10n ** BigInt(s - sb), s]; };
  const dx0 = sub(B[1][0], B[0][0]), dy0 = sub(B[1][1], B[0][1]);
  for (let i = 2; i < B.length; i++) {
    const dx = sub(B[i][0], B[0][0]), dy = sub(B[i][1], B[0][1]);
    if (!eqScaled(mulScaled(dy, dx0), mulScaled(dy0, dx))) return false;
  }
  return true;
}

// ---------------------------------------------------------------- contexts
/**
 * Proportional contexts: x → y with y = r·x. `r[level]` unit rates (y per one x), `x[level]` = [lo, hi, step].
 * given(x,y): statement of a known pair; askY(x) / askX(y): question; claim(x,y): “Dann …” sentence for L4.
 */
const kg = qty('Gewicht (kg)', { unit: 'kg' });
const euro = qty('Preis (€)', { money: true });
const PROP = [
  {
    id: 'apples', x: kg, y: euro, r: { 1: ['2', '3', '4'], 2: ['1.2', '1.5', '1.8', '2.4', '2.5', '3.5'], 3: ['1.4', '1.8', '2.6', '3.2', '2.25', '1.75'] },
    xr: { 1: [1, 10, 1], 2: [2, 9, 1], 3: [1, 8, 0.5] },
    given: (x, y) => `${deNum(x)} kg Äpfel kosten ${eur(y)}.`, askY: x => `Wie viel kosten ${deNum(x)} kg Äpfel?`,
    askX: y => `Wie viel Kilogramm Äpfel bekommt man für ${eur(y)}?`, claim: (x, y) => `Dann kosten ${deNum(x)} kg Äpfel ${eur(y)}.`,
    intro: 'Die Tabelle zeigt Preise für Äpfel auf dem Markt.',
  },
  {
    id: 'fuel', x: qty('Benzin (l)', { unit: 'l' }), y: euro, r: { 1: ['2'], 2: ['1.6', '1.7', '1.8', '1.9'], 3: ['1.65', '1.72', '1.85', '1.79'] },
    xr: { 1: [5, 50, 5], 2: [10, 60, 5], 3: [11, 49, 1] },
    given: (x, y) => `Für ${deNum(x)} l Benzin bezahlt man ${eur(y)}.`, askY: x => `Wie viel kosten ${deNum(x)} l Benzin?`,
    askX: y => `Wie viel Liter Benzin bekommt man für ${eur(y)}?`, claim: (x, y) => `Dann kosten ${deNum(x)} l Benzin ${eur(y)}.`,
    intro: 'Die Tabelle zeigt Preise an einer Tankstelle.',
  },
  {
    id: 'tap', x: qty('Zeit (min)', { unit: 'min' }), y: qty('Wasser (l)', { unit: 'l' }), r: { 1: ['6', '8', '9', '12'], 2: ['6', '8', '9', '12', '15'], 3: ['7.5', '10.5', '4.5', '12.5'] },
    xr: { 1: [1, 10, 1], 2: [2, 12, 1], 3: [1, 9, 0.5] },
    given: (x, y) => `Aus einem Wasserhahn fließen gleichmäßig in ${deNum(x)} min ${deNum(y)} l Wasser.`, askY: x => `Wie viel Wasser fließt in ${deNum(x)} min?`,
    askX: y => `Wie lange dauert es, bis ${deNum(y)} l Wasser geflossen sind?`, claim: (x, y) => `Dann fließen in ${deNum(x)} min ${deNum(y)} l Wasser.`,
    intro: 'Ein Wasserhahn ist gleichmäßig geöffnet. Die Tabelle zeigt, wie viel Wasser in einer bestimmten Zeit fließt.',
  },
  {
    id: 'train', x: qty('Fahrzeit (h)', { unit: 'h' }), y: qty('Strecke (km)', { unit: 'km' }), r: { 1: ['60', '80', '100'], 2: ['60', '80', '90', '120', '150'], 3: ['70', '90', '110', '130'] },
    xr: { 1: [1, 6, 1], 2: [2, 6, 1], 3: [1, 6, 0.5] },
    given: (x, y) => `Ein Zug fährt mit gleichbleibender Geschwindigkeit und legt in ${deNum(x)} h ${deNum(y)} km zurück.`, askY: x => `Wie weit kommt der Zug in ${deNum(x)} h?`,
    askX: y => `Wie lange braucht der Zug für ${deNum(y)} km?`, claim: (x, y) => `Dann legt der Zug in ${deNum(x)} h ${deNum(y)} km zurück.`,
    intro: 'Ein Zug fährt mit gleichbleibender Geschwindigkeit. Die Tabelle zeigt Fahrzeit und Strecke.',
  },
  {
    id: 'fabric', x: qty('Stofflänge (m)', { unit: 'm' }), y: euro, r: { 1: ['4', '5', '6', '8'], 2: ['4.5', '6', '7.5', '8.4', '12.5'], 3: ['5.8', '9.6', '11.2', '7.25'] },
    xr: { 1: [1, 8, 1], 2: [2, 9, 1], 3: [1, 6, 0.5] },
    given: (x, y) => `${deNum(x)} m Stoff kosten ${eur(y)}.`, askY: x => `Wie viel kosten ${deNum(x)} m Stoff?`,
    askX: y => `Wie viele Meter Stoff bekommt man für ${eur(y)}?`, claim: (x, y) => `Dann kosten ${deNum(x)} m Stoff ${eur(y)}.`,
    intro: 'Die Tabelle zeigt Preise für einen Stoff, der meterweise verkauft wird.',
  },
  {
    id: 'recipe', x: qty('Anzahl der Personen', { count: true, text: plural('Person', 'Personen') }), y: qty('Mehl (g)', { unit: 'g' }),
    r: { 1: ['50', '60', '100'], 2: ['50', '60', '75', '80', '125'], 3: ['62.5', '37.5', '87.5', '45'] },
    xr: { 1: [1, 10, 1], 2: [2, 12, 1], 3: [2, 12, 1] },
    given: (x, y) => `Für ein Rezept für ${plural('Person', 'Personen')(x)} braucht man ${deNum(y)} g Mehl.`, askY: x => `Wie viel Mehl braucht man für ${plural('Person', 'Personen')(x)}?`,
    askX: y => `Für wie viele Personen reichen ${deNum(y)} g Mehl?`, claim: (x, y) => `Dann braucht man für ${plural('Person', 'Personen')(x)} ${deNum(y)} g Mehl.`,
    intro: 'Die Tabelle zeigt, wie viel Mehl man für ein Rezept braucht.',
  },
];
/**
 * Antiproportional contexts: x → y with x·y = c (fixed total). `c[level]` products, `x[level]` candidate x values.
 */
const ANTI = [
  {
    id: 'share', x: qty('Anzahl der Personen', { count: true, text: plural('Person', 'Personen') }), y: qty('Betrag pro Person (€)', { money: true }),
    c: { 1: ['60', '72', '84', '90', '96', '120'], 2: ['120', '144', '180', '240', '150', '210'], 3: ['135', '157.5', '187.5', '225', '262.5'] },
    xs: { 1: [2, 3, 4, 5, 6, 8, 10, 12], 2: [2, 3, 4, 5, 6, 8, 9, 10, 12, 15], 3: [2, 3, 4, 5, 6, 8, 10, 12] },
    given: (x, y) => `Wenn sich ${plural('Person', 'Personen')(x)} die Kosten für einen Ausflug teilen, bezahlt jede Person ${eur(y)}.`,
    askY: x => `Wie viel bezahlt jede Person, wenn sich ${plural('Person', 'Personen')(x)} die Kosten teilen?`,
    askX: y => `Wie viele Personen müssen sich die Kosten teilen, damit jede Person ${eur(y)} bezahlt?`,
    claim: (x, y) => `Dann bezahlt bei ${plural('Person', 'Personen')(x)} jede Person ${eur(y)}.`,
    intro: 'Die Kosten für einen Ausflug werden gleichmäßig aufgeteilt.',
  },
  {
    id: 'pumps', x: qty('Anzahl der Pumpen', { count: true, text: plural('Pumpe', 'Pumpen') }), y: qty('Zeit (h)', { unit: 'h' }),
    c: { 1: ['12', '24', '36', '48', '60'], 2: ['24', '36', '48', '60', '72', '90'], 3: ['18', '30', '45', '54', '75'] },
    xs: { 1: [2, 3, 4, 6], 2: [2, 3, 4, 5, 6, 8], 3: [2, 3, 4, 5, 6, 8, 9] },
    given: (x, y) => `${plural('gleich starke Pumpe', 'gleich starke Pumpen')(x)} leeren ein Becken in ${deNum(y)} h.`,
    askY: x => `Wie lange brauchen ${plural('Pumpe', 'Pumpen')(x)} für dasselbe Becken?`,
    askX: y => `Wie viele Pumpen braucht man, um das Becken in ${deNum(y)} h zu leeren?`,
    claim: (x, y) => `Dann leeren ${plural('Pumpe', 'Pumpen')(x)} das Becken in ${deNum(y)} h.`,
    intro: 'Gleich starke Pumpen leeren ein Becken.',
  },
  {
    id: 'trip', x: qty('Geschwindigkeit (km/h)', { text: v => `${deNum(v)} km/h` }), y: qty('Fahrzeit (h)', { unit: 'h' }),
    c: { 1: ['120', '240', '360'], 2: ['180', '240', '300', '360', '480'], 3: ['150', '210', '270', '330'] },
    xs: { 1: [40, 60, 80, 120], 2: [40, 60, 80, 90, 100, 120], 3: [50, 60, 70, 75, 90, 100] },
    given: (x, y) => `Bei einer Durchschnittsgeschwindigkeit von ${deNum(x)} km/h dauert eine Fahrt ${deNum(y)} h.`,
    askY: x => `Wie lange dauert dieselbe Fahrt bei ${deNum(x)} km/h?`,
    askX: y => `Wie schnell muss man im Durchschnitt fahren, damit dieselbe Fahrt ${deNum(y)} h dauert?`,
    claim: (x, y) => `Dann dauert die Fahrt bei ${deNum(x)} km/h ${deNum(y)} h.`,
    intro: 'Eine Strecke wird mit verschiedenen Durchschnittsgeschwindigkeiten gefahren.', xAnswerNote: 'Gib die Geschwindigkeit in km/h an (ohne Einheit).',
  },
  {
    id: 'bed', x: qty('Breite (m)', { unit: 'm' }), y: qty('Länge (m)', { unit: 'm' }),
    c: { 1: ['12', '24', '36'], 2: ['24', '36', '48', '60'], 3: ['18', '30', '45', '54'] },
    xs: { 1: [1, 2, 3, 4, 6], 2: [2, 3, 4, 5, 6, 8], 3: [1.5, 2, 2.5, 3, 4, 5, 6, 7.5] },
    given: (x, y) => `Ein rechteckiges Beet ist ${deNum(x)} m breit und ${deNum(y)} m lang.`,
    askY: x => `Wie lang muss ein gleich großes rechteckiges Beet sein, das ${deNum(x)} m breit ist?`,
    askX: y => `Wie breit muss ein gleich großes rechteckiges Beet sein, das ${deNum(y)} m lang ist?`,
    claim: (x, y) => `Dann ist ein gleich großes Beet mit ${deNum(x)} m Breite ${deNum(y)} m lang.`,
    intro: 'Rechteckige Beete haben alle denselben Flächeninhalt.',
  },
  {
    id: 'fodder', x: qty('Anzahl der Pferde', { count: true, text: plural('Pferd', 'Pferde') }), y: qty('Dauer (Tage)', { unit: 'Tage', count: true }),
    c: { 1: ['60', '120', '180'], 2: ['120', '180', '240', '360'], 3: ['90', '150', '210', '270'] },
    xs: { 1: [2, 3, 4, 5, 6], 2: [3, 4, 5, 6, 8, 9, 10, 12], 3: [2, 3, 5, 6, 9, 10, 15] },
    given: (x, y) => `Ein Futtervorrat reicht für ${plural('Pferd', 'Pferde')(x)} ${deNum(y)} Tage.`,
    askY: x => `Wie lange reicht derselbe Vorrat für ${plural('Pferd', 'Pferde')(x)}?`,
    askX: y => `Für wie viele Pferde reicht derselbe Vorrat ${deNum(y)} Tage?`,
    claim: (x, y) => `Dann reicht der Vorrat für ${plural('Pferd', 'Pferde')(x)} ${deNum(y)} Tage.`,
    intro: 'Ein Futtervorrat wird an Pferde verfüttert; jedes Pferd frisst gleich viel.',
  },
  {
    id: 'bags', x: qty('Kekse pro Tüte', { count: true, text: plural('Keks', 'Kekse') }), y: qty('Anzahl der Tüten', { count: true, text: plural('Tüte', 'Tüten') }),
    c: { 1: ['60', '120'], 2: ['120', '144', '180', '240'], 3: ['144', '180', '216', '360'] },
    xs: { 1: [4, 5, 6, 10, 12, 15, 20], 2: [6, 8, 9, 10, 12, 15, 18, 20], 3: [8, 9, 12, 15, 18, 24, 30] },
    given: (x, y) => `Ein Bäcker verteilt Kekse auf Tüten. Mit je ${deNum(x)} Keksen pro Tüte füllt er ${plural('Tüte', 'Tüten')(y)}.`,
    askY: x => `Wie viele Tüten füllt er mit je ${deNum(x)} Keksen pro Tüte?`,
    askX: y => `Wie viele Kekse muss er in jede Tüte packen, um ${plural('Tüte', 'Tüten')(y)} zu füllen?`,
    claim: (x, y) => `Dann füllt er mit je ${deNum(x)} Keksen ${plural('Tüte', 'Tüten')(y)}.`,
    intro: 'Ein Bäcker verteilt immer dieselbe Menge Kekse gleichmäßig auf Tüten.',
  },
];

/** Values lo..hi in steps (as decimal strings). */
function range([lo, hi, step]) { const out = []; for (let v = F(lo); v.cmp(F(hi)) <= 0; v = v.add(F(step))) out.push(dstr(v)); return out; }
/** Pick n distinct values from a list, returned ascending (numerically). */
function pickDistinct(rng, list, n) {
  const pool = list.slice(), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out.sort((a, b) => F(a).cmp(F(b)));
}
/** A value is admissible on side q (counts integer, money ≤ 2 decimals, others ≤ 2 decimals; always positive). */
function admissible(v, q) {
  v = F(v);
  if (v.sign() <= 0) return false;
  if (q.count) return v.isInteger();
  return fitsPlaces(v, 2);
}

/** A factor is “simple” if it or its reciprocal is a whole number (doubling, tripling, halving …). */
const simpleFactor = f => { f = F(f); return f.isInteger() || F(1).div(f).isInteger(); };
/**
 * Apply a simple factor f to y in words and LaTeX: f whole → “mit $f$ multipliziert”, y·f;
 * otherwise f = 1/n → “durch $n$ geteilt”, y : n. tex(v) formats numbers.
 */
function scaleStep(y, f, tex) {
  f = F(f); y = F(y);
  if (f.isInteger()) return { word: `mit $${tex(f)}$ multipliziert`, calc: `${tex(y)} \\cdot ${tex(f)} = ${tex(y.mul(f))}` };
  const n = F(1).div(f);
  return { word: `durch $${tex(n)}$ geteilt`, calc: `${tex(y)} : ${tex(n)} = ${tex(y.mul(f))}` };
}

module.exports = {
  simpleFactor, scaleStep,
  F, NAMES, places, fitsPlaces, dstr, qty, plural, numSpec, dist, unitHint,
  viaExpr, mach, propFrom, propBack, antiFrom, classify, collinear,
  PROP, ANTI, range, pickDistinct, admissible, deNum, texNum, eur, eur2Tex,
};
