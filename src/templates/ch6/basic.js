'use strict';
/**
 * Skill ch6.pct.basic_tasks — Prozentsatz, Prozentwert und Grundwert berechnen (LS7 VI.2–4),
 * plus Erhöhen/Vermindern and comparing offers. All contexts are original.
 * Money/rounding rules: see pct.js header and D55.
 */
const { hints, $ } = require('../util');
const P = require('./pct');
const { F, deNum, texNum, pctTex, pct } = P;

const SKILL = 'ch6.pct.basic_tasks';
const NAMES = ['Lea', 'Ben', 'Aylin', 'Tom', 'Mia', 'Noah', 'Emma', 'Luca'];

/** Quantity kinds: unit for the answer spec, decimals allowed, sampling of the Grundwert. */
const KINDS = {
  count: { unit: null, places: 0, G: rng => rng.int(20, 120) * 10 },
  eur: { unit: '€', places: 2, G: rng => F(rng.int(80, 1800)).div(2) },
  km: { unit: 'km', places: 1, G: rng => rng.int(6, 36) },
  ml: { unit: 'ml', places: 0, G: rng => rng.pick([200, 250, 330, 400, 500, 750, 1000, 1500]) },
  kg: { unit: 'kg', places: 1, G: rng => rng.int(2, 60) * 10 },
  m: { unit: 'm', places: 1, G: rng => rng.int(2, 60) * 10 },
};
/** Plain text quantity: "4,50 €", "12,5 km", "240". */
function qty(kind, f) {
  f = F(f);
  if (kind === 'eur') return P.eur(f);
  const u = KINDS[kind].unit;
  return u ? `${deNum(f)} ${u}` : deNum(f);
}
/** Quantity in a worked step: formula number plus unit as text. */
function qtyTex(kind, f) {
  f = F(f);
  const n = kind === 'eur' && !f.isInteger() ? P.eur2Tex(f) : texNum(f);
  const u = KINDS[kind].unit;
  return `${$(n)}${u ? ` ${u}` : ''}`;
}
const pctT = f => $(pctTex(f));

/** Context texts per kind and question type. p: percent text, G, W: quantity texts. */
const CONTEXTS = {
  count: {
    value: (c) => `An einer Schule mit ${c.G} Schülerinnen und Schülern kommen ${c.p} mit dem Bus. Wie viele Schülerinnen und Schüler sind das?`,
    rate: (c) => `An einer Schule mit ${c.G} Schülerinnen und Schülern kommen ${c.W} mit dem Bus. Wie viel Prozent sind das?`,
    base: (c) => `An einer Schule kommen ${c.W} Schülerinnen und Schüler mit dem Bus. Das sind ${c.p} aller Schülerinnen und Schüler. Wie viele Schülerinnen und Schüler hat die Schule?`,
  },
  eur: {
    value: (c) => `${c.name} hat ${c.G} gespart und gibt ${c.p} davon für ein Konzertticket aus. Wie viel kostet das Ticket?`,
    rate: (c) => `${c.name} hat ${c.G} gespart und gibt ${c.W} für ein Konzertticket aus. Wie viel Prozent des Ersparten sind das?`,
    base: (c) => `${c.name} gibt ${c.W} für ein Konzertticket aus. Das sind ${c.p} des Ersparten. Wie viel Geld hatte ${c.name} gespart?`,
  },
  km: {
    value: (c) => `Eine Wanderung ist ${c.G} lang. Bis zur Mittagspause schafft die Gruppe ${c.p} der Strecke. Wie viele Kilometer sind das?`,
    rate: (c) => `Eine Wanderung ist ${c.G} lang. Bis zur Mittagspause schafft die Gruppe ${c.W}. Wie viel Prozent der Strecke sind das?`,
    base: (c) => `Bis zur Mittagspause schafft eine Wandergruppe ${c.W}. Das sind ${c.p} der ganzen Strecke. Wie lang ist die Strecke?`,
  },
  ml: {
    value: (c) => `Ein Fruchtsaftgetränk enthält ${c.p} Fruchtsaft. Wie viel Milliliter Fruchtsaft sind in einer Flasche mit ${c.G}?`,
    rate: (c) => `In einer Flasche mit ${c.G} Fruchtsaftgetränk sind ${c.W} Fruchtsaft. Wie viel Prozent Fruchtsaft enthält das Getränk?`,
    base: (c) => `In einer Flasche Fruchtsaftgetränk sind ${c.W} Fruchtsaft. Das sind ${c.p} des Inhalts. Wie viel Milliliter passen in die Flasche?`,
  },
};
const BARE = {
  value: c => `Berechne ${c.p} von ${c.G}.`,
  rate: c => `Wie viel Prozent sind ${c.W} von ${c.G}?`,
  base: c => `${c.p} sind ${c.W}. Wie viel sind 100 %?`,
};
const P1 = [1, 2, 4, 5, 10, 20, 25, 40, 50, 60, 75];
const ASKS = ['value', 'rate', 'base'];

/** Answer spec for a quantity (or a percentage when kind === 'pct'). */
function qtySpec(kind, exact, rounded, places, distractors) {
  const unit = kind === 'pct' ? '%' : KINDS[kind].unit;
  const tol = rounded ? F(5).div(F(10).pow(places + 1)) : F(0);
  if (kind === 'count') return { type: 'integer', value: exact.toString(), canonical: exact.toString(), distractors };
  const v = rounded ? exact.round(places) : exact;
  return { type: 'decimal', value: v.toString(), tolerance: tol.toString(), places, ...(unit ? { unit } : {}), canonical: deNum(v, kind === 'eur' && !v.isInteger() ? 2 : undefined), distractors };
}
/** Distractor list → machine strings; drops values equal to (or within tolerance of) the answer and duplicates. */
function dist(spec, list) {
  const v = F(spec.value), tol = F(spec.tolerance || '0'), out = [];
  for (const d of list) {
    const x = F(d.value);
    if (x.sub(v).abs().cmp(tol) <= 0 || x.sign() <= 0 || out.some(o => F(o.value).eq(x))) continue;
    if (spec.type === 'integer' && !x.isInteger()) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}
const fitsPlaces = (f, places) => F(f).round(places).eq(F(f));

// ================================================================== the three basic tasks
/**
 * Template ch6.pct.basic_tasks.grundaufgaben (families rate, value, base)
 * Levels
 *  L1 Grundlagen    "Berechne 25 % von 80 €" without context; benchmark percentages (1, 2, 4, 5, 10, 20, 25, 40, 50, 60, 75 %),
 *                   whole-number results.
 *  L2 Standard      the three basic tasks in contexts (school bus, savings, hike, juice); any whole percentage;
 *                   results exact (cents, one decimal for km).
 *  L3 Anspruchsvoll percentages with one decimal (12,5 %); Prozentsatz rounded to one decimal, money rounded to cents
 *                   (stated in the task).
 * Misconceptions: wrong_base (Prozentwert used as Grundwert), divide_instead_multiply, forgot_hundred (×100/÷100
 *   forgotten), money_rounding (cut off instead of rounded).
 * Build path: Dreisatz 100 % → 1 % → p % with Fractions. Independent solver: the expression engine evaluates the
 *   formula (G·p/100, W/G·100, W·100/p) and rounds with BigInt half-up.
 */
const grundaufgaben = {
  id: `${SKILL}.grundaufgaben`, version: 1, skillId: SKILL,
  families: ['rate', 'value', 'base'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Einfache Prozentsätze (10 %, 25 %, 75 % …) ohne Sachzusammenhang; ganzzahlige Ergebnisse.',
    2: 'Prozentsatz, Prozentwert oder Grundwert im Sachzusammenhang; ganze Prozentsätze, Ergebnisse ohne Runden.',
    3: 'Prozentsätze mit Komma; Prozentsatz auf eine Nachkommastelle bzw. Geld auf Cent runden.',
  },
  misconceptions: ['wrong_base', 'divide_instead_multiply', 'forgot_hundred', 'money_rounding'],
  sample(rng, level) {
    const ask = rng.pick(ASKS);
    if (level === 1) {
      const kind = rng.pick(['eur', 'kg', 'm', 'count']);
      const p = rng.pick(P1);
      const step = 100 / gcd(p, 100);
      const G = step * rng.int(1, Math.max(1, Math.floor(600 / step)));
      return { ask, kind, G: String(G), p: String(p) };
    }
    const kind = level === 3 && ask === 'value' ? rng.pick(['eur', 'count']) : rng.pick(['count', 'eur', 'km', 'ml']);
    const G = F(KINDS[kind].G(rng));
    if (level === 3 && ask === 'rate') {
      const pl = KINDS[kind].places;
      const W = F(rng.int(1, Number(G.mul(10 ** pl).n) - 1)).div(10 ** pl);
      return { ask, kind, G: G.toString(), W: W.toString(), name: rng.int(0, NAMES.length - 1) };
    }
    const p = level === 2 ? F(rng.int(2, 98)) : F(rng.intExcept(5, 995, [])).div(10);
    return { ask, kind, G: G.toString(), p: p.toString(), name: rng.int(0, NAMES.length - 1) };
  },
  constraints(p, level) {
    const G = F(p.G), places = KINDS[p.kind].places;
    if (G.cmp(10) < 0) return 'base too small';
    if (p.W !== undefined) {
      const rate = F(p.W).div(G).mul(100);
      if (fitsPlaces(rate, 1)) return 'L3 rate should need rounding';
      if (rate.cmp(1) < 0 || rate.cmp(99) > 0) return 'rate out of range';
      return true;
    }
    const pc = F(p.p);
    if (level === 3 && pc.isInteger()) return 'L3 needs a decimal percentage';
    if (level === 2 && (pc.eq(50) || pc.eq(25) || pc.eq(10))) return 'L2 avoids benchmark percentages';
    const W = G.mul(pc).div(100);
    if (W.sign() <= 0) return 'zero value';
    const exactW = fitsPlaces(W, places);
    if (p.ask === 'value' && level === 3 && p.kind === 'eur') { if (exactW) return 'L3 money value should need rounding'; return true; }
    if (!exactW) return 'Prozentwert not exact';
    if (p.kind === 'count' && (W.cmp(5) < 0)) return 'too few people';
    if (level === 1 && !W.isInteger()) return 'L1 whole numbers';
    return true;
  },
  signatureParams(p) { return { ask: p.ask, kind: p.kind, G: p.G, p: p.p, W: p.W }; },
  build(p, level) {
    const kind = p.kind, G = F(p.G), places = KINDS[kind].places;
    const pc = p.p !== undefined ? F(p.p) : F(p.W).div(G).mul(100);
    const W = p.W !== undefined ? F(p.W) : G.mul(pc).div(100);
    const rounded = (p.ask === 'value' && !fitsPlaces(W, places)) || (p.ask === 'rate' && !fitsPlaces(pc, 1));
    const c = { G: qty(kind, G), W: qty(kind, W), p: pct(pc), name: NAMES[p.name || 0] };
    const prompt = level === 1 ? BARE[p.ask](c) : CONTEXTS[kind][p.ask](c);
    let spec, steps, result, strategy, alt;
    const one = G.div(100);
    if (p.ask === 'value') {
      spec = qtySpec(kind, W, rounded, places, []);
      spec.distractors = dist(spec, [
        { value: G.mul(100).div(pc), category: 'concept_confusion', feedback: 'Du hast durch den Prozentsatz geteilt. Für den Prozentwert rechnest du Grundwert durch 100 mal Prozentsatz.' },
        { value: G.mul(pc), category: 'concept_confusion', feedback: 'Du hast vergessen, durch 100 zu teilen: p % bedeutet p Hundertstel.' },
        ...(rounded ? [{ value: truncTo(W, 2), category: 'rounding', feedback: 'Runde kaufmännisch: Ist die nächste Ziffer 5 oder größer, wird aufgerundet.' }] : []),
      ]);
      steps = [`${pctT(100)} entsprechen ${qtyTex(kind, G)}.`, `${pctT(1)} entspricht ${$(`${texNum(G)} : 100 = ${texNum(one)}`)}.`,
        `${pctT(pc)} entsprechen ${$(`${texNum(one)} \\cdot ${texNum(pc)} = ${texNum(W)}`)}${rounded ? ` ${$(`\\approx ${P.eur2Tex(W.round(2))}`)} (auf Cent gerundet)` : ''}.`];
      result = `${qtyTex(kind, rounded ? W.round(places) : W)}`;
      strategy = 'Gesucht ist der Prozentwert. Dreisatz: Von 100 % auf 1 % (geteilt durch 100), dann auf p % (mal p).';
      alt = `Mit dem Faktor: ${$(`${texNum(pc)}\\,\\% = ${texNum(pc.div(100))}`)}, also Prozentwert $=$ Grundwert ${$(`\\cdot ${texNum(pc.div(100))}`)}.`;
    } else if (p.ask === 'rate') {
      spec = qtySpec('pct', pc, rounded, rounded ? 1 : P.placesOf(pc), []);
      spec.distractors = dist(spec, [
        { value: G.div(W).mul(100), category: 'concept_confusion', feedback: 'Du hast Grundwert durch Prozentwert geteilt. Der Teil (Prozentwert) gehört in den Zähler, das Ganze (Grundwert) in den Nenner.' },
        { value: W.div(G), category: 'concept_confusion', feedback: 'Das ist der Anteil als Dezimalzahl. Für den Prozentsatz rechnest du noch mal 100.' },
        ...(rounded ? [{ value: truncTo(pc, 1), category: 'rounding', feedback: 'Runde kaufmännisch: Ist die nächste Ziffer 5 oder größer, wird aufgerundet.' }] : []),
      ]);
      const q = W.div(G);
      steps = [`Anteil: ${$(`\\frac{${texNum(W)}}{${texNum(G)}} ${fitsPlaces(q, 6) ? '=' : '\\approx'} ${texNum(q.round(fitsPlaces(q, 6) ? P.placesOf(q) : 4))}`)}.`,
        `In Prozent: ${$(`${rounded ? '\\approx ' : ''}${pctTex(rounded ? pc.round(1) : pc)}`)}${rounded ? ' (auf eine Nachkommastelle gerundet)' : ''}.`];
      result = pctT(rounded ? pc.round(1) : pc);
      strategy = 'Gesucht ist der Prozentsatz: Teile den Prozentwert (den Teil) durch den Grundwert (das Ganze) und rechne in Prozent um.';
      alt = `Dreisatz: ${qtyTex(kind, G)} entsprechen ${pctT(100)}, also entsprechen ${qtyTex(kind, one)} genau ${pctT(1)}. Wie oft passt ${qty(kind, one)} in ${qty(kind, W)}?`;
    } else {
      spec = qtySpec(kind, G, false, places, []);
      spec.distractors = dist(spec, [
        { value: W.mul(pc).div(100), category: 'concept_confusion', feedback: 'Du hast den Prozentwert wie einen Grundwert behandelt. Hier ist der Teil gegeben – gesucht ist das Ganze (100 %).' },
        { value: W.div(pc), category: 'concept_confusion', feedback: 'Das ist erst der Wert für 1 %. Rechne noch mal 100.' },
        { value: W.mul(pc), category: 'concept_confusion', feedback: 'Vom Wert für p % kommst du zu 1 %, indem du durch p teilst – nicht mal p.' },
      ]);
      const w1 = W.div(pc);
      steps = [`${pctT(pc)} entsprechen ${qtyTex(kind, W)}.`, `${pctT(1)} entspricht ${$(`${texNum(W)} : ${texNum(pc)} = ${texNum(fitsPlaces(w1, 6) ? w1 : w1.round(4))}`)}${fitsPlaces(w1, 6) ? '' : ' (gerundet; rechne mit dem genauen Wert weiter)'}.`,
        `${pctT(100)} entsprechen ${$(`${texNum(W)} : ${texNum(pc)} \\cdot 100 = ${texNum(G)}`)}.`];
      result = qtyTex(kind, G);
      strategy = 'Gesucht ist der Grundwert (100 %). Dreisatz: Von p % auf 1 % (geteilt durch p), dann auf 100 % (mal 100).';
      alt = `Probe: ${$(`${texNum(pc)}\\,\\%`)} von ${qty(kind, G)} müssen wieder ${qty(kind, W)} ergeben.`;
    }
    const unitWord = spec.unit === '%' ? 'Das Prozentzeichen kannst du weglassen.' : (spec.unit ? `Die Einheit ${spec.unit} kannst du weglassen.` : null);
    const roundWord = rounded ? (p.ask === 'rate' ? 'Runde auf eine Nachkommastelle.' : 'Runde auf Cent.') : null;
    const instr = [roundWord, unitWord].filter(Boolean).join(' ');
    return {
      prompt,
      ...(instr ? { instructions: instr } : {}),
      answer: spec,
      hints: hints(
        'Ordne zu: Grundwert = das Ganze (100 %), Prozentsatz = p %, Prozentwert = der Teil. Was ist gegeben, was ist gesucht?',
        strategy, steps[0], steps, alt),
      solution: { steps, result },
    };
  },
  /** Independent: formula through the expression engine, BigInt half-up rounding. */
  solve(p) {
    const kind = p.kind, places = KINDS[kind].places;
    let v, pl;
    if (p.ask === 'value') { v = P.viaExpr(`${P.mach(p.G)}*${P.mach(p.p)}/100`); pl = places; }
    else if (p.ask === 'rate') {
      const W = p.W !== undefined ? P.mach(p.W) : `(${P.mach(p.G)}*${P.mach(p.p)}/100)`;
      v = P.viaExpr(`${W}/${P.mach(p.G)}*100`); pl = 1;
    } else { v = P.viaExpr(`${P.mach(p.G)}*${P.mach(p.p)}/100*100/${P.mach(p.p)}`); pl = places; }
    const r = P.roundTo(v, pl);
    return P.rawOf(r.eq(v) ? v : r);
  },
};
/** Cut off (not rounded) to `places` decimals — the money_rounding misconception. */
function truncTo(f, places) { const s = F(10).pow(places), x = F(f).mul(s); return F(x.n / x.d).div(s); }
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }

// ================================================================== increase / decrease, reverse, offers
/** Items: indefinite (prompt start), nominative and accusative with article, price range in € (multiples of 5). */
const ITEMS = [
  { ein: 'Ein Fahrrad', nom: 'das Fahrrad', acc: 'das Fahrrad', lo: 250, hi: 900 },
  { ein: 'Eine Jacke', nom: 'die Jacke', acc: 'die Jacke', lo: 40, hi: 200 },
  { ein: 'Ein Skateboard', nom: 'das Skateboard', acc: 'das Skateboard', lo: 40, hi: 160 },
  { ein: 'Ein Kopfhörer', nom: 'der Kopfhörer', acc: 'den Kopfhörer', lo: 30, hi: 300 },
  { ein: 'Ein Rucksack', nom: 'der Rucksack', acc: 'den Rucksack', lo: 25, hi: 120 },
  { ein: 'Eine Spielkonsole', nom: 'die Spielkonsole', acc: 'die Spielkonsole', lo: 200, hi: 550 },
];
const price = (rng, it) => rng.int(it.lo / 5, it.hi / 5) * 5;
const VARIANTS = { 2: ['up', 'down', 'members'], 3: ['original', 'rate_change'], 4: ['successive', 'offers'] };

/**
 * Template ch6.pct.basic_tasks.change (family increase_decrease)
 * Levels
 *  L2 Standard      raise or lower a price (or a membership count) by p %: new value.
 *  L3 Anspruchsvoll back-calculation (price before a discount or a rise; the new price is NOT the Grundwert) and
 *                   the percentage of a change (Grundwert = old value).
 *  L4 Transfer      two successive changes (+a % then −b %, also a = b) and comparing two offers (choice).
 * Misconceptions: wrong_base (back-calculation with the new value as Grundwert; change related to the new value),
 *   plus_minus_same (+20 % then −20 % = start; percentages simply added), only_change (answers the change, not the
 *   new value).
 * Build path: Prozentwert then add/subtract (Fractions). Independent solver: growth factor in the expression engine
 *   (G·(100 ± p)/100, N·100/(100 ± p), …).
 */
const change = {
  id: `${SKILL}.change`, version: 1, skillId: SKILL,
  families: ['increase_decrease'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Einen Preis oder eine Anzahl um p % erhöhen oder vermindern.',
    3: 'Rückrechnen auf den ursprünglichen Wert; Prozentsatz einer Veränderung bestimmen.',
    4: 'Zwei Veränderungen nacheinander; zwei Angebote vergleichen.',
  },
  misconceptions: ['wrong_base', 'plus_minus_same', 'only_change'],
  sample(rng, level) {
    const v = rng.pick(VARIANTS[level]);
    const item = rng.int(0, ITEMS.length - 1), it = ITEMS[item];
    if (v === 'members') return { v, G: String(rng.int(8, 60) * 10), p: String(rng.pick([2, 4, 5, 6, 8, 12, 15, 16, 24, 30, 35, 45])), dir: rng.bool() ? 1 : -1 };
    if (v === 'offers') {
      const G1 = price(rng, it), pA = rng.pick([10, 15, 20, 25, 30, 35, 40]);
      const fixed = rng.bool();
      return { v, item, G1: String(G1), pA: String(pA), G2: String(G1 + rng.int(-6, 10) * 5), pB: String(rng.pick([10, 15, 20, 25, 30, 35, 40, 50])), fixed, amount: String(rng.int(2, 30) * 5) };
    }
    const G = String(price(rng, it));
    if (v === 'successive') { const a = rng.pick([10, 20, 25, 30, 40, 50]); return { v, item, G, a: String(a), b: String(rng.bool() ? a : rng.pick([10, 20, 25, 30, 40, 50])), upFirst: rng.bool() }; }
    return { v, item, G, p: String(rng.pick([5, 10, 15, 20, 25, 30, 35, 40, 12, 8, 60])), dir: rng.bool() ? 1 : -1 };
  },
  constraints(p) {
    if (p.v === 'offers') {
      const [a, b] = offerPrices(p);
      if (a.eq(b)) return 'equal offers';
      if (a.sub(b).abs().cmp(F(1)) < 0) return 'offers too close';
      if (!p.fixed && p.pA === p.pB) return 'same percentage';
      if (b.sign() <= 0 || F(p.amount).cmp(F(p.G2).div(2)) > 0) return 'implausible discount';
      return true;
    }
    if (p.v === 'successive') {
      const [m] = successive(p);
      if (!fitsPlaces(m, 2)) return 'intermediate not cents';
      return true;
    }
    const G = F(p.G), q = F(p.p).div(100);
    if (p.v === 'members') { const W = G.mul(q); return W.isInteger() ? true : 'members not whole'; }
    const N = p.dir > 0 ? G.mul(q.add(1)) : G.mul(F(1).sub(q));
    if (!fitsPlaces(N, 2)) return 'new price not cents';
    if (p.v === 'rate_change' && !fitsPlaces(F(p.p), 1)) return 'rate';
    return true;
  },
  build(p) {
    const it = ITEMS[p.item || 0];
    if (p.v === 'offers') return buildOffers(p);
    if (p.v === 'successive') return buildSuccessive(p);
    const G = F(p.G), pc = F(p.p), q = pc.div(100), W = G.mul(q);
    const N = p.dir > 0 ? G.add(W) : G.sub(W);
    const up = p.dir > 0;
    const factor = up ? F(1).add(q) : F(1).sub(q);
    const facT = texNum(factor);
    let prompt, spec, steps, result, strategy, orient, alt;
    if (p.v === 'up' || p.v === 'down' || p.v === 'members') {
      const isCount = p.v === 'members';
      prompt = isCount
        ? `Ein Sportverein hat ${G} Mitglieder. Im nächsten Jahr ${up ? 'steigt' : 'sinkt'} die Zahl der Mitglieder um ${pct(pc)}. Wie viele Mitglieder hat der Verein dann?`
        : `${it.ein} kostet ${P.eur(G)}. Der Preis wird um ${pct(pc)} ${up ? 'erhöht' : 'gesenkt'}. Wie viel kostet ${it.nom} danach?`;
      const kind = isCount ? 'count' : 'eur';
      spec = qtySpec(kind, N, false, isCount ? 0 : 2, []);
      spec.distractors = dist(spec, [
        { value: W, category: 'concept_confusion', feedback: `Das ist nur die Veränderung (${pct(pc)} von ${qty(kind, G)}). Gefragt ist der neue Wert.` },
        { value: up ? G.sub(W) : G.add(W), category: 'concept_confusion', feedback: up ? 'Bei einer Erhöhung kommt der Prozentwert dazu.' : 'Bei einer Senkung wird der Prozentwert abgezogen.' },
      ]);
      steps = [`Veränderung: ${$(`${texNum(pc)}\\,\\%`)} von ${qtyTex(kind, G)} sind ${$(`${texNum(G)} \\cdot ${texNum(q)} = ${texNum(W)}`)}.`,
        `Neuer Wert: ${$(`${texNum(G)} ${up ? '+' : '-'} ${texNum(W)} = ${isCount ? texNum(N) : P.eur2Tex(N)}`)}.`];
      result = qtyTex(kind, N);
      orient = `Der alte Wert ist der Grundwert (100 %). ${up ? 'Bei einer Erhöhung kommt etwas dazu' : 'Bei einer Senkung fällt etwas weg'}.`;
      strategy = 'Berechne zuerst die Veränderung (Prozentwert) und rechne sie dann zum alten Wert dazu bzw. ziehe sie ab.';
      alt = `Mit dem Wachstumsfaktor: Der neue Wert ist ${$(`${texNum(F(100).add(up ? pc : pc.neg()))}\\,\\%`)} des alten, also ${$(`${texNum(G)} \\cdot ${facT} = ${isCount ? texNum(N) : P.eur2Tex(N)}`)}.`;
    } else if (p.v === 'original') {
      prompt = `${it.ein} kostet nach einer Preis${up ? 'erhöhung' : 'senkung'} um ${pct(pc)} jetzt ${P.eur(N)}. Wie viel hat ${it.nom} vorher gekostet?`;
      spec = qtySpec('eur', G, false, 2, []);
      spec.distractors = dist(spec, [
        { value: up ? N.mul(F(1).sub(q)) : N.mul(F(1).add(q)), category: 'concept_confusion', feedback: 'Die Prozente beziehen sich auf den ALTEN Preis, nicht auf den neuen. Der neue Preis entspricht ' + (up ? `${pct(F(100).add(pc))}` : `${pct(F(100).sub(pc))}`) + ' des alten.' },
        { value: up ? N.sub(W) : N.add(W), category: 'concept_confusion', feedback: 'Die Veränderung kennst du noch nicht – sie hängt vom gesuchten alten Preis ab. Rechne mit dem Dreisatz vom neuen Prozentsatz auf 100 %.' },
      ]);
      const newPct = F(100).add(up ? pc : pc.neg());
      steps = [`Der alte Preis ist der Grundwert (100 %). Der neue Preis entspricht ${$(`100\\,\\% ${up ? '+' : '-'} ${texNum(pc)}\\,\\% = ${texNum(newPct)}\\,\\%`)}.`,
        `${pctT(newPct)} entsprechen ${qtyTex('eur', N)}.`, `${pctT(1)} entspricht ${$(`${P.eur2Tex(N)} : ${texNum(newPct)}`)}.`,
        `${pctT(100)} entsprechen ${$(`${P.eur2Tex(N)} : ${texNum(newPct)} \\cdot 100 = ${P.eur2Tex(G)}`)}.`];
      result = qtyTex('eur', G);
      orient = 'Gesucht ist der Preis VOR der Veränderung. Er ist der Grundwert (100 %), der neue Preis ist es nicht.';
      strategy = `Überlege, wie viel Prozent der neue Preis vom alten ist (${up ? '100 % + p %' : '100 % − p %'}). Dann Dreisatz zurück auf 100 %.`;
      alt = `Mit dem Faktor rückwärts: alter Preis ${$(`= ${P.eur2Tex(N)} : ${facT} = ${P.eur2Tex(G)}`)}. Probe: ${P.eur(G)} ${up ? 'plus' : 'minus'} ${pct(pc)} ergibt ${P.eur(N)}.`;
    } else {
      prompt = `Der Preis für ${it.acc} ${up ? 'steigt' : 'sinkt'} von ${P.eur(G)} auf ${P.eur(N)}. Um wie viel Prozent hat sich der Preis ${up ? 'erhöht' : 'verringert'}?`;
      spec = qtySpec('pct', pc, false, P.placesOf(pc), []);
      spec.distractors = dist(spec, [
        { value: W.div(N).mul(100), category: 'concept_confusion', feedback: 'Du hast die Veränderung auf den neuen Preis bezogen. Grundwert ist der alte Preis.' },
        { value: N.div(G).mul(100), category: 'concept_confusion', feedback: 'Das ist der neue Preis in Prozent des alten. Gefragt ist nur die Veränderung: Ziehe 100 % ab.' },
        { value: W, category: 'concept_confusion', feedback: 'Das ist die Veränderung in Euro. Gefragt ist der Prozentsatz.' },
      ]);
      steps = [`Veränderung: ${$(up ? `${P.eur2Tex(N)} - ${P.eur2Tex(G)} = ${P.eur2Tex(W)}` : `${P.eur2Tex(G)} - ${P.eur2Tex(N)} = ${P.eur2Tex(W)}`)} €.`,
        `Grundwert ist der alte Preis: ${$(`\\frac{${P.eur2Tex(W)}}{${P.eur2Tex(G)}} = ${texNum(q)} = ${pctTex(pc)}`)}.`];
      result = pctT(pc);
      orient = 'Gesucht ist ein Prozentsatz. Bezugsgröße (Grundwert) ist immer der Wert VOR der Veränderung.';
      strategy = 'Berechne zuerst, um wie viel Euro sich der Preis verändert hat. Teile das durch den alten Preis.';
      alt = `Oder: Der neue Preis ist ${$(`\\frac{${P.eur2Tex(N)}}{${P.eur2Tex(G)}} = ${texNum(N.div(G))} = ${pctTex(N.div(G).mul(100))}`)} des alten. Der Unterschied zu 100 % ist die Veränderung.`;
    }
    const instr = spec.unit === '%' ? 'Das Prozentzeichen kannst du weglassen.' : (spec.unit ? `Die Einheit ${spec.unit} kannst du weglassen.` : null);
    return { prompt, ...(instr ? { instructions: instr } : {}), answer: spec, hints: hints(orient, strategy, steps[0], steps, alt), solution: { steps, result } };
  },
  /** Independent: growth factors in the expression engine. */
  solve(p) {
    if (p.v === 'offers') {
      const a = P.viaExpr(`${p.G1}*(100-${p.pA})/100`);
      const b = p.fixed ? P.viaExpr(`${p.G2}-${p.amount}`) : P.viaExpr(`${p.G2}*(100-${p.pB})/100`);
      return a.cmp(b) < 0 ? 'A' : 'B';
    }
    if (p.v === 'successive') {
      const f1 = p.upFirst ? `(100+${p.a})` : `(100-${p.a})`, f2 = p.upFirst ? `(100-${p.b})` : `(100+${p.b})`;
      return P.rawOf(P.viaExpr(`${p.G}*${f1}*${f2}/10000`));
    }
    const f = p.dir > 0 ? `(100+${p.p})` : `(100-${p.p})`;
    if (p.v === 'original') return P.rawOf(P.viaExpr(`${p.G}*${f}/100*100/${f}`));
    if (p.v === 'rate_change') return P.rawOf(P.viaExpr(`(${p.G}*${f}/100-${p.G})/${p.G}*100`).abs());
    return P.rawOf(P.viaExpr(`${p.G}*${f}/100`));
  },
};

function successive(p) {
  const G = F(p.G), a = F(p.a).div(100), b = F(p.b).div(100);
  const m = p.upFirst ? G.add(G.mul(a)) : G.sub(G.mul(a));
  const e = p.upFirst ? m.sub(m.mul(b)) : m.add(m.mul(b));
  return [m, e];
}
function buildSuccessive(p) {
  const G = F(p.G), a = F(p.a), b = F(p.b), [m, e] = successive(p);
  const it = ITEMS[p.item];
  const w1 = word => (word ? 'erhöht' : 'gesenkt');
  const prompt = `${it.ein} kostet ${P.eur(G)}. Zuerst wird der Preis um ${pct(a)} ${w1(p.upFirst)}, später wird der neue Preis um ${pct(b)} ${w1(!p.upFirst)}. Wie viel kostet ${it.nom} am Ende?`;
  const spec = qtySpec('eur', e, false, 2, []);
  const net = p.upFirst ? a.sub(b) : b.sub(a);
  spec.distractors = dist(spec, [
    { value: G.mul(F(100).add(net)).div(100), category: 'concept_confusion', feedback: a.eq(b) ? 'Plus und minus gleich viel Prozent heben sich NICHT auf: Die zweite Änderung bezieht sich auf den neuen Preis.' : 'Du darfst die Prozentsätze nicht einfach verrechnen: Die zweite Änderung bezieht sich auf den neuen Preis, nicht auf den Anfangspreis.' },
    { value: m, category: 'concept_confusion', feedback: 'Das ist erst der Preis nach der ersten Änderung. Es folgt noch eine zweite.' },
  ]);
  const fa = p.upFirst ? F(100).add(a).div(100) : F(100).sub(a).div(100);
  const fb = p.upFirst ? F(100).sub(b).div(100) : F(100).add(b).div(100);
  const steps = [
    `1. Änderung (Grundwert ${P.eur(G)}): ${$(`${texNum(G)} \\cdot ${texNum(fa)} = ${P.eur2Tex(m)}`)} €.`,
    `2. Änderung (neuer Grundwert ${P.eur(m)}): ${$(`${P.eur2Tex(m)} \\cdot ${texNum(fb)} = ${P.eur2Tex(e)}`)} €.`,
    a.eq(b) ? `Der Endpreis ist ${e.cmp(G) < 0 ? 'kleiner' : 'größer'} als der Anfangspreis, obwohl um gleich viel Prozent ${p.upFirst ? 'erhöht und gesenkt' : 'gesenkt und erhöht'} wurde.` : `Gesamtfaktor: ${$(`${texNum(fa)} \\cdot ${texNum(fb)} = ${texNum(fa.mul(fb))}`)}.`,
  ];
  return {
    prompt, instructions: 'Die Einheit € kannst du weglassen.',
    answer: spec,
    hints: hints('Achtung: Die zweite Änderung bezieht sich auf den Preis NACH der ersten Änderung – der Grundwert wechselt.',
      'Rechne Schritt für Schritt: zuerst den Preis nach der ersten Änderung, dann davon ausgehend die zweite.', steps[0], steps,
      'Mit Faktoren: Multipliziere den Anfangspreis nacheinander mit beiden Wachstumsfaktoren, z. B. $1{,}2$ für $+20\\,\\%$ und $0{,}8$ für $-20\\,\\%$.'),
    solution: { steps, result: qtyTex('eur', e) },
  };
}
function offerPrices(p) {
  const a = F(p.G1).mul(F(100).sub(F(p.pA))).div(100);
  const b = p.fixed ? F(p.G2).sub(F(p.amount)) : F(p.G2).mul(F(100).sub(F(p.pB))).div(100);
  return [a, b];
}
function buildOffers(p) {
  const [a, b] = offerPrices(p);
  const it = ITEMS[p.item];
  const tA = `Laden A: ${P.eur(F(p.G1))}, im Angebot ${pct(F(p.pA))} billiger.`;
  const tB = p.fixed ? `Laden B: ${P.eur(F(p.G2))}, im Angebot ${P.eur(F(p.amount))} billiger.` : `Laden B: ${P.eur(F(p.G2))}, im Angebot ${pct(F(p.pB))} billiger.`;
  const correct = a.cmp(b) < 0 ? 'A' : 'B';
  const bigger = !p.fixed && F(p.pB).cmp(F(p.pA)) > 0 ? 'B' : (!p.fixed ? 'A' : null);
  const opt = (id, text) => {
    if (id === correct) return { id, text };
    const fb = id === 'eq' ? 'Rechne beide Endpreise genau aus – sie sind verschieden.'
      : (bigger === id ? 'Der höhere Prozentsatz bezieht sich auf einen anderen Grundwert. Vergleiche die Endpreise, nicht die Prozentsätze.' : 'Rechne beide Endpreise aus und vergleiche sie.');
    return { id, text, category: 'concept_confusion', feedback: fb };
  };
  const options = [opt('A', 'Laden A ist günstiger.'), opt('B', 'Laden B ist günstiger.'), opt('eq', 'Beide sind gleich teuer.')];
  const steps = [`Laden A: ${$(`${texNum(F(p.G1))} \\cdot ${texNum(F(100).sub(F(p.pA)).div(100))} = ${P.eur2Tex(a)}`)} €.`,
    p.fixed ? `Laden B: ${$(`${texNum(F(p.G2))} - ${texNum(F(p.amount))} = ${P.eur2Tex(b)}`)} €.` : `Laden B: ${$(`${texNum(F(p.G2))} \\cdot ${texNum(F(100).sub(F(p.pB)).div(100))} = ${P.eur2Tex(b)}`)} €.`,
    `Laden ${correct} ist um ${P.eur(a.sub(b).abs())} günstiger.`];
  const lines = [tA, tB];
  return {
    prompt: `Zwei Läden verkaufen ${it.acc}. Wo ist ${it.nom} im Angebot günstiger?`,
    promptLines: lines,
    answer: { type: 'choice', options, correct, canonical: correct },
    hints: hints('Vergleiche die Preise, die du am Ende wirklich bezahlst – nicht die Rabatte.',
      'Berechne für jeden Laden den Angebotspreis. Prozent-Rabatte beziehen sich auf den Preis des jeweiligen Ladens.', steps[0], steps,
      `Mit dem Faktor: ${pct(F(p.pA))} billiger heißt, du zahlst ${pct(F(100).sub(F(p.pA)))} des Preises.`),
    solution: { steps, result: `Laden ${correct} ist günstiger (${P.eur(correct === 'A' ? a : b)}).` },
  };
}

module.exports = [grundaufgaben, change];
