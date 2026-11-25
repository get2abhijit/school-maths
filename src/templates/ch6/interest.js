'use strict';
/**
 * Skill ch6.interest.simple_compound — Zins und Zinseszins (LS7 VI.5). All contexts are original.
 * Terms as in the Zinsrechnung: Kapital/Guthaben (Grundwert), Zinssatz (Prozentsatz), Zinsen (Prozentwert).
 * Compound interest is computed YEAR BY YEAR (no closed formula K·q^n; Kl. 9/10 bound, see curriculum-sources).
 * Rounding (D55): interest is rounded to cents every year; an instance is only published if rounding only at the
 * end gives the same cents in every row (so both ways are graded correct).
 */
const { hints, $ } = require('../util');
const P = require('./pct');
const { F, texNum, pctTex, pct, eur, eur2, eur2Tex } = P;

const SKILL = 'ch6.interest.simple_compound';
const NAMES = ['Lea', 'Ben', 'Aylin', 'Tom', 'Mia', 'Noah', 'Emma', 'Luca'];
const RATES = ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2', '2.25', '2.5', '3', '3.5', '4'];
const HALF_CENT = F(1).div(200);

/** Build path: balances and interests with yearly cent rounding (Fractions). */
function yearByYear(K0, rate, years) {
  const rows = []; let k = F(K0);
  for (let i = 1; i <= years; i++) { const z = k.mul(F(rate)).div(100).round(2); const e = k.add(z); rows.push({ start: k, z, end: e }); k = e; }
  return rows;
}
/** Unrounded path (exact): K0·(1+p)^i built by repeated multiplication. */
function unrounded(K0, rate, years) {
  const rows = []; let k = F(K0); const q = F(1).add(F(rate).div(100));
  for (let i = 1; i <= years; i++) { const e = k.mul(q); rows.push({ z: e.sub(k), end: e }); k = e; }
  return rows;
}
/** True iff end-of-calculation rounding agrees with yearly rounding to within half a cent everywhere. */
function pathsAgree(K0, rate, years) {
  const a = yearByYear(K0, rate, years), b = unrounded(K0, rate, years);
  return a.every((r, i) => r.end.sub(b[i].end).abs().cmp(HALF_CENT) < 0 && r.z.sub(b[i].z).abs().cmp(HALF_CENT) < 0);
}
/** Independent path: integer cents with BigInt half-up rounding. Returns [{z, end}] as cents (BigInt). */
function centsYears(K0, rate, years, rates) {
  let k = BigInt(F(K0).mul(100).toString());
  const out = [];
  for (let i = 0; i < years; i++) { const z = P.interestCents(P.unscale(k, 2), rates ? rates[i] : rate); k += z; out.push({ z, end: k }); }
  return out;
}
const money = (f, rounded) => ({ type: 'decimal', value: F(f).toString(), tolerance: rounded ? HALF_CENT.toString() : '0', places: 2, unit: '€', canonical: eur2(f) });
function dist(spec, list) {
  const v = F(spec.value), tol = F(spec.tolerance), out = [];
  for (const d of list) {
    const x = F(d.value);
    if (x.sub(v).abs().cmp(tol) <= 0 || x.sign() <= 0 || out.some(o => F(o.value).eq(x))) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}
const fits = (f, pl) => F(f).round(pl).eq(F(f));
/** Fraction → decimal machine string "2.25" (stored params stay human-readable and BigInt-parsable). */
const dstr = f => F(f).toDecimalString(P.placesOf(F(f)), '.');
const m = f => $(eur2Tex(f));

// ================================================================== yearly interest
/**
 * Template ch6.interest.simple_compound.yearly (family yearly_interest)
 * Levels
 *  L1 Grundlagen  Jahreszinsen or the balance after one year from Kapital and Zinssatz (cents rounded if needed).
 *  L2 Standard    backwards: Zinssatz from Kapital and Zinsen, or Kapital from Zinsen and Zinssatz.
 * Misconceptions: forgot_hundred, wrong_base (Zinsen treated as Kapital), only_change (Zinsen instead of balance),
 *   cent_rounding (cut off instead of rounded).
 * Build path: Dreisatz with Fractions. Independent solver: integer cents (BigInt) or the expression engine.
 */
const yearly = {
  id: `${SKILL}.yearly`, version: 1, skillId: SKILL,
  families: ['yearly_interest'],
  levels: [1, 2],
  levelNotes: {
    1: 'Jahreszinsen oder Guthaben nach einem Jahr berechnen.',
    2: 'Rückwärts: Zinssatz aus Kapital und Zinsen oder Kapital aus Zinsen und Zinssatz.',
  },
  misconceptions: ['forgot_hundred', 'wrong_base', 'only_change', 'cent_rounding'],
  sample(rng, level) {
    const ask = level === 1 ? rng.pick(['interest', 'balance']) : rng.pick(['rate', 'capital']);
    return { ask, K: String(rng.int(4, 160) * 25), rate: rng.pick(RATES), name: rng.int(0, NAMES.length - 1) };
  },
  constraints(p, level) {
    const z = F(p.K).mul(F(p.rate)).div(100);
    if (level === 2 && !fits(z, 2)) return 'L2 interest must be whole cents';
    if (z.cmp(1) < 0) return 'interest below 1 €';
    return true;
  },
  signatureParams(p) { return { ask: p.ask, K: p.K, rate: p.rate }; },
  build(p) {
    const K = F(p.K), r = F(p.rate), zx = K.mul(r).div(100), z = zx.round(2), rounded = !fits(zx, 2);
    const who = NAMES[p.name];
    const intro = `${who} legt ${eur(K)} auf einem Sparkonto an. Die Bank zahlt ${pct(r)} Zinsen pro Jahr.`;
    let prompt, spec, steps, result, strategy, alt;
    const s100 = `${$(`100\\,\\%`)} entsprechen ${m(K)} €.`;
    const s1 = `${$(`1\\,\\%`)} entspricht ${$(`${texNum(K)} : 100 = ${texNum(K.div(100))}`)} €.`;
    const sp = `${$(pctTex(r))} entsprechen ${$(`${texNum(K.div(100))} \\cdot ${texNum(r)} = ${texNum(zx)}`)}${rounded ? ` ${$(`\\approx ${eur2Tex(z)}`)}` : ''} €.`;
    if (p.ask === 'interest' || p.ask === 'balance') {
      const bal = p.ask === 'balance';
      prompt = `${intro} ${bal ? 'Wie hoch ist das Guthaben nach einem Jahr?' : 'Wie viel Zinsen bekommt ' + who + ' nach einem Jahr?'}`;
      const target = bal ? K.add(z) : z;
      spec = money(target, rounded);
      spec.distractors = dist(spec, [
        { value: bal ? K.add(K.mul(r)) : K.mul(r), category: 'concept_confusion', feedback: 'Du hast vergessen, durch 100 zu teilen: p % bedeutet p Hundertstel.' },
        ...(bal ? [{ value: z, category: 'concept_confusion', feedback: 'Das sind nur die Zinsen. Gefragt ist das Guthaben: altes Guthaben plus Zinsen.' }] : [{ value: K.add(z), category: 'concept_confusion', feedback: 'Das ist das Guthaben nach einem Jahr. Gefragt sind nur die Zinsen.' }]),
        ...(rounded ? [{ value: trunc2(target.add(zx.sub(z))), category: 'rounding', feedback: 'Runde kaufmännisch auf Cent: Ist die dritte Nachkommastelle 5 oder größer, wird aufgerundet.' }] : []),
      ]);
      steps = [s100, s1, sp, ...(bal ? [`Guthaben nach einem Jahr: ${$(`${eur2Tex(K)} + ${eur2Tex(z)} = ${eur2Tex(K.add(z))}`)} €.`] : [])];
      result = `${m(target)} €`;
      strategy = bal ? 'Berechne zuerst die Zinsen (Prozentwert) und addiere sie zum Kapital.' : 'Die Zinsen sind der Prozentwert: Kapital durch 100 mal Zinssatz.';
      alt = `Mit dem Faktor: ${$(`${texNum(K)} \\cdot ${texNum(r.div(100))} = ${texNum(zx)}`)}${bal ? ` bzw. Guthaben ${$(`= ${texNum(K)} \\cdot ${texNum(F(1).add(r.div(100)))}`)}` : ''}.`;
    } else if (p.ask === 'rate') {
      prompt = `${who} legt ${eur(K)} ein Jahr lang auf einem Sparkonto an und bekommt dafür ${eur(z)} Zinsen. Wie hoch ist der Zinssatz?`;
      spec = { type: 'decimal', value: r.toString(), tolerance: '0', places: P.placesOf(r), unit: '%', canonical: P.deNum(r) };
      spec.distractors = dist(spec, [
        { value: z.div(K), category: 'concept_confusion', feedback: 'Das ist der Anteil als Dezimalzahl. Für den Zinssatz rechnest du noch mal 100.' },
        { value: K.div(z).mul(100), category: 'concept_confusion', feedback: 'Zinsen (der Teil) gehören in den Zähler, das Kapital (das Ganze) in den Nenner.' },
      ]);
      steps = [`Zinssatz ${$(`= \\frac{${eur2Tex(z)}}{${texNum(K)}} = ${texNum(r.div(100))} = ${pctTex(r)}`)}.`];
      result = $(pctTex(r));
      strategy = 'Der Zinssatz ist der Prozentsatz: Zinsen geteilt durch Kapital, dann in Prozent.';
      alt = `Probe: ${pct(r)} von ${eur(K)} sind ${eur(z)}.`;
    } else {
      prompt = `${who} bekommt für ein Jahr ${eur(z)} Zinsen. Der Zinssatz beträgt ${pct(r)}. Wie viel Geld hat ${who} angelegt?`;
      spec = money(K, false);
      spec.distractors = dist(spec, [
        { value: z.mul(r).div(100), category: 'concept_confusion', feedback: 'Die Zinsen sind der Prozentwert, nicht das Kapital. Gesucht ist das Ganze (100 %).' },
        { value: z.div(r), category: 'concept_confusion', feedback: 'Das ist erst der Wert für 1 %. Rechne noch mal 100.' },
      ]);
      steps = [`${$(pctTex(r))} entsprechen ${m(z)} €.`, `${$(`1\\,\\%`)} entspricht ${$(`${eur2Tex(z)} : ${texNum(r)}`)} €.`,
        `${$(`100\\,\\%`)} entsprechen ${$(`${eur2Tex(z)} : ${texNum(r)} \\cdot 100 = ${eur2Tex(K)}`)} €.`];
      result = `${m(K)} €`;
      strategy = 'Gesucht ist das Kapital (Grundwert, 100 %). Dreisatz: vom Zinssatz auf 1 %, dann auf 100 %.';
      alt = `Probe: ${pct(r)} von ${eur(K)} müssen ${eur(z)} ergeben.`;
    }
    const instr = [rounded && (p.ask === 'interest' || p.ask === 'balance') ? 'Runde auf Cent.' : null, spec.unit === '%' ? 'Das Prozentzeichen kannst du weglassen.' : 'Die Einheit € kannst du weglassen.'].filter(Boolean).join(' ');
    return {
      prompt, instructions: instr, answer: spec,
      hints: hints('Zinsrechnung ist Prozentrechnung: Kapital = Grundwert, Zinssatz = Prozentsatz, Zinsen = Prozentwert.', strategy, steps[0], steps, alt),
      solution: { steps, result },
    };
  },
  /** Independent: integer cents (interest/balance) or the expression engine (backwards). */
  solve(p) {
    if (p.ask === 'interest' || p.ask === 'balance') {
      const zc = P.interestCents(p.K, p.rate);
      const c = p.ask === 'balance' ? BigInt(p.K) * 100n + zc : zc;
      return P.rawOf(F(P.unscale(c, 2)));
    }
    if (p.ask === 'rate') return P.rawOf(P.viaExpr(`(${P.mach(p.K)}*${P.mach(p.rate)}/100)/${P.mach(p.K)}*100`));
    return P.rawOf(P.viaExpr(`(${P.mach(p.K)}*${P.mach(p.rate)}/100)*100/${P.mach(p.rate)}`));
  },
};
function trunc2(f) { const x = F(f).mul(100); return F(x.n / x.d).div(100); }

// ================================================================== compound interest
/**
 * Template ch6.interest.simple_compound.compound (families iterative_table, compare_offers)
 * Levels
 *  L3 Anspruchsvoll  Zinseszins Jahr für Jahr: fill a table (Zinsen and Guthaben for 2–3 years) or give the balance
 *                    after 2–5 years.
 *  L4 Transfer       compare two savings offers over 3–5 years: constant rate vs rising rates (Zinstreppe), or
 *                    compound interest vs a higher rate whose interest is paid out (no Zinseszins).
 * Misconceptions: simple_for_compound (interest of year 1 every year), add_rates (Zinstreppe judged by the sum of
 *   the rates). Rounding paths are made to agree by a constraint (D55), so cent rounding is not a trap here.
 * Build path: Fractions with yearly Fraction.round(2). Independent solver: BigInt cents with own half-up rounding.
 */
const compound = {
  id: `${SKILL}.compound`, version: 1, skillId: SKILL,
  families: ['iterative_table', 'compare_offers'],
  levels: [3, 4],
  levelNotes: {
    3: 'Zinseszins Jahr für Jahr: Tabelle für 2–3 Jahre ausfüllen oder Guthaben nach 2–5 Jahren.',
    4: 'Zwei Sparangebote vergleichen (Zinstreppe oder Auszahlung der Zinsen ohne Zinseszins).',
  },
  misconceptions: ['simple_for_compound', 'add_rates'],
  sample(rng, level) {
    const name = rng.int(0, NAMES.length - 1);
    if (level === 3) {
      const table = rng.bool();
      return { v: table ? 'table' : 'final', K: String(rng.int(4, 120) * 50), rate: rng.pick(RATES.slice(2)), years: table ? rng.int(2, 3) : rng.int(2, 5), name };
    }
    const K = String(rng.int(4, 40) * 250);
    if (rng.bool()) {
      const r = F(rng.pick(['1.5', '2', '2.5', '3', '3.5'])), d = F(rng.pick(['0.5', '1'])), shift = F(rng.pick(['-0.25', '0', '0', '0.25']));
      const stairs = [r.sub(d).add(shift), r.add(shift), r.add(d).add(shift)].map(dstr);
      return { v: 'stairs', K, rate: dstr(r), stairs, years: 3, name };
    }
    const r = F(rng.pick(['1.5', '2', '2.5', '3']));
    return { v: 'payout', K, rate: dstr(r), payRate: dstr(r.add(F(rng.pick(['0.05', '0.1', '0.15', '0.2', '0.25'])))), years: rng.int(3, 5), name };
  },
  constraints(p) {
    if (p.v === 'table' || p.v === 'final') return pathsAgree(p.K, p.rate, p.years) ? true : 'rounding paths differ';
    const [a, b] = offerTotals(p);
    if (a.sub(b).abs().cmp(F(1).div(20)) < 0) return 'offers too close';
    if (p.v === 'stairs' && !pathsAgree(p.K, p.rate, p.years)) return 'rounding paths differ';
    return true;
  },
  signatureParams(p) { const { name, ...rest } = p; return rest; },
  build(p) {
    const who = NAMES[p.name];
    if (p.v === 'stairs' || p.v === 'payout') return buildOffers(p, who);
    const K = F(p.K), r = F(p.rate), rows = yearByYear(K, r, p.years);
    const intro = `${who} legt ${eur(K)} zu einem Zinssatz von ${pct(r)} pro Jahr an. Die Zinsen werden jedes Jahr am Jahresende gutgeschrieben und im nächsten Jahr mitverzinst.`;
    const stepsRows = rows.map((row, i) => `Jahr ${i + 1}: Zinsen ${$(`${eur2Tex(row.start)} \\cdot ${texNum(r.div(100))} \\approx ${eur2Tex(row.z)}`)} €, Guthaben ${$(`${eur2Tex(row.start)} + ${eur2Tex(row.z)} = ${eur2Tex(row.end)}`)} €.`.replace('\\approx', fits(row.start.mul(r).div(100), 2) ? '=' : '\\approx'));
    const simple = K.add(rows[0].z.mul(p.years));
    const hintsCommon = ['Zinseszins: Die Zinsen eines Jahres kommen zum Guthaben dazu und werden im nächsten Jahr mitverzinst. Der Grundwert wächst also jedes Jahr.',
      'Rechne Jahr für Jahr: Zinsen = Guthaben am Jahresanfang mal Zinssatz; neues Guthaben = altes Guthaben plus Zinsen. Runde die Zinsen jedes Jahr auf Cent.'];
    const alt = `Mit dem Faktor ${$(texNum(F(1).add(r.div(100))))}: Multipliziere das Guthaben jedes Jahr mit diesem Faktor, z. B. ${$(`${eur2Tex(K)} \\cdot ${texNum(F(1).add(r.div(100)))} = ${eur2Tex(rows[0].end)}`)}.`;
    if (p.v === 'table') {
      const cells = [], grid = { columns: ['Jahr', 'Zinsen (€)', 'Guthaben am Jahresende (€)'], rows: [[{ text: '0' }, { text: '–' }, { text: m(K) }]] };
      rows.forEach((row, i) => {
        const zSpec = money(row.z, true), eSpec = money(row.end, true);
        if (i > 0) {
          zSpec.distractors = dist(zSpec, [{ value: rows[0].z, category: 'concept_confusion', feedback: 'Im zweiten Jahr wird das neue Guthaben (mit den Zinsen) verzinst, nicht mehr das Anfangskapital.' }]);
          eSpec.distractors = dist(eSpec, [{ value: K.add(rows[0].z.mul(i + 1)), category: 'concept_confusion', feedback: 'Bei Zinseszins wachsen die Zinsen jedes Jahr – du hast jedes Jahr dieselben Zinsen addiert.' }]);
        }
        cells.push({ id: `z${i + 1}`, label: `Zinsen im Jahr ${i + 1} (€)`, spec: zSpec }, { id: `k${i + 1}`, label: `Guthaben am Ende von Jahr ${i + 1} (€)`, spec: eSpec });
        grid.rows.push([{ text: String(i + 1) }, { cell: `z${i + 1}` }, { cell: `k${i + 1}` }]);
      });
      return {
        prompt: `${intro} Fülle die Tabelle aus.`,
        instructions: 'Runde die Zinsen jedes Jahr auf Cent. Trage Beträge in € ein, z. B. 12,34.',
        answer: { type: 'table', cells, grid },
        hints: hints(hintsCommon[0], hintsCommon[1], stepsRows[0], stepsRows, alt),
        solution: { steps: stepsRows, result: rows.map((row, i) => `Jahr ${i + 1}: ${m(row.z)} €; ${m(row.end)} €`).join(' · ') },
      };
    }
    const last = rows[rows.length - 1].end;
    const spec = money(last, true);
    spec.distractors = dist(spec, [
      { value: simple, category: 'concept_confusion', feedback: `Das wäre das Guthaben ohne Zinseszins (jedes Jahr ${eur(rows[0].z)}). Bei Zinseszins werden auch die Zinsen mitverzinst.` },
      { value: rows.length > 1 ? rows[rows.length - 2].end : K, category: 'concept_confusion', feedback: 'Zähle die Jahre nach: Du hast ein Jahr zu wenig gerechnet.' },
    ]);
    return {
      prompt: `${intro} Wie hoch ist das Guthaben nach ${p.years} Jahren?`,
      instructions: 'Runde die Zinsen jedes Jahr auf Cent. Die Einheit € kannst du weglassen.',
      answer: spec,
      hints: hints(hintsCommon[0], hintsCommon[1], stepsRows[0], [...stepsRows, `Ohne Zinseszins wären es nur ${eur(simple)}.`], alt),
      solution: { steps: stepsRows, result: `${m(last)} €` },
    };
  },
  /** Independent: BigInt cents, year by year. */
  solve(p) {
    if (p.v === 'stairs' || p.v === 'payout') {
      const a = centsYears(p.K, p.rate, p.years).pop().end;
      const b = p.v === 'stairs' ? centsYears(p.K, null, p.years, p.stairs).pop().end
        : BigInt(p.K) * 100n + BigInt(p.years) * P.interestCents(p.K, p.payRate);
      return a > b ? 'A' : 'B';
    }
    const ys = centsYears(p.K, p.rate, p.years);
    if (p.v === 'final') return P.rawOf(F(P.unscale(ys[ys.length - 1].end, 2)));
    const o = {};
    ys.forEach((y, i) => { o[`z${i + 1}`] = P.deNum(F(P.unscale(y.z, 2))); o[`k${i + 1}`] = P.deNum(F(P.unscale(y.end, 2))); });
    return o;
  },
};

/** Final amounts (Guthaben incl. interest) of offer A and B, build path. */
function offerTotals(p) {
  const K = F(p.K);
  const a = yearByYear(K, p.rate, p.years).pop().end;
  if (p.v === 'stairs') {
    let k = K; for (const s of p.stairs) k = k.add(k.mul(F(s)).div(100).round(2));
    return [a, k];
  }
  return [a, K.add(K.mul(F(p.payRate)).div(100).round(2).mul(p.years))];
}
function buildOffers(p, who) {
  const K = F(p.K), r = F(p.rate), [a, b] = offerTotals(p);
  const A = `Angebot A: ${pct(r)} Zinsen pro Jahr, die Zinsen werden mitverzinst (Zinseszins).`;
  const B = p.v === 'stairs'
    ? `Angebot B: Zinstreppe mit ${p.stairs.map((s, i) => `${pct(F(s))} im ${i + 1}. Jahr`).join(', ')}; die Zinsen werden mitverzinst.`
    : `Angebot B: ${pct(F(p.payRate))} Zinsen pro Jahr, die Zinsen werden aber jedes Jahr ausgezahlt (kein Zinseszins).`;
  const correct = a.cmp(b) > 0 ? 'A' : 'B';
  const rowsA = yearByYear(K, r, p.years);
  const steps = [`A: ${rowsA.map(row => m(row.end)).join(' → ')} € (Zinsen insgesamt ${eur(a.sub(K))}).`];
  if (p.v === 'stairs') {
    let k = K; const parts = [];
    for (const s of p.stairs) { k = k.add(k.mul(F(s)).div(100).round(2)); parts.push(m(k)); }
    steps.push(`B: ${parts.join(' → ')} € (Zinsen insgesamt ${eur(b.sub(K))}).`);
  } else {
    const z = K.mul(F(p.payRate)).div(100).round(2);
    steps.push(`B: jedes Jahr ${$(`${texNum(K)} \\cdot ${texNum(F(p.payRate).div(100))} \\approx ${eur2Tex(z)}`)} €, in ${p.years} Jahren ${$(`${p.years} \\cdot ${eur2Tex(z)} = ${eur2Tex(z.mul(p.years))}`)} €.`.replace('\\approx', fits(K.mul(F(p.payRate)).div(100), 2) ? '=' : '\\approx'));
  }
  steps.push(`Angebot ${correct} bringt ${eur(a.sub(b).abs())} mehr.`);
  const addFb = p.v === 'stairs' ? 'Die Summe der Zinssätze allein entscheidet nicht: Bei Zinseszins kommt es darauf an, wann welcher Zinssatz gilt. Rechne beide Angebote Jahr für Jahr durch.'
    : 'Rechne beide Angebote aus: Ein höherer Zinssatz ohne Zinseszins kann weniger bringen als ein niedrigerer mit Zinseszins – oder auch nicht.';
  const opt = (id, text) => (id === correct ? { id, text } : { id, text, category: 'concept_confusion', feedback: id === 'eq' ? 'Die beiden Angebote bringen nicht genau gleich viel. Rechne beide Jahr für Jahr aus.' : addFb });
  const options = [opt('A', 'Angebot A bringt mehr.'), opt('B', 'Angebot B bringt mehr.'), opt('eq', 'Beide bringen gleich viel.')];
  return {
    prompt: `${who} möchte ${eur(K)} für ${p.years} Jahre anlegen und vergleicht zwei Angebote. Welches bringt am Ende mehr Geld?`,
    promptLines: [A, B],
    instructions: 'Runde die Zinsen jedes Jahr auf Cent.',
    answer: { type: 'choice', options, correct, canonical: correct },
    hints: hints('Vergleiche, wie viel Geld am Ende insgesamt da ist (bzw. wie viel Zinsen es insgesamt gibt).',
      'Rechne beide Angebote Jahr für Jahr durch. Bei Zinseszins wird jedes Jahr das neue Guthaben verzinst.', steps[0], steps,
      p.v === 'stairs' ? 'Überlege: Bei der Zinstreppe gilt der hohe Zinssatz erst am Ende, dafür auf ein größeres Guthaben. Nur die Rechnung zeigt, was überwiegt.' : 'Ohne Zinseszins gibt es jedes Jahr gleich viel Zinsen. Mit Zinseszins wachsen die Zinsen von Jahr zu Jahr.'),
    solution: { steps, result: `Angebot ${correct} (${eur(correct === 'A' ? a : b)} gegenüber ${eur(correct === 'A' ? b : a)})` },
  };
}

module.exports = [yearly, compound];
