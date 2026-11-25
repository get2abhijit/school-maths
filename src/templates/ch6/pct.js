'use strict';
/**
 * pct.js — shared helpers for Chapter VI (Prozent- und Zinsrechnung). No randomness, no DOM.
 *
 * Two independent number paths (architecture rule 3):
 *  - BUILD path: exact Fraction arithmetic (core.js) with Fraction.round (half away from zero).
 *  - SOLVE path: integer arithmetic in BigInt "milli-cents"/scaled integers with an own half-up rounding
 *    (`roundDivHalfUp`), or the expression engine (`viaExpr`). Templates use these in `solve` only.
 *
 * Money and rounding rules (D55):
 *  - Money is stated and answered in euros with at most two decimals (cents), kaufmännisch gerundet.
 *  - Where a result must be rounded, the prompt says so; the answer spec has `places` and tolerance = half a
 *    unit of the last place (0.005 € or 0.05 %), so the exact unrounded value is accepted too, the neighbouring
 *    rounded values are not.
 *  - Interest over several years is rounded to cents EACH YEAR (as a bank credits it). Instances are only
 *    published if rounding at the very end gives the same cents in every row (constraint), so both ways are correct.
 */
const { Fraction } = require('../../core');
const X = require('../../expr');

const F = x => Fraction.of(x);
const HUNDRED = F(100);

/** Plain-text number with German decimal comma; `places` fixed, else as many as needed (≤ 6). */
function deNum(f, places) {
  f = F(f);
  if (places !== undefined) return f.toDecimalString(places, ',');
  let p = 0; while (p < 6 && !f.round(p).eq(f)) p++;
  return f.toDecimalString(p, ',');
}
/** LaTeX number with {,} as decimal comma. */
function texNum(f, places) { return deNum(f, places).replace(',', '{,}'); }
/** Money in plain text: whole euros "80 €", otherwise "4,50 €". */
function eur(f) { f = F(f); return `${f.isInteger() ? f.toString() : f.toDecimalString(2, ',')} €`; }
/** Money as a LaTeX number (no unit): "80" or "4{,}50". */
function eurTex(f) { f = F(f); return f.isInteger() ? f.toString() : f.toDecimalString(2, '{,}'); }
/** Money with always two decimals (tables, results): "80,00". */
function eur2(f) { return F(f).toDecimalString(2, ','); }
function eur2Tex(f) { return F(f).toDecimalString(2, '{,}'); }
/** Percent in plain text "12,5 %" and LaTeX "12{,}5\,\%". */
function pct(f) { return `${deNum(f)} %`; }
function pctTex(f) { return `${texNum(f)}\\,\\%`; }
/** Decimal places needed (≤ 6). */
function placesOf(f) { f = F(f); let p = 0; while (p < 6 && !f.round(p).eq(f)) p++; return p; }
const cents = f => F(f).round(2);

/** Canonical student input with comma; money always with two decimals when not whole. */
function inputNum(f, places) { return deNum(f, places); }

// ---------------------------------------------------------------- independent (solve) path
/** Decimal string "12.5" / "-3" → [BigInt mantissa, scale] exactly (no Fraction). */
function scaled(str) {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(str));
  if (!m) throw new Error(`scaled: not a decimal ${str}`);
  const frac = m[3] || '';
  const v = BigInt(m[2] + frac);
  return [m[1] ? -v : v, frac.length];
}
/** round(a / b) half away from zero for BigInt a, b (b > 0). */
function roundDivHalfUp(a, b) {
  const neg = a < 0n;
  const A = neg ? -a : a;
  let q = A / b; const r = A % b;
  if (2n * r >= b) q += 1n;
  return neg ? -q : q;
}
/** Decimal string of BigInt v / 10^s with dot. */
function unscale(v, s) {
  const neg = v < 0n; let t = (neg ? -v : v).toString();
  if (s === 0) return (neg ? '-' : '') + t;
  t = t.padStart(s + 1, '0');
  return `${neg ? '-' : ''}${t.slice(0, -s)}.${t.slice(-s)}`;
}
/** Independent: amount·rate/100 rounded to cents, by integer arithmetic. amount, rate: decimal strings. */
function interestCents(amount, rate) {
  const [a, sa] = scaled(amount), [r, sr] = scaled(rate);
  // value = a·r / (10^sa · 10^sr · 100); in cents: ·100
  return roundDivHalfUp(a * r, 10n ** BigInt(sa + sr));
}
/** Independent: cents (BigInt) → machine decimal string "4.50". */
function centsStr(c) { return unscale(c, 2); }
/** Independent rounding of an exact Fraction to `places` decimals (BigInt half-up), returned as a Fraction. */
function roundTo(f, places) {
  f = F(f);
  const scale = 10n ** BigInt(places);
  return new Fraction(roundDivHalfUp(f.n * scale, f.d), scale);
}
/** Exact value of a machine expression string through the expression engine. */
function viaExpr(machine) { return X.evaluate(X.parse(machine), {}); }
/** Fraction → machine literal for viaExpr: integer or bracketed a/b (never dot decimals, see D5). */
function mach(f) { f = F(f); return f.isInteger() ? (f.sign() < 0 ? `(${f})` : f.toString()) : `(${f.n}/${f.d})`; }

/** Students' decimal input → "1234,5" style (comma) from a machine/Fraction value, exact. */
function rawOf(f) { f = F(f); return f.isInteger() ? f.toString() : (f.isTerminatingDecimal() ? deNum(f) : `${f.n}/${f.d}`); }

module.exports = {
  F, HUNDRED, deNum, texNum, eur, eurTex, eur2, eur2Tex, pct, pctTex, placesOf, cents, inputNum,
  scaled, roundDivHalfUp, unscale, interestCents, centsStr, viaExpr, mach, rawOf, roundTo,
};
