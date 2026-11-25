'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { Fraction, Rng, parseNumber } = E;
const F = s => Fraction.of(s);

test('mulberry32 golden values (seed 42; first value matches the published reference 0.6011037519…)', () => {
  const n = E.mulberry32(42);
  assert.deepEqual([n(), n(), n(), n(), n()], [2581720956, 1925393290, 3661312704, 2876485805, 750819978]);
});

test('fnv1a matches the reference value for "abc"', () => {
  assert.equal(E.hashHex('abc'), '1a47e90b');
  assert.equal(E.hashHex(''), '811c9dc5');
});

test('Rng is deterministic and int() stays in range', () => {
  const a = new Rng(7), b = new Rng(7);
  const xs = Array.from({ length: 200 }, () => a.int(-5, 5));
  const ys = Array.from({ length: 200 }, () => b.int(-5, 5));
  assert.deepEqual(xs, ys);
  assert.ok(xs.every(x => x >= -5 && x <= 5));
  assert.equal(new Set(xs).size, 11, 'all 11 values occur in 200 draws');
  assert.deepEqual(new Rng(7).shuffle([1, 2, 3, 4, 5]).sort(), [1, 2, 3, 4, 5]);
  assert.throws(() => a.int(3, 2), RangeError);
  const r = new Rng(1);
  for (let i = 0; i < 100; i++) assert.notEqual(r.intExcept(-2, 2, [0]), 0);
});

test('deriveSeed produces distinct child seeds', () => {
  const s = new Set(Array.from({ length: 1000 }, (_, k) => E.deriveSeed(123, k)));
  assert.equal(s.size, 1000);
});

test('Fraction normalises sign and reduces', () => {
  const f = new Fraction(6n, -8n);
  assert.equal(f.toString(), '-3/4');
  assert.equal(new Fraction(0n, -5n).toString(), '0');
  assert.equal(F('4/2').toString(), '2');
  assert.throws(() => new Fraction(1n, 0n), RangeError);
});

test('Fraction arithmetic is exact (no floating point)', () => {
  assert.equal(F('1/10').add(F('2/10')).toString(), '3/10'); // 0.1+0.2 exactly
  assert.equal(F('1/3').mul(3).toString(), '1');
  assert.equal(F('-2/3').div(F('4/9')).toString(), '-3/2');
  assert.equal(F('2/3').pow(-2).toString(), '9/4');
  assert.equal(F('10').pow(30).toString(), '1' + '0'.repeat(30));
  assert.equal(F('1/2').cmp(F('2/3')), -1);
  assert.throws(() => F('1').div(0), RangeError);
});

test('Fraction rounding: half away from zero, exact', () => {
  assert.equal(F('1.005').toDecimalString(2), '1,01'); // float would give 1,00
  assert.equal(F('2.5').toDecimalString(0), '3');
  assert.equal(F('-2.5').toDecimalString(0), '-3');
  assert.equal(F('-0.004').toDecimalString(2), '0,00');
  assert.equal(F('1/3').toDecimalString(3, '.'), '0.333');
  assert.equal(F('2/3').round(2).toString(), '67/100');
  assert.equal(F('7/8').isTerminatingDecimal(), true);
  assert.equal(F('1/3').isTerminatingDecimal(), false);
});

test('parseNumber accepts school notations', () => {
  const ok = (s, v, form) => { const r = parseNumber(s); assert.ok(r.ok, s); assert.equal(r.value.toString(), v, s); if (form) assert.equal(r.form, form, s); };
  ok('12', '12', 'integer');
  ok('-12', '-12');
  ok('\u221212', '-12'); // typographic minus
  ok('1,5', '3/2', 'decimal');
  ok('1.5', '3/2', 'decimal');
  ok(',5', '1/2');
  ok('0.125', '1/8'); // leading zero → not a thousands separator
  ok(' -3/4 ', '-3/4', 'fraction');
  ok('6/8', '3/4');
  ok('1 1/2', '3/2', 'mixed');
  ok('-2 1/4', '-9/4', 'mixed');
  assert.equal(parseNumber('6/8').reduced, false);
  assert.equal(parseNumber('3/4').reduced, true);
});

test('parseNumber rejects invalid or ambiguous input with a code', () => {
  const bad = (s, code) => { const r = parseNumber(s); assert.equal(r.ok, false, s); assert.equal(r.code, code, s); };
  bad('', 'empty');
  bad('   ', 'empty');
  bad('1.000', 'ambiguous_separator');
  bad('3/0', 'div_zero');
  bad('abc', 'not_a_number');
  bad('1,2,3', 'multiple_separators');
  bad('2x', 'not_a_number');
});
