'use strict';
/**
 * Skill ch1.terms.expand_factor — Ausmultiplizieren und Ausklammern (LS7 I.5).
 * Scope note: sum × sum is flagged disabled_by_default in the catalog and NOT generated.
 */
const X = require('../../expr');
const U = require('../util');
const { F, hints, tex, $, numTex, numMachine, polyMachine, polyInput, exprDistractors, gcd } = U;

const SKILL = 'ch1.terms.expand_factor';

/**
 * parts: [{k:'3', inner:[[c,pow],...]}  (bracket part)  |  {single:[c,pow]}]
 * Machine string of the task, sign of each part merged with the join.
 */
function partsMachine(parts) {
  return parts.map((pt, i) => {
    if (pt.single) {
      const s = polyMachine([pt.single]);
      return i === 0 || s.startsWith('-') ? s : `+${s}`;
    }
    const k = F(pt.k), inner = polyMachine(pt.inner);
    const body = k.abs().eq(1) ? `(${inner})` : `${numMachine(k.abs())}(${inner})`;
    if (k.sign() < 0) return `-${body}`;
    return i === 0 ? body : `+${body}`;
  }).join('');
}
/** Products term by term (with an optional wrong rule), in display order. */
function expandTerms(parts, rule) {
  const out = [];
  for (const pt of parts) {
    if (pt.single) { out.push([F(pt.single[0]), pt.single[1]]); continue; }
    const k = F(pt.k);
    pt.inner.forEach(([c, pw], i) => {
      let coef = k.mul(F(c));
      if (rule === 'firstOnly' && i > 0) coef = F(c);
      if (rule === 'minusBracket' && i > 0 && k.sign() < 0) coef = k.abs().mul(F(c));
      out.push([coef, pw]);
    });
  }
  return out;
}
function collectTerms(terms) {
  let kx = F(0), k0 = F(0);
  for (const [c, pw] of terms) { if (pw === 1) kx = kx.add(c); else k0 = k0.add(c); }
  return [[kx, 1], [k0, 0]];
}
function innerSample(rng, allowNeg) {
  const b = rng.int(1, 6) * (allowNeg && rng.bool() ? -1 : 1);
  const c = rng.int(1, 12) * (allowNeg && rng.bool() ? -1 : 1);
  return rng.bool() ? [[String(b), 1], [String(c), 0]] : [[String(c), 0], [String(b), 1]];
}

/**
 * Template ch1.terms.expand_factor.expand (families expand_positive, expand_negative, expand_collect)
 * Levels
 *  L1 Grundlagen    positive integer factor, one bracket: 3(2x + 5).
 *  L2 Standard      negative factor or minus before the bracket: −4(2x − 3), −(x − 7).
 *  L3 Anspruchsvoll two brackets, then collect: 3(2x + 1) − 2(x − 4); also ½(4x − 6).
 *  L4 Transfer      three parts incl. a minus bracket and a single term: 2(3x − 1) − (4x − 5) + 3x.
 * Misconceptions → distractors: distribute_first_only (2(x + 3) → 2x + 3),
 *  minus_bracket (−(x − 4) → −x − 4).
 * Independent solver: polynomial normal form of the task string.
 */
const expand = {
  id: `${SKILL}.expand`, version: 1, skillId: SKILL,
  families: ['expand_positive', 'expand_negative', 'expand_collect'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Positiver ganzzahliger Faktor, eine Klammer.',
    2: 'Negativer Faktor oder Minus vor der Klammer.',
    3: 'Zwei Klammern ausmultiplizieren und zusammenfassen; auch Bruch als Faktor.',
    4: 'Drei Teile mit Minusklammer und einzelnem Glied, anschließend zusammenfassen.',
  },
  misconceptions: ['distribute_first_only', 'minus_bracket'],
  sample(rng, level) {
    if (level === 1) return { parts: [{ k: String(rng.int(2, 9)), inner: innerSample(rng, false) }] };
    if (level === 2) {
      const k = rng.pick([-1, -1, 0]) === 0 ? -rng.int(2, 9) : -1;
      return { parts: [{ k: String(k === -1 && rng.bool() ? -rng.int(2, 9) : k), inner: innerSample(rng, true) }] };
    }
    if (level === 3) {
      const shape = rng.pick(['two', 'two', 'half']);
      if (shape === 'half') {
        const b = 2 * rng.int(1, 5), c = 2 * rng.int(1, 6) * rng.pick([1, -1]);
        return { parts: [{ k: '1/2', inner: [[String(b), 1], [String(c), 0]] }, { single: [String(rng.intExcept(-9, 9, [0])), 1] }] };
      }
      return { parts: [{ k: String(rng.int(2, 9)), inner: innerSample(rng, true) }, { k: String(rng.pick([-1, 1]) * rng.int(1, 9)), inner: innerSample(rng, true) }] };
    }
    return {
      parts: rng.shuffle([
        { k: String(rng.int(2, 9)), inner: innerSample(rng, true) },
        { k: String(-rng.int(1, 6)), inner: innerSample(rng, true) },
        { single: [String(rng.intExcept(-9, 9, [0])), rng.pick([0, 1])] },
      ]),
    };
  },
  constraints(p, level) {
    const res = collectTerms(expandTerms(p.parts));
    if (res[0][0].isZero()) return 'x cancels';
    if (level >= 3 && res[1][0].isZero()) return 'constant cancels';
    if (level === 4 && p.parts[0].single) return 'single term first';
    if (level >= 2 && !p.parts.some(pt => pt.k && F(pt.k).sign() < 0) && level !== 3) return 'no negative factor';
    return true;
  },
  build(p, level) {
    const task = partsMachine(p.parts);
    const products = expandTerms(p.parts);
    const res = collectTerms(products);
    const value = polyMachine(res);
    const line1 = polyMachine(products);
    const steps = [`Jedes Glied in der Klammer mit dem Faktor davor multiplizieren: ${$(`${tex(task)} = ${tex(line1)}`)}`];
    const single = p.parts.length === 1;
    if (!single) steps.push(`Gleichartige Glieder zusammenfassen: ${$(`= ${tex(value)}`)}`);
    else if (tex(line1) !== tex(value)) steps.push($(`= ${tex(value)}`));
    const firstOnly = { value: polyMachine(collectTerms(expandTerms(p.parts, 'firstOnly'))), category: 'concept_confusion', feedback: 'Multipliziere jedes Glied in der Klammer mit dem Faktor, nicht nur das erste.' };
    const minusBr = { value: polyMachine(collectTerms(expandTerms(p.parts, 'minusBracket'))), category: 'sign_error', feedback: 'Steht ein Minus vor der Klammer, ändert sich das Vorzeichen jedes Glieds in der Klammer.' };
    // If both misconceptions give the same wrong result, a negative factor makes the sign error the better diagnosis.
    const dis = p.parts.some(pt => pt.k && F(pt.k).sign() < 0) ? [minusBr, firstOnly] : [firstOnly, minusBr];
    const firstBracket = p.parts.find(pt => pt.inner);
    const kb = F(firstBracket.k);
    const fbTex = tex(partsMachine([firstBracket]));
    const fbRes = tex(polyMachine(expandTerms([firstBracket])));
    return {
      prompt: `Multipliziere aus und vereinfache: ${$(tex(task))}.`,
      instructions: 'Schreibe das Ergebnis ohne Klammern und fasse zusammen.',
      answer: { type: 'expression', value, canonical: polyInput(res), variables: ['x'], form: 'expanded', distractors: exprDistractors(value, dis) },
      hints: hints(
        'Distributivgesetz: Ein Faktor vor der Klammer wird mit jedem Glied in der Klammer multipliziert.',
        kb.sign() < 0 || p.parts.some(pt => pt.k && F(pt.k).sign() < 0)
          ? 'Bei einem negativen Faktor (oder Minus vor der Klammer) ändern sich alle Vorzeichen in der Klammer.'
          : 'Multipliziere den Faktor mit dem ersten und mit dem zweiten Glied der Klammer.',
        `Zum Beispiel: ${$(`${fbTex} = ${fbRes}`)}${single ? '' : '. Mache das für jede Klammer und fasse dann zusammen.'}`,
        steps,
        `Flächenmodell: ${$(tex(partsMachine([{ ...firstBracket, k: kb.abs().toString() }])))} ist der Flächeninhalt eines Rechtecks mit der Breite ${$(numTex(kb.abs()))}, das aus zwei Teilrechtecken besteht. Addiere die Teilflächen.`),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) { return U.solveExpanded(partsMachine(p.parts)); },
};

/**
 * Template ch1.terms.expand_factor.factor_out (family factor_out)
 * Levels
 *  L2 Standard      common integer factor of two positive summands: 6x + 9 → 3(2x + 3).
 *  L3 Anspruchsvoll negative summands, inner 1 (6x + 6 → 6(x + 1)), both negative (−4x − 10).
 *  L4 Transfer      Rechenvorteil (17·38 + 17·62) or sum of consecutive numbers as a product (n + (n+1) + (n+2) = 3(n+1)).
 * Misconceptions: incomplete_factoring (handled by the form check factored_complete with feedback),
 *  only one summand divided, forgetting the 1 in the bracket.
 * Independent solver: brute-force search over factors k and inner coefficients for a complete
 *  factorisation equivalent to the task (expression variants); exact evaluation for Rechenvorteil.
 */
const factorOut = {
  id: `${SKILL}.factor_out`, version: 1, skillId: SKILL,
  families: ['factor_out'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Gemeinsamer ganzzahliger Faktor zweier positiver Summanden.',
    3: 'Negative Summanden, Klammer mit 1, beide Summanden negativ.',
    4: 'Rechenvorteil durch Ausklammern oder Summe aufeinanderfolgender Zahlen als Produkt.',
  },
  misconceptions: ['incomplete_factoring', 'divide_one_only', 'forget_one'],
  sample(rng, level) {
    if (level === 4) {
      const shape = rng.pick(['advantage', 'consecutive']);
      if (shape === 'advantage') {
        const base = rng.pick([10, 100, 100]);
        const m = rng.int(base === 10 ? 2 : 11, base === 10 ? 8 : 89);
        return { shape, k: rng.int(11, 49), m, n: base - m, op: '+' };
      }
      return { shape, count: rng.pick([3, 3, 5]), even: rng.pick([false, false, true]) };
    }
    const k = rng.int(2, 9);
    let b = rng.int(1, 9), c = level === 3 && rng.int(0, 3) === 0 ? 1 : rng.int(1, 12);
    const kind = level === 2 ? 'pos' : rng.pick(['negC', 'negB', 'both', 'pos']);
    if (kind === 'negC' || kind === 'both') c = -c;
    if (kind === 'negB' || kind === 'both') b = -b;
    return { shape: 'linear', k, b, c, swap: rng.bool() };
  },
  constraints(p, level) {
    if (p.shape === 'linear') {
      if (gcd(p.b, p.c) !== 1) return 'inner not coprime';
      if (Math.abs(p.b) === 1 && Math.abs(p.c) === 1 && level === 2) return 'too trivial';
      if (level === 3 && p.b > 0 && p.c > 0 && p.c !== 1) return 'L3 needs a sign or a 1';
    }
    return true;
  },
  build(p, level) {
    if (p.shape === 'advantage') {
      const task = `${p.k}*${p.m}+${p.k}*${p.n}`;
      const sum = p.m + p.n, value = F(p.k * sum);
      const steps = [`${$(`${tex(task)} = ${p.k}\\cdot \\left(${p.m}+${p.n}\\right)`)}`, $(`= ${p.k}\\cdot ${sum}`), $(`= ${value.toString()}`)];
      return {
        prompt: `Berechne geschickt, indem du ausklammerst: ${$(tex(task))}.`,
        instructions: 'Gib das Ergebnis als ganze Zahl an.',
        answer: { type: 'integer', value: value.toString(), canonical: value.toString(), distractors: U.numDistractors(value, [{ value: String(p.k * p.m + p.n), category: 'concept_confusion', feedback: 'Beide Produkte enthalten den Faktor – er wird mit der ganzen Summe multipliziert.' }]) },
        hints: hints(
          'Beide Produkte haben einen gemeinsamen Faktor. Den kannst du ausklammern (Distributivgesetz rückwärts).',
          `Klammere ${$(String(p.k))} aus: ${$(`${p.k}\\cdot (\\ldots + \\ldots)`)}.`,
          `${$(`${tex(task)} = ${p.k}\\cdot \\left(${p.m}+${p.n}\\right)`)}. Die Klammer ergibt eine glatte Zahl.`,
          steps,
          `Denke an ${$(String(p.k))} Kisten mit je ${$(String(p.m))} und noch einmal ${$(String(p.k))} Kisten mit je ${$(String(p.n))} Stück: Das sind ${$(String(p.k))} Kisten mit je ${$(String(sum))} Stück.`),
        solution: { steps, result: $(value.toString()) },
      };
    }
    if (p.shape === 'consecutive') {
      const step = p.even ? 2 : 1;
      const first = p.even ? '2n' : 'n';
      const summands = Array.from({ length: p.count }, (_, i) => (i === 0 ? first : `(${first}+${i * step})`));
      const task = summands.join('+');
      const kx = p.count * (p.even ? 2 : 1), k0 = step * (p.count * (p.count - 1)) / 2;
      const g = gcd(kx, k0);
      const value = `${g}(${polyMachine([[kx / g, 1], [k0 / g, 0]], { v: 'n' })})`;
      const sumLine = polyMachine([[kx, 1], [k0, 0]], { v: 'n' });
      const steps = [`Zusammenfassen: ${$(`${tex(task)} = ${tex(sumLine)}`)}`, `Ausklammern: ${$(`= ${tex(value)}`)}`,
        `Daran erkennt man: Die Summe ist immer durch ${$(String(g))} teilbar.`];
      const kindAdj = p.even ? ['gerader', 'geraden'] : ['natürlicher', 'natürlichen'];
      const what = p.count === 3 ? `dreier aufeinanderfolgender ${kindAdj[0]} Zahlen` : `von fünf aufeinanderfolgenden ${kindAdj[1]} Zahlen`;
      return {
        prompt: `Die Summe ${what} lässt sich mit dem Term ${$(tex(task))} beschreiben. Fasse zusammen und klammere den größten gemeinsamen Faktor aus.`,
        instructions: 'Schreibe das Ergebnis als Produkt: Zahl mal Klammer. Verwende die Variable $n$.',
        answer: { type: 'expression', value, canonical: value, variables: ['n'], form: 'factored_complete', distractors: exprDistractors(value, [{ value: `${kx}n+${step * (p.count - 1)}`, category: 'concept_confusion', feedback: 'Fasse alle Zahlen zusammen – jede Klammer enthält eine eigene Zahl.' }], ['n']) },
        hints: hints(
          'Fasse zuerst alle $n$-Glieder und alle Zahlen zusammen. Dann suchst du den größten gemeinsamen Teiler.',
          'Größter gemeinsamer Faktor: der ggT der beiden Zahlen im zusammengefassten Term.',
          `Zusammengefasst ergibt sich ${$(tex(sumLine))}.`,
          steps,
          `Probe: Für $n=1$ ergibt der Term ${$(numTex(U.evalMachine(task, { n: F(1) })))}; dein Produkt muss denselben Wert haben.`),
        solution: { steps, result: $(tex(value)) },
      };
    }
    const { k, b, c } = p;
    const outer = b < 0 && c < 0 ? -k : k;
    const ib = b / (outer / k), ic = c / (outer / k);
    const innerTerms = p.swap ? [[ic, 0], [ib, 1]] : [[ib, 1], [ic, 0]];
    const value = `${outer}(${polyMachine(innerTerms)})`;
    const taskTerms = p.swap ? [[k * c, 0], [k * b, 1]] : [[k * b, 1], [k * c, 0]];
    const task = polyMachine(taskTerms);
    const steps = [
      `Größter gemeinsamer Faktor von ${$(String(Math.abs(k * b)))} und ${$(String(Math.abs(k * c)))}: ${$(String(k))}${outer < 0 ? ' (wegen der zwei Minuszeichen klammern wir $-' + k + '$ aus)' : ''}.`,
      `Jedes Glied durch ${$(numTex(outer))} teilen: ${$(`${tex(task)} = ${tex(value)}`)}`,
      `Probe durch Ausmultiplizieren: ${$(`${tex(value)} = ${tex(task)}`)} ✓`,
    ];
    const dis = [{ value: `${outer}(${polyMachine(p.swap ? [[ic, 0], [k * b, 1]] : [[ib, 1], [k * c, 0]])})`, category: 'concept_confusion', feedback: 'Jedes Glied muss durch den ausgeklammerten Faktor geteilt werden.' }];
    if (Math.abs(c) === 1) dis.push({ value: `${outer}(${polyMachine([[ib, 1]])})`, category: 'concept_confusion', feedback: 'Wenn ein Glied genau der ausgeklammerte Faktor ist, bleibt in der Klammer 1 (bzw. −1) stehen.' });
    return {
      prompt: `Klammere den größten gemeinsamen Faktor aus: ${$(tex(task))}.`,
      instructions: 'Schreibe das Ergebnis als Produkt: Zahl mal Klammer.',
      answer: { type: 'expression', value, canonical: value, variables: ['x'], form: 'factored_complete', distractors: exprDistractors(value, dis) },
      hints: hints(
        'Ausklammern ist Ausmultiplizieren rückwärts: Du suchst einen Faktor, der in jedem Glied steckt.',
        'Bestimme den größten gemeinsamen Teiler (ggT) der Zahlen in den Gliedern und teile jedes Glied dadurch.',
        `Der ggT von ${$(String(Math.abs(k * b)))} und ${$(String(Math.abs(k * c)))} ist ${$(String(k))}.`,
        steps,
        'Kontrolliere dein Ergebnis, indem du wieder ausmultiplizierst. Prüfe auch: Haben die Zahlen in der Klammer noch einen gemeinsamen Teiler? Dann war der Faktor nicht der größte.'),
      solution: { steps, result: $(tex(value)) },
    };
  },
  /** Independent: search factors g = ±1…±60 and inner coefficients so that g·(inner) ≡ task and is complete. */
  solve(p) {
    if (p.shape === 'advantage') return U.evalMachine(`${p.k}*${p.m}+${p.k}*${p.n}`).toString();
    let task, v;
    if (p.shape === 'consecutive') {
      const step = p.even ? 2 : 1, first = p.even ? '2n' : 'n';
      task = Array.from({ length: p.count }, (_, i) => (i === 0 ? first : `(${first}+${i * step})`)).join('+');
      v = 'n';
    } else {
      task = polyMachine(p.swap ? [[p.k * p.c, 0], [p.k * p.b, 1]] : [[p.k * p.b, 1], [p.k * p.c, 0]]);
      v = 'x';
    }
    const poly = X.toPoly(X.parse(task, { variables: [v] }));
    const a1 = poly.get(`${v}^1`), a0 = poly.get('');
    for (let g = 60; g >= 1; g--) {
      const G = F(g);
      if (!a1.div(G).isInteger() || !a0.div(G).isInteger()) continue;
      const cand = `${g}(${polyMachine([[a1.div(G), 1], [a0.div(G), 0]], { v })})`;
      const ast = X.parse(cand, { variables: [v] });
      if (X.checkForm(ast, 'factored_complete').ok && U.equiv(cand, task, [v])) return cand;
    }
    return null;
  },
};

module.exports = [expand, factorOut];
