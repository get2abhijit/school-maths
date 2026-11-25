'use strict';
/**
 * Template ch7.prob.frequency.series for LS7 VII.4 „Versuchsreihen ergeben Wahrscheinlichkeiten“
 * (Bildungsplan 3.2.5(7): relative frequencies as estimates that tend to improve with the sample size). All objects
 * and counts are original; no real experiment data is quoted.
 * Levels
 *  L1 Grundlagen     Relative Häufigkeit k : n of one outcome (fraction, decimal or percent).
 *  L2 Standard       Estimate the probability from a long series and predict the expected count in m further throws.
 *  L3 Anspruchsvoll  Three series of different length: the best estimate pools all data (Σk : Σn), not the mean of
 *                    the three relative frequencies.
 *  L4 Transfer       A table of growing series (n = 10 … several thousand): which statement about stabilisation is
 *                    correct (exactly one of three)?
 * Misconceptions: ratio_not_share (k : (n − k)), all_equal (two outcomes = 1/2 each), mean_of_rates, small_sample,
 * exact_from_frequency (a relative frequency is the probability).
 * Independent solver: the expression engine on the displayed counts (sums and quotients); L4 recomputes the stable
 * value from the last row and picks the statement that names it.
 */
const { hints } = require('../util');
const Z = require('./zufall');
const { F, texNum, probTex, probSpec, probResult } = Z;

const SKILL = 'ch7.prob.frequency';
const REL_INSTR = 'Gib die relative Häufigkeit als Bruch, als Dezimalzahl oder in Prozent an.';

/** Objects that are NOT Laplace: the probability can only be estimated. */
const OBJECTS = [
  { id: 'pin', obj: 'eine Reißzwecke', acc: 'eine Reißzwecke', verb: 'geworfen', out: 'Spitze nach oben', other: 'schräg auf der Spitze', p: [30, 70] },
  { id: 'lego', obj: 'ein Legostein', acc: 'einen Legostein', verb: 'geworfen', out: 'Noppen nach oben', other: 'eine andere Lage', p: [25, 55] },
  { id: 'cap', obj: 'ein Kronkorken', acc: 'einen Kronkorken', verb: 'geworfen', out: 'Zacken nach oben', other: 'Zacken nach unten', p: [30, 65] },
  { id: 'cup', obj: 'ein Plastikbecher', acc: 'einen Plastikbecher', verb: 'geworfen', out: 'auf der Seite liegend', other: 'aufrecht oder kopfüber', p: [55, 80] },
  { id: 'box', obj: 'eine Streichholzschachtel', acc: 'eine Streichholzschachtel', verb: 'geworfen', out: 'auf einer großen Fläche', other: 'auf einer kleinen Fläche', p: [60, 85] },
  { id: 'free', obj: 'ein Freiwurf', acc: 'Freiwürfe', verb: 'ausgeführt', out: 'Treffer', other: 'kein Treffer', p: [55, 80], player: true },
];
const N1 = [20, 25, 40, 50, 80, 100, 125, 200, 250, 400, 500];
const intro = (o, n) => (o.player ? `Ein Basketballspieler hat ${n} Freiwürfe geworfen.` : `${o.obj[0].toUpperCase()}${o.obj.slice(1)} wurde ${n}-mal ${o.verb}.`);
const outQ = o => (o.player ? 'Treffer' : `„${o.out}“`);
/** „Dabei gab es 11-mal „Noppen nach oben“.“ / „Er traf 456-mal.“ */
const occurred = (o, k) => (o.player ? `Er traf ${k}-mal.` : `Dabei gab es ${k}-mal ${outQ(o)}.`);

const series = {
  id: `${SKILL}.series`, version: 1, skillId: SKILL,
  families: ['relative_frequency', 'estimate', 'compare_series', 'stabilization'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Relative Häufigkeit eines Ergebnisses aus absoluter Häufigkeit und Anzahl der Versuche.',
    2: 'Aus einer langen Versuchsreihe die Wahrscheinlichkeit schätzen und die erwartete Anzahl bei weiteren Versuchen berechnen.',
    3: 'Mehrere Versuchsreihen verschiedener Länge zusammenfassen: alle Daten zusammen nutzen, nicht die Häufigkeiten mitteln.',
    4: 'Stabilisierung relativer Häufigkeiten bei wachsender Versuchszahl beurteilen (Gesetz der großen Zahlen).',
  },
  misconceptions: ['ratio_not_share', 'all_equal', 'mean_of_rates', 'small_sample', 'exact_from_frequency'],
  sample(rng, level) {
    const oi = rng.int(0, OBJECTS.length - 1), o = OBJECTS[oi];
    const pc = rng.int(o.p[0], o.p[1]);                         // hidden "true" percentage (only shapes the data)
    if (level === 1) { const n = rng.pick(N1); return { oi, n, k: Math.max(1, Math.min(n - 1, Math.round(n * pc / 100) + rng.int(-3, 3))) }; }
    if (level === 2) {
      const n = rng.pick([500, 800, 1000, 1250, 2000]), m = rng.pick([50, 100, 200, 300, 400, 500, 600]);
      return { oi, n, k: Math.round(n * pc / 100) + rng.int(-5, 5), m };
    }
    if (level === 3) {
      const N = rng.pick([200, 400, 500, 1000]);
      const a = rng.int(2, 6) * N / 20, b = rng.int(3, 8) * N / 20, c = N - a - b;
      const ns = rng.shuffle([a, b, c]);
      return { oi, ns, ks: ns.map(n => Math.max(1, Math.min(n - 1, Math.round(n * pc / 100) + rng.int(-Math.ceil(n / 12), Math.ceil(n / 12))))), names: rng.shuffle(Z.NAMES).slice(0, 3) };
    }
    // L4: growing series; counts generated with shrinking noise
    const ns = [10, 50, 100, 500, 1000, rng.pick([2000, 5000])];
    const ks = []; let prevN = 0, prevK = 0;
    for (const n of ns) {
      const noise = Math.round(n * (rng.int(-12, 12) / 100) / Math.sqrt(n / 10));
      let k = Math.round(n * pc / 100) + noise;
      k = Math.max(prevK, Math.min(prevK + (n - prevN), k));
      ks.push(k); prevN = n; prevK = k;
    }
    return { oi, ns, ks, order: rng.shuffle([0, 1, 2]) };
  },
  constraints(p, level) {
    if (level === 1 && (p.k <= 0 || p.k >= p.n || 2 * p.k === p.n)) return 'k';
    if (level === 2 && (p.m * p.k) % p.n !== 0) return 'expected count not whole';
    if (level === 2 && 2 * p.k === p.n) return 'half';
    if (level === 3) {
      if (new Set(p.ns).size < 3 || p.ns.some(n => n < 20)) return 'series lengths';
      const pooled = F(p.ks.reduce((a, b) => a + b, 0)).div(p.ns.reduce((a, b) => a + b, 0));
      if (meanRates(p).eq(pooled)) return 'mean of rates equals pooled';
      if (Z.places(pooled) < 0 || Z.places(pooled) > 4) return 'pooled not short';
    }
    if (level === 4) {
      const h = p.ks.map((k, i) => F(k).div(p.ns[i]));
      const last = h[h.length - 1].round(2), first = h[0].round(2);
      if (first.sub(last).abs().cmp(F('0.1')) < 0) return 'first value too close (no visible stabilisation)';
      if (h.slice(3).some(x => x.sub(last).abs().cmp(F('0.03')) > 0)) return 'not stable';
    }
    return true;
  },
  signatureParams(p, level) { if (level === 3) { const { names, ...r } = p; return r; } if (level === 4) { const { order, ...r } = p; return r; } return p; },
  build(p, level) {
    const o = OBJECTS[p.oi];
    if (level === 1) {
      const v = F(p.k).div(p.n);
      const steps = [`Relative Häufigkeit = absolute Häufigkeit : Anzahl der Versuche.`, `$${p.k} : ${p.n} = ${probTex(v)}${v.isTerminatingDecimal() ? ` = ${texNum(v)}` : ''}$.`];
      return {
        prompt: `${intro(o, p.n)} ${occurred(o, p.k)} Bestimme die relative Häufigkeit ${o.player ? 'der Treffer' : `von ${outQ(o)}`}.`,
        instructions: REL_INSTR,
        answer: probSpec(v, [{ value: F(p.k).div(p.n - p.k), category: 'concept_confusion', feedback: `Du hast ${outQ(o)} mit den anderen Ergebnissen verglichen. Teile durch die Anzahl aller Versuche.` },
          { value: F(p.n - p.k).div(p.n), category: 'concept_confusion', feedback: `Das ist die relative Häufigkeit des anderen Ergebnisses (${o.other}).` }]),
        hints: hints('Die relative Häufigkeit gibt den Anteil an: Wie viele von allen Versuchen hatten dieses Ergebnis?',
          'Teile die absolute Häufigkeit durch die Anzahl aller Versuche.', `Absolute Häufigkeit: ${p.k}; Anzahl der Versuche: ${p.n}.`, steps,
          `In Prozent: Wie viele von 100 Versuchen wären das? ${p.n} Versuche entsprechen 100 %.`),
        solution: { steps, result: probResult('Relative Häufigkeit:', v) },
      };
    }
    if (level === 2) {
      const h = F(p.k).div(p.n), E = h.mul(p.m);
      const steps = [`Schätzwert für die Wahrscheinlichkeit: $${p.k} : ${p.n} = ${texNum(h)}$.`, `Erwartete Anzahl bei ${p.m} Würfen: $${p.m} \\cdot ${texNum(h)} = ${texNum(E)}$.`];
      return {
        prompt: `${intro(o, p.n)} ${occurred(o, p.k)} ${o.player ? 'Wie viele Treffer erwartest du ungefähr' : `Wie oft erwartest du ${outQ(o)} ungefähr`}, wenn ${o.player ? `er weitere ${p.m} Freiwürfe wirft` : `${o.obj} noch ${p.m}-mal ${o.verb} wird`}?`,
        instructions: 'Nutze die relative Häufigkeit als Schätzwert für die Wahrscheinlichkeit. Gib eine ganze Zahl ein.',
        answer: { type: 'integer', value: E.toString(), canonical: E.toString(), distractors: Z.ndist(E, [
          { value: F(p.m).div(2), category: 'concept_confusion', feedback: 'Die beiden Ergebnisse sind hier nicht gleich wahrscheinlich. Nutze die relative Häufigkeit aus der langen Versuchsreihe.' },
          { value: F(p.m).sub(E), category: 'concept_confusion', feedback: `Das ist die erwartete Anzahl für das andere Ergebnis (${o.other}).` },
          { value: F(p.k), category: 'other', feedback: `Das ist die Anzahl aus den ${p.n} Versuchen. Rechne auf ${p.m} Versuche um.` }].filter(d => F(d.value).isInteger())) },
        hints: hints('Bei langen Versuchsreihen ist die relative Häufigkeit ein guter Schätzwert für die Wahrscheinlichkeit.',
          'Bestimme die relative Häufigkeit und multipliziere sie mit der neuen Anzahl der Versuche.', steps[0], steps,
          `Dreisatz: ${p.n} Versuche → ${p.k}-mal; 1 Versuch → $\\frac{${p.k}}{${p.n}}$-mal; ${p.m} Versuche → ?`),
        solution: { steps, result: `Etwa $${E.toString()}$-mal` },
      };
    }
    if (level === 3) {
      const K = p.ks.reduce((a, b) => a + b, 0), N = p.ns.reduce((a, b) => a + b, 0), v = F(K).div(N);
      const big = p.ns.indexOf(Math.max(...p.ns)), small = p.ns.indexOf(Math.min(...p.ns));
      const steps = [`Alle Würfe zusammen: $${p.ns.join(' + ')} = ${N}$; davon ${outQ(o)}: $${p.ks.join(' + ')} = ${K}$.`, `Schätzwert: $${K} : ${N} = ${probTex(v)} = ${texNum(v)}$.`];
      return {
        prompt: `${p.names.join(', ').replace(/, ([^,]*)$/, ' und $1')} haben ${o.player ? 'bei einem Spieler Freiwürfe gezählt' : `${o.acc} geworfen`}. Bestimme aus allen Daten den besten Schätzwert für die Wahrscheinlichkeit von ${outQ(o)}.`,
        promptTable: { columns: ['Name', o.player ? 'Anzahl der Freiwürfe' : 'Anzahl der Würfe', `davon ${o.player ? 'Treffer' : o.out}`], rows: p.names.map((nm, i) => [nm, `$${p.ns[i]}$`, `$${p.ks[i]}$`]) },
        instructions: 'Gib den Schätzwert als Bruch, Dezimalzahl oder in Prozent an.',
        answer: probSpec(v, [
          { value: meanRates(p), category: 'concept_confusion', feedback: 'Du hast die drei relativen Häufigkeiten gemittelt. Die Reihen sind verschieden lang – fasse lieber alle Würfe zusammen.' },
          { value: F(p.ks[big]).div(p.ns[big]), category: 'other', feedback: 'Das ist nur die längste Reihe. Mit allen Daten zusammen wird die Schätzung noch besser.' },
          { value: F(p.ks[small]).div(p.ns[small]), category: 'concept_confusion', feedback: 'Das ist die kürzeste Reihe – sie ist am wenigsten zuverlässig.' }]),
        hints: hints('Je mehr Versuche, desto zuverlässiger ist die relative Häufigkeit als Schätzwert.',
          'Fasse alle drei Reihen zu einer langen Reihe zusammen: alle Würfe addieren, alle Treffer addieren.', steps[0], steps,
          'Mittelwert der drei relativen Häufigkeiten wäre nur richtig, wenn alle Reihen gleich lang wären.'),
        solution: { steps, result: probResult('Schätzwert:', v) },
      };
    }
    return buildL4(p, o);
  },
  solve(p, level) {
    if (level === 1) return Z.viaExpr(`${p.k}/${p.n}`).toString();
    if (level === 2) return Z.viaExpr(`${p.m}*${p.k}/${p.n}`).toString();
    if (level === 3) return Z.viaExpr(`(${p.ks.join('+')})/(${p.ns.join('+')})`).toString();
    const last = Z.viaExpr(`${p.ks[p.ks.length - 1]}/${p.ns[p.ns.length - 1]}`).round(2);
    const opt = buildL4(p, OBJECTS[p.oi]).answer.options.find(op => op.text.includes(`bei etwa $${texNum(last)}$`));
    return opt ? opt.id : null;
  },
};
function meanRates(p) { return p.ks.reduce((a, k, i) => a.add(F(k).div(p.ns[i])), F(0)).div(3); }

function buildL4(p, o) {
  const h = p.ks.map((k, i) => F(k).div(p.ns[i])), N = p.ns[p.ns.length - 1], last = h[h.length - 1].round(2), first = h[0];
  const raw = [
    { id: 'g', text: `Die relativen Häufigkeiten schwanken anfangs stark und stabilisieren sich bei etwa $${texNum(last)}$. Das ist ein guter Schätzwert für die Wahrscheinlichkeit.` },
    { id: 'f0', text: `Nach ${N} Würfen kennt man die Wahrscheinlichkeit genau; weitere Würfe würden an der relativen Häufigkeit nichts mehr ändern.`, category: 'concept_confusion', feedback: 'Auch eine sehr lange Versuchsreihe liefert nur einen Schätzwert. Die genaue Wahrscheinlichkeit kennt man bei diesem Gegenstand nicht.' },
    { id: 'f1', text: `Schon nach 10 Würfen ist der Schätzwert $${texNum(first)}$ genauso zuverlässig wie der nach ${N} Würfen.`, category: 'concept_confusion', feedback: 'Kurze Versuchsreihen schwanken stark. Erst bei vielen Versuchen wird die relative Häufigkeit stabil.' },
  ];
  const options = p.order.map(i => raw[i]);
  const steps = [`Die Werte für kleine Anzahlen (z. B. $${texNum(first)}$ bei 10 Würfen) weichen deutlich ab.`, `Ab etwa 500 Würfen ändern sie sich kaum noch und liegen bei etwa $${texNum(last)}$.`, 'Die relative Häufigkeit ist ein Schätzwert, der mit wachsender Versuchszahl tendenziell besser wird (Gesetz der großen Zahlen).'];
  return {
    prompt: `${o.player ? 'Ein Basketballspieler hat seine Freiwürfe gezählt' : `${o.obj[0].toUpperCase()}${o.obj.slice(1)} wurde oft ${o.verb}`}. Die Tabelle zeigt nach verschiedenen Anzahlen von Versuchen, ${o.player ? 'wie viele Treffer er hatte' : `wie oft ${outQ(o)} vorkam`}. Welche Aussage ist richtig?`,
    promptTable: { columns: ['Anzahl der Versuche', `davon ${o.player ? 'Treffer' : o.out}`, 'relative Häufigkeit (gerundet)'], rows: p.ns.map((n, i) => [`$${n}$`, `$${p.ks[i]}$`, `$${texNum(h[i].round(3))}$`]) },
    instructions: 'Wähle die richtige Aussage.',
    answer: { type: 'choice', options, correct: 'g', canonical: 'g' },
    hints: hints('Vergleiche die relativen Häufigkeiten bei wenigen und bei vielen Versuchen.',
      'Bei welchen Anzahlen ändern sich die Werte noch stark, ab wann kaum noch?', steps[0], steps,
      'Stell dir vor, mehrere Gruppen werfen je 10-mal: Ihre Ergebnisse wären sehr verschieden. Bei je 1000 Würfen lägen sie dicht beieinander.'),
    solution: { steps, result: raw[0].text },
  };
}

module.exports = [series];
module.exports.helpers = { meanRates };
