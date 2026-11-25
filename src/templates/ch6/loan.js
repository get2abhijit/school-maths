'use strict';
/**
 * Skill ch6.interest.loan — Kredit und Tilgung (LS7 VI.6). All contexts are original.
 * Model (stated in every task): a loan with a fixed yearly rate R paid at the end of each year. From R, first the
 * interest on the CURRENT debt (Restschuld) is paid; the rest is Tilgung and reduces the debt. In the last year only
 * the remaining debt plus its interest is paid.
 * Rounding (D55): interest is rounded to cents each year; instances are only published if rounding at the very end
 * gives the same values to within half a cent in every row.
 */
const { hints, $ } = require('../util');
const P = require('./pct');
const { F, texNum, pct, eur, eur2, eur2Tex } = P;

const SKILL = 'ch6.interest.loan';
const HALF_CENT = F(1).div(200);
const RATES = ['2', '2.5', '3', '3.5', '4', '4.5', '5', '6', '7', '8'];
const PURPOSES = ['ein gebrauchtes Auto', 'eine neue Küche', 'die Renovierung einer Wohnung', 'eine Solaranlage', 'die Einrichtung eines kleinen Ladens', 'eine neue Maschine für eine Werkstatt'];
const m = f => $(eur2Tex(f));
const fits = (f, pl) => F(f).round(pl).eq(F(f));

/** Build path (Fractions): rows until paid off (or `max` rows). */
function plan(S, rate, R, max = 40) {
  const rows = []; let s = F(S);
  for (let i = 1; i <= max && s.sign() > 0; i++) {
    const z = s.mul(F(rate)).div(100).round(2);
    const pay = s.add(z).cmp(F(R)) <= 0 ? s.add(z) : F(R);
    const t = pay.sub(z), e = s.sub(t);
    rows.push({ start: s, z, t, end: e, pay, last: e.isZero() });
    s = e;
  }
  return rows;
}
/** Unrounded rows (exact interest) for the first n years with the full rate. */
function planExact(S, rate, R, n) {
  const rows = []; let s = F(S);
  for (let i = 1; i <= n; i++) { const z = s.mul(F(rate)).div(100); const t = F(R).sub(z); rows.push({ z, t, end: s.sub(t) }); s = s.sub(t); }
  return rows;
}
function pathsAgree(S, rate, R, n) {
  const a = plan(S, rate, R, n), b = planExact(S, rate, R, n);
  return a.length === n && a.every((r, i) => ['z', 't', 'end'].every(k => r[k].sub(b[i][k]).abs().cmp(HALF_CENT) < 0));
}
/** Independent path: integer cents (BigInt). Returns rows [{z, t, end}] in cents until paid off. */
function centsPlan(S, rate, R) {
  let s = BigInt(S) * 100n; const r = BigInt(R) * 100n; const out = [];
  while (s > 0n && out.length < 40) {
    const z = P.interestCents(P.unscale(s, 2), rate);
    const pay = s + z <= r ? s + z : r;
    const t = pay - z; s -= t; out.push({ z, t, end: s });
  }
  return out;
}
const money = (f, rounded) => ({ type: 'decimal', value: F(f).toString(), tolerance: rounded ? HALF_CENT.toString() : '0', places: 2, unit: '€', canonical: eur2(f) });
function dist(spec, list) {
  const v = F(spec.value), tol = F(spec.tolerance || '0'), out = [];
  for (const d of list) {
    const x = F(d.value);
    if (x.sub(v).abs().cmp(tol) <= 0 || x.sign() < 0 || out.some(o => F(o.value).eq(x))) continue;
    if (spec.type === 'integer' && !x.isInteger()) continue;
    out.push({ ...d, value: x.toString() });
  }
  return out;
}
function intro(p) {
  return `Für ${PURPOSES[p.purpose]} wird ein Kredit über ${eur(F(p.S))} aufgenommen. Der Zinssatz beträgt ${pct(F(p.rate))} pro Jahr. Am Ende jedes Jahres werden ${eur(F(p.R))} zurückgezahlt (Rate). Davon werden zuerst die Zinsen für die aktuelle Restschuld bezahlt, der Rest ist die Tilgung.`;
}
function rowText(row, i, rate) {
  const zx = row.start.mul(F(rate)).div(100);
  return `Jahr ${i + 1}: Zinsen ${$(`${eur2Tex(row.start)} \\cdot ${texNum(F(rate).div(100))} ${fits(zx, 2) ? '=' : '\\approx'} ${eur2Tex(row.z)}`)} €, Tilgung ${$(`${eur2Tex(row.pay)} - ${eur2Tex(row.z)} = ${eur2Tex(row.t)}`)} €, Restschuld ${$(`${eur2Tex(row.start)} - ${eur2Tex(row.t)} = ${eur2Tex(row.end)}`)} €.`;
}
const ORIENT = 'Die Rate besteht aus zwei Teilen: Zinsen und Tilgung. Nur die Tilgung verringert die Restschuld.';
const STRAT = 'Zeile für Zeile: Zinsen = Restschuld am Jahresanfang mal Zinssatz. Tilgung = Rate minus Zinsen. Neue Restschuld = alte Restschuld minus Tilgung.';
const ALT = 'Denke an ein Tabellenkalkulationsprogramm: Jede Zeile wird mit denselben drei Rechnungen aus der Zeile davor berechnet. Die Zinsen werden jedes Jahr kleiner, die Tilgung größer.';

// ================================================================== repayment table
/**
 * Template ch6.interest.loan.table (family repayment_table)
 * Levels
 *  L1 Grundlagen  one row of the Tilgungsplan: Zinsen, Tilgung, Restschuld after year 1.
 *  L2 Standard    three rows (years 1–3).
 * Misconceptions: interest_on_original (interest always on the original loan), rate_is_repayment (whole rate
 *   subtracted from the debt).
 * Build path: Fractions with yearly Fraction.round(2). Independent solver: BigInt cents.
 */
const table = {
  id: `${SKILL}.table`, version: 1, skillId: SKILL,
  families: ['repayment_table'],
  levels: [1, 2],
  levelNotes: {
    1: 'Eine Zeile des Tilgungsplans: Zinsen, Tilgung und Restschuld nach einem Jahr.',
    2: 'Drei Zeilen des Tilgungsplans.',
  },
  misconceptions: ['interest_on_original', 'rate_is_repayment'],
  sample(rng, level) {
    const S = rng.int(4, 40) * 500, rate = rng.pick(RATES);
    const z1 = F(S).mul(F(rate)).div(100);
    const R = (Math.ceil(Number(z1.toDecimalString(0, '.')) / 100) + rng.int(level === 1 ? 2 : 3, 30)) * 100;
    return { S: String(S), rate, R: String(R), purpose: rng.int(0, PURPOSES.length - 1), years: level === 1 ? 1 : 3 };
  },
  constraints(p) {
    const rows = plan(p.S, p.rate, p.R, p.years);
    if (rows.length !== p.years || rows.some(r => r.last || r.end.sign() <= 0)) return 'paid off too early';
    if (F(p.R).cmp(F(p.S).div(2)) > 0) return 'rate too large';
    if (!pathsAgree(p.S, p.rate, p.R, p.years)) return 'rounding paths differ';
    return true;
  },
  signatureParams(p) { const { purpose, ...rest } = p; return rest; },
  build(p) {
    const S = F(p.S), R = F(p.R), rows = plan(S, p.rate, R, p.years);
    const cells = [];
    const grid = { columns: ['Jahr', 'Zinsen (€)', 'Tilgung (€)', 'Restschuld am Jahresende (€)'], rows: [[{ text: '0' }, { text: '–' }, { text: '–' }, { text: m(S) }]] };
    rows.forEach((row, i) => {
      const n = i + 1;
      const zs = money(row.z, true), ts = money(row.t, true), es = money(row.end, true);
      const origZ = S.mul(F(p.rate)).div(100).round(2);
      zs.distractors = dist(zs, i > 0 ? [{ value: origZ, category: 'concept_confusion', feedback: 'Die Zinsen werden auf die aktuelle Restschuld berechnet, nicht auf den ursprünglichen Kredit.' }] : []);
      ts.distractors = dist(ts, [{ value: R, category: 'concept_confusion', feedback: 'Die Rate ist nicht die Tilgung: Von der Rate werden zuerst die Zinsen bezahlt.' }]);
      es.distractors = dist(es, [{ value: row.start.sub(R), category: 'concept_confusion', feedback: 'Du hast die ganze Rate abgezogen. Die Restschuld sinkt nur um die Tilgung (Rate minus Zinsen).' }]);
      cells.push({ id: `z${n}`, label: `Zinsen im Jahr ${n} (€)`, spec: zs }, { id: `t${n}`, label: `Tilgung im Jahr ${n} (€)`, spec: ts }, { id: `e${n}`, label: `Restschuld am Ende von Jahr ${n} (€)`, spec: es });
      grid.rows.push([{ text: String(n) }, { cell: `z${n}` }, { cell: `t${n}` }, { cell: `e${n}` }]);
    });
    const steps = rows.map((row, i) => rowText(row, i, p.rate));
    return {
      prompt: `${intro(p)} Fülle den Tilgungsplan für ${p.years === 1 ? 'das erste Jahr' : `die ersten ${p.years} Jahre`} aus.`,
      instructions: 'Runde die Zinsen auf Cent. Trage Beträge in € ein, z. B. 1234,56.',
      answer: { type: 'table', cells, grid },
      hints: hints(ORIENT, STRAT, steps[0], steps, ALT),
      solution: { steps, result: rows.map((row, i) => `Jahr ${i + 1}: ${m(row.z)} €; ${m(row.t)} €; ${m(row.end)} €`).join(' · ') },
    };
  },
  /** Independent: BigInt cents. */
  solve(p) {
    const ys = centsPlan(p.S, p.rate, p.R).slice(0, p.years), o = {};
    ys.forEach((y, i) => { const n = i + 1; o[`z${n}`] = P.deNum(F(P.unscale(y.z, 2))); o[`t${n}`] = P.deNum(F(P.unscale(y.t, 2))); o[`e${n}`] = P.deNum(F(P.unscale(y.end, 2))); });
    return o;
  },
};

// ================================================================== duration and total interest
/**
 * Template ch6.interest.loan.duration (families loan_duration, loan_cost)
 * Levels
 *  L3 Anspruchsvoll  How many years until the loan is repaid (3–6 years, Tilgungsplan to the end)?
 *  L4 Transfer       Total interest paid until the loan is repaid (2–4 years), i.e. the cost of the loan.
 * Misconceptions: interest_on_original, ignore_interest (debt divided by the rate), last_payment_full (in the last
 *   year the full rate is paid).
 * Build path: Fractions. Independent solver: BigInt cents.
 */
const duration = {
  id: `${SKILL}.duration`, version: 1, skillId: SKILL,
  families: ['loan_duration', 'loan_cost'],
  levels: [3, 4],
  levelNotes: {
    3: 'Laufzeit bestimmen: Nach wie vielen Jahren ist der Kredit abbezahlt?',
    4: 'Kosten des Kredits: Wie viel Zinsen werden insgesamt bezahlt?',
  },
  misconceptions: ['interest_on_original', 'ignore_interest', 'last_payment_full'],
  sample(rng, level) {
    const S = rng.int(4, 30) * 500, rate = rng.pick(RATES);
    const n = level === 3 ? rng.int(3, 6) : rng.int(2, 4);
    const R = Math.ceil(S / n / 100) * 100 + rng.int(0, 4) * 100;
    return { S: String(S), rate, R: String(R), purpose: rng.int(0, PURPOSES.length - 1) };
  },
  constraints(p, level) {
    const rows = plan(p.S, p.rate, p.R);
    const n = rows.length;
    if (!rows[n - 1].last) return 'not repaid';
    if (level === 3 && (n < 3 || n > 6)) return 'duration out of range';
    if (level === 4 && (n < 2 || n > 4)) return 'duration out of range';
    if (rows[n - 1].pay.cmp(F(p.R).div(10)) < 0) return 'last payment tiny';
    if (!pathsAgree(p.S, p.rate, p.R, n - 1)) return 'rounding paths differ';
    if (level === 3 && Math.ceil(Number(p.S) / Number(p.R)) === n && !originalDuration(p)) return 'no misconception separates';
    if (level === 4) {
      const exactTotal = planExact(p.S, p.rate, p.R, n - 1).reduce((a, r) => a.add(r.z), F(0)).add(rows[n - 1].start.mul(F(p.rate)).div(100));
      const total = rows.reduce((a, r) => a.add(r.z), F(0));
      if (exactTotal.sub(total).abs().cmp(HALF_CENT) >= 0) return 'rounding paths differ (total)';
    }
    return true;
  },
  signatureParams(p) { const { purpose, ...rest } = p; return rest; },
  build(p, level) {
    const S = F(p.S), R = F(p.R), rows = plan(S, p.rate, R), n = rows.length, last = rows[n - 1];
    const steps = rows.map((row, i) => rowText(row, i, p.rate));
    const lastSum = $(`${eur2Tex(last.start)} + ${eur2Tex(last.z)} = ${eur2Tex(last.pay)}`);
    steps.splice(n - 1, 0, last.pay.eq(R)
      ? `Im Jahr ${n} sind Restschuld plus Zinsen ${lastSum} € – genau eine Rate.`
      : `Im Jahr ${n} reicht die Rate: Restschuld plus Zinsen sind nur noch ${lastSum} € (weniger als ${eur(R)}). Es wird nur noch dieser Betrag gezahlt.`);
    if (level === 3) {
      const wrong = [{ value: F(Math.ceil(Number(p.S) / Number(p.R))), category: 'concept_confusion', feedback: 'Du hast die Zinsen nicht berücksichtigt. Von jeder Rate geht ein Teil für Zinsen weg – nur die Tilgung verringert die Schuld.' }];
      const od = originalDuration(p);
      if (od) wrong.push({ value: F(od), category: 'concept_confusion', feedback: 'Die Zinsen werden jedes Jahr auf die aktuelle Restschuld berechnet, nicht immer auf den ursprünglichen Kredit. Dadurch wird die Tilgung jedes Jahr größer.' });
      const spec = { type: 'integer', value: String(n), unit: 'Jahre', canonical: String(n) };
      spec.distractors = dist(spec, wrong);
      return {
        prompt: `${intro(p)} Nach wie vielen Jahren ist der Kredit vollständig zurückgezahlt?`,
        instructions: 'Gib die Anzahl der Jahre an. Runde die Zinsen auf Cent.',
        answer: spec,
        hints: hints(ORIENT, `${STRAT} Rechne so lange weiter, bis keine Restschuld mehr übrig ist.`, steps[0], [...steps, `Der Kredit ist nach ${n} Jahren zurückgezahlt.`], ALT),
        solution: { steps: [...steps, `Der Kredit ist nach ${n} Jahren zurückgezahlt.`], result: `${$(String(n))} Jahre` },
      };
    }
    const total = rows.reduce((a, r) => a.add(r.z), F(0));
    const spec = money(total, true);
    spec.distractors = dist(spec, [
      { value: S.mul(F(p.rate)).div(100).round(2).mul(n), category: 'concept_confusion', feedback: 'Die Zinsen werden jedes Jahr auf die aktuelle Restschuld berechnet, nicht immer auf den ursprünglichen Kredit.' },
      { value: R.mul(n).sub(S), category: 'concept_confusion', feedback: 'Im letzten Jahr wird nicht die volle Rate gezahlt, sondern nur noch die Restschuld plus Zinsen.' },
      { value: rows[0].z, category: 'concept_confusion', feedback: 'Das sind nur die Zinsen des ersten Jahres. Gefragt sind die Zinsen für die ganze Laufzeit.' },
    ]);
    const sumLine = `Zinsen insgesamt: ${$(rows.map(r => eur2Tex(r.z)).join(' + ') + ` = ${eur2Tex(total)}`)} €.`;
    const check = `Probe: Gezahlt wurden ${$(`${n - 1 > 0 ? `${n - 1} \\cdot ${eur2Tex(R)} + ` : ''}${eur2Tex(last.pay)} = ${eur2Tex(R.mul(n - 1).add(last.pay))}`)} €; davon ${eur(S)} Kredit, der Rest sind Zinsen.`;
    return {
      prompt: `${intro(p)} Wie viel Zinsen werden insgesamt bezahlt, bis der Kredit vollständig zurückgezahlt ist?`,
      instructions: 'Runde die Zinsen jedes Jahr auf Cent. Die Einheit € kannst du weglassen.',
      answer: spec,
      hints: hints(ORIENT, `${STRAT} Addiere am Ende die Zinsen aller Jahre.`, steps[0], [...steps, sumLine], `Alles, was insgesamt zurückgezahlt wird, minus die Kreditsumme ergibt die Zinsen. ${check}`),
      solution: { steps: [...steps, sumLine, check], result: `${m(total)} €` },
    };
  },
  /** Independent: BigInt cents to the end. */
  solve(p, level) {
    const ys = centsPlan(p.S, p.rate, p.R);
    if (level === 3) return String(ys.length);
    return P.deNum(F(P.unscale(ys.reduce((a, y) => a + y.z, 0n), 2)));
  },
};
/** Years if the interest were always charged on the original loan (constant Tilgung); null if not repayable. */
function originalDuration(p) {
  const t = F(p.R).sub(F(p.S).mul(F(p.rate)).div(100));
  if (t.sign() <= 0) return null;
  const q = F(p.S).div(t);
  const n = Number(q.n / q.d) + (q.isInteger() ? 0 : 1);
  return n;
}

module.exports = [table, duration];
