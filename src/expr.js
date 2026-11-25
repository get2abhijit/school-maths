'use strict';
/**
 * expr.js — safe parser for school algebra input (never eval), exact evaluation,
 * polynomial normal form, equivalence checking and form checks.
 *
 * Grammar (precedence low → high):
 *   expr    := term (('+'|'-') term)*
 *   term    := unary (('*'|'/') unary | <implicit> power)*
 *   unary   := ('+'|'-') unary | power
 *   power   := primary ('^' unary)?           (right-assoc; -x^2 = -(x^2))
 *   primary := number | variable | '(' expr ')'
 * Implicit multiplication applies before a variable or '(' : 2x, 3(x+1), (x+1)(x-1), x(x+2).
 * A number directly after a factor (x2, (x+1)3) is rejected (ambiguous).
 * Implicit and explicit products share precedence, left-assoc: 1/2x = (1/2)·x.
 */
const { Fraction, normalizeInput, bgcd } = require('./core');
const bgcdAbs = (a, b) => bgcd(a, b);

const LIMITS = { maxLength: 200, maxDepth: 40, maxExponent: 12 };

class ParseError extends Error {
  constructor(code, pos, detail) { super(`${code} at ${pos}${detail ? ': ' + detail : ''}`); this.code = code; this.pos = pos; }
}
class EvalError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** German messages for parse/eval error codes (presentation strings, no math logic). */
const MESSAGES_DE = {
  empty: 'Bitte gib eine Antwort ein.',
  too_long: 'Die Eingabe ist zu lang.',
  unexpected_char: 'Unbekanntes Zeichen in der Eingabe.',
  unexpected_token: 'An dieser Stelle passt das Zeichen nicht.',
  unexpected_end: 'Die Eingabe hört mitten im Term auf.',
  missing_rparen: 'Es fehlt eine schließende Klammer.',
  unmatched_rparen: 'Es gibt eine schließende Klammer zu viel.',
  unknown_variable: 'Diese Variable kommt in der Aufgabe nicht vor.',
  adjacent_numbers: 'Zwei Zahlen stehen ohne Rechenzeichen nebeneinander.',
  number_after_factor: 'Schreibe die Zahl vor die Variable oder Klammer (z. B. 2x statt x2).',
  ambiguous_separator: 'Bitte ohne Tausenderpunkt schreiben; nutze das Komma als Dezimalzeichen.',
  multiple_separators: 'Die Zahl hat zu viele Kommas oder Punkte.',
  not_a_number: 'Bitte gib eine Zahl ein.',
  too_deep: 'Der Term ist zu stark verschachtelt.',
  div_zero: 'Division durch null ist nicht definiert.',
  non_integer_exponent: 'Als Exponent sind nur ganze Zahlen erlaubt.',
  exponent_too_large: 'Der Exponent ist zu groß.',
  unbound_variable: 'Für eine Variable fehlt ein Wert.',
  no_choice: 'Bitte wähle eine Antwort aus.',
  invalid_choice: 'Diese Auswahl gibt es nicht.',
};

// ---------------------------------------------------------------- tokenizer
function tokenize(input, allowedVars) {
  const s = normalizeInput(input).replace(/\u00b2/g, '^2').replace(/\u00b3/g, '^3');
  if (s === '') throw new ParseError('empty', 0);
  if (s.length > LIMITS.maxLength) throw new ParseError('too_long', LIMITS.maxLength);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (/[0-9]/.test(c) || ((c === ',' || c === '.') && /[0-9]/.test(s[i + 1] || ''))) {
      const m = /^(\d*)(?:([.,])(\d+))?/.exec(s.slice(i));
      const intP = m[1], sep = m[2], fracP = m[3];
      if (sep === '.' && fracP && fracP.length === 3 && intP !== '' && !/^0+$/.test(intP)) throw new ParseError('ambiguous_separator', i);
      const den = 10n ** BigInt((fracP || '').length);
      toks.push({ k: 'num', v: new Fraction(BigInt((intP || '0') + (fracP || '')), den), dec: !!sep, pos: i });
      i += m[0].length;
      if (/[.,]/.test(s[i] || '') && /[0-9]/.test(s[i + 1] || '')) throw new ParseError('multiple_separators', i);
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      if (allowedVars && !allowedVars.includes(c)) throw new ParseError('unknown_variable', i, c);
      toks.push({ k: 'var', v: c, pos: i }); i++; continue;
    }
    if ('+-*/^'.includes(c)) { toks.push({ k: 'op', v: c, pos: i }); i++; continue; }
    if (c === ':') { toks.push({ k: 'op', v: '/', pos: i }); i++; continue; }
    if (c === '(' || c === '[') { toks.push({ k: 'lp', pos: i }); i++; continue; }
    if (c === ')' || c === ']') { toks.push({ k: 'rp', pos: i }); i++; continue; }
    throw new ParseError('unexpected_char', i, c);
  }
  return toks;
}

// ---------------------------------------------------------------- parser
/**
 * Parse an expression string into an AST.
 * Nodes: {t:'num',v:Fraction} {t:'var',name} {t:'add'|'sub'|'mul'|'div'|'pow',a,b} {t:'neg',a}
 * mul nodes carry `implicit: true` when written without an operator.
 */
function parse(input, options = {}) {
  const toks = tokenize(input, options.variables);
  let p = 0, depth = 0;
  const peek = () => toks[p];
  const endPos = () => (toks.length ? toks[toks.length - 1].pos + 1 : 0);
  const enter = () => { if (++depth > LIMITS.maxDepth) throw new ParseError('too_deep', peek() ? peek().pos : endPos()); };
  const leave = () => { depth--; };

  function expr() {
    enter();
    let left = term();
    while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = toks[p++].v;
      const right = term();
      left = { t: op === '+' ? 'add' : 'sub', a: left, b: right };
    }
    leave();
    return left;
  }
  function term() {
    let left = unary();
    for (;;) {
      const tk = peek();
      if (!tk) break;
      if (tk.k === 'op' && (tk.v === '*' || tk.v === '/')) {
        p++;
        const right = unary();
        left = { t: tk.v === '*' ? 'mul' : 'div', a: left, b: right };
      } else if (tk.k === 'var' || tk.k === 'lp') {
        const right = power();
        left = { t: 'mul', a: left, b: right, implicit: true };
      } else if (tk.k === 'num') {
        throw new ParseError(left.t === 'num' ? 'adjacent_numbers' : 'number_after_factor', tk.pos);
      } else break;
    }
    return left;
  }
  function unary() {
    const tk = peek();
    if (tk && tk.k === 'op' && (tk.v === '-' || tk.v === '+')) {
      p++; enter();
      const a = unary();
      leave();
      return tk.v === '-' ? { t: 'neg', a } : a;
    }
    return power();
  }
  function power() {
    const base = primary();
    const tk = peek();
    if (tk && tk.k === 'op' && tk.v === '^') {
      p++; enter();
      const e = unary();
      leave();
      return { t: 'pow', a: base, b: e };
    }
    return base;
  }
  function primary() {
    const tk = peek();
    if (!tk) throw new ParseError('unexpected_end', endPos());
    if (tk.k === 'num') { p++; return tk.dec ? { t: 'num', v: tk.v, dec: true } : { t: 'num', v: tk.v }; }
    if (tk.k === 'var') { p++; return { t: 'var', name: tk.v }; }
    if (tk.k === 'lp') {
      p++;
      const e = expr();
      const c = peek();
      if (!c) throw new ParseError('missing_rparen', endPos());
      if (c.k !== 'rp') throw new ParseError('unexpected_token', c.pos);
      p++;
      return { t: 'paren', a: e };
    }
    if (tk.k === 'rp') throw new ParseError('unmatched_rparen', tk.pos);
    throw new ParseError('unexpected_token', tk.pos);
  }

  const ast = expr();
  if (p < toks.length) {
    const tk = toks[p];
    throw new ParseError(tk.k === 'rp' ? 'unmatched_rparen' : 'unexpected_token', tk.pos);
  }
  return ast;
}

/** Safe wrapper: returns {ok:true, ast} or {ok:false, code, pos, message}. */
function tryParse(input, options) {
  try { return { ok: true, ast: parse(input, options) }; }
  catch (e) {
    if (e instanceof ParseError) return { ok: false, code: e.code, pos: e.pos, message: MESSAGES_DE[e.code] || e.code };
    throw e;
  }
}

/** Remove explicit 'paren' wrappers (kept in AST only for form checks and printing). */
function strip(n) { while (n.t === 'paren') n = n.a; return n; }

// ---------------------------------------------------------------- evaluation
function evaluate(node, env = {}) {
  switch (node.t) {
    case 'num': return node.v;
    case 'var': {
      if (!(node.name in env)) throw new EvalError('unbound_variable');
      return Fraction.of(env[node.name]);
    }
    case 'paren': return evaluate(node.a, env);
    case 'neg': return evaluate(node.a, env).neg();
    case 'add': return evaluate(node.a, env).add(evaluate(node.b, env));
    case 'sub': return evaluate(node.a, env).sub(evaluate(node.b, env));
    case 'mul': return evaluate(node.a, env).mul(evaluate(node.b, env));
    case 'div': {
      const d = evaluate(node.b, env);
      if (d.isZero()) throw new EvalError('div_zero');
      return evaluate(node.a, env).div(d);
    }
    case 'pow': {
      const e = evaluate(node.b, env);
      if (!e.isInteger()) throw new EvalError('non_integer_exponent');
      if (e.n > BigInt(LIMITS.maxExponent) || e.n < -BigInt(LIMITS.maxExponent)) throw new EvalError('exponent_too_large');
      const b = evaluate(node.a, env);
      if (b.isZero() && e.n < 0n) throw new EvalError('div_zero');
      return b.pow(Number(e.n));
    }
    default: throw new Error(`evaluate: unknown node ${node.t}`);
  }
}

function collectVars(node, set = new Set()) {
  if (node.t === 'var') set.add(node.name);
  if (node.a) collectVars(node.a, set);
  if (node.b) collectVars(node.b, set);
  return set;
}

// ---------------------------------------------------------------- polynomials
// A polynomial is a Map<monomialKey, Fraction>; key "" = constant, "x^2", "x^1*y^3" (vars sorted).
function monoKey(powers) {
  return Object.keys(powers).filter(v => powers[v] > 0).sort().map(v => `${v}^${powers[v]}`).join('*');
}
function parseKey(key) {
  const out = {};
  if (key) for (const part of key.split('*')) { const [v, e] = part.split('^'); out[v] = Number(e); }
  return out;
}
function polyConst(c) { const m = new Map(); if (!c.isZero()) m.set('', c); return m; }
function polyAdd(p, q, sign = 1) {
  const r = new Map(p);
  for (const [k, c] of q) {
    const v = (r.get(k) || Fraction.ZERO)[sign === 1 ? 'add' : 'sub'](c);
    if (v.isZero()) r.delete(k); else r.set(k, v);
  }
  return r;
}
function polyMul(p, q) {
  let r = new Map();
  for (const [k1, c1] of p) for (const [k2, c2] of q) {
    const a = parseKey(k1), b = parseKey(k2);
    for (const v in b) a[v] = (a[v] || 0) + b[v];
    r = polyAdd(r, new Map([[monoKey(a), c1.mul(c2)]]));
  }
  return r;
}
function polyIsConst(p) { return p.size === 0 || (p.size === 1 && p.has('')); }
function polyConstValue(p) { return p.get('') || Fraction.ZERO; }

/** Convert AST to polynomial normal form, or null if not a polynomial (e.g. division by a variable). */
function toPoly(node) {
  switch (node.t) {
    case 'num': return polyConst(node.v);
    case 'var': return new Map([[monoKey({ [node.name]: 1 }), Fraction.ONE]]);
    case 'paren': return toPoly(node.a);
    case 'neg': { const a = toPoly(node.a); return a && polyAdd(new Map(), a, -1); }
    case 'add': case 'sub': {
      const a = toPoly(node.a), b = toPoly(node.b);
      return a && b && polyAdd(a, b, node.t === 'add' ? 1 : -1);
    }
    case 'mul': { const a = toPoly(node.a), b = toPoly(node.b); return a && b && polyMul(a, b); }
    case 'div': {
      const a = toPoly(node.a), b = toPoly(node.b);
      if (!a || !b || !polyIsConst(b) || polyConstValue(b).isZero()) return null;
      return polyMul(a, polyConst(Fraction.ONE.div(polyConstValue(b))));
    }
    case 'pow': {
      const a = toPoly(node.a), e = toPoly(node.b);
      if (!a || !e || !polyIsConst(e)) return null;
      const ev = polyConstValue(e);
      if (!ev.isInteger() || ev.n < 0n || ev.n > BigInt(LIMITS.maxExponent)) return null;
      let r = polyConst(Fraction.ONE);
      for (let i = 0n; i < ev.n; i++) r = polyMul(r, a);
      return r;
    }
    default: return null;
  }
}
function polyEqual(p, q) {
  if (p.size !== q.size) return false;
  for (const [k, c] of p) { const d = q.get(k); if (!d || !d.eq(c)) return false; }
  return true;
}
function keyDegree(k) { return Object.values(parseKey(k)).reduce((s, e) => s + e, 0); }
/** Canonical string, descending total degree then lexicographic key: e.g. "3x^2-x+1/2". */
function polyToString(p) {
  if (p.size === 0) return '0';
  const keys = [...p.keys()].sort((a, b) => keyDegree(b) - keyDegree(a) || (a < b ? -1 : a > b ? 1 : 0));
  let out = '';
  keys.forEach((k, i) => {
    const c = p.get(k);
    const neg = c.sign() < 0, a = c.abs();
    out += neg ? '-' : (i ? '+' : '');
    const mono = k.split('*').filter(Boolean).map(part => { const [v, e] = part.split('^'); return e === '1' ? v : `${v}^${e}`; }).join('*');
    if (!mono) out += a.toString();
    else if (a.eq(1)) out += mono;
    else out += `${a.toString()}*${mono}`;
  });
  return out;
}

// ---------------------------------------------------------------- equivalence
/** Deterministic rational test values (avoid 0/1 bias; include negatives and fractions). */
const TEST_VALUES = ['-7/3', '5', '-2', '3/4', '11', '-13/5', '2/7', '-1/2', '17/3', '4', '-9', '19/11', '-3/8', '7', '1/3', '-6'].map(s => Fraction.of(s));

/**
 * Check algebraic equivalence of two ASTs.
 * Always samples ≥ MIN_POINTS exact rational points; additionally compares polynomial
 * normal forms when both sides are polynomials (definitive).
 * Returns {equivalent:boolean, method, checkedPoints}.
 */
function equivalent(a, b, variables) {
  const vars = variables && variables.length ? variables : [...new Set([...collectVars(a), ...collectVars(b)])].sort();
  const MIN_POINTS = 8;
  let checked = 0;
  for (let i = 0; i < TEST_VALUES.length; i++) {
    const env = {};
    vars.forEach((v, j) => { env[v] = TEST_VALUES[(i + 5 * j) % TEST_VALUES.length]; });
    let va, vb;
    try { va = evaluate(a, env); } catch (e) { if (e instanceof EvalError) { va = null; } else throw e; }
    try { vb = evaluate(b, env); } catch (e) { if (e instanceof EvalError) { vb = null; } else throw e; }
    if (va === null && vb === null) continue;
    if (va === null || vb === null) return { equivalent: false, method: 'domain', checkedPoints: checked };
    if (!va.eq(vb)) return { equivalent: false, method: 'sampling', checkedPoints: checked + 1 };
    checked++;
  }
  const pa = toPoly(a), pb = toPoly(b);
  if (pa && pb) {
    const eq = polyEqual(pa, pb);
    return { equivalent: eq, method: 'normal_form', checkedPoints: checked };
  }
  if (checked < MIN_POINTS) return { equivalent: false, method: 'insufficient_points', checkedPoints: checked };
  return { equivalent: true, method: 'sampling', checkedPoints: checked };
}

// ---------------------------------------------------------------- form checks
function flattenSum(node, sign, out) {
  node = strip(node);
  if (node.t === 'add') { flattenSum(node.a, sign, out); flattenSum(node.b, sign, out); }
  else if (node.t === 'sub') { flattenSum(node.a, sign, out); flattenSum(node.b, -sign, out); }
  else if (node.t === 'neg' && (strip(node.a).t === 'add' || strip(node.a).t === 'sub')) {
    out.push({ sign, node, bracketedSum: true });
  }
  else out.push({ sign, node });
  return out;
}
function isNumLiteral(n) { n = strip(n); return n.t === 'num'; }

/**
 * Analyse a single additive term. Returns {key, coeff, numerators, denominators} if the term is
 * "number · variable powers" (each variable once, at most one numeric factor on top and one below),
 * otherwise null.
 */
function analyzeTerm(node) {
  const info = { powers: {}, numerators: 0, denominators: 0, varRepeat: false, negs: 0, numVals: [], denVals: [] };
  function walk(n, inDen) {
    if (n.t === 'paren') return walk(n.a, inDen) && !hasSum(n.a);
    if (n.t === 'neg') { info.negs++; return walk(n.a, inDen); }
    if (n.t === 'num') { if (inDen) { info.denominators++; info.denVals.push(n.v); } else { info.numerators++; info.numVals.push(n.v); } return true; }
    if (n.t === 'var') { if (inDen) return false; if (info.powers[n.name]) info.varRepeat = true; info.powers[n.name] = (info.powers[n.name] || 0) + 1; return true; }
    if (n.t === 'mul') return walk(n.a, inDen) && walk(n.b, inDen);
    if (n.t === 'div') { if (inDen) return false; if (!isNumLiteral(n.b)) return false; return walk(n.a, false) && walk(n.b, true); }
    if (n.t === 'pow') {
      const base = strip(n.a), e = strip(n.b);
      if (inDen || base.t !== 'var' || e.t !== 'num' || !e.v.isInteger() || e.v.n < 2n) return false;
      if (info.powers[base.name]) info.varRepeat = true;
      info.powers[base.name] = (info.powers[base.name] || 0) + Number(e.v.n);
      return true;
    }
    return false;
  }
  if (!walk(node, false)) return null;
  return info;
}
function hasSum(n) {
  n = strip(n);
  if (n.t === 'add' || n.t === 'sub') return true;
  if (n.t === 'neg') return hasSum(n.a);
  return false;
}

/**
 * Form check. Supported forms:
 *  - 'any'      : no restriction
 *  - 'expanded' : sum of simplified monomials — no brackets around sums, each monomial
 *                 at most once, at most one constant, no zero coefficients, no x·x (use x^2),
 *                 at most one numeric factor per term (and at most one numeric divisor).
 *  - 'product_with_sum' : (±) factor · (sum) — basic Ausklammern shape.
 *  - 'factored_complete': product_with_sum AND the largest common factor is outside
 *                 (inner integer coefficients with gcd 1, no variable common to all inner terms).
 *  - 'expanded_product' (S11, D83): 'expanded' AND no quotient with a variable in the dividend —
 *                 (3x):2 or 3x/2 must be rewritten as a product (3/2x or 1,5x), as in LS7 I.4.
 * Returns {ok:boolean, reason?:string}.
 */
function checkForm(ast, form) {
  if (!form || form === 'any') return { ok: true };
  if (form === 'expanded_product') {
    const base = checkForm(ast, 'expanded');
    if (!base.ok) return base;
    let bad = false;
    (function walk(n) { if (n.t === 'div' && collectVars(n.a).size) bad = true; if (n.a) walk(n.a); if (n.b) walk(n.b); })(ast);
    return bad ? { ok: false, reason: 'quotient_not_product' } : { ok: true };
  }
  if (form === 'expanded') {
    const terms = flattenSum(ast, 1, []);
    const seen = new Set();
    for (const { node, bracketedSum } of terms) {
      if (bracketedSum) return { ok: false, reason: 'brackets_remaining' };
      const info = analyzeTerm(strip(node));
      if (!info) return { ok: false, reason: 'brackets_remaining' };
      if (info.varRepeat) return { ok: false, reason: 'unsimplified_product' };
      if (info.numerators > 1 || info.denominators > 1 || info.negs > 1) return { ok: false, reason: 'unsimplified_coefficient' };
      const key = monoKey(info.powers);
      if (seen.has(key)) return { ok: false, reason: 'like_terms_not_collected' };
      seen.add(key);
      if (info.numVals.length === 1 && info.denVals.length === 1) {
        const a = info.numVals[0], b = info.denVals[0];
        if (a.isInteger() && b.isInteger() && bgcdAbs(a.n, b.n) > 1n) return { ok: false, reason: 'unreduced_fraction' };
      }
      const p = toPoly(node);
      if (!p) return { ok: false, reason: 'brackets_remaining' };
      if (p.size === 0 && terms.length > 1) return { ok: false, reason: 'zero_term' };
    }
    return { ok: true };
  }
  if (form === 'product_with_sum') {
    let n = strip(ast);
    if (n.t === 'neg') n = strip(n.a);
    if (n.t !== 'mul') return { ok: false, reason: 'not_a_product' };
    const factors = [];
    (function fl(m) { m = strip(m); if (m.t === 'mul') { fl(m.a); fl(m.b); } else factors.push(m); })(n);
    if (!factors.some(hasSum)) return { ok: false, reason: 'no_bracket_factor' };
    return { ok: true };
  }
  if (form === 'factored_complete') {
    // Ausklammern: (±) monomial factor(s) · ONE bracketed sum whose integer coefficients have
    // gcd 1 and no variable common to all its terms. The sum itself must be simplified.
    const base = checkForm(ast, 'product_with_sum');
    if (!base.ok) return base;
    let n = strip(ast);
    if (n.t === 'neg') n = strip(n.a);
    const factors = [];
    (function fl(m) { m = strip(m); if (m.t === 'mul') { fl(m.a); fl(m.b); } else factors.push(m); })(n);
    const sums = factors.filter(hasSum);
    if (sums.length !== 1) return { ok: false, reason: 'not_a_product' };
    for (const f of factors) if (!hasSum(f)) { const fp = toPoly(f); if (!fp || fp.size !== 1) return { ok: false, reason: 'not_a_product' }; }
    if (!checkForm(sums[0], 'expanded').ok) return { ok: false, reason: 'inner_not_simplified' };
    const inner = toPoly(sums[0]);
    if (!inner || inner.size < 2) return { ok: false, reason: 'not_a_product' };
    const coeffs = [...inner.values()];
    if (coeffs.some(c => !c.isInteger())) return { ok: false, reason: 'non_integer_inside' };
    if (coeffs.reduce((g, c) => bgcdAbs(g, c.n), 0n) > 1n) return { ok: false, reason: 'incomplete_factoring' };
    const keys = [...inner.keys()].map(parseKey);
    const vars = Object.keys(keys[0]);
    if (vars.some(v => keys.every(k => (k[v] || 0) > 0))) return { ok: false, reason: 'incomplete_factoring' };
    return { ok: true };
  }
  throw new Error(`checkForm: unknown form ${form}`);
}

// ---------------------------------------------------------------- printing
const PREC = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4, num: 5, var: 5, paren: 5 };
/**
 * AST → LaTeX in school notation.
 * - Numbers written with a decimal separator (node.dec) print as decimals with a comma: 0{,}5.
 * - A negative number or a negation that is not the leading token is bracketed: 5+\left(-3\right)\cdot 4.
 * - opts.explicitMul: print \cdot before a bracket (3\cdot\left(-2\right) instead of 3\left(-2\right));
 *   used when showing substituted values.
 */
function toLatex(node, opts = {}) { return tl(node, opts, true); }
function numLatex(node) {
  const v = node.v;
  if (node.dec && !v.isInteger() && v.isTerminatingDecimal()) {
    let p = 1;
    while (!v.round(p).eq(v)) p++;
    return v.toDecimalString(p, '{,}');
  }
  return v.toLatex();
}
function tl(node, o, lead) {
  switch (node.t) {
    case 'num': { const s = numLatex(node); return !lead && node.v.sign() < 0 ? `\\left(${s}\\right)` : s; }
    case 'var': return node.name;
    case 'paren': return `\\left(${tl(node.a, o, true)}\\right)`;
    case 'neg': { const s = `-${wrap(node.a, 3, o, false)}`; return lead ? s : `\\left(${s}\\right)`; }
    case 'add': return `${wrap(node.a, 1, o, lead)}+${wrap(node.b, 1, o, false)}`;
    case 'sub': return `${wrap(node.a, 1, o, lead)}-${wrap(node.b, 2, o, false)}`;
    case 'mul': {
      const a = wrap(node.a, 2, o, lead), b = wrap(node.b, 2, o, false);
      const sa = strip(node.a);
      const aIsFracLiteral = sa.t === 'num' || (sa.t === 'div' && isNumLiteral(strip(sa.a).t === 'neg' ? strip(sa.a).a : sa.a) && isNumLiteral(sa.b));
      let join = /^[a-z]/.test(b) && (!/\}$/.test(a) || aIsFracLiteral);
      if (/^\\left/.test(b)) join = !o.explicitMul && !/\}$/.test(a) && !/^\\left\(-/.test(b);
      return join ? `${a}${b}` : `${a}\\cdot ${b}`;
    }
    case 'div': {
      const na = strip(node.a);
      if (na.t === 'neg') { const s = `-\\frac{${tl(na.a, o, true)}}{${tl(node.b, o, true)}}`; return lead ? s : `\\left(${s}\\right)`; }
      return `\\frac{${tl(node.a, o, true)}}{${tl(node.b, o, true)}}`;
    }
    case 'pow': {
      const base = node.a;
      const bs = base.t === 'num' && (base.v.sign() < 0 || !base.v.isInteger())
        ? `\\left(${numLatex(base)}\\right)` : wrap(base, 5, o, lead);
      return `${bs}^{${tl(node.b, o, true)}}`;
    }
    default: return '?';
  }
}
function wrap(n, minPrec, o, lead) {
  return PREC[n.t] < minPrec ? `\\left(${tl(n, o, true)}\\right)` : tl(n, o, lead);
}

module.exports = {
  LIMITS, MESSAGES_DE, ParseError, EvalError,
  tokenize, parse, tryParse, strip, evaluate, collectVars,
  toPoly, polyEqual, polyToString, equivalent, checkForm, toLatex, TEST_VALUES,
};
