'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { Fraction } = E;
const V = { variables: ['x'] };
const val = (s, x, opts = V) => E.evaluate(E.parse(s, opts), { x: Fraction.of(x) }).toString();
const nf = s => E.polyToString(E.toPoly(E.parse(s, V)));
const eqv = (a, b) => E.equivalent(E.parse(a, V), E.parse(b, V), ['x']).equivalent;

test('precedence and associativity', () => {
  assert.equal(val('2+3*4', 0), '14');
  assert.equal(val('(2+3)*4', 0), '20');
  assert.equal(val('10-4-3', 0), '3');
  assert.equal(val('24/4/2', 0), '3');
  assert.equal(val('24:4:2', 0), '3');         // German division sign
  assert.equal(val('2^3^2', 0), '512');         // right-assoc
  assert.equal(val('-x^2', 3), '-9');           // -(x^2)
  assert.equal(val('(-x)^2', 3), '9');
  assert.equal(val('-3^2', 0), '-9');
  assert.equal(val('2*-3', 0), '-6');
  assert.equal(val('--4', 0), '4');
});

test('implicit multiplication', () => {
  assert.equal(val('2x', 5), '10');
  assert.equal(val('3(x+1)', 2), '9');
  assert.equal(val('(x+1)(x-1)', 3), '8');
  assert.equal(val('x(x+2)', 3), '15');
  assert.equal(val('2x^2', 3), '18');
  assert.equal(val('1/2x', 4), '2');            // (1/2)·x, documented
  assert.equal(val('-2x', 5), '-10');
  assert.equal(val('3x·4', 1), '12');           // middle dot
  assert.equal(val('x²', 4), '16');              // superscript 2
});

test('decimal numbers with comma or dot, exactly', () => {
  assert.equal(val('0,1+0,2', 0), '3/10');
  assert.equal(val('1.5x', 2), '3');
});

test('parse errors carry codes and German messages (invalid input ≠ wrong answer)', () => {
  const code = s => { const r = E.tryParse(s, V); assert.equal(r.ok, false, s); assert.ok(r.message, s); return r.code; };
  assert.equal(code(''), 'empty');
  assert.equal(code('2+'), 'unexpected_end');
  assert.equal(code('(x+1'), 'missing_rparen');
  assert.equal(code('x+1)'), 'unmatched_rparen');
  assert.equal(code('2y'), 'unknown_variable');
  assert.equal(code('x2'), 'number_after_factor');
  assert.equal(code('2 3'), 'adjacent_numbers');
  assert.equal(code('2#x'), 'unexpected_char');
  assert.equal(code('1.000x'), 'ambiguous_separator');
  assert.equal(code('*3'), 'unexpected_token');
  assert.equal(code('x'.repeat(201)), 'too_long');
  assert.equal(code('('.repeat(60) + 'x' + ')'.repeat(60)), 'too_deep');
});

test('parser never executes code', () => {
  for (const s of ['process.exit(1)', 'constructor', 'alert(1)', '__proto__', '1;2', '`x`', 'x=>x']) {
    const r = E.tryParse(s, V);
    assert.equal(r.ok, false, s);
  }
  // Without a variable whitelist, letters are single variables — still just data.
  const r = E.tryParse('ab');
  assert.ok(r.ok);
  assert.deepEqual([...E.collectVars(r.ast)].sort(), ['a', 'b']);
});

test('evaluation errors are typed', () => {
  assert.throws(() => E.evaluate(E.parse('1/(x-2)', V), { x: 2 }), e => e.code === 'div_zero');
  assert.throws(() => E.evaluate(E.parse('x^(1/2)', V), { x: 4 }), e => e.code === 'non_integer_exponent');
  assert.throws(() => E.evaluate(E.parse('2^100', V), {}), e => e.code === 'exponent_too_large');
  assert.throws(() => E.evaluate(E.parse('x', V), {}), e => e.code === 'unbound_variable');
});

test('polynomial normal form', () => {
  assert.equal(nf('3x+5-x'), '2*x+5');
  assert.equal(nf('2(x+3)'), '2*x+6');
  assert.equal(nf('-(x-4)'), '-x+4');
  assert.equal(nf('(x+1)^2'), 'x^2+2*x+1');
  assert.equal(nf('x/2+x/3'), '5/6*x');
  assert.equal(nf('x-x'), '0');
  assert.equal(E.toPoly(E.parse('1/x', V)), null);
  const two = E.parse('x*y+y*x', { variables: ['x', 'y'] });
  assert.equal(E.polyToString(E.toPoly(two)), '2*x*y');
});

test('equivalence: true cases', () => {
  assert.ok(eqv('2(x+3)', '2x+6'));
  assert.ok(eqv('3x+5-x', '5+2x'));
  assert.ok(eqv('-(x-4)', '4-x'));
  assert.ok(eqv('(x+1)(x-1)', 'x^2-1'));
  assert.ok(eqv('x/2', '0,5x'));
  assert.ok(eqv('(x^2-1)/(x-1)', '(x+1)(x-1)/(x-1)'));   // non-polynomial → sampling
  const r = E.equivalent(E.parse('(2x)/(4x)', V), E.parse('1/(2)', V), ['x']);
  assert.ok(r.checkedPoints >= 8);
});

test('equivalence: false cases (typical misconceptions)', () => {
  assert.ok(!eqv('2(x+3)', '2x+3'));       // distributing to first term only
  assert.ok(!eqv('-(x-4)', '-x-4'));       // sign error
  assert.ok(!eqv('3x+2', '5x'));            // unlike terms merged
  assert.ok(!eqv('x*x', '2x'));             // x·x ≠ 2x
  assert.ok(!eqv('(x+1)^2', 'x^2+1'));
  assert.ok(!eqv('x+1/1000000', 'x'));      // tiny difference still detected (exact)
  // Different domains (x=5 is a test point): treated as not equivalent, documented in decisions.md.
  const d = E.equivalent(E.parse('(x-5)/(x-5)', V), E.parse('1', V), ['x']);
  assert.equal(d.equivalent, false);
  assert.equal(d.method, 'domain');
});

test('equivalence with polynomials is decided by normal form', () => {
  const r = E.equivalent(E.parse('(x+2)^3', V), E.parse('x^3+6x^2+12x+8', V), ['x']);
  assert.equal(r.equivalent, true);
  assert.equal(r.method, 'normal_form');
});

test('form check "expanded"', () => {
  const f = s => E.checkForm(E.parse(s, V), 'expanded');
  for (const s of ['2x+6', '-x+4', '5', '0', 'x^2-1', '3x/2+1', '1/2x-3', '-4x']) assert.ok(f(s).ok, s);
  assert.equal(f('2(x+3)').reason, 'brackets_remaining');
  assert.equal(f('-(x-4)').reason, 'brackets_remaining');
  assert.equal(f('3x+5-x').reason, 'like_terms_not_collected');
  assert.equal(f('2+x+3').reason, 'like_terms_not_collected');
  assert.equal(f('x*x').reason, 'unsimplified_product');
  assert.equal(f('2*3x').reason, 'unsimplified_coefficient');
  assert.equal(f('6/4x').reason, 'unreduced_fraction');
  assert.equal(f('0x+3').reason, 'zero_term');
});

test('form check "product_with_sum"', () => {
  const f = s => E.checkForm(E.parse(s, V), 'product_with_sum');
  assert.ok(f('3(2x+3)').ok);
  assert.ok(f('-2(x-1)').ok);
  assert.ok(f('x(x+1)').ok);
  assert.equal(f('6x+9').reason, 'not_a_product');
  assert.equal(f('3*2x').reason, 'no_bracket_factor');
});

test('toLatex renders readable school notation', () => {
  const L = s => E.toLatex(E.parse(s, V));
  assert.equal(L('2x+3'), '2x+3');
  assert.equal(L('2(x+1)'), '2\\left(x+1\\right)');
  assert.equal(L('x-(-3)'), 'x-\\left(-3\\right)');
  assert.equal(L('3/4'), '\\frac{3}{4}');
  assert.equal(L('-x^2'), '-x^{2}');
});
