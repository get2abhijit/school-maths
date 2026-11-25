'use strict';
/**
 * Value tables (Wertetabellen) for LS7 II.1 and II.2. All contexts and numbers are original.
 * Two templates share this module: ch2.prop.recognize_compute.table and ch2.antiprop.recognize_compute.table.
 *
 * Build path: answers from the model parameter (factor k = y : x, or product c = x · y) with Fractions.
 * Independent solver: from the displayed reference row only, Dreisatz through the expression engine (fill), or
 * BigInt cross-multiplication of the displayed numbers (classify).
 * Tables are shown vertically (two columns: first value, second value) so they fit a phone and a printed sheet.
 */
const { hints, $, numTex } = require('../util');
const Z = require('./zuo');
const { F, deNum, texNum } = Z;

const tq = f => (Z.fitsPlaces(f, 4) ? texNum(f) : numTex(f));   // exact quotient/product in LaTeX
const Q_TXT = 'Quotient = zweiter Wert : erster Wert';
const P_TXT = 'Produkt = erster Wert · zweiter Wert';

// ---------------------------------------------------------------- neutral “not a model” tables (classify only)
/** Lena's age → her brother's age: constant difference (je mehr, desto mehr – but not proportional). */
const AGES = { x: Z.qty('Alter von Lena (Jahre)'), y: Z.qty('Alter ihres Bruders (Jahre)'), intro: 'Die Tabelle vergleicht das Alter von Lena mit dem Alter ihres älteren Bruders.' };
/** Taxi with a base fee: a straight line not through the origin. */
const TAXI = { x: Z.qty('Strecke (km)'), y: Z.qty('Fahrpreis (€)', { money: true }), intro: 'Die Tabelle zeigt Fahrpreise eines Taxis.' };
/** Girls → boys in a class of fixed size: constant sum (je mehr, desto weniger – but not antiproportional). */
const CLASS = { x: Z.qty('Anzahl der Mädchen'), y: Z.qty('Anzahl der Jungen'), intro: 'Die Tabelle zeigt für verschiedene Klassen gleicher Größe die Anzahl der Mädchen und der Jungen.' };
/** Burning candle: length decreases by the same amount each hour. */
const CANDLE = { x: Z.qty('Brenndauer (h)'), y: Z.qty('Länge der Kerze (cm)'), intro: 'Eine Kerze brennt gleichmäßig ab. Die Tabelle zeigt ihre Länge.' };

/** Rows of a table of the given kind; all values as decimal strings. */
function tableRows(p) {
  const xs = p.xs.map(F);
  const k = p.k !== undefined ? F(p.k) : null;
  let ys;
  switch (p.kind) {
    case 'prop': ys = xs.map(x => k.mul(x)); break;
    case 'anti': ys = xs.map(x => F(p.c).div(x)); break;
    case 'additive': ys = xs.map(x => x.add(F(p.d))); break;
    case 'affine': ys = xs.map(x => k.mul(x).add(F(p.b))); break;
    case 'sum': ys = xs.map(x => F(p.n).sub(x)); break;
    case 'candle': ys = xs.map(x => F(p.L).sub(k.mul(x))); break;
    case 'prop_off': ys = xs.map(x => k.mul(x)); ys[p.off] = ys[p.off].mul(F(p.f)); break;
    case 'anti_off': ys = xs.map(x => F(p.c).div(x)); ys[p.off] = ys[p.off].add(F(p.f)); break;
    default: throw new Error(`kind ${p.kind}`);
  }
  return xs.map((x, i) => [Z.dstr(x), Z.fitsPlaces(ys[i], 6) ? Z.dstr(ys[i]) : ys[i].toString()]);
}
function sides(p) {
  if (p.ctxSet === 'prop') return Z.PROP[p.ctx];
  if (p.ctxSet === 'anti') return Z.ANTI[p.ctx];
  return { ages: AGES, taxi: TAXI, class: CLASS, candle: CANDLE }[p.ctxSet];
}

// ---------------------------------------------------------------- sampling
/** Hide pattern: array per row of null | 'x' | 'y'; `ref` is a complete row. */
function hidePattern(rng, level, n) {
  const hide = new Array(n).fill(null);
  if (level === 1) { for (let i = 1; i < n; i++) hide[i] = 'y'; return { hide, ref: 0 }; }
  const order = rng.shuffle([...Array(n).keys()]);
  const ref = order[0];
  if (level === 2) { hide[order[2]] = 'x'; hide[order[3]] = 'y'; hide[order[4]] = 'y'; return { hide, ref }; }
  hide[order[1]] = 'x'; hide[order[2]] = 'x'; hide[order[3]] = 'y'; hide[order[4]] = 'y';
  return { hide, ref };
}
function sampleFill(rng, level, model) {
  const set = model === 'prop' ? Z.PROP : Z.ANTI, ci = rng.int(0, set.length - 1), ctx = set[ci], n = level === 1 ? 4 : 5;
  const p = { ask: 'fill', kind: model, ctxSet: model, ctx: ci, ...hidePattern(rng, level, n) };
  if (model === 'prop') { p.k = rng.pick(ctx.r[level]); p.xs = Z.pickDistinct(rng, Z.range(ctx.xr[level]), n); }
  else { p.c = rng.pick(ctx.c[level]); p.xs = Z.pickDistinct(rng, ctx.xs[level].map(String), n); }
  p.rows = tableRows(p);
  return p;
}
function sampleCheck(rng, level, skill) {
  const n = level === 1 ? 4 : 5;
  const kinds = skill === 'prop'
    ? (level === 1 ? ['prop', 'additive'] : ['prop', 'prop', 'additive', 'affine', 'prop_off'])
    : (level === 1 ? ['anti', 'anti', 'prop'] : ['anti', 'anti', 'prop', 'sum', 'candle', 'anti_off']);
  const kind = rng.pick(kinds);
  const lv = Math.min(level, 3);
  let p;
  if (kind === 'prop' || kind === 'prop_off') {
    const ci = kind === 'prop_off' ? rng.pick([0, 1, 4]) : rng.int(0, Z.PROP.length - 1), ctx = Z.PROP[ci];
    p = { kind, ctxSet: 'prop', ctx: ci, k: rng.pick(ctx.r[lv]), xs: Z.pickDistinct(rng, Z.range(ctx.xr[lv]), n) };
    if (kind === 'prop_off') { p.off = n - 1; p.f = '0.9'; }
  } else if (kind === 'anti' || kind === 'anti_off') {
    const ci = rng.int(0, Z.ANTI.length - 1), ctx = Z.ANTI[ci];
    p = { kind, ctxSet: 'anti', ctx: ci, c: rng.pick(ctx.c[lv]), xs: Z.pickDistinct(rng, ctx.xs[lv].map(String), n) };
    if (kind === 'anti_off') { p.off = rng.int(1, n - 1); p.f = rng.pick(['1', '2', '-1']); }
  } else if (kind === 'additive') {
    p = { kind, ctxSet: 'ages', d: String(rng.int(2, 7)), xs: Z.pickDistinct(rng, Z.range([3, 15, 1]), n) };
  } else if (kind === 'affine') {
    p = { kind, ctxSet: 'taxi', k: rng.pick(['1.8', '2', '2.2', '2.5']), b: rng.pick(['3', '3.5', '4', '4.5']), xs: Z.pickDistinct(rng, Z.range(lv === 3 ? [1, 12, 0.5] : [2, 20, 1]), n) };
  } else if (kind === 'sum') {
    const total = rng.int(24, 30);
    p = { kind, ctxSet: 'class', n: String(total), xs: Z.pickDistinct(rng, Z.range([8, 18, 1]), n) };
  } else {
    p = { kind, ctxSet: 'candle', L: String(rng.int(20, 30)), k: rng.pick(['2', '2.5', '3']), xs: Z.pickDistinct(rng, Z.range(lv === 3 ? [0.5, 6, 0.5] : [1, 6, 1]), n) };
  }
  p.ask = 'check';
  p.rows = tableRows(p);
  return p;
}

function constraintsFor(p) {
  const s = sides(p);
  if (new Set(p.rows.map(r => r[0])).size !== p.rows.length) return 'duplicate x';
  for (const [x, y] of p.rows) {
    if (!Z.admissible(x, s.x) || !Z.admissible(y, s.y)) return 'value not admissible';
  }
  if (p.ask === 'check' && (p.kind === 'prop_off' || p.kind === 'anti_off') && Z.classify(p.rows) !== 'neither') return 'off-table is still a model';
  return true;
}

// ---------------------------------------------------------------- fill
function buildFill(p, level) {
  const s = sides(p), anti = p.kind === 'anti', [xr, yr] = p.rows[p.ref].map(F);
  const k = anti ? F(p.c) : F(p.k);
  const cells = [], grid = { columns: [s.x.label, s.y.label], rows: [] }, steps = [];
  p.rows.forEach(([x0, y0], i) => {
    const x = F(x0), y = F(y0), h = p.hide[i];
    const row = [h === 'x' ? { cell: `x${i}` } : { text: s.x.tex(x) }, h === 'y' ? { cell: `y${i}` } : { text: s.y.tex(y) }];
    grid.rows.push(row);
    if (h === 'y') {
      const v = anti ? k.div(x) : k.mul(x);
      const spec = Z.numSpec(v, s.y);
      spec.distractors = Z.dist(v, anti
        ? [{ value: yr.mul(x).div(xr), category: 'concept_confusion', feedback: 'So rechnet man bei proportionalen Zuordnungen. Hier ist das Produkt erster Wert · zweiter Wert immer gleich: Zum Doppelten gehört die Hälfte.' },
          { value: yr.sub(x.sub(xr)), category: 'concept_confusion', feedback: 'Bei antiproportionalen Zuordnungen nimmt der zweite Wert nicht um gleich viel ab, sondern das Produkt bleibt gleich.' }]
        : [{ value: yr.mul(xr).div(x), category: 'concept_confusion', feedback: 'So rechnet man bei antiproportionalen Zuordnungen. Hier gilt: Zum Doppelten gehört das Doppelte.' },
          { value: yr.add(x.sub(xr)), category: 'concept_confusion', feedback: 'Bei proportionalen Zuordnungen wachsen beide Werte nicht um gleich viel, sondern mit demselben Faktor.' }]);
      cells.push({ id: `y${i}`, label: `${s.y.label} zu ${s.x.text(x)}`, spec });
      steps.push(anti ? `${s.x.text(x)}: ${$(`${tq(k)} : ${texNum(x)} = ${tq(v)}`)}` : `${s.x.text(x)}: ${$(`${texNum(x)} \\cdot ${tq(k)} = ${tq(v)}`)}`);
    } else if (h === 'x') {
      const v = anti ? k.div(y) : y.div(k);
      const spec = Z.numSpec(v, s.x);
      spec.distractors = Z.dist(v, anti
        ? [{ value: xr.mul(y).div(yr), category: 'concept_confusion', feedback: 'So rechnet man bei proportionalen Zuordnungen. Hier ist das Produkt der beiden Werte immer gleich.' }]
        : [{ value: y.mul(k), category: 'concept_confusion', feedback: `Du hast mit dem Faktor multipliziert. Für den ersten Wert musst du den zweiten Wert durch ${$(tq(k))} teilen.` },
          { value: xr.add(y.sub(yr)), category: 'concept_confusion', feedback: 'Bei proportionalen Zuordnungen wachsen beide Werte nicht um gleich viel, sondern mit demselben Faktor.' }]);
      cells.push({ id: `x${i}`, label: `${s.x.label} zu ${s.y.text(y)}`, spec });
      steps.push(anti ? `${s.y.text(y)}: ${$(`${tq(k)} : ${texNum(y)} = ${tq(v)}`)}` : `${s.y.text(y)}: ${$(`${texNum(y)} : ${tq(k)} = ${tq(v)}`)}`);
    }
  });
  const refTxt = `${s.x.text(xr)} → ${s.y.text(yr)}`;
  const first = anti
    ? `Aus der vollständigen Zeile (${refTxt}): Produkt ${$(`${texNum(xr)} \\cdot ${texNum(yr)} = ${tq(k)}`)}. Dieses Produkt ist in jeder Zeile gleich.`
    : `Aus der vollständigen Zeile (${refTxt}): Quotient ${$(`${texNum(yr)} : ${texNum(xr)} = ${tq(k)}`)}. Das ist der Wert für 1 (Proportionalitätsfaktor).`;
  const solSteps = [first, ...steps];
  const strategy = anti
    ? `Berechne aus der vollständigen Zeile das Produkt erster Wert · zweiter Wert. Fehlt der zweite Wert, teile das Produkt durch den ersten – und umgekehrt.`
    : `Berechne aus der vollständigen Zeile den Quotienten zweiter Wert : erster Wert. Fehlt der zweite Wert, multipliziere den ersten mit diesem Faktor; fehlt der erste, teile den zweiten durch den Faktor.`;
  const yRows = p.rows.map((r, i) => i).filter(i => p.hide[i] === 'y');
  const altRow = yRows.find(i => Z.simpleFactor(F(p.rows[i][0]).div(xr))) ?? yRows[0];
  const xa = F(p.rows[altRow][0]), fac = xa.div(xr);
  const alt = !Z.simpleFactor(fac)
    ? `Probe: Prüfe am Ende, ob in jeder Zeile ${anti ? 'das Produkt erster Wert · zweiter Wert' : 'der Quotient zweiter Wert : erster Wert'} ${$(tq(k))} ergibt.`
    : `Mit Vielfachen: Von ${s.x.text(xr)} zu ${s.x.text(xa)} wird der erste Wert ${Z.scaleStep(xr, fac, texNum).word}. Dann wird der zweite Wert ${Z.scaleStep(yr, anti ? F(1).div(fac) : fac, texNum).word}: ${$(Z.scaleStep(yr, anti ? F(1).div(fac) : fac, texNum).calc)}.`;
  return {
    prompt: `${s.intro} Die Zuordnung ist ${anti ? 'antiproportional' : 'proportional'}. Fülle die Tabelle aus.`,
    instructions: `Rechne genau, ohne zu runden.${s.y.money || s.x.money ? ' Geldbeträge in €, z. B. 4,50.' : ''}`,
    answer: { type: 'table', cells, grid },
    hints: hints(anti
      ? 'Antiproportional: Zum Doppelten (Dreifachen, …) des ersten Werts gehört die Hälfte (ein Drittel, …) des zweiten. Das Produkt der beiden Werte ist immer gleich.'
      : 'Proportional: Zum Doppelten (Dreifachen, …) des ersten Werts gehört das Doppelte (Dreifache, …) des zweiten. Der Quotient zweiter Wert : erster Wert ist immer gleich.',
    strategy, first, solSteps, alt),
    solution: { steps: solSteps, result: cells.map(c => `${c.label}: ${c.spec.canonical}`).join(' · ') },
  };
}

// ---------------------------------------------------------------- classify
const FB = {
  more_more: '„Je mehr, desto mehr“ reicht nicht als Begründung: Auch bei nicht proportionalen Zuordnungen wachsen beide Werte. Entscheidend ist, ob alle Quotienten gleich sind.',
  less_less: '„Je mehr, desto weniger“ reicht nicht als Begründung: Entscheidend ist, ob alle Produkte erster Wert · zweiter Wert gleich sind.',
  additive: 'Gleiche Zuwächse sind kein Kennzeichen für Proportionalität. Prüfe die Quotienten zweiter Wert : erster Wert.',
  wrong_prop: 'Berechne die Quotienten zweiter Wert : erster Wert in jeder Zeile. Sind sie alle gleich?',
  wrong_anti: 'Berechne die Produkte erster Wert · zweiter Wert in jeder Zeile. Sind sie alle gleich?',
  wrong_neither: 'Prüfe genau: Sind alle Quotienten oder alle Produkte gleich? Dann liegt doch eine proportionale bzw. antiproportionale Zuordnung vor.',
  wrong_not_prop: 'Prüfe genau: Rechne in jeder Zeile zweiter Wert : erster Wert. Sind alle Quotienten gleich, ist die Zuordnung proportional.',
};
function checkOptions(skill, level, truth) {
  if (skill === 'prop') {
    const correct = truth === 'prop' ? 'p' : 'n';
    const raw = level === 1
      ? [['p', 'Die Zuordnung ist proportional.', 'wrong_prop'], ['n', 'Die Zuordnung ist nicht proportional.', 'wrong_not_prop']]
      : [['p', 'Proportional, denn alle Quotienten (zweiter Wert : erster Wert) sind gleich.', 'wrong_prop'],
        ['m', 'Proportional, denn je größer der erste Wert, desto größer der zweite.', 'more_more'],
        ['n', 'Nicht proportional, denn die Quotienten (zweiter Wert : erster Wert) sind nicht alle gleich.', 'wrong_not_prop'],
        ['d', 'Nicht proportional, denn die zweiten Werte wachsen nicht immer um gleich viel.', 'additive']];
    return { correct, options: raw.map(([id, text, fb]) => (id === correct ? { id, text } : { id, text, category: 'concept_confusion', feedback: FB[fb] })) };
  }
  const correct = { prop: 'p', anti: 'a', neither: 'w' }[truth];
  const raw = [['p', level === 1 ? 'Die Zuordnung ist proportional.' : 'Proportional, denn alle Quotienten (zweiter Wert : erster Wert) sind gleich.', 'wrong_prop'],
    ['a', level === 1 ? 'Die Zuordnung ist antiproportional.' : 'Antiproportional, denn alle Produkte (erster Wert · zweiter Wert) sind gleich.', 'wrong_anti'],
    ...(level === 1 ? [] : [['l', 'Antiproportional, denn je größer der erste Wert, desto kleiner der zweite.', 'less_less']]),
    ['w', 'Die Zuordnung ist weder proportional noch antiproportional.', 'wrong_neither']];
  return { correct, options: raw.map(([id, text, fb]) => (id === correct ? { id, text } : { id, text, category: 'concept_confusion', feedback: FB[fb] })) };
}
function buildCheck(p, level, skill) {
  const s = sides(p), truth = { prop: 'prop', anti: 'anti' }[p.kind] || 'neither';
  const { correct, options } = checkOptions(skill, level, truth);
  const rows = p.rows.map(([x, y]) => [F(x), F(y)]);
  const quot = rows.map(([x, y]) => `${$(`${texNum(y)} : ${texNum(x)} = ${tq(y.div(x))}`)}`);
  const prod = rows.map(([x, y]) => `${$(`${texNum(x)} \\cdot ${texNum(y)} = ${tq(x.mul(y))}`)}`);
  const qs = rows.map(([x, y]) => y.div(x)), ps = rows.map(([x, y]) => x.mul(y));
  const allEq = a => a.every(v => v.eq(a[0]));
  const steps = [`Quotienten: ${quot.join('; ')}.`];
  if (skill === 'anti') steps.push(`Produkte: ${prod.join('; ')}.`);
  const verdict = truth === 'prop' ? 'Alle Quotienten sind gleich: Die Zuordnung ist proportional.'
    : truth === 'anti' ? 'Alle Produkte sind gleich: Die Zuordnung ist antiproportional.'
      : (skill === 'prop' ? 'Die Quotienten sind nicht alle gleich: Die Zuordnung ist nicht proportional.' : 'Weder alle Quotienten noch alle Produkte sind gleich: weder proportional noch antiproportional.');
  steps.push(verdict);
  if (truth !== 'prop' && !allEq(qs) && skill === 'prop' && level > 1) steps.push('Auch wenn beide Werte wachsen: Ohne gleiche Quotienten ist die Zuordnung nicht proportional.');
  if (truth === 'neither' && skill === 'anti' && !allEq(ps)) steps.push('Auch wenn ein Wert kleiner wird, während der andere wächst: Ohne gleiche Produkte ist die Zuordnung nicht antiproportional.');
  return {
    prompt: `${s.intro} ${skill === 'prop' ? 'Ist die Zuordnung proportional?' : 'Welche Art von Zuordnung liegt vor?'}${level > 1 ? ' Wähle die Aussage mit der richtigen Begründung.' : ''}`,
    promptTable: { columns: [s.x.label, s.y.label], rows: p.rows.map(([x, y]) => [s.x.tex(F(x)), s.y.tex(F(y))]) },
    instructions: skill === 'prop' ? `${Q_TXT}.` : `${Q_TXT}; ${P_TXT}.`,
    answer: { type: 'choice', options, correct, canonical: correct },
    hints: hints(skill === 'prop'
      ? 'Proportional heißt: Alle Quotienten zweiter Wert : erster Wert sind gleich (Quotientengleichheit).'
      : 'Proportional: alle Quotienten gleich. Antiproportional: alle Produkte erster Wert · zweiter Wert gleich (Produktgleichheit).',
    skill === 'prop' ? 'Berechne für jede Zeile den Quotienten zweiter Wert : erster Wert und vergleiche.' : 'Berechne für jede Zeile den Quotienten und das Produkt und vergleiche.',
    skill === 'prop' ? `Zum Beispiel: ${quot.slice(0, 2).join('; ')}; …` : `Zum Beispiel: ${prod.slice(0, 2).join('; ')}; …`, steps,
    skill === 'prop' ? 'Vergleiche Vielfache: Wird der erste Wert verdoppelt (verdreifacht, …), muss sich bei einer proportionalen Zuordnung auch der zweite Wert verdoppeln (verdreifachen, …).'
      : 'Vergleiche Vielfache: Wird der erste Wert verdoppelt, muss sich bei einer antiproportionalen Zuordnung der zweite Wert halbieren.'),
    solution: { steps, result: options.find(o => o.id === correct).text },
  };
}

// ---------------------------------------------------------------- templates
function makeTable(skill) {
  const skillId = skill === 'prop' ? 'ch2.prop.recognize_compute' : 'ch2.antiprop.recognize_compute';
  return {
    id: `${skillId}.table`, version: 1, skillId,
    families: ['classify_table', 'fill_table'],
    levels: [1, 2, 3],
    levelNotes: skill === 'prop' ? {
      1: 'Tabelle mit ganzen Zahlen ergänzen (Wert für 1 ablesen) oder entscheiden: proportional oder nicht (Fehlvorstellung: gleiche Zuwächse).',
      2: 'Dezimalzahlen; auch fehlende erste Werte; beim Prüfen Begründung wählen (Quotientengleichheit statt „je mehr, desto mehr“), mit Taxi-Grundgebühr und Mengenrabatt.',
      3: 'Halbe Werte und Faktoren mit zwei Nachkommastellen; nur eine vollständige Zeile, je zwei fehlende erste und zweite Werte.',
    } : {
      1: 'Tabelle mit ganzen Zahlen über das gleiche Produkt ergänzen oder entscheiden: proportional oder antiproportional.',
      2: 'Dezimalzahlen und fehlende erste Werte; beim Prüfen Fallen wie konstante Summe oder gleichmäßige Abnahme („je mehr, desto weniger“).',
      3: 'Halbe Werte und Beträge mit Cent; nur eine vollständige Zeile, je zwei fehlende erste und zweite Werte.',
    },
    misconceptions: skill === 'prop' ? ['more_more', 'additive_reasoning', 'inverse_dreisatz', 'affine_as_prop'] : ['wrong_dreisatz', 'less_less', 'additive_reasoning'],
    sample(rng, level) { return rng.bool() ? sampleFill(rng, level, skill) : sampleCheck(rng, level, skill); },
    constraints(p) { return constraintsFor(p); },
    signatureParams(p) { return { ask: p.ask, kind: p.kind, ctxSet: p.ctxSet, ctx: p.ctx, rows: p.rows, hide: p.hide }; },
    build(p, level) { return p.ask === 'fill' ? buildFill(p, level) : buildCheck(p, level, skill); },
    /** Independent: Dreisatz from the displayed reference row (expression engine), or BigInt classification. */
    solve(p) {
      if (p.ask === 'check') {
        const t = Z.classify(p.rows);
        if (skill === 'prop') return t === 'prop' ? 'p' : 'n';
        return { prop: 'p', anti: 'a', neither: 'w' }[t];
      }
      const [xr, yr] = p.rows[p.ref], o = {};
      p.rows.forEach(([x, y], i) => {
        if (p.hide[i] === 'y') o[`y${i}`] = Z.deNum(skill === 'prop' ? Z.propFrom(xr, yr, x) : Z.antiFrom(xr, yr, x));
        if (p.hide[i] === 'x') o[`x${i}`] = Z.deNum(skill === 'prop' ? Z.propBack(xr, yr, y) : Z.antiFrom(yr, xr, y));
      });
      return o;
    },
  };
}

module.exports = { prop: makeTable('prop'), anti: makeTable('anti'), tableRows, sampleCheck };
