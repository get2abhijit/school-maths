'use strict';
/**
 * Template ch2.antiprop.recognize_compute.decide (family prop_or_antiprop). All situations are original.
 * Levels
 *  L1 Grundlagen     A situation in words with numbers: proportional, antiproportional or neither? Traps: Taxi with
 *                    a base fee and squares' areas (“je mehr, desto mehr”), a burning candle and girls/boys in a class
 *                    of fixed size (“je mehr, desto weniger”), age and height.
 *  L3 Anspruchsvoll  Dreisatz without being told the type: the student first decides proportional or antiproportional
 *                    (the distractor is the result of the other model).
 * Misconceptions: more_more, less_less, wrong_dreisatz.
 * Independent solver: L1 builds a value table from the situation's own numbers (three sample inputs) and classifies
 * it by BigInt cross-multiplication; L3 is the Dreisatz term of the displayed pair (expression engine).
 */
const { hints } = require('../util');
const Z = require('./zuo');
const D = require('./dreisatz');
const { F, deNum, eur } = Z;
const { Rng } = require('../../core');

const SKILL = 'ch2.antiprop.recognize_compute';

/**
 * Situation generators: (rng) → {text, type, trap, f(x) → y (Fraction), xs: three sample inputs}.
 * `f` is the situation's rule, used only by the independent solver; `type` is what build uses.
 */
const SITUATIONS = [
  // proportional
  rng => { const p = F(rng.pick(['1.2', '1.5', '0.9', '2.1', '1.35'])); return { id: 'notebooks', type: 'prop', text: `Ein Heft kostet ${eur(p)}. Zuordnung: Anzahl der Hefte → Gesamtpreis.`, f: x => p.mul(x), xs: [1, 2, 5] }; },
  rng => { const v = rng.pick([60, 80, 90, 110]); return { id: 'car', type: 'prop', text: `Ein Auto fährt gleichbleibend mit ${v} km/h. Zuordnung: Fahrzeit → zurückgelegte Strecke.`, f: x => F(v).mul(x), xs: [1, 2, 3] }; },
  rng => { const r = rng.pick([6, 8, 12, 15]); return { id: 'tap', type: 'prop', text: `Aus einem Wasserhahn fließen gleichmäßig ${r} l Wasser pro Minute. Zuordnung: Zeit → Wassermenge.`, f: x => F(r).mul(x), xs: [1, 3, 4] }; },
  rng => { const g = rng.pick([80, 100, 125, 150]); return { id: 'pasta', type: 'prop', text: `Für ein Nudelgericht rechnet man ${g} g Nudeln pro Person. Zuordnung: Anzahl der Personen → Nudelmenge.`, f: x => F(g).mul(x), xs: [2, 4, 6] }; },
  rng => { const p = F(rng.pick(['4.5', '5.2', '6.8', '7.9'])); return { id: 'cherries', type: 'prop', text: `Ein Kilogramm Kirschen kostet ${eur(p)}. Zuordnung: Gewicht der Kirschen → Preis.`, f: x => p.mul(x), xs: [1, 2, 3] }; },
  // antiproportional
  rng => { const T = rng.pick([120, 180, 240, 300]); return { id: 'prize', type: 'anti', text: `Ein Gewinn von ${eur(F(T))} wird gleichmäßig verteilt. Zuordnung: Anzahl der Gewinner → Betrag pro Person.`, f: x => F(T).div(x), xs: [2, 3, 4] }; },
  rng => { const d = rng.pick([120, 180, 240, 360]); return { id: 'distance', type: 'anti', text: `Eine Strecke ist ${d} km lang. Zuordnung: Durchschnittsgeschwindigkeit → Fahrzeit.`, f: x => F(d).div(x), xs: [40, 60, 80] }; },
  rng => { const A = rng.pick([24, 36, 48, 60]); return { id: 'rect', type: 'anti', text: `Rechtecke haben alle den Flächeninhalt ${A} cm². Zuordnung: Breite → Länge.`, f: x => F(A).div(x), xs: [2, 3, 4] }; },
  rng => { const n = rng.pick([48, 60, 72, 96]); return { id: 'sweets', type: 'anti', text: `${n} Bonbons werden gerecht an Kinder verteilt. Zuordnung: Anzahl der Kinder → Bonbons pro Kind.`, f: x => F(n).div(x), xs: [2, 3, 4] }; },
  rng => { const V = rng.pick([12, 18, 24]); return { id: 'tank', type: 'anti', text: `Gleich starke Pumpen füllen einen Tank mit ${V} m³ Wasser. Zuordnung: Anzahl der Pumpen → Zeit zum Füllen.`, f: x => F(V).div(x), xs: [1, 2, 3] }; },
  // neither
  rng => { const b = F(rng.pick(['3', '3.5', '4'])), r = F(rng.pick(['2', '2.2', '2.5'])); return { id: 'taxi', type: 'neither', trap: 'more', text: `Ein Taxi kostet ${eur(b)} Grundgebühr und ${eur(r)} pro Kilometer. Zuordnung: Strecke → Fahrpreis.`, f: x => b.add(r.mul(x)), xs: [1, 2, 4] }; },
  rng => { const L = rng.int(18, 30), r = F(rng.pick(['1.5', '2', '2.5'])); return { id: 'candle', type: 'neither', trap: 'less', text: `Eine Kerze ist ${L} cm lang und brennt pro Stunde ${deNum(r)} cm ab. Zuordnung: Brenndauer → Länge der Kerze.`, f: x => F(L).sub(r.mul(x)), xs: [1, 2, 4] }; },
  rng => { const n = rng.int(24, 31); return { id: 'class', type: 'neither', trap: 'less', text: `In einer Klasse sind ${n} Kinder. Zuordnung: Anzahl der Mädchen → Anzahl der Jungen.`, f: x => F(n).sub(x), xs: [10, 12, 15] }; },
  rng => { const s = rng.int(3, 9); return { id: 'square', type: 'neither', trap: 'more', text: `Ein Quadrat mit ${s} cm Seitenlänge hat den Flächeninhalt ${s * s} cm². Zuordnung: Seitenlänge eines Quadrats → Flächeninhalt.`, f: x => F(x).mul(x), xs: [1, 2, 3] }; },
  rng => { const b = F(rng.pick(['5', '7.5', '9.9'])), r = F(rng.pick(['0.09', '0.1', '0.12'])); return { id: 'phone', type: 'neither', trap: 'more', text: `Ein Handytarif kostet ${eur(b)} im Monat und zusätzlich ${eur(r)} pro Gesprächsminute. Zuordnung: Gesprächsminuten im Monat → Monatsrechnung.`, f: x => b.add(r.mul(x)), xs: [10, 20, 40] }; },
];

const TXT = { prop: 'proportional', anti: 'antiproportional', neither: 'weder proportional noch antiproportional' };
function feedback(sit, chosen) {
  if (sit.type === 'neither' && chosen === 'prop') return sit.trap === 'more' ? '„Je mehr, desto mehr“ reicht nicht. Prüfe: Gehört zum Doppelten wirklich das Doppelte?' : 'Prüfe: Gehört zum Doppelten wirklich das Doppelte?';
  if (sit.type === 'neither' && chosen === 'anti') return sit.trap === 'less' ? '„Je mehr, desto weniger“ reicht nicht. Prüfe: Gehört zum Doppelten wirklich die Hälfte?' : 'Prüfe: Gehört zum Doppelten wirklich die Hälfte?';
  if (sit.type === 'prop') return 'Rechne ein Beispiel: Verdopple den ersten Wert. Was passiert mit dem zweiten?';
  if (sit.type === 'anti') return 'Rechne ein Beispiel: Verdopple den ersten Wert. Halbiert sich der zweite?';
  return 'Rechne ein Beispiel mit dem Doppelten.';
}

const decide = {
  id: `${SKILL}.decide`, version: 1, skillId: SKILL,
  families: ['prop_or_antiprop'],
  levels: [1, 3],
  levelNotes: {
    1: 'Eine Situation in Worten zuordnen: proportional, antiproportional oder keins von beiden (Fallen: Grundgebühr, Kerze, Quadrat).',
    3: 'Dreisatz, ohne dass der Zuordnungstyp genannt wird: erst den Typ entscheiden, dann rechnen.',
  },
  misconceptions: ['more_more', 'less_less', 'wrong_dreisatz'],
  sample(rng, level) {
    if (level === 3) return { ...D.sampleTask(rng, rng.pick(['prop', 'anti']), 3), ask: 'y' };
    return { sit: rng.int(0, SITUATIONS.length - 1), seed: rng.int(0, 1e6) };
  },
  constraints(p, level) { return level === 3 ? D.taskConstraints(p) : true; },
  signatureParams(p, level) { return level === 3 ? p : { sit: p.sit, text: situation(p).text }; },
  build(p, level) {
    if (level === 3) {
      const b = D.buildTask(p, { hiddenType: true });
      return { ...b, prompt: `${b.prompt}`, instructions: `Überlege zuerst, ob die Zuordnung proportional oder antiproportional ist. ${b.instructions}` };
    }
    const sit = situation(p);
    const options = ['prop', 'anti', 'neither'].map(id => (id === sit.type ? { id, text: `Die Zuordnung ist ${TXT[id]}.` }
      : { id, text: `Die Zuordnung ist ${TXT[id]}.`, category: 'concept_confusion', feedback: feedback(sit, id) }));
    const ex = sit.xs.map(x => `${x} → ${deNum(sit.f(x))}`).join('; ');
    const verdict = sit.type === 'prop' ? 'Zum Doppelten gehört das Doppelte: proportional.'
      : sit.type === 'anti' ? 'Zum Doppelten gehört die Hälfte: antiproportional.'
        : 'Zum Doppelten gehört weder das Doppelte noch die Hälfte: weder proportional noch antiproportional.';
    const steps = [`Beispielwerte: ${ex}.`, verdict];
    return {
      prompt: `${sit.text} Welche Art von Zuordnung liegt vor?`,
      instructions: 'Rechne ein Beispiel: Was passiert mit dem zweiten Wert, wenn du den ersten Wert verdoppelst?',
      answer: { type: 'choice', options, correct: sit.type, canonical: sit.type },
      hints: hints('Proportional: Zum Doppelten gehört das Doppelte. Antiproportional: Zum Doppelten gehört die Hälfte.',
        'Setze zwei Werte ein, zum Beispiel einen Wert und sein Doppeltes, und berechne jeweils den zweiten Wert.',
        `Beispielwerte: ${ex}.`, steps,
        'Prüfe in einer kleinen Tabelle: Sind alle Quotienten gleich (proportional) oder alle Produkte (antiproportional)?'),
      solution: { steps, result: `Die Zuordnung ist ${TXT[sit.type]}.` },
    };
  },
  /** Independent: classify a table of the situation's own rule (BigInt), or the Dreisatz term (expression engine). */
  solve(p, level) {
    if (level === 3) return D.solveTask(p);
    const sit = situation(p);
    const t = Z.classify([1, 2, 3, 4, 6].map(x => [String(x), Z.dstr(sit.f(x))]));
    return t === 'neither' ? 'neither' : t;
  },
};
function situation(p) {
  return SITUATIONS[p.sit](new Rng(p.seed >>> 0));
}

module.exports = [decide];
