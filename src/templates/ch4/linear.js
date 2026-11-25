'use strict';
/**
 * linear.js — linear equations in one variable for Chapter 4 templates (no DOM, no randomness).
 *
 * A SIDE is a list of parts, in display order:
 *   {t:'x', c}          c·x            (c: Fraction-compatible)
 *   {t:'n', c}          the number c
 *   {t:'br', f, a, b}   f·(a·x + b)    (a ≠ 0, b ≠ 0)
 * An equation is {L: side, R: side}.
 *
 * Two code paths (decision D18):
 *   BUILD path  — `lin`, `chain`: direct arithmetic on the parts, also produces the worked solution lines.
 *   SOLVE path  — `solveMachine`: parses the displayed machine strings with expr.js and solves via the
 *                 polynomial normal form of L − R. Templates use it in `solve` and in constraints.
 */
const X = require('../../expr');
const U = require('../util');
const { Fraction, bgcd } = require('../../core');

const F = U.F;
const ZERO = F(0);

// ---------------------------------------------------------------- machine strings / LaTeX
function partBody(p) {
  // returns {neg, body} with body = machine string of |part|
  if (p.t === 'x') { const c = F(p.c); return { neg: c.sign() < 0, body: U.polyMachine([[c.abs(), 1]]) }; }
  if (p.t === 'n') { const c = F(p.c); return { neg: c.sign() < 0, body: U.numMachine(c.abs()) }; }
  if (p.t === 'br') {
    const f = F(p.f);
    const inner = U.polyMachine([[p.a, 1], [p.b, 0]]);
    return { neg: f.sign() < 0, body: f.abs().eq(1) ? `(${inner})` : `${U.numMachine(f.abs())}(${inner})` };
  }
  throw new Error(`bad part ${JSON.stringify(p)}`);
}
/** Side → machine string (parsed by expr.js). Empty side = "0". */
function sideMachine(side) {
  if (!side.length) return '0';
  return side.map((p, i) => { const { neg, body } = partBody(p); return neg ? `-${body}` : (i ? `+${body}` : body); }).join('');
}
function eqMachine(eq) { return [sideMachine(eq.L), sideMachine(eq.R)]; }
function sideTex(side) { return U.tex(sideMachine(side)); }
function eqTex(eq) { return `${sideTex(eq.L)} = ${sideTex(eq.R)}`; }

// ---------------------------------------------------------------- build path: arithmetic on parts
/** Side → {a, b} with side = a·x + b (Fractions). */
function lin(side) {
  let a = ZERO, b = ZERO;
  for (const p of side) {
    if (p.t === 'x') a = a.add(p.c);
    else if (p.t === 'n') b = b.add(p.c);
    else { a = a.add(F(p.f).mul(p.a)); b = b.add(F(p.f).mul(p.b)); }
  }
  return { a, b };
}
const hasBracket = side => side.some(p => p.t === 'br');
function expand(side) {
  return side.flatMap(p => (p.t === 'br' ? [{ t: 'x', c: F(p.f).mul(p.a).toString() }, { t: 'n', c: F(p.f).mul(p.b).toString() }] : [p]));
}
function needsCollect(side) {
  const xs = side.filter(p => p.t === 'x').length, ns = side.filter(p => p.t === 'n').length;
  return xs > 1 || ns > 1 || side.some(p => p.t !== 'br' && F(p.c).isZero() && side.length > 1);
}
/** Collected side: x-term first, then the number; zero parts dropped; [] stays []. */
function collect(side) {
  const { a, b } = lin(side);
  const out = [];
  if (!a.isZero()) out.push({ t: 'x', c: a.toString() });
  if (!b.isZero()) out.push({ t: 'n', c: b.toString() });
  return out;
}
function scale(side, m) {
  return side.map(p => (p.t === 'br' ? { ...p, f: F(p.f).mul(m).toString() } : { ...p, c: F(p.c).mul(m).toString() }));
}
function denominators(side) {
  return side.flatMap(p => (p.t === 'br' ? [F(p.f).d, F(p.a).d, F(p.b).d] : [F(p.c).d]));
}
const blcm = (a, b) => a / bgcd(a, b) * b;

/**
 * Worked solution by equivalence transformations (build path).
 * Returns {lines:[{eq, op}], kind:'one'|'none'|'all', value?:Fraction}
 * op (annotation of the transformation applied AFTER that line):
 *   {k:'expand'} {k:'collect'} {k:'mul', v} {k:'add', v, x:boolean} {k:'div', v}
 * Order: brackets → collect → clear fractions → x-terms to the left → numbers to the right → divide.
 * opts.from: skip the bracket/collect phase markers (used when continuing a chain).
 */
function chain(eq0) {
  const lines = [{ eq: eq0, op: null }];
  let eq = eq0;
  const step = (op, next) => { lines[lines.length - 1].op = op; lines.push({ eq: next, op: null }); eq = next; };
  if (hasBracket(eq.L) || hasBracket(eq.R)) step({ k: 'expand' }, { L: expand(eq.L), R: expand(eq.R) });
  if (needsCollect(eq.L) || needsCollect(eq.R)) step({ k: 'collect' }, { L: collect(eq.L), R: collect(eq.R) });
  const den = [...denominators(eq.L), ...denominators(eq.R)].reduce(blcm, 1n);
  if (den > 1n) { const m = F(den); step({ k: 'mul', v: m.toString() }, { L: scale(eq.L, m), R: scale(eq.R, m) }); }
  let l = lin(eq.L), r = lin(eq.R);
  if (!r.a.isZero()) {
    const v = r.a.neg();
    step({ k: 'add', v: v.toString(), x: true }, { L: collect([...eq.L, { t: 'x', c: v.toString() }]), R: collect([...eq.R, { t: 'x', c: v.toString() }]) });
    l = lin(eq.L); r = lin(eq.R);
  }
  if (l.a.isZero()) {
    // x has vanished: a statement about numbers remains
    if (!eq.L.length || !eq.R.length) {
      // make both sides explicit numbers (\"0\")
      lines[lines.length - 1].eq = { L: eq.L.length ? eq.L : [{ t: 'n', c: '0' }], R: eq.R.length ? eq.R : [{ t: 'n', c: '0' }] };
    }
    return { lines, kind: l.b.eq(r.b) ? 'all' : 'none' };
  }
  if (!l.b.isZero()) {
    const v = l.b.neg();
    step({ k: 'add', v: v.toString(), x: false }, { L: collect([...eq.L, { t: 'n', c: v.toString() }]), R: collect([...eq.R, { t: 'n', c: v.toString() }]) });
    l = lin(eq.L); r = lin(eq.R);
  }
  if (!eq.R.length) { lines[lines.length - 1].eq = { L: eq.L, R: [{ t: 'n', c: '0' }] }; eq = lines[lines.length - 1].eq; }
  if (!l.a.eq(1)) {
    const value = r.b.div(l.a);
    step({ k: 'div', v: l.a.toString() }, { L: [{ t: 'x', c: '1' }], R: [{ t: 'n', c: value.toString() }] });
  }
  const value = lin(eq.R).b;
  return { lines, kind: 'one', value };
}

/** LaTeX of an operation annotation (after the bar). Text operations return null (written in words). */
function opTex(op) {
  if (op.k === 'add') {
    const v = F(op.v);
    const body = op.x ? U.tex(U.polyMachine([[v.abs(), 1]])) : U.numTex(v.abs());
    return `${v.sign() < 0 ? '-' : '+'}${body}`;
  }
  if (op.k === 'mul') return `\\cdot ${U.numTex(op.v)}`;
  if (op.k === 'div') { const v = F(op.v); return v.sign() < 0 ? `:\\left(${U.numTex(v)}\\right)` : `:${U.numTex(v)}`; }
  return null;
}
const OP_WORDS_DE = { expand: 'Klammern auflösen', collect: 'zusammenfassen' };
/** One worked line: \"$eq \qquad \big|\; op$\" or \"$eq$ | Klammern auflösen\". */
function lineText(line, prefix = '') {
  const eq = eqTex(line.eq);
  if (!line.op) return `${prefix}$${eq}$`;
  const t = opTex(line.op);
  return t ? `${prefix}$${eq} \\qquad \\big|\\; ${t}$` : `${prefix}$${eq}$ \u2003| ${OP_WORDS_DE[line.op.k]}`;
}
/** Short words for an operation (hints). */
function opWords(op) {
  if (op.k === 'expand') return 'Löse die Klammern auf';
  if (op.k === 'collect') return 'Fasse auf jeder Seite gleichartige Glieder zusammen';
  if (op.k === 'mul') return `Multipliziere beide Seiten mit ${'$' + U.numTex(op.v) + '$'}`;
  if (op.k === 'div') return `Dividiere beide Seiten durch ${'$' + U.numTex(op.v) + '$'}`;
  const v = F(op.v);
  const what = op.x ? U.tex(U.polyMachine([[v.abs(), 1]])) : U.numTex(v.abs());
  return v.sign() < 0 ? `Subtrahiere auf beiden Seiten $${what}$` : `Addiere auf beiden Seiten $${what}$`;
}

// ---------------------------------------------------------------- solve path (independent)
/** Solve L = R given as machine strings via expr.js polynomials. → {kind, value?:Fraction} */
function solveMachine(Lm, Rm, variable = 'x') {
  const p = X.toPoly(X.parse(Lm, { variables: [variable] }));
  const q = X.toPoly(X.parse(Rm, { variables: [variable] }));
  if (!p || !q) throw new Error('solveMachine: not polynomial');
  const coef = key => (p.get(key) || ZERO).sub(q.get(key) || ZERO);
  for (const k of new Set([...p.keys(), ...q.keys()])) if (k !== '' && k !== `${variable}^1` && !coef(k).isZero()) throw new Error('solveMachine: not linear');
  const a = coef(`${variable}^1`), b = coef('');
  if (a.isZero()) return { kind: b.isZero() ? 'all' : 'none' };
  return { kind: 'one', value: b.neg().div(a) };
}
function solveEq(eq) { const [l, r] = eqMachine(eq); return solveMachine(l, r); }
/** Exact value of a machine expression at x = v (probe). */
function valueAt(machine, v) { return X.evaluate(X.parse(machine, { variables: ['x'] }), { x: F(v) }); }

/** \"Probe\" sentence for x = v, computed from the ORIGINAL equation's machine strings. */
function probeText(eq, v) {
  const [Lm, Rm] = eqMachine(eq);
  const side = m => {
    const ast = X.parse(m, { variables: ['x'] });
    const vars = X.collectVars(ast);
    const val = valueAt(m, v);
    if (!vars.size) return `$${U.numTex(val)}$`;
    return `$${X.toLatex(U.substitute(ast, 'x', F(v)), { explicitMul: true })} = ${U.numTex(val)}$`;
  };
  return `Probe mit $x = ${U.numTex(v)}$: links ${side(Lm)}, rechts ${side(Rm)}. Beide Seiten sind gleich.`;
}

/** Checks for display ranges. */
function maxAbsCoefficient(eq) {
  let m = ZERO;
  for (const p of [...eq.L, ...eq.R]) for (const c of (p.t === 'br' ? [p.f, p.a, p.b] : [p.c])) { const a = F(c).abs(); if (a.cmp(m) > 0) m = a; }
  return m;
}
function chainMax(ch) {
  let m = ZERO;
  for (const l of ch.lines) { const a = maxAbsCoefficient(l.eq); if (a.cmp(m) > 0) m = a; }
  return m;
}

module.exports = {
  sideMachine, eqMachine, sideTex, eqTex, lin, expand, collect, scale, needsCollect, hasBracket,
  chain, opTex, opWords, lineText, solveMachine, solveEq, valueAt, probeText, maxAbsCoefficient, chainMax,
};
