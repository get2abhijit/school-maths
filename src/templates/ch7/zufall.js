'use strict';
/**
 * zufall.js — shared helpers for Chapter VII (Daten und Zufall). No randomness of its own, no DOM.
 *
 * Two independent paths (architecture rule 3):
 *  - BUILD path: constructive enumeration (events listed by stepping through Ω with arithmetic), counting
 *    formulas, sorting/indexing for statistics.
 *  - SOLVE path: predicates tested on every outcome (`holds`), brute-force enumeration of outcome pairs, counting
 *    ranks for the median, and the expression engine (`viaExpr`) for means and probabilities.
 *
 * Notation decisions (D67): sets are written with semicolons, E = {2; 4; 6} (comma is the decimal separator);
 * the sample space is called „Ergebnismenge“ in words; probabilities are shown as reduced fractions, and as decimal
 * and percentage where they terminate. All contexts are original.
 */
const { Fraction } = require('../../core');
const P = require('../ch6/pct');

const F = x => Fraction.of(typeof x === 'number' ? String(x) : x);
const { deNum, texNum, viaExpr, mach } = P;
const NAMES = ['Lea', 'Ben', 'Aylin', 'Tom', 'Mia', 'Noah', 'Emma', 'Luca', 'Jonas', 'Sara', 'Elif', 'Finn'];

/** Decimal places of a terminating fraction (≤ 6) or -1. */
function places(f) { f = F(f); let p = 0; while (p <= 6 && !f.round(p).eq(f)) p++; return p > 6 ? -1 : p; }

// ---------------------------------------------------------------- probabilities
/** LaTeX of a probability as a reduced fraction (0 and 1 as integers). */
const probTex = f => F(f).toLatex();
/** Plain-text decimal and percentage of a probability, or '' when not terminating within 4 places. */
function probAlt(f) {
  f = F(f);
  if (f.isInteger()) return '';
  const p = places(f);
  if (p < 0 || p > 4) return '';
  return ` (= ${deNum(f)} = ${deNum(f.mul(100))} %)`;
}
/** Sentence part: „$\frac{3}{8}$ (= 0,375 = 37,5 %)“. */
const probText = f => `$${probTex(f)}$${probAlt(f)}`;
/** Result line for keys: the LAST math segment is the exact probability (the worksheet key checker reads it). */
function probResult(label, f) {
  f = F(f);
  const alt = probAlt(f);
  return `${label} $${probTex(f)}$.${alt ? ` Das sind ${deNum(f)} bzw. ${deNum(f.mul(100))} %.` : ''}`;
}

/** Distractors: unique, different from the answer, non-negative; values as fraction strings. */
function dist(answer, list) {
  const a = F(answer), out = [];
  for (const d of list) {
    if (d.value === null || d.value === undefined) continue;
    const x = F(d.value);
    if (x.eq(a) || x.sign() < 0 || out.some(o => F(o.value).eq(x))) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}
/** Answer spec for a probability (fraction, decimal or percent accepted; D66). */
function probSpec(f, distractors = []) {
  f = F(f);
  return { type: 'fraction', value: f.toString(), probability: true, canonical: f.toString(), distractors: dist(f, distractors) };
}
const PROB_INSTR = 'Gib die Wahrscheinlichkeit als Bruch (z. B. 3/8), als Dezimalzahl oder in Prozent an.';

/** Answer spec for a plain number (integer or terminating decimal). */
function numSpec(v, extra = {}) {
  v = F(v);
  if (v.isInteger()) return { type: 'integer', value: v.toString(), canonical: v.toString(), ...extra };
  const p = places(v);
  if (p < 0) throw new Error(`numSpec: non-terminating ${v}`);
  return { type: 'decimal', value: v.toString(), tolerance: '0', places: p, canonical: deNum(v), ...extra };
}
/** Numeric distractors (may be negative, e.g. temperatures). */
function ndist(answer, list) {
  const a = F(answer), out = [];
  for (const d of list) {
    if (d.value === null || d.value === undefined) continue;
    const x = F(d.value);
    if (x.eq(a) || out.some(o => F(o.value).eq(x))) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}

// ---------------------------------------------------------------- sets
/** One element in LaTeX: numbers as numbers, words in \text{}. */
const elTex = e => (typeof e === 'number' ? texNum(F(e)) : `\\text{${e}}`);
/** LaTeX of a set: \{2;\ 4;\ 6\}; the empty set as \{\,\}. */
const setTex = arr => (arr.length ? `\\{${arr.map(elTex).join(';\\ ')}\\}` : '\\{\\,\\}');
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// ---------------------------------------------------------------- number events (die, octahedron, wheel, urn)
/**
 * Event kinds on Ω = {1, …, n}. Each kind has
 *  text(a): words („eine gerade Zahl“), build(n, a): constructive list (BUILD path), test(x, a): predicate (SOLVE path).
 * `a` is the kind's parameter (threshold, divisor, …).
 */
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19];
const KINDS = {
  even: { adj: () => 'gerade', text: () => 'eine gerade Zahl', build: n => stepList(2, n, 2), test: x => x % 2 === 0 },
  odd: { adj: () => 'ungerade', text: () => 'eine ungerade Zahl', build: n => stepList(1, n, 2), test: x => x % 2 === 1 },
  gt: { adj: a => `größer als ${a}`, text: a => `eine Zahl größer als ${a}`, build: (n, a) => stepList(a + 1, n, 1), test: (x, a) => x > a },
  ge: { adj: a => `mindestens ${a}`, text: a => `eine Zahl, die mindestens ${a} ist`, build: (n, a) => stepList(a, n, 1), test: (x, a) => x >= a },
  lt: { adj: a => `kleiner als ${a}`, text: a => `eine Zahl kleiner als ${a}`, build: (n, a) => stepList(1, a - 1, 1), test: (x, a) => x < a },
  le: { adj: a => `höchstens ${a}`, text: a => `eine Zahl, die höchstens ${a} ist`, build: (n, a) => stepList(1, a, 1), test: (x, a) => x <= a },
  mult: { adj: a => `durch ${a} teilbar`, text: a => `eine durch ${a} teilbare Zahl`, build: (n, a) => stepList(a, n, a), test: (x, a) => x % a === 0 },
  prime: { adj: () => 'eine Primzahl', text: () => 'eine Primzahl', build: n => PRIMES.filter(p => p <= n), test: x => x > 1 && [2, 3, 5, 7].every(p => x === p || x % p !== 0) },
  divisor: { adj: a => `ein Teiler von ${a}`, text: a => `ein Teiler von ${a}`, build: (n, a) => stepList(1, n, 1).filter(d => Number.isInteger(a / d)), test: (x, a) => a % x === 0 },
};
function stepList(from, to, step) { const out = []; for (let x = from; x <= to; x += step) out.push(x); return out; }
/** Parameter choices per kind for Ω = {1..n}; chosen so the event is neither empty nor Ω. */
function kindParams(kind, n) {
  switch (kind) {
    case 'gt': case 'ge': return stepList(2, n - 1, 1);
    case 'lt': case 'le': return stepList(2, n - 1, 1);
    case 'mult': return [3, 4, 5].filter(m => m < n);
    case 'divisor': return [6, 8, 10, 12, 15, 18, 20].filter(a => a !== n);
    default: return [0];
  }
}
/** BUILD path: the event as a sorted list. */
const eventBuild = (n, ev) => KINDS[ev.kind].build(n, ev.a);
/** SOLVE path: test every outcome. */
const holds = (x, ev) => KINDS[ev.kind].test(x, ev.a);
const eventSolve = (n, ev) => stepList(1, n, 1).filter(x => holds(x, ev));
const eventText = ev => KINDS[ev.kind].text(ev.a);
const eventAdj = ev => KINDS[ev.kind].adj(ev.a);

/** Experiments with outcomes 1..n (equally likely). */
const NUM_EXPERIMENTS = [
  { id: 'die', n: 6, text: 'Ein fairer Würfel wird einmal geworfen. Beobachtet wird die Augenzahl.', what: 'Augenzahl', short: 'Würfel' },
  { id: 'octa', n: 8, text: 'Ein fairer Würfel mit acht Flächen (Augenzahlen 1 bis 8) wird einmal geworfen.', what: 'Augenzahl', short: 'Achterwürfel' },
  { id: 'wheel', n: 10, text: 'Ein Glücksrad hat zehn gleich große Felder mit den Zahlen 1 bis 10. Es wird einmal gedreht.', what: 'Zahl', short: 'Glücksrad' },
  { id: 'urn', n: 12, text: 'In einer Urne liegen zwölf gleiche Kugeln mit den Nummern 1 bis 12. Eine Kugel wird blind gezogen.', what: 'Nummer', short: 'Urne' },
];

module.exports = {
  F, deNum, texNum, viaExpr, mach, NAMES, places,
  probTex, probAlt, probText, probResult, dist, probSpec, PROB_INSTR, numSpec, ndist,
  elTex, setTex, sameSet,
  KINDS, kindParams, stepList, eventBuild, eventSolve, eventText, eventAdj, holds, NUM_EXPERIMENTS,
};
