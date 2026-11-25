'use strict';
/**
 * Skill ch1.numterms.evaluate — Zahlterme mit rationalen Zahlen berechnen (LS7 I.1).
 */
const X = require('../../expr');
const U = require('../util');
const { F, hints, tex, $, numMachine, numInput, reduceSteps, evalMachine, numDistractors } = U;

const SKILL = 'ch1.numterms.evaluate';
const nb = n => numMachine(n, { bracket: true }); // negative literals bracketed

/**
 * Template ch1.numterms.evaluate.order_ops (families: order_of_operations, sign_rules, mixed_representations)
 *
 * Levels
 *  L1 Grundlagen   natural numbers ≤ 20, one product and one sum/difference, at most one bracket; result ≥ 0.
 *  L2 Standard     integers −12…12 incl. negatives, two products or product + bracket; sign rules.
 *  L3 Anspruchsvoll fractions and decimals mixed, powers (−a² vs (−a)², squared bracket).
 * Misconceptions → distractors
 *  strich_vor_punkt (order_of_operations): strict left-to-right / bracket ignored.
 *  neg_square (sign_error): −a² read as (−a)².
 *  mixed_repr (rounding): non-terminating fraction rounded to one decimal before multiplying.
 *  product_sign (sign_error): sign of one product flipped.
 */
const orderOps = {
  id: `${SKILL}.order_ops`, version: 1, skillId: SKILL,
  families: ['order_of_operations', 'sign_rules', 'mixed_representations'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Natürliche Zahlen ≤ 20, ein Produkt und eine Summe/Differenz, höchstens eine Klammer, Ergebnis ≥ 0.',
    2: 'Ganze Zahlen mit negativen Werten, zwei Produkte oder Produkt mit Klammer; Vorzeichenregeln.',
    3: 'Brüche und Dezimalzahlen gemischt, Potenzen (−a² gegenüber (−a)²), quadrierte Klammer.',
  },
  misconceptions: ['strich_vor_punkt', 'neg_square', 'mixed_repr', 'product_sign'],
  sample(rng, level) {
    if (level === 1) {
      const shape = rng.pick(['a+b*c', 'a-b*c', '(a+b)*c', 'a*(b-c)']);
      return { shape, a: rng.int(2, 20), b: rng.int(2, 9), c: rng.int(2, 9) };
    }
    if (level === 2) {
      const nz = () => rng.intExcept(-12, 12, [0, 1, -1]);
      return { shape: rng.pick(['a*b+c*d', 'a-b*c', '(a-b)*c', 'a*b-c*d']), a: nz(), b: nz(), c: nz(), d: nz() };
    }
    const shape = rng.pick(['negsq', 'mixed', 'fracbr', 'sqbr']);
    const den = rng.pick([2, 3, 4, 5]);
    return {
      shape, a: rng.int(2, 9), b: rng.intExcept(-9, 9, [0, 1, -1]), c: rng.intExcept(-9, 9, [0, 1, -1]),
      p: `${rng.pick([-1, 1]) * rng.int(1, 49)}/10`, q: `${rng.pick([-1, 1]) * rng.int(1, 2 * den - 1)}/${den}`,
    };
  },
  machine(p) {
    switch (p.shape) {
      case 'a+b*c': return `${p.a}+${p.b}*${p.c}`;
      case 'a-b*c': return `${p.a}-${p.b}*${p.c}`;
      case '(a+b)*c': return `(${p.a}+${p.b})*${p.c}`;
      case 'a*(b-c)': return `${p.a}*(${p.b}-${p.c})`;
      case 'a*b+c*d': return `${nb(p.a)}*${nb(p.b)}+${nb(p.c)}*${nb(p.d)}`;
      case 'a*b-c*d': return `${nb(p.a)}*${nb(p.b)}-${nb(p.c)}*${nb(p.d)}`;
      case 'a-b*c': return `${nb(p.a)}-${nb(p.b)}*${nb(p.c)}`;
      case '(a-b)*c': return `(${nb(p.a)}-${nb(p.b)})*${nb(p.c)}`;
      case 'negsq': return `-${p.a}^2+${nb(p.b)}*${nb(p.c)}`;
      case 'mixed': return `${numMachine(p.p, { dec: true })}+${fracM(p.q)}*${nb(p.c)}`;
      case 'fracbr': return `(${fracLead(p.q)}-${nb(p.b)})*${nb(p.c)}`;
      case 'sqbr': return `(${nb(p.b)}+${nb(p.c)})^2-${p.a}`;
      default: throw new Error(p.shape);
    }
  },
  constraints(p, level) {
    const m = this.machine(p);
    const v = evalMachine(m);
    if (level === 1 && v.sign() < 0) return 'negative result at L1';
    if (v.abs().cmp(F(level === 1 ? 200 : 400)) > 0) return 'result too large';
    if (level === 3) {
      if (F(p.q).isInteger() || F(p.p).isInteger()) return 'fraction literal is integral';
      if (p.shape === 'fracbr' && F(p.q).sub(p.b).isZero()) return 'zero bracket';
      if (p.shape === 'sqbr' && p.b + p.c === 0) return 'zero bracket';
      if (!v.isInteger() && v.d > 60n) return 'awkward denominator';
    }
    if (p.shape === 'a*(b-c)' && p.b <= p.c) return 'bracket not positive';
    return true;
  },
  /** Distractor values computed from the parameters (each one a specific misconception). */
  distractors(p) {
    const b = F(p.b), c = F(p.c), a = F(p.a);
    const L = [];
    const oo = (value, fb) => L.push({ value, category: 'order_of_operations', feedback: fb });
    const sg = (value, fb) => L.push({ value, category: 'sign_error', feedback: fb });
    switch (p.shape) {
      case 'a+b*c': oo(a.add(b).mul(c), 'Punkt vor Strich: Berechne zuerst das Produkt.'); break;
      case 'a-b*c':
        oo(a.sub(b).mul(c), 'Punkt vor Strich: Berechne zuerst das Produkt.');
        if (p.d !== undefined) sg(a.add(b.mul(c)), 'Achte auf das Vorzeichen des Produkts.');
        break;
      case '(a+b)*c': oo(a.add(b.mul(c)), 'Die Klammer wird zuerst berechnet.'); break;
      case 'a*(b-c)': oo(a.mul(b).sub(c), 'Die Klammer wird zuerst berechnet.'); break;
      case 'a*b+c*d': case 'a*b-c*d': {
        const s = p.shape === 'a*b+c*d' ? 1 : -1, ab = a.mul(b), cd = c.mul(p.d);
        oo(s === 1 ? ab.add(c).mul(p.d) : ab.sub(c).mul(p.d), 'Punkt vor Strich: Berechne zuerst beide Produkte.');
        sg(s === 1 ? ab.sub(cd) : ab.add(cd), 'Achte auf die Vorzeichen der Produkte (Minus mal Minus ergibt Plus).');
        break;
      }
      case '(a-b)*c': oo(a.sub(b.mul(c)), 'Die Klammer wird zuerst berechnet.'); sg(a.add(b).mul(c), 'Minus vor einer negativen Zahl ergibt Plus.'); break;
      case 'negsq': sg(a.mul(a).add(b.mul(c)), 'Bei $-a^2$ wird nur $a$ quadriert, das Minus bleibt: $-3^2=-9$.'); break;
      case 'mixed': {
        const q = F(p.q), pp = F(p.p);
        oo(pp.add(q).mul(c), 'Punkt vor Strich: Berechne zuerst das Produkt.');
        if (!q.isTerminatingDecimal()) L.push({ value: pp.add(q.round(1).mul(c)), category: 'rounding', feedback: 'Runde nicht vorzeitig – rechne mit dem Bruch weiter.' });
        break;
      }
      case 'fracbr': oo(F(p.q).sub(b.mul(c)), 'Die Klammer wird zuerst berechnet.'); break;
      case 'sqbr': L.push({ value: b.mul(b).add(c.mul(c)).sub(a), category: 'concept_confusion', feedback: 'Quadriere die ganze Klammer: erst addieren, dann quadrieren.' }); break;
      default: break;
    }
    return L;
  },
  build(p, level) {
    const m = this.machine(p);
    const ast = X.parse(m);
    const { lines, value } = reduceSteps(ast);
    const decTask = level === 3 && p.shape === 'mixed';
    const answer = level === 3
      ? { type: 'fraction', value: value.toString(), canonical: numInput(value, { dec: decTask }) }
      : { type: 'integer', value: value.toString(), canonical: value.toString() };
    answer.distractors = numDistractors(value, this.distractors(p));
    const task = lines[0];
    const strategy = {
      'a+b*c': 'Punkt vor Strich: Berechne zuerst das Produkt, dann die Summe.',
      'a-b*c': 'Punkt vor Strich: Berechne zuerst das Produkt, dann die Differenz.',
      '(a+b)*c': 'Berechne zuerst die Klammer, dann multipliziere.',
      'a*(b-c)': 'Berechne zuerst die Klammer, dann multipliziere.',
      'a*b+c*d': 'Berechne beide Produkte (Vorzeichenregeln!), dann addiere.',
      'a*b-c*d': 'Berechne beide Produkte (Vorzeichenregeln!), dann subtrahiere.',
      '(a-b)*c': 'Berechne zuerst die Klammer. Minus einer negativen Zahl ist Plus.',
      negsq: 'Potenz vor Punkt vor Strich. Bei $-a^2$ wird nur $a$ quadriert.',
      mixed: 'Berechne zuerst das Produkt mit dem Bruch. Rechne mit Brüchen, wenn ein Bruch nicht abbricht.',
      fracbr: 'Berechne zuerst die Klammer (gemeinsamer Nenner), dann multipliziere.',
      sqbr: 'Berechne zuerst die Klammer, dann quadriere das Ergebnis.',
    }[p.shape];
    const alt = {
      1: `Setze gedanklich unsichtbare Klammern um alles, was zuerst gerechnet wird. Rechne dann Schritt für Schritt und schreibe jedes Zwischenergebnis auf.`,
      2: `Vorzeichenregel: Haben beide Faktoren das gleiche Vorzeichen, ist das Produkt positiv, sonst negativ. Bestimme zuerst das Vorzeichen, dann den Betrag.`,
      3: `Du kannst Dezimalzahlen in Brüche umwandeln (z. B. $0{,}5=\\frac{1}{2}$) und dann nur mit Brüchen rechnen. So vermeidest du Rundungsfehler.`,
    }[level];
    const steps = [$(lines[0]), ...lines.slice(1).map(l => $(`= ${l}`))];
    return {
      prompt: `Berechne ${$(task)}.`,
      instructions: level === 3 ? 'Gib das Ergebnis als Bruch, ganze Zahl oder Dezimalzahl an.' : 'Gib das Ergebnis als ganze Zahl an.',
      answer,
      hints: hints(
        'Es geht um die Rechenreihenfolge: Klammern zuerst, dann Potenzen, dann Punkt- vor Strichrechnung, sonst von links nach rechts.',
        strategy,
        lines.length > 2 ? `Erster Schritt: ${$(`${lines[0]} = ${lines[1]}`)}. Rechne jetzt weiter.` : `Rechne ${$(lines[0])} aus.`,
        steps, alt),
      solution: { steps, result: $(U.numTex(value, { dec: decTask })) },
    };
  },
  solve(p) { return evalMachine(this.machine(p)).toString(); },
};
function fracLead(q) { const f = F(q); return `${f.sign() < 0 ? '-' : ''}${f.abs().n}/${f.d}`; }
function fracM(q) { const f = F(q); return f.sign() < 0 ? `(-${f.abs().n}/${f.d})` : `${f.n}/${f.d}`; }

/**
 * Template ch1.numterms.evaluate.insert_brackets (family insert_brackets)
 * "Setze genau ein Klammerpaar so, dass der Zielwert entsteht." Choice among bracket placements.
 * The correct placement must be the ONLY single-bracket placement (incl. none) giving the target.
 *
 * Levels
 *  L2 Standard      four natural numbers 1…9, operators + − ·, exactly one ·.
 *  L3 Anspruchsvoll four numbers 1…12, one or two ·; target may be negative.
 *  L4 Transfer      five numbers, one of them negative; reverse reasoning needed.
 * Misconceptions → distractor options: brackets that do not change the value (order_of_operations),
 *  brackets placed around the wrong pair.
 */
const insertBrackets = {
  id: `${SKILL}.insert_brackets`, version: 1, skillId: SKILL,
  families: ['insert_brackets'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Vier natürliche Zahlen 1–9, Rechenzeichen + − ·, genau ein Malpunkt.',
    3: 'Vier Zahlen 1–12, ein oder zwei Malpunkte; Zielwert kann negativ sein.',
    4: 'Fünf Zahlen, eine davon negativ; Rückwärtsdenken nötig.',
  },
  misconceptions: ['strich_vor_punkt'],
  sample(rng, level) {
    const n = level === 4 ? 5 : 4;
    const nums = Array.from({ length: n }, () => rng.int(2, level === 2 ? 9 : 12));
    if (level === 4) nums[rng.int(1, n - 1)] *= -1;
    let ops;
    if (level === 2) { ops = ['+', rng.pick(['+', '-']), '*']; ops = rng.shuffle(ops); }
    else ops = Array.from({ length: n - 1 }, () => rng.pick(['+', '-', '*']));
    const spans = allSpans(n);
    return { nums, ops, target: rng.int(0, spans.length - 1), pick: [rng.uint32(), rng.uint32(), rng.uint32()] };
  },
  signatureParams(p) { return { nums: p.nums, ops: p.ops, target: p.target }; },
  variants(p) {
    const list = [{ span: null, m: joinTerms(p.nums, p.ops, null) }];
    for (const s of allSpans(p.nums.length)) list.push({ span: s, m: joinTerms(p.nums, p.ops, s) });
    return list;
  },
  constraints(p, level) {
    if (!p.ops.includes('*')) return 'no product';
    if (level === 3 && p.ops.filter(o => o === '*').length > 2) return 'too many products';
    const vs = this.variants(p).map(v => evalMachine(v.m));
    const t = vs[p.target + 1];
    if (vs.filter(v => v.eq(t)).length !== 1) return 'target not unique';
    if (t.isZero()) return 'zero target';
    const sp = allSpans(p.nums.length)[p.target];
    const inner = joinTerms(p.nums.slice(sp[0], sp[1] + 1), p.ops.slice(sp[0], sp[1]), null);
    if (evalMachine(inner).isZero()) return 'bracket evaluates to zero';
    const others = vs.filter(v => !v.eq(t));
    if (others.length < 3) return 'too few distractors';
    if (t.abs().cmp(F(level === 4 ? 300 : 150)) > 0) return 'target too large';
    return true;
  },
  build(p) {
    const vars = this.variants(p);
    const correct = vars[p.target + 1];
    const value = evalMachine(correct.m);
    const others = vars.filter(v => v !== correct);
    const chosen = [];
    for (const k of p.pick) {
      const rest = others.filter(v => !chosen.includes(v));
      chosen.push(rest[k % rest.length]);
    }
    const all = [correct, ...chosen];
    const order = all.map((v, i) => ({ v, key: (p.pick[i % 3] ^ (i * 2654435761)) >>> 0 })).sort((a, b) => a.key - b.key).map(o => o.v);
    const ids = ['a', 'b', 'c', 'd'];
    const options = order.map((v, i) => {
      const val = evalMachine(v.m);
      return {
        id: ids[i], text: v.span ? $(tex(v.m)) : `${$(tex(v.m))} (ohne Klammer)`, value: val.toString(),
        ...(v === correct ? {} : { category: 'order_of_operations', feedback: `Mit dieser Klammersetzung ergibt sich ${$(U.numTex(val))}, nicht ${$(U.numTex(value))}.` }),
      };
    });
    const correctId = options[order.indexOf(correct)].id;
    const plain = vars[0];
    const plainSteps = reduceSteps(X.parse(plain.m));
    const { lines } = reduceSteps(X.parse(correct.m));
    const steps = [`Richtige Klammersetzung: ${$(lines[0])}`, ...lines.slice(1).map(l => $(`= ${l}`))];
    return {
      prompt: `Setze in ${$(tex(plain.m))} genau ein Klammerpaar so, dass der Wert ${$(U.numTex(value))} herauskommt.`,
      instructions: 'Wähle die passende Klammersetzung aus.',
      answer: { type: 'choice', options: options.map(({ value: _v, ...o }) => o), correct: correctId, canonical: correctId },
      hints: hints(
        'Klammern werden zuerst berechnet. Wo die Klammer steht, bestimmt die Rechenreihenfolge.',
        `Berechne für jede Antwort den Wert und vergleiche mit ${$(U.numTex(value))}.`,
        `Ohne Klammer gilt Punkt vor Strich: ${$(`${plainSteps.lines[0]} = ${U.numTex(plainSteps.value)}`)}. Das ist ${plainSteps.value.eq(value) ? '' : 'noch nicht '}der Zielwert.`,
        steps,
        `Arbeite rückwärts: Überlege, welches Zwischenergebnis du vor der letzten Rechnung brauchst, damit ${$(U.numTex(value))} herauskommt.`),
      solution: { steps, result: options.find(o => o.id === correctId).text },
    };
  },
  /** Independent: evaluate every displayed option from its LaTeX-free machine form; unique match wins. */
  solve(p) {
    const q = this.build(p);
    const target = evalMachine(this.variants(p)[p.target + 1].m);
    const vars = this.variants(p);
    const matches = q.answer.options.filter(o => {
      const v = vars.find(vv => (vv.span ? $(tex(vv.m)) : `${$(tex(vv.m))} (ohne Klammer)`) === o.text);
      return v && evalMachine(v.m).eq(target);
    });
    return matches.length === 1 ? matches[0].id : null;
  },
};
function allSpans(n) {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!(i === 0 && j === n - 1)) out.push([i, j]);
  return out;
}
function joinTerms(nums, ops, span) {
  let s = '';
  nums.forEach((x, i) => {
    if (i) s += ops[i - 1];
    if (span && span[0] === i) s += '(';
    s += i === 0 || (span && span[0] === i) ? `${x < 0 ? `(${x})` : x}` : nb(x);
    if (span && span[1] === i) s += ')';
  });
  return s;
}

module.exports = [orderOps, insertBrackets];
