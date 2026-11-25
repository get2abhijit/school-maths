'use strict';
/**
 * core.js — seeded PRNG, hashing, exact BigInt fractions, number-literal parsing.
 * No DOM access. Pure functions / immutable values only.
 */

// ---------------------------------------------------------------- hashing
/** FNV-1a 32-bit over UTF-16 code units. Returns uint32. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function hashHex(str) { return fnv1a(str).toString(16).padStart(8, '0'); }

/** Derive the k-th child seed of a seed (used for regeneration after rejection). */
function deriveSeed(seed, k) { return fnv1a(`${seed >>> 0}:${k}`); }

// ---------------------------------------------------------------- PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

class Rng {
  constructor(seed) { this._next = mulberry32(seed); }
  uint32() { return this._next(); }
  /** Uniform integer in [lo, hi] (inclusive), unbiased via rejection sampling. */
  int(lo, hi) {
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) throw new RangeError(`bad range ${lo}..${hi}`);
    const range = hi - lo + 1;
    if (range > 0x100000000) throw new RangeError('range too large');
    const limit = Math.floor(0x100000000 / range) * range;
    let r;
    do { r = this._next(); } while (r >= limit);
    return lo + (r % range);
  }
  /** Integer in [lo, hi] excluding values in `exclude`. */
  intExcept(lo, hi, exclude) {
    const ex = new Set(exclude);
    for (let i = 0; i < 1000; i++) { const v = this.int(lo, hi); if (!ex.has(v)) return v; }
    throw new RangeError('intExcept: no admissible value');
  }
  bool() { return (this._next() & 1) === 1; }
  pick(arr) { if (!arr.length) throw new RangeError('pick from empty'); return arr[this.int(0, arr.length - 1)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = this.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}

// ---------------------------------------------------------------- fractions
function bgcd(a, b) {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

class Fraction {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new RangeError('Fraction: zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
    Object.freeze(this);
  }
  static of(x) {
    if (x instanceof Fraction) return x;
    if (typeof x === 'bigint') return new Fraction(x, 1n);
    if (typeof x === 'number') {
      if (!Number.isSafeInteger(x)) throw new RangeError('Fraction.of: only safe integers from number');
      return new Fraction(BigInt(x), 1n);
    }
    if (typeof x === 'string') return parseMachineNumber(x);
    throw new TypeError('Fraction.of: unsupported type');
  }
  add(o) { o = Fraction.of(o); return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Fraction.of(o); return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Fraction.of(o); return new Fraction(this.n * o.n, this.d * o.d); }
  div(o) {
    o = Fraction.of(o);
    if (o.n === 0n) throw new RangeError('Fraction: division by zero');
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  neg() { return new Fraction(-this.n, this.d); }
  abs() { return this.n < 0n ? this.neg() : this; }
  /** Integer power (k may be negative if this is nonzero). */
  pow(k) {
    if (!Number.isInteger(k)) throw new RangeError('pow: integer exponent required');
    if (k < 0) { if (this.n === 0n) throw new RangeError('pow: 0 to negative power'); return new Fraction(this.d ** BigInt(-k), this.n ** BigInt(-k)); }
    return new Fraction(this.n ** BigInt(k), this.d ** BigInt(k));
  }
  sign() { return this.n === 0n ? 0 : (this.n < 0n ? -1 : 1); }
  isZero() { return this.n === 0n; }
  isInteger() { return this.d === 1n; }
  eq(o) { o = Fraction.of(o); return this.n === o.n && this.d === o.d; }
  cmp(o) { o = Fraction.of(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : (l > r ? 1 : 0); }
  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
  toLatex() {
    if (this.d === 1n) return `${this.n}`;
    const neg = this.n < 0n;
    return `${neg ? '-' : ''}\\frac{${neg ? -this.n : this.n}}{${this.d}}`;
  }
  /** True if the decimal expansion terminates (denominator has only factors 2 and 5). */
  isTerminatingDecimal() {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }
  /**
   * Exact rounding to `places` decimals, half away from zero (kaufmännisches Runden).
   * Returns a string with the given decimal separator.
   */
  toDecimalString(places, sep = ',') {
    if (!Number.isInteger(places) || places < 0) throw new RangeError('places');
    const scale = 10n ** BigInt(places);
    const neg = this.n < 0n;
    const absN = neg ? -this.n : this.n;
    let q = (absN * scale) / this.d;
    const r = (absN * scale) % this.d;
    if (2n * r >= this.d) q += 1n;
    let s = q.toString();
    if (places > 0) {
      s = s.padStart(places + 1, '0');
      s = s.slice(0, -places) + sep + s.slice(-places);
    }
    return (neg && q !== 0n ? '-' : '') + s;
  }
  /** Round to `places` decimals (half away from zero), returned as Fraction. */
  round(places) { return Fraction.of(this.toDecimalString(places, '.')); }
  toJSON() { return this.toString(); }
}
Fraction.ZERO = new Fraction(0n);
Fraction.ONE = new Fraction(1n);

// ---------------------------------------------------------------- number parsing
/**
 * Strict parser for machine-written values (templates, stored data): "-12", "2.5", "-3/4".
 * Dot is the only decimal separator; no ambiguity heuristics. Throws on anything else.
 */
function parseMachineNumber(str) {
  const s = str.trim();
  let m = /^(-)?(\d+)\/(\d+)$/.exec(s);
  if (m) { const f = new Fraction(BigInt(m[2]), BigInt(m[3])); return m[1] ? f.neg() : f; }
  m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (m) return decimalToFraction(m[2], m[3], !!m[1]);
  throw new RangeError(`Fraction.of: cannot parse machine number "${str}"`);
}
/** Normalise typographic characters students may type or paste. */
function normalizeInput(s) {
  return String(s)
    .replace(/[\u2212\u2013\u2014]/g, '-')      // minus, en dash, em dash
    .replace(/[\u00b7\u22c5\u00d7\u2217]/g, '*') // middle dot, dot operator, times, asterisk op
    .replace(/[\u00f7]/g, '/')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function decimalToFraction(intPart, fracPart, neg) {
  const digits = (intPart || '0') + (fracPart || '');
  const den = 10n ** BigInt((fracPart || '').length);
  const f = new Fraction(BigInt(digits), den);
  return neg ? f.neg() : f;
}

/**
 * Parse a number answer: integer, decimal ("1,5" or "1.5"), fraction ("-3/4"),
 * mixed number ("1 1/2"). Returns {ok:true, value:Fraction, form} or {ok:false, code}.
 * A dot followed by exactly three digits after a non-zero integer part ("1.000")
 * is rejected as ambiguous (could be a German thousands separator).
 */
function parseNumber(raw) {
  if (raw === null || raw === undefined) return { ok: false, code: 'empty' };
  const s = normalizeInput(raw);
  if (s === '') return { ok: false, code: 'empty' };
  if (s.length > 60) return { ok: false, code: 'too_long' };
  let m = /^([+-])?\s*(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    if (/^0+$/.test(m[3])) return { ok: false, code: 'div_zero' };
    const f = new Fraction(BigInt(m[2]), BigInt(m[3]));
    return { ok: true, value: m[1] === '-' ? f.neg() : f, form: 'fraction', reduced: bgcd(BigInt(m[2]), BigInt(m[3])) === 1n };
  }
  m = /^([+-])?\s*(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (m) {
    if (/^0+$/.test(m[4])) return { ok: false, code: 'div_zero' };
    const whole = new Fraction(BigInt(m[2]));
    const f = whole.add(new Fraction(BigInt(m[3]), BigInt(m[4])));
    return { ok: true, value: m[1] === '-' ? f.neg() : f, form: 'mixed', reduced: bgcd(BigInt(m[3]), BigInt(m[4])) === 1n };
  }
  m = /^([+-])?\s*(\d*)(?:([.,])(\d+))?$/.exec(s);
  if (m && (m[2] !== '' || m[4] !== undefined)) {
    if (m[3] === '.' && m[4] && m[4].length === 3 && m[2] !== '' && !/^0+$/.test(m[2])) {
      return { ok: false, code: 'ambiguous_separator' };
    }
    const value = decimalToFraction(m[2], m[4], m[1] === '-');
    return { ok: true, value, form: m[4] !== undefined ? 'decimal' : 'integer', reduced: true };
  }
  if (/[.,].*[.,]/.test(s)) return { ok: false, code: 'multiple_separators' };
  return { ok: false, code: 'not_a_number' };
}

module.exports = { parseMachineNumber, fnv1a, hashHex, deriveSeed, mulberry32, Rng, Fraction, bgcd, normalizeInput, parseNumber, decimalToFraction };
