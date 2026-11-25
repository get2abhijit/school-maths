'use strict';
/**
 * Skill ch1.terms.simplify_products — Produkte mit einer Variable vereinfachen (LS7 I.4).
 * Scope note: x·x (term_times_term) is flagged provisional_scope in the catalog and NOT generated.
 */
const U = require('../util');
const { F, hints, tex, $, numTex, numMachine, polyMachine, polyInput, exprDistractors } = U;

const SKILL = 'ch1.terms.simplify_products';

/**
 * factors: [{k:'3'|'-3/4'|'0.5', x:bool}] → machine string. A factor after the first is bracketed
 * when it is negative or a (non-decimal) fraction, so that 2·(3/4) never reads as (2·3)/4.
 */
function factorsMachine(factors, dec) {
  return factors.map((f, i) => {
    const v = F(f.k), a = v.abs();
    const isFrac = !a.isInteger() && !(dec && a.isTerminatingDecimal());
    const coef = f.x && a.eq(1) ? '' : numMachine(a, { dec });
    const body = `${v.sign() < 0 ? '-' : ''}${coef}${f.x ? 'x' : ''}`;
    return i > 0 && (v.sign() < 0 || isFrac) ? `(${body})` : body;
  }).join('*');
}

/**
 * Template ch1.terms.simplify_products.number_times_term (family number_times_term)
 * Levels
 *  L1 Grundlagen    natural factors: 4·3x, 3x·4, 2·x·7.
 *  L2 Standard      negative factors, two or three factors: (−4)·3x, −2·(−5x), 3·x·(−2).
 *  L3 Anspruchsvoll fractions or decimals as factors: ¾·(−8x), 0,5·6x·(−3).
 * Misconceptions → distractors: product_sign (sign of the product wrong), adding the numbers
 *  instead of multiplying them (concept_confusion).
 * Answer form 'expanded' (4·3x is equivalent but not simplified → specific feedback).
 */
const numberTimesTerm = {
  id: `${SKILL}.number_times_term`, version: 1, skillId: SKILL,
  families: ['number_times_term'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Natürliche Zahlen als Faktoren, z. B. 4·3x oder 2·x·7.',
    2: 'Negative Faktoren, zwei oder drei Faktoren.',
    3: 'Brüche oder Dezimalzahlen als Faktoren.',
  },
  misconceptions: ['product_sign', 'add_instead_of_multiply'],
  sample(rng, level) {
    const n = level === 1 ? 2 : rng.pick([2, 3]);
    const xPos = rng.int(0, n - 1);
    let dec = false;
    const factors = [];
    const style = level === 3 ? rng.pick(['frac', 'dec']) : 'int';
    if (style === 'dec') dec = true;
    for (let i = 0; i < n; i++) {
      let k;
      if (level === 1) k = rng.int(i === xPos && rng.bool() ? 1 : 2, 9);
      else if (level === 2) k = rng.pick([-1, 1]) * rng.int(i === xPos ? 1 : 2, 9);
      else if (i === 0 || rng.int(0, 2) === 0) {
        const sgn = rng.pick([-1, 1]);
        k = style === 'frac' ? `${sgn < 0 ? '-' : ''}${rng.pick(['1/2', '3/4', '2/3', '1/3', '5/6', '3/2', '1/4'])}` : `${sgn < 0 ? '-' : ''}${rng.pick(['0.5', '1.5', '0.2', '2.5', '0.4'])}`;
      } else k = rng.pick([-1, 1]) * rng.int(2, 12);
      factors.push({ k: String(k), x: i === xPos });
    }
    return { factors, dec };
  },
  constraints(p, level) {
    const prod = p.factors.reduce((a, f) => a.mul(F(f.k)), F(1));
    if (prod.abs().eq(1)) return 'trivial coefficient';
    if (level >= 2 && !p.factors.some(f => F(f.k).sign() < 0)) return 'no negative factor';
    if (level === 3 && p.factors.every(f => F(f.k).isInteger())) return 'no fraction factor';
    if (level === 3 && !prod.isInteger() && prod.d > 12n) return 'awkward product';
    if (prod.abs().cmp(F(200)) > 0) return 'too large';
    if (p.factors.length === 2 && p.factors[0].x && F(p.factors[0].k).abs().eq(1) && !p.factors[1].x) return 'x times number only';
    return true;
  },
  build(p, level) {
    const o = { dec: p.dec };
    const task = factorsMachine(p.factors, p.dec);
    const k = p.factors.reduce((a, f) => a.mul(F(f.k)), F(1));
    const value = polyMachine([[k, 1]], o);
    const nums = p.factors.map(f => F(f.k));
    const numsTex = nums.map((v, i) => (i > 0 && v.sign() < 0 ? `\\left(${numTex(v, o)}\\right)` : numTex(v, o))).join('\\cdot ');
    const negCount = nums.filter(v => v.sign() < 0).length;
    const steps = [
      `Zahlen nach vorne, $x$ nach hinten: ${$(`${tex(task)} = ${numsTex}\\cdot x`)}`,
      `${negCount ? `Vorzeichen: ${negCount} negative${negCount === 1 ? 'r Faktor' : ' Faktoren'} → ${negCount % 2 ? 'Minus' : 'Plus'}. ` : ''}Zahlen multiplizieren: ${$(`${numsTex} = ${numTex(k, o)}`)}`,
      `Ergebnis: ${$(tex(value))}`,
    ];
    const sumK = nums.reduce((a, v) => a.add(v), F(0));
    const dis = [
      { value: polyMachine([[k.neg(), 1]], o), category: 'sign_error', feedback: 'Zähle die negativen Faktoren: gerade Anzahl → Plus, ungerade Anzahl → Minus.' },
      { value: polyMachine([[sumK, 1]], o), category: 'concept_confusion', feedback: 'In einem Produkt werden die Zahlen multipliziert, nicht addiert.' },
    ];
    return {
      prompt: `Vereinfache das Produkt ${$(tex(task))}.`,
      instructions: 'Schreibe das Ergebnis in der Form Zahl mal $x$.',
      answer: { type: 'expression', value, canonical: polyInput([[k, 1]], o), variables: ['x'], form: 'expanded', distractors: exprDistractors(value, dis) },
      hints: hints(
        'In einem Produkt darfst du die Faktoren beliebig vertauschen (Kommutativgesetz) und zusammenfassen (Assoziativgesetz).',
        'Multipliziere alle Zahlen miteinander und schreibe $x$ dahinter.',
        steps[0],
        steps,
        `Probe mit $x=1$: Dann ist ${$(tex(task))} einfach ein Zahlterm mit dem Wert ${$(numTex(k, o))}. Dein Ergebnis muss für $x=1$ denselben Wert haben.`),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) { return U.solveExpanded(factorsMachine(p.factors, p.dec)); },
};

/**
 * Template ch1.terms.simplify_products.area_terms (family area_terms)
 * Figures are described in words (SVG diagrams come with the geometry sessions).
 * Levels
 *  L2 Standard      rectangle with sides a and b·x → area.
 *  L3 Anspruchsvoll cuboid volume (a·c·b·x) or triangle area ½·g·h with g = b·x.
 *  L4 Transfer      composite figure of two rectangles, or cuboid surface area 2(ab + ax + bx).
 * Misconceptions: adding instead of multiplying, forgetting ½ (triangle) or the factor 2 (surface).
 * Independent solver: polynomial normal form of the textbook formula with the given lengths.
 */
const areaTerms = {
  id: `${SKILL}.area_terms`, version: 1, skillId: SKILL,
  families: ['area_terms'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Flächeninhalt eines Rechtecks mit den Seiten a und b·x.',
    3: 'Volumen eines Quaders oder Flächeninhalt eines Dreiecks (½·g·h).',
    4: 'Zusammengesetzte Fläche aus zwei Rechtecken oder Oberfläche eines Quaders.',
  },
  misconceptions: ['add_instead_of_multiply', 'forget_half'],
  sample(rng, level) {
    const shape = level === 2 ? 'rect' : level === 3 ? rng.pick(['cuboid', 'triangle']) : rng.pick(['lshape', 'surface']);
    return { shape, a: rng.int(2, 9), b: rng.int(1, 9), c: rng.int(2, 9), d: rng.int(1, 9) };
  },
  formula(p) {
    const bx = p.b === 1 ? 'x' : `${p.b}x`, dx = p.d === 1 ? 'x' : `${p.d}x`;
    switch (p.shape) {
      case 'rect': return `${p.a}*(${bx})`;
      case 'cuboid': return `${p.a}*${p.c}*(${bx})`;
      case 'triangle': return `1/2*(${bx})*${p.a}`;
      case 'lshape': return `${p.a}*(${bx})+${p.c}*(${dx})`;
      case 'surface': return `2*(${p.a}*${p.c}+${p.a}x+${p.c}x)`;
      default: throw new Error(p.shape);
    }
  },
  constraints(p) {
    if (p.shape === 'triangle' && (p.a * p.b) % 2 !== 0) return 'odd triangle coefficient';
    if (p.shape === 'surface' && p.a === p.c) return 'cube-like';
    if (p.shape === 'lshape' && p.a === p.c && p.b === p.d) return 'identical rectangles';
    return true;
  },
  build(p) {
    const bx = tex(p.b === 1 ? 'x' : `${p.b}x`), dx = tex(p.d === 1 ? 'x' : `${p.d}x`);
    let kx, k0 = 0, text, unit, rule, dis = [], stepsCore;
    switch (p.shape) {
      case 'rect':
        kx = p.a * p.b; unit = 'cm²';
        text = `Ein Rechteck ist ${$(bx)} cm lang und ${$(String(p.a))} cm breit. Gib einen möglichst einfachen Term für seinen Flächeninhalt in cm² an.`;
        rule = 'Flächeninhalt Rechteck = Länge · Breite';
        stepsCore = [`${rule}: ${$(`${p.a}\\cdot ${bx}`)}`];
        dis = [{ value: `${p.a}+${p.b}x`, category: 'concept_confusion', feedback: 'Für den Flächeninhalt werden die Seitenlängen multipliziert, nicht addiert.' },
          { value: `${2 * p.a}+${2 * p.b}x`, category: 'concept_confusion', feedback: 'Das ist der Umfang. Gesucht ist der Flächeninhalt.' }];
        break;
      case 'cuboid':
        kx = p.a * p.c * p.b; unit = 'cm³';
        text = `Ein Quader hat die Kantenlängen ${$(String(p.a))} cm, ${$(String(p.c))} cm und ${$(bx)} cm. Gib einen möglichst einfachen Term für sein Volumen in cm³ an.`;
        rule = 'Volumen Quader = Länge · Breite · Höhe';
        stepsCore = [`${rule}: ${$(`${p.a}\\cdot ${p.c}\\cdot ${bx}`)}`];
        dis = [{ value: `${p.a + p.c}+${p.b}x`, category: 'concept_confusion', feedback: 'Für das Volumen werden die drei Kantenlängen multipliziert.' }];
        break;
      case 'triangle':
        kx = (p.a * p.b) / 2; unit = 'cm²';
        text = `Ein Dreieck hat die Grundseite ${$(bx)} cm und die zugehörige Höhe ${$(String(p.a))} cm. Gib einen möglichst einfachen Term für seinen Flächeninhalt in cm² an.`;
        rule = 'Flächeninhalt Dreieck = ½ · Grundseite · Höhe';
        stepsCore = [`${rule}: ${$(`\\frac{1}{2}\\cdot ${bx}\\cdot ${p.a}`)}`];
        dis = [{ value: `${p.a * p.b}x`, category: 'concept_confusion', feedback: 'Beim Dreieck kommt der Faktor $\\frac{1}{2}$ dazu.' }];
        break;
      case 'lshape':
        kx = p.a * p.b + p.c * p.d; unit = 'cm²';
        text = `Eine Fläche besteht aus zwei Rechtecken, die sich nicht überlappen: Das erste ist ${$(String(p.a))} cm breit und ${$(bx)} cm lang, das zweite ist ${$(String(p.c))} cm breit und ${$(dx)} cm lang. Gib einen möglichst einfachen Term für den Flächeninhalt der ganzen Fläche in cm² an.`;
        rule = 'Gesamtfläche = Fläche Rechteck 1 + Fläche Rechteck 2';
        stepsCore = [`${rule}: ${$(`${p.a}\\cdot ${bx}+${p.c}\\cdot ${dx}`)}`, `${$(`= ${tex(`${p.a * p.b}x`)}+${tex(`${p.c * p.d}x`)}`)}`];
        dis = [{ value: `${p.a * p.b}x`, category: 'concept_confusion', feedback: 'Beide Rechtecke gehören zur Fläche – addiere ihre Flächeninhalte.' },
          { value: `${p.a + p.c}+${p.b + p.d}x`, category: 'concept_confusion', feedback: 'Für Flächeninhalte werden Seitenlängen multipliziert.' }];
        break;
      case 'surface':
        kx = 2 * (p.a + p.c); k0 = 2 * p.a * p.c; unit = 'cm²';
        text = `Ein Quader hat die Kantenlängen ${$(String(p.a))} cm, ${$(String(p.c))} cm und $x$ cm. Gib einen möglichst einfachen Term für seinen Oberflächeninhalt in cm² an.`;
        rule = 'Oberfläche Quader = 2 · (Grundfläche + zwei verschiedene Seitenflächen)';
        stepsCore = [`${rule}: ${$(`2\\cdot \\left(${p.a}\\cdot ${p.c}+${p.a}x+${p.c}x\\right)`)}`, `${$(`= 2\\cdot \\left(${p.a * p.c}+${p.a + p.c}x\\right)`)}`];
        dis = [{ value: `${p.a * p.c}+${p.a + p.c}x`, category: 'concept_confusion', feedback: 'Jede Fläche kommt beim Quader zweimal vor.' }];
        break;
      default: throw new Error(p.shape);
    }
    const value = polyMachine([[kx, 1], [k0, 0]]);
    const steps = [...stepsCore, `Ergebnis: ${$(`${tex(value)}`)} (in ${unit})`];
    return {
      prompt: text,
      instructions: 'Gib den Term ohne Einheit ein, vereinfacht (Zahlen zusammengefasst).',
      answer: { type: 'expression', value, canonical: polyInput([[kx, 1], [k0, 0]]), variables: ['x'], form: 'expanded', distractors: exprDistractors(value, dis) },
      hints: hints(
        'Stelle zuerst die passende Formel auf und setze dann die Längen als Terme ein.',
        `${rule}.`,
        stepsCore[0],
        steps,
        `Skizziere die Figur und beschrifte die Seiten. Prüfe deinen Term mit $x=1$: Dann sind alle Längen Zahlen und du kannst direkt nachrechnen (Ergebnis ${$(numTex(F(kx + k0)))}).`),
      solution: { steps, result: $(tex(value)) },
    };
  },
  solve(p) { return U.solveExpanded(this.formula(p)); },
};

module.exports = [numberTimesTerm, areaTerms];
