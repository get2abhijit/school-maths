'use strict';
/**
 * util.js — shared helpers for exercise templates (no DOM, no randomness of its own).
 *
 * Conventions
 * - "machine" strings are parsed by expr.js (dot decimals, '*' or implicit products, '/' fractions).
 * - Display LaTeX for task terms is ALWAYS produced from the parsed machine string via toLatex,
 *   so what the student sees and what the independent solver computes cannot drift apart.
 * - Independent solvers (`solveExpanded`, `evalMachine`, brute force) use the expression engine;
 *   template `build` functions compute answers by direct arithmetic on the parameters.
 */
const { Fraction } = require('../core');
const X = require('../expr');

const F = x => Fraction.of(x);

/** Exactly five hints in the required order. `solutionSteps` becomes the worked-solution hint. */
function hints(orientation, strategy, step, solutionSteps, alternative) {
  return [
    { kind: 'orientation', text: orientation },
    { kind: 'strategy', text: strategy },
    { kind: 'step', text: step },
    { kind: 'solution', text: solutionSteps.join(' \u2003 ') },
    { kind: 'alternative', text: alternative },
  ];
}

/** LaTeX of a machine expression (via the parser → printer). */
function tex(machine, opts) { return X.toLatex(X.parse(machine), opts); }
const $ = s => `$${s}$`;

/** Decimal places needed to write a terminating fraction exactly. */
function placesOf(f) { let p = 0; while (!f.round(p).eq(f)) p++; return p; }

/** Number → LaTeX. opts.dec: show terminating non-integers as decimals (comma). */
function numTex(f, opts = {}) {
  f = F(f);
  if (opts.dec && !f.isInteger() && f.isTerminatingDecimal()) return f.toDecimalString(placesOf(f), '{,}');
  return f.toLatex();
}
/** Number → what a student would type (comma decimals or a/b). */
function numInput(f, opts = {}) {
  f = F(f);
  if (f.isInteger()) return f.toString();
  if (opts.dec && f.isTerminatingDecimal()) return f.toDecimalString(placesOf(f), ',');
  return f.toString();
}
/** Number → machine literal (dot decimals). Negative values are bracketed when opts.bracket. */
function numMachine(f, opts = {}) {
  f = F(f);
  let s = f.isInteger() ? f.toString()
    : (opts.dec && f.isTerminatingDecimal() ? f.toDecimalString(placesOf(f), '.') : `${f.abs().n}/${f.d}`);
  if (!f.isInteger() && !(opts.dec && f.isTerminatingDecimal()) && f.sign() < 0) s = `-${s}`;
  // "1.125" would be rejected as a possible thousands separator (D5): pad to "1.1250".
  s = s.replace(/^(-?[1-9]\d*\.\d{3})$/, '$10');
  if (opts.bracket && f.sign() < 0) s = `(${s})`;
  return s;
}

/**
 * Monomial list → machine string. terms: [[coef, power]] in display order; zero coefficients skipped.
 * opts.v variable name (default x), opts.dec decimal coefficients, opts.keepZero keeps zero terms.
 */
function polyMachine(terms, opts = {}) {
  const v = opts.v || 'x';
  let out = '';
  for (const [c0, p] of terms) {
    const c = F(c0);
    if (c.isZero() && !opts.keepZero) continue;
    const neg = c.sign() < 0, a = c.abs();
    const mono = p === 0 ? '' : (p === 1 ? v : `${v}^${p}`);
    let body;
    if (!mono) body = numMachine(a, opts);
    else if (a.eq(1)) body = mono;
    else body = `${numMachine(a, opts)}${mono}`;
    out += neg ? `-${body}` : (out ? `+${body}` : body);
  }
  return out || '0';
}
/** Canonical student input for a monomial list: like polyMachine but comma decimals. */
function polyInput(terms, opts = {}) { return polyMachine(terms, opts).replace(/(\d)\.(\d)/g, '$1,$2'); }

/** Independent solver: simplify a machine expression to polynomial normal form string. */
function solveExpanded(machine, variables = ['x']) {
  const p = X.toPoly(X.parse(machine, { variables }));
  if (!p) throw new Error(`solveExpanded: not a polynomial: ${machine}`);
  return X.polyToString(p);
}
/** Independent solver: exact value of a variable-free machine expression. */
function evalMachine(machine, env) { return X.evaluate(X.parse(machine), env || {}); }
/** True iff two machine expressions are algebraically equivalent. */
function equiv(a, b, variables = ['x']) {
  return X.equivalent(X.parse(a, { variables }), X.parse(b, { variables }), variables).equivalent;
}

// ---------------------------------------------------------------- stepwise reduction
function normalize(n) {
  if (n.t === 'paren' && n.a.t === 'num') return n.a;
  if (n.t === 'neg' && n.a.t === 'num') return n.a.dec ? { t: 'num', v: n.a.v.neg(), dec: true } : { t: 'num', v: n.a.v.neg() };
  return n;
}
function combine(op, a, b) {
  const x = a.v, y = b.v;
  let v;
  if (op === 'add') v = x.add(y);
  else if (op === 'sub') v = x.sub(y);
  else if (op === 'mul') v = x.mul(y);
  else if (op === 'div') v = x.div(y);
  else if (op === 'pow') v = x.pow(Number(y.n));
  const dec = (a.dec || b.dec) && v.isTerminatingDecimal() && !(op === 'div' && !a.dec && !b.dec);
  return dec ? { t: 'num', v, dec: true } : { t: 'num', v };
}
/** One leftmost-innermost reduction step on a variable-free AST, or null if it is a single number. */
function reduceOnce(n) {
  if (n.t === 'num' || n.t === 'var') return null;
  if (n.t === 'paren' || n.t === 'neg') {
    const r = reduceOnce(n.a);
    if (r) return normalize({ ...n, a: r });
    const nn = normalize(n);
    return nn !== n ? nn : null;
  }
  const ra = reduceOnce(n.a);
  if (ra) return { ...n, a: ra };
  const rb = reduceOnce(n.b);
  if (rb) return { ...n, b: rb };
  if (n.a.t === 'num' && n.b.t === 'num') return combine(n.t, n.a, n.b);
  return null;
}
/**
 * Worked steps for a numeric expression: list of LaTeX strings (first = the task as written),
 * each obtained by one reduction; visually identical consecutive lines are merged.
 * Returns {lines, value:Fraction, node}.
 */
function reduceSteps(ast, opts = {}) {
  const lines = [X.toLatex(ast, opts)];
  const normAll = n => { const o = { ...n }; if (n.a) o.a = normAll(n.a); if (n.b) o.b = normAll(n.b); return normalize(o); };
  let cur = normAll(ast), guard = 0;
  for (;;) {
    const nx = reduceOnce(cur);
    if (!nx) break;
    cur = nx;
    const s = X.toLatex(cur, opts);
    if (s !== lines[lines.length - 1]) lines.push(s);
    if (++guard > 200) throw new Error('reduceSteps: no progress');
  }
  if (cur.t !== 'num') throw new Error('reduceSteps: expression not numeric');
  return { lines, value: cur.v, node: cur };
}
/** Replace variable `name` by a number node (display brackets are added by the printer). */
function substitute(ast, name, value, opts = {}) {
  const f = F(value);
  const numNode = opts.dec && !f.isInteger() ? { t: 'num', v: f, dec: true } : { t: 'num', v: f };
  const rep = numNode; // the printer brackets negatives (non-leading) and fraction/negative bases itself
  (function check(n) { if (n.t === 'var' && n.name !== name) throw new Error('substitute: other variable'); if (n.a) check(n.a); if (n.b) check(n.b); })(ast);
  function go(n) {
    if (n.t === 'var') return rep;
    const out = { ...n };
    if (n.a) out.a = go(n.a);
    if (n.b) out.b = go(n.b);
    if (n.t === 'mul' && n.implicit) delete out.implicit;
    return out;
  }
  return go(ast);
}
/** Joins worked-solution lines into "A = B = C" with LaTeX delimiters. */
function chain(lines) { return $(lines.join(' = ')); }

// ---------------------------------------------------------------- distractors
/** Keep numeric distractors that differ from the answer and from each other. */
function numDistractors(answer, list) {
  const a = F(answer), seen = [];
  return list.filter(d => {
    const v = F(d.value);
    if (v.eq(a) || seen.some(s => s.eq(v))) return false;
    seen.push(v);
    return true;
  }).map(d => ({ ...d, value: F(d.value).toString() }));
}
/** Keep expression distractors that are not equivalent to the answer nor to each other. */
function exprDistractors(answer, list, variables = ['x']) {
  const kept = [];
  for (const d of list) {
    if (equiv(d.value, answer, variables)) continue;
    if (kept.some(k => equiv(k.value, d.value, variables))) continue;
    kept.push(d);
  }
  return kept;
}

/** German multiplier words ("das Dreifache"). */
const FACH = { 2: 'Doppelte', 3: 'Dreifache', 4: 'Vierfache', 5: 'Fünffache', 6: 'Sechsfache', 7: 'Siebenfache', 8: 'Achtfache', 9: 'Neunfache', 10: 'Zehnfache' };
const FACHEN = { 2: 'Doppelten', 3: 'Dreifachen', 4: 'Vierfachen', 5: 'Fünffachen', 6: 'Sechsfachen', 7: 'Siebenfachen', 8: 'Achtfachen', 9: 'Neunfachen', 10: 'Zehnfachen' };

/** Integer gcd for plain numbers. */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

module.exports = {
  F, hints, tex, $, numTex, numInput, numMachine, polyMachine, polyInput, placesOf,
  solveExpanded, evalMachine, equiv, reduceSteps, reduceOnce, substitute, chain,
  numDistractors, exprDistractors, FACH, FACHEN, gcd,
};
