'use strict';
/**
 * Template ch2.prop.recognize_compute.graph (family graph_type). No drawn graph yet (D64): the graph is given by
 * a point or described in words; the student works with coordinates and a value table.
 * Levels
 *  L2 Standard       The graph of a proportional Zuordnung is a straight line through the origin and P(a | b).
 *                    Find the missing coordinate of another point on it (forward or backward).
 *  L3 Anspruchsvoll  Imagine the points of a value table in a coordinate system: on a line through the origin,
 *                    on a line not through the origin, on a falling curve approaching the axes, or on a rising
 *                    curve getting steeper? (proportional, Grundgebühr-type, antiproportional, squares)
 * Misconceptions: additive_reasoning, inverse_dreisatz, affine_as_prop.
 * Independent solver: L2 Dreisatz term of the displayed point (expression engine); L3 BigInt classification
 * (quotients, products, collinearity) of the displayed table.
 */
const { hints, $, numTex } = require('../util');
const Z = require('./zuo');
const { F, texNum } = Z;

const SKILL = 'ch2.prop.recognize_compute';
const tq = f => (Z.fitsPlaces(f, 4) ? texNum(f) : numTex(f));
const pt = (name, x, y) => $(`${name}(${texNum(x)} \\mid ${texNum(y)})`);

const SHAPE = {
  prop: 'auf einer Geraden durch den Ursprung',
  affine: 'auf einer Geraden, die nicht durch den Ursprung geht',
  anti: 'auf einer fallenden Kurve, die sich beiden Achsen immer mehr annähert',
  square: 'auf einer steigenden Kurve, die immer steiler wird (keine Gerade)',
};
const SHAPE_FB = {
  prop: 'Für eine Gerade durch den Ursprung müssten alle Quotienten $y : x$ gleich sein.',
  affine: 'Prüfe: Wächst $y$ bei jedem Schritt um 1 in $x$ um gleich viel? Und ist $y$ bei $x = 0$ wirklich nicht 0?',
  anti: 'Für eine antiproportionale Zuordnung müssten alle Produkte $x \\cdot y$ gleich sein.',
  square: 'Prüfe, ob die Zuwächse wirklich immer größer werden – oder ob alle Quotienten bzw. Produkte gleich sind.',
};

function sampleL2(rng) {
  const k = rng.pick(['0.5', '1.5', '2', '2.5', '3', '4', '5', '6']);
  const [a, c] = rng.shuffle(Z.pickDistinct(rng, Z.range([1, 12, 1]), 2));
  return { v: 'point', k, a, c, ask: rng.pick(['y', 'x']) };
}
function sampleL3(rng) {
  const kind = rng.pick(['prop', 'affine', 'anti', 'square']);
  if (kind === 'prop') return { v: 'shape', kind, k: rng.pick(['0.5', '1.5', '2', '2.5', '3', '4']), xs: Z.pickDistinct(rng, Z.range([1, 10, 1]), 5) };
  if (kind === 'affine') return { v: 'shape', kind, k: rng.pick(['0.5', '1', '1.5', '2', '3']), b: String(rng.int(1, 6)), xs: Z.pickDistinct(rng, Z.range([1, 10, 1]), 5) };
  if (kind === 'anti') { const c = rng.pick(['12', '24', '36', '48', '60']); return { v: 'shape', kind, c, xs: Z.pickDistinct(rng, ['1', '2', '3', '4', '6', '12'].filter(x => F(c).div(F(x)).isInteger()), 5) }; }
  return { v: 'shape', kind, q: rng.pick(['0.5', '1', '2']), xs: Z.pickDistinct(rng, Z.range([1, 8, 1]), 5) };
}
function rowsOf(p) {
  return p.xs.map(x0 => {
    const x = F(x0);
    const y = p.kind === 'prop' ? F(p.k).mul(x) : p.kind === 'affine' ? F(p.k).mul(x).add(F(p.b)) : p.kind === 'anti' ? F(p.c).div(x) : F(p.q).mul(x).mul(x);
    return [Z.dstr(x), Z.dstr(y)];
  });
}

function buildPoint(p) {
  const k = F(p.k), a = F(p.a), b = k.mul(a), c = F(p.c), d = k.mul(c);
  const askY = p.ask === 'y';
  const answer = askY ? d : c;
  const spec = { ...Z.numSpec(answer, null), variable: askY ? 'y' : 'x' };
  spec.distractors = Z.dist(answer, askY
    ? [{ value: b.add(c.sub(a)), category: 'concept_confusion', feedback: 'Auf einer Ursprungsgeraden wachsen $x$ und $y$ nicht um gleich viel, sondern mit demselben Faktor.' },
      { value: a.mul(b).div(c), category: 'concept_confusion', feedback: 'So rechnet man bei antiproportionalen Zuordnungen. Auf einer Ursprungsgeraden gehört zum doppelten $x$ das doppelte $y$.' },
      { value: c.div(k), category: 'concept_confusion', feedback: `Du hast durch ${$(tq(k))} geteilt. Der $y$-Wert ist ${$(tq(k))}-mal so groß wie der $x$-Wert.` }]
    : [{ value: a.add(d.sub(b)), category: 'concept_confusion', feedback: 'Auf einer Ursprungsgeraden wachsen $x$ und $y$ nicht um gleich viel, sondern mit demselben Faktor.' },
      { value: d.mul(k), category: 'concept_confusion', feedback: `Du hast mit ${$(tq(k))} multipliziert. Für den $x$-Wert musst du den $y$-Wert durch ${$(tq(k))} teilen.` }]);
  const s1 = `Quotient aus ${pt('P', a, b)}: ${$(`${texNum(b)} : ${texNum(a)} = ${tq(k)}`)}. Jeder Punkt der Geraden hat ${$(`y = ${tq(k)} \\cdot x`)}.`;
  const s2 = askY ? `${$(`y = ${tq(k)} \\cdot ${texNum(c)} = ${texNum(d)}`)}, also ${pt('Q', c, d)}.` : `${$(`x = ${texNum(d)} : ${tq(k)} = ${texNum(c)}`)}, also ${pt('Q', c, d)}.`;
  const f = c.div(a);
  return {
    prompt: `Der Graph einer proportionalen Zuordnung ist eine Gerade durch den Ursprung. Sie geht durch den Punkt ${pt('P', a, b)}. Der Punkt Q liegt auch auf dieser Geraden. ${askY ? `Q hat den $x$-Wert ${$(texNum(c))}. Welchen $y$-Wert hat Q?` : `Q hat den $y$-Wert ${$(texNum(d))}. Welchen $x$-Wert hat Q?`}`,
    instructions: `Du kannst „${askY ? 'y' : 'x'} = …“ oder nur die Zahl eingeben.`,
    answer: spec,
    hints: hints('Auf einer Geraden durch den Ursprung ist für jeden Punkt der Quotient $y : x$ gleich – es ist der Graph einer proportionalen Zuordnung.',
      `Berechne den Quotienten $y : x$ für P. ${askY ? 'Multipliziere dann den $x$-Wert von Q mit ihm.' : 'Teile dann den $y$-Wert von Q durch ihn.'}`,
      s1, [s1, s2],
      Z.simpleFactor(f)
        ? `Mit Vielfachen: Von P zu Q wird der $x$-Wert ${Z.scaleStep(a, f, texNum).word}. Dann wird auch der $y$-Wert ${Z.scaleStep(b, f, texNum).word}: ${$(Z.scaleStep(b, f, texNum).calc)}.`
        : `Probe: Für Q muss der Quotient $y : x$ ebenfalls ${$(tq(k))} sein: ${$(`${texNum(d)} : ${texNum(c)} = ${tq(k)}`)}.`),
    solution: { steps: [s1, s2], result: askY ? $(`y = ${texNum(d)}`) : $(`x = ${texNum(c)}`) },
  };
}
function buildShape(p) {
  const rows = rowsOf(p).map(([x, y]) => [F(x), F(y)]);
  const options = ['prop', 'affine', 'anti', 'square'].map((id, i) => {
    const o = { id: ['g', 'n', 'h', 's'][i], text: `Die Punkte liegen ${SHAPE[id]}.` };
    return id === p.kind ? o : { ...o, category: 'concept_confusion', feedback: SHAPE_FB[id] };
  });
  const correct = { prop: 'g', affine: 'n', anti: 'h', square: 's' }[p.kind];
  const quot = rows.map(([x, y]) => $(`${texNum(y)} : ${texNum(x)} = ${tq(y.div(x))}`)).join('; ');
  const prod = rows.map(([x, y]) => $(`${texNum(x)} \\cdot ${texNum(y)} = ${tq(x.mul(y))}`)).join('; ');
  const steps = [`Quotienten $y : x$: ${quot}.`];
  if (p.kind === 'prop') steps.push('Alle Quotienten sind gleich: Die Zuordnung ist proportional, die Punkte liegen auf einer Geraden durch den Ursprung.');
  else if (p.kind === 'anti') steps.push(`Produkte $x \\cdot y$: ${prod}.`, 'Alle Produkte sind gleich: Die Zuordnung ist antiproportional, die Punkte liegen auf einer fallenden Kurve, die sich den Achsen nähert.');
  else if (p.kind === 'affine') steps.push(`Die Quotienten sind verschieden. Aber pro Schritt um 1 in $x$ wächst $y$ immer um ${$(tq(F(p.k)))}: Die Punkte liegen auf einer Geraden. Bei $x = 0$ wäre ${$(`y = ${texNum(F(p.b))}`)}, also nicht im Ursprung.`);
  else steps.push(`Die Quotienten sind verschieden, und die Zuwächse von $y$ werden immer größer (${$(`y = ${tq(F(p.q))} \\cdot x^{2}`)}): eine steigende Kurve, die immer steiler wird.`);
  return {
    prompt: 'Du trägst die Wertepaare der Tabelle als Punkte in ein Koordinatensystem ein. Worauf liegen die Punkte?',
    promptTable: { columns: ['$x$', '$y$'], rows: rows.map(([x, y]) => [$(texNum(x)), $(texNum(y))]) },
    instructions: 'Du musst nichts zeichnen. Prüfe Quotienten, Produkte und Zuwächse.',
    answer: { type: 'choice', options, correct, canonical: correct },
    hints: hints('Graph einer proportionalen Zuordnung: Gerade durch den Ursprung. Graph einer antiproportionalen Zuordnung: fallende Kurve, die sich den Achsen nähert.',
      'Berechne die Quotienten $y : x$ und die Produkte $x \\cdot y$. Sind beide nicht gleich, vergleiche die Zuwächse von $y$.',
      steps[0], steps,
      'Skizziere die Punkte grob auf Karopapier. Liegen sie auf einer Linie? Würde die Linie durch den Punkt (0 | 0) gehen?'),
    solution: { steps, result: options.find(o => o.id === correct).text },
  };
}

const graph = {
  id: `${SKILL}.graph`, version: 1, skillId: SKILL,
  families: ['graph_type'],
  levels: [2, 3],
  levelNotes: {
    2: 'Ursprungsgerade durch einen gegebenen Punkt: fehlende Koordinate eines weiteren Punkts berechnen (vorwärts und rückwärts).',
    3: 'Aus einer Wertetabelle entscheiden, worauf die Punkte liegen: Ursprungsgerade, Gerade ohne Ursprung, fallende Kurve oder steiler werdende Kurve.',
  },
  misconceptions: ['additive_reasoning', 'inverse_dreisatz', 'affine_as_prop'],
  sample(rng, level) { return level === 2 ? sampleL2(rng) : sampleL3(rng); },
  constraints(p) {
    if (p.v === 'point') {
      const b = F(p.k).mul(F(p.a)), d = F(p.k).mul(F(p.c));
      return Z.fitsPlaces(b, 1) && Z.fitsPlaces(d, 1) ? true : 'coordinates too long';
    }
    return new Set(p.xs).size === 5 ? true : 'duplicate x';
  },
  build(p) { return p.v === 'point' ? buildPoint(p) : buildShape(p); },
  /** Independent: Dreisatz term of the displayed point (expression engine) / BigInt classification of the table. */
  solve(p) {
    if (p.v === 'point') {
      const b = Z.dstr(F(p.k).mul(F(p.a)));
      if (p.ask === 'y') return Z.deNum(Z.propFrom(p.a, b, p.c));
      return Z.deNum(Z.propBack(p.a, b, Z.dstr(F(p.k).mul(F(p.c)))));
    }
    const rows = rowsOf(p), t = Z.classify(rows);
    if (t === 'prop') return 'g';
    if (t === 'anti') return 'h';
    return Z.collinear(rows) ? 'n' : 's';
  },
};

module.exports = [graph];
