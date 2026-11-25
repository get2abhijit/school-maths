'use strict';
/**
 * Skill ch6.pct.compare — Anteile vergleichen – Prozente (LS7 VI.1). All contexts are original.
 */
const { hints, $ } = require('../util');
const P = require('./pct');
const { F, deNum, texNum, pctTex } = P;

const SKILL = 'ch6.pct.compare';

// ================================================================== convert
const DENOMS = { 1: [2, 4, 5, 10, 20, 25, 50, 100], 2: [8, 16, 40, 80, 125, 200, 250, 400, 1000, 4, 5, 20, 50] };
const DIRS = ['frac2pct', 'dec2pct', 'pct2dec', 'pct2frac'];

/**
 * Template ch6.pct.compare.convert (family convert)
 * Levels
 *  L1 Grundlagen  Halbe, Viertel, Fünftel, Zehntel, Zwanzigstel, Fünfundzwanzigstel, Fünfzigstel, Hundertstel ↔ ganze Prozent.
 *  L2 Standard    Achtel, Sechzehntel, Tausendstel …: Prozentsätze mit Komma (37,5 %), über 100 % und unter 1 %.
 * Four directions: Bruch → %, Dezimalzahl → %, % → Dezimalzahl, % → gekürzter Bruch.
 * Misconceptions: shift_two_places (comma moved by one place or not at all; ×100 forgotten), numerator_as_percent
 *   (3/4 → „3 %“), not reduced (generic engine feedback).
 * Build path: Fraction arithmetic. Independent solver: the expression engine evaluates "n/d*100", "q/100" etc.
 */
const convert = {
  id: `${SKILL}.convert`, version: 1, skillId: SKILL,
  families: ['convert'],
  levels: [1, 2],
  levelNotes: {
    1: 'Einfache Brüche (Halbe, Viertel, Fünftel, Zehntel …) in ganze Prozent umwandeln und zurück.',
    2: 'Achtel, Tausendstel …: Prozentsätze mit Komma, über 100 % und unter 1 %.',
  },
  misconceptions: ['shift_two_places', 'numerator_as_percent'],
  sample(rng, level) {
    const d = rng.pick(DENOMS[level]);
    const n = level === 1 ? rng.int(1, d - 1) : rng.int(1, 2 * d);
    return { dir: rng.pick(DIRS), n, d };
  },
  constraints(p, level) {
    const q = F(p.n).div(p.d);
    if (q.eq(1) || q.isZero()) return 'trivial share';
    const pc = q.mul(100);
    if (level === 1 && !pc.isInteger()) return 'L1 needs whole percent';
    if (level === 2 && pc.isInteger() && pc.cmp(1) >= 0 && pc.cmp(100) <= 0) return 'L2 needs a non-trivial percent';
    if (P.placesOf(pc) > 2) return 'too many decimals';
    if (p.dir === 'frac2pct' && level === 2 && p.d >= 400 && p.n % 5 === 0 && F(p.n).div(p.d).d <= 50) return 'fraction too easy to expand';
    return true;
  },
  signatureParams(p) { return { dir: p.dir, q: F(p.n).div(p.d).toString() }; },
  build(p) {
    const q = F(p.n).div(p.d), pc = q.mul(100);
    const fracTex = `\\frac{${p.n}}{${p.d}}`, decT = texNum(q), pcT = pctTex(pc);
    const qr = `\\frac{${q.n}}{${q.d}}`;
    let prompt, answer, steps, result, strategy, step;
    const via100 = 100 % p.d === 0;
    if (p.dir === 'frac2pct' || p.dir === 'dec2pct') {
      const wrong = [{ value: q, category: 'concept_confusion', feedback: 'Das ist der Anteil als Dezimalzahl. Für den Prozentsatz rechnest du noch mal 100.' }];
      if (p.dir === 'frac2pct' && !F(p.n).eq(pc)) wrong.push({ value: F(p.n), category: 'concept_confusion', feedback: 'Der Zähler allein ist noch kein Prozentsatz. Erweitere auf Hundertstel oder teile Zähler durch Nenner.' });
      if (p.dir === 'dec2pct') wrong.push({ value: q.mul(10), category: 'concept_confusion', feedback: 'Verschiebe das Komma um ZWEI Stellen nach rechts (mal 100).' });
      answer = { type: 'decimal', value: pc.toString(), tolerance: '0', unit: '%', canonical: deNum(pc), distractors: dist(pc, wrong) };
      if (p.dir === 'frac2pct') {
        prompt = `Schreibe den Anteil ${$(fracTex)} als Prozentsatz.`;
        steps = via100
          ? [`Erweitere auf Hundertstel: ${$(`${fracTex} = \\frac{${p.n * (100 / p.d)}}{100}`)}.`, `${$(`\\frac{${p.n * (100 / p.d)}}{100} = ${pcT}`)}`]
          : [`Teile Zähler durch Nenner: ${$(`${p.n} : ${p.d} = ${decT}`)}.`, `Mal 100: ${$(`${decT} = ${pcT}`)}`];
        strategy = via100 ? 'Erweitere den Bruch so, dass im Nenner 100 steht. Der Zähler ist dann der Prozentsatz.' : 'Rechne den Bruch als Dezimalzahl aus (Zähler geteilt durch Nenner) und multipliziere mit 100.';
        step = steps[0];
      } else {
        prompt = `Schreibe die Dezimalzahl ${$(decT)} als Prozentsatz.`;
        steps = [`${$(`${decT} = \\frac{${texNum(pc)}}{100}`)} (Hundertstel)`, `${$(`\\frac{${texNum(pc)}}{100} = ${pcT}`)}`];
        strategy = 'Prozent heißt Hundertstel. Multipliziere mit 100: Das Komma rückt zwei Stellen nach rechts.';
        step = `${$(`${decT} \\cdot 100 = ${texNum(pc)}`)}`;
      }
      result = $(pcT);
    } else if (p.dir === 'pct2dec') {
      const wrong = [
        { value: pc, category: 'concept_confusion', feedback: 'Prozent heißt Hundertstel: Teile den Prozentsatz durch 100.' },
        { value: pc.div(10), category: 'concept_confusion', feedback: 'Verschiebe das Komma um ZWEI Stellen nach links (geteilt durch 100).' },
      ];
      prompt = `Schreibe ${$(pcT)} als Dezimalzahl.`;
      answer = { type: 'decimal', value: q.toString(), tolerance: '0', canonical: deNum(q), distractors: dist(q, wrong) };
      steps = [`${$(`${pcT} = \\frac{${texNum(pc)}}{100}`)}`, `${$(`\\frac{${texNum(pc)}}{100} = ${decT}`)}`];
      strategy = 'Prozent heißt Hundertstel. Teile durch 100: Das Komma rückt zwei Stellen nach links.';
      step = steps[0];
      result = $(decT);
    } else {
      prompt = `Schreibe ${$(pcT)} als vollständig gekürzten Bruch.`;
      const wrong = [];
      if (!pc.eq(0) && !F(100).div(pc).eq(q)) wrong.push({ value: F(100).div(pc), category: 'concept_confusion', feedback: 'Der Prozentsatz gehört in den Zähler: p % = p/100.' });
      answer = { type: 'fraction', value: q.toString(), requireReduced: true, canonical: `${q.n}/${q.d}`, distractors: dist(q, wrong) };
      const pl = P.placesOf(pc);
      const intN = pc.mul(10 ** pl);
      steps = [`${$(`${pcT} = \\frac{${texNum(pc)}}{100}`)}`];
      if (pl > 0) steps.push(`Erweitere mit ${10 ** pl}, damit der Zähler ganz ist: ${$(`\\frac{${intN}}{${100 * 10 ** pl}}`)}`);
      steps.push(`Kürze vollständig: ${$(`\\frac{${intN}}{${100 * 10 ** pl}} = ${qr}`)}`);
      strategy = 'Schreibe den Prozentsatz als Hundertstel-Bruch und kürze so weit wie möglich.';
      step = steps[0];
      result = $(qr);
    }
    return {
      prompt,
      ...(answer.unit ? { instructions: 'Das Prozentzeichen kannst du weglassen.' } : {}),
      answer,
      hints: hints(
        'Prozent bedeutet Hundertstel: $1\\,\\% = \\frac{1}{100} = 0{,}01$.',
        strategy, step, steps,
        'Merkhilfen: $\\frac{1}{2} = 50\\,\\%$, $\\frac{1}{4} = 25\\,\\%$, $\\frac{1}{5} = 20\\,\\%$, $\\frac{1}{8} = 12{,}5\\,\\%$, $\\frac{1}{10} = 10\\,\\%$. Setze daraus zusammen, z. B. $\\frac{3}{8} = 3 \\cdot 12{,}5\\,\\%$.'),
      solution: { steps, result },
    };
  },
  /** Independent: expression engine. */
  solve(p) {
    if (p.dir === 'frac2pct') return P.rawOf(P.viaExpr(`${p.n}/${p.d}*100`));
    if (p.dir === 'dec2pct') return P.rawOf(P.viaExpr(`${P.mach(F(p.n).div(p.d))}*100`));
    const v = P.viaExpr(`${p.n}/${p.d}`);
    return p.dir === 'pct2dec' ? P.rawOf(v) : `${v.n}/${v.d}`;
  },
};
function dist(answer, list) {
  const out = [];
  for (const d of list) {
    const v = F(d.value);
    if (v.eq(answer) || out.some(o => F(o.value).eq(v))) continue;
    out.push({ ...d, value: v.toString() });
  }
  return out;
}

// ================================================================== compare shares
const CTX = {
  pets: {
    groups: ['7a', '7b', '7c', '7d'],
    label: g => `Klasse ${g}`,
    line: (g, a, b) => `In der Klasse ${g} haben ${a} von ${b} Kindern ein Haustier.`,
    item: (g, a, b) => `Klasse ${g}: ${a} von ${b} Kindern`,
    question: 'In welcher Klasse ist der Anteil der Kinder mit Haustier größer?',
    rank: 'Ordne die Klassen nach dem Anteil der Kinder mit Haustier, den größten Anteil zuerst.',
    rest: 'Kinder ohne Haustier',
  },
  shots: {
    groups: ['Lea', 'Ben', 'Aylin', 'Tom'],
    label: g => g,
    line: (g, a, b) => `${g} trifft bei ${b} Freiwürfen ${a}-mal.`,
    item: (g, a, b) => `${g}: ${a} Treffer bei ${b} Würfen`,
    question: 'Wer hat die bessere Trefferquote, also den größeren Anteil an Treffern?',
    rank: 'Ordne nach der Trefferquote, die beste zuerst.',
    rest: 'Fehlwürfe',
  },
  bike: {
    groups: ['5', '6', '7', '8'],
    label: g => `Klassenstufe ${g}`,
    line: (g, a, b) => `In Klassenstufe ${g} kommen ${a} von ${b} Schülerinnen und Schülern mit dem Fahrrad.`,
    item: (g, a, b) => `Klassenstufe ${g}: ${a} von ${b}`,
    question: 'In welcher Klassenstufe ist der Anteil der Radfahrer größer?',
    rank: 'Ordne die Klassenstufen nach dem Anteil der Radfahrer, den größten zuerst.',
    rest: 'Schülerinnen und Schüler ohne Fahrrad',
  },
};
const CTX_KEYS = Object.keys(CTX);
const SHARE_DENOMS_L1 = [10, 20, 25, 50];

/** "\frac{12}{30} = 40\,\%" or "\frac{5}{12} \approx 41{,}7\,\%". */
function shareTex(a, b) {
  const pc = F(a).div(b).mul(100);
  const exact = P.placesOf(pc) <= 1 && pc.isTerminatingDecimal();
  return `\\frac{${a}}{${b}} ${exact ? '=' : '\\approx'} ${pctTex(exact ? pc : pc.round(1))}`;
}
const cmpShare = (g, h) => F(g.a).div(g.b).cmp(F(h.a).div(h.b));

/**
 * Template ch6.pct.compare.shares (family compare_shares)
 * Levels
 *  L1 Grundlagen    two shares with denominators 10, 20, 25, 50 (expand to hundredths); which is larger?
 *  L2 Standard      group sizes 12…40; the group with MORE members having the property has the SMALLER share
 *                   (or both shares are equal) — absolute counts mislead.
 *  L3 Anspruchsvoll rank four groups by share (ordering); the order of the absolute counts is different.
 *  L4 Transfer      choose the statement that is correct AND correctly justified (absolute vs relative,
 *                   "cannot compare", right result with wrong reason).
 * Misconceptions: absolute_vs_relative.
 * Build path: Fraction comparison. Independent solver: integer cross-multiplication a1·b2 vs a2·b1.
 */
const shares = {
  id: `${SKILL}.shares`, version: 1, skillId: SKILL,
  families: ['compare_shares'],
  levels: [1, 2, 3, 4],
  levelNotes: {
    1: 'Zwei Anteile mit Nenner 10, 20, 25 oder 50 vergleichen (auf Hundertstel erweitern).',
    2: 'Unterschiedlich große Gruppen: Die größere Anzahl hat den kleineren Anteil (oder beide sind gleich).',
    3: 'Vier Gruppen nach ihrem Anteil ordnen; die Anzahlen allein führen zu einer anderen Reihenfolge.',
    4: 'Aussagen über Anteile beurteilen: richtig und richtig begründet?',
  },
  misconceptions: ['absolute_vs_relative'],
  sample(rng, level) {
    const ctx = rng.pick(CTX_KEYS);
    const order = rng.shuffle([0, 1, 2, 3]);
    if (level === 1) {
      const g = [0, 1].map(() => { const b = rng.pick(SHARE_DENOMS_L1); return { a: rng.int(1, b - 1), b }; });
      return { ctx, order, groups: g };
    }
    if (level === 2 && rng.int(0, 4) === 0) {
      const v = rng.int(2, 6), u = rng.int(1, v - 1), m1 = rng.int(2, 8), m2 = rng.int(2, 8);
      return { ctx, order, groups: [{ a: u * m1, b: v * m1 }, { a: u * m2, b: v * m2 }] };
    }
    const k = level === 3 ? 4 : 2, hi = level === 3 ? 60 : 40;
    const g = Array.from({ length: k }, () => { const b = rng.int(12, hi); return { a: rng.int(2, b - 2), b }; });
    return { ctx, order, groups: g, perm: rng.shuffle(['a', 'b', 'c', 'd']) };
  },
  constraints(p, level) {
    const g = p.groups;
    if (new Set(g.map(x => x.b)).size !== g.length) return 'equal group sizes';
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const c = cmpShare(g[i], g[j]);
      if (c === 0 && !(level === 2)) return 'equal shares';
      const diff = F(g[i].a).div(g[i].b).sub(F(g[j].a).div(g[j].b)).abs().mul(100);
      if (c !== 0 && diff.cmp(level === 1 ? 2 : 1) < 0) return 'shares too close';
      if (g[i].a === g[j].a) return 'equal counts';
    }
    if (level === 2 || level === 4) {
      const c = cmpShare(g[0], g[1]);
      if (c !== 0) { const big = c > 0 ? 0 : 1; if (g[big].a > g[1 - big].a) return 'no absolute trap'; }
      if (level === 4) {
        if (c === 0) return 'L4 needs different shares';
        const big = c > 0 ? 0 : 1, small = 1 - big;
        if (!(g[big].b - g[big].a < g[small].b - g[small].a)) return 'complement statement would be false';
      }
    }
    if (level === 3) {
      const byShare = [0, 1, 2, 3].sort((i, j) => cmpShare(g[j], g[i]));
      const byCount = [0, 1, 2, 3].sort((i, j) => g[j].a - g[i].a);
      if (byShare.join() === byCount.join()) return 'counts give the same order';
      if (byShare.map(i => 'abcd'[i]).join() === p.perm.join()) return 'shown order already correct';
    }
    return true;
  },
  signatureParams(p) { return { ctx: p.ctx, groups: p.groups }; },
  build(p, level) {
    const C = CTX[p.ctx];
    const names = p.groups.map((_, i) => C.groups[p.order[i]]);
    const lines = p.groups.map((g, i) => C.line(names[i], g.a, g.b));
    const calc = p.groups.map((g, i) => `${C.label(names[i])}: ${$(shareTex(g.a, g.b))}`);
    const expandHint = level === 1
      ? `Erweitere auf Hundertstel, z. B. ${$(`\\frac{${p.groups[0].a}}{${p.groups[0].b}} = \\frac{${p.groups[0].a * (100 / p.groups[0].b)}}{100}`)}.`
      : `Rechne den ersten Anteil aus: ${calc[0]}.`;
    const orient = 'Die Gruppen sind verschieden groß. Vergleiche deshalb nicht die Anzahlen, sondern die Anteile.';
    const strategy = 'Schreibe jeden Anteil als Bruch „Anzahl von Gesamtzahl“ und rechne ihn in Prozent um. Dann kannst du vergleichen.';
    const alt = 'Stell dir vor, jede Gruppe hätte genau 100 Mitglieder: Wie viele hätten dann die Eigenschaft? Das ist der Prozentsatz.';
    if (level === 3) {
      const ids = ['a', 'b', 'c', 'd'];
      const items = p.groups.map((g, i) => ({ id: ids[i], text: C.item(names[i], g.a, g.b) }));
      const correctOrder = [0, 1, 2, 3].sort((i, j) => cmpShare(p.groups[j], p.groups[i]));
      const shown = p.perm.map(id => items[ids.indexOf(id)]);
      const steps = [...calc, `Reihenfolge: ${correctOrder.map(i => C.label(names[i])).join(' > ')}`];
      return {
        prompt: `${lines.join(' ')} ${C.rank}`,
        answer: { type: 'ordering', items: shown, correct: correctOrder.map(i => ids[i]), canonical: correctOrder.map(i => ids[i]) },
        hints: hints(orient, strategy, `${calc[0]}; ${calc[1]}.`, steps, alt),
        solution: { steps, result: correctOrder.map(i => C.label(names[i])).join(' > ') },
      };
    }
    const c = cmpShare(p.groups[0], p.groups[1]);
    if (level === 4) {
      const big = c > 0 ? 0 : 1, small = 1 - big;
      const B = p.groups[big], S = p.groups[small];
      const opts = {
        a: { text: `${C.label(names[big])} hat den größeren Anteil, denn ${$(shareTex(B.a, B.b))} ist mehr als ${$(shareTex(S.a, S.b))}.` },
        b: { text: `${C.label(names[small])} hat den größeren Anteil, denn dort sind es ${S.a} statt ${B.a}.`, category: 'concept_confusion', feedback: 'Du vergleichst Anzahlen. Die Gruppen sind verschieden groß – entscheidend ist der Anteil, also Anzahl geteilt durch Gesamtzahl.' },
        c: { text: 'Man kann die Anteile nicht vergleichen, weil die Gruppen verschieden groß sind.', category: 'concept_confusion', feedback: 'Gerade dafür gibt es Anteile und Prozente: Sie machen verschieden große Gruppen vergleichbar.' },
        d: { text: `${C.label(names[big])} hat den größeren Anteil, denn dort gibt es nur ${B.b - B.a} ${C.rest} statt ${S.b - S.a}.`, category: 'concept_confusion', feedback: 'Das Ergebnis stimmt, aber die Begründung nicht: Auch hier vergleichst du nur Anzahlen. Begründe mit den Anteilen.' },
      };
      const options = p.perm.map(id => ({ id, text: opts[id].text, ...(opts[id].category ? { category: opts[id].category, feedback: opts[id].feedback } : {}) }));
      const steps = [...calc, `Also hat ${C.label(names[big])} den größeren Anteil – begründet mit den Anteilen, nicht mit den Anzahlen.`];
      return {
        prompt: `${lines.join(' ')} Welche Aussage ist richtig und richtig begründet?`,
        answer: { type: 'choice', options, correct: 'a', canonical: 'a' },
        hints: hints(orient, 'Prüfe bei jeder Aussage zwei Dinge: Stimmt das Ergebnis? Und vergleicht die Begründung Anteile oder nur Anzahlen?', `${calc[0]}; ${calc[1]}.`, steps, alt),
        solution: { steps, result: opts.a.text },
      };
    }
    const correct = c === 0 ? 'eq' : (c > 0 ? 'g0' : 'g1');
    const options = [0, 1].map(i => {
      const id = `g${i}`;
      if (id === correct) return { id, text: C.label(names[i]) };
      const other = p.groups[1 - i], mine = p.groups[i];
      const fb = c === 0 ? 'Rechne beide Anteile genau aus oder kürze die Brüche: Sie sind gleich groß.'
        : (mine.a > other.a ? 'Du hast die Anzahlen verglichen. Die Gruppen sind verschieden groß – vergleiche die Anteile, z. B. in Prozent.' : 'Rechne beide Anteile in Prozent um und vergleiche dann.');
      return { id, text: C.label(names[i]), category: 'concept_confusion', feedback: fb };
    });
    options.push(correct === 'eq' ? { id: 'eq', text: 'Beide Anteile sind gleich groß.' } : { id: 'eq', text: 'Beide Anteile sind gleich groß.', category: 'concept_confusion', feedback: 'Rechne beide Anteile genau aus – sie sind nicht gleich.' });
    const verdict = c === 0 ? 'Beide Anteile sind gleich groß.' : `${C.label(names[c > 0 ? 0 : 1])} hat den größeren Anteil.`;
    const steps = [...calc, verdict];
    return {
      prompt: `${lines.join(' ')} ${C.question}`,
      answer: { type: 'choice', options, correct, canonical: correct },
      hints: hints(orient, strategy, expandHint, steps, alt),
      solution: { steps, result: verdict },
    };
  },
  /** Independent: integer cross-multiplication. */
  solve(p, level) {
    const g = p.groups;
    const cross = (x, y) => Math.sign(x.a * y.b - y.a * x.b);
    if (level === 3) {
      const ids = ['a', 'b', 'c', 'd'];
      const idx = [0, 1, 2, 3];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3 - i; j++) if (cross(g[idx[j]], g[idx[j + 1]]) < 0) [idx[j], idx[j + 1]] = [idx[j + 1], idx[j]];
      return idx.map(i => ids[i]);
    }
    const s = cross(g[0], g[1]);
    if (level === 4) return 'a';
    return s === 0 ? 'eq' : (s > 0 ? 'g0' : 'g1');
  },
};

module.exports = [convert, shares];
