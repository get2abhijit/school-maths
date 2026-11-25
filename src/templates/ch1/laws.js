'use strict';
/**
 * Skill ch1.numterms.evaluate — two families added in Session 11 (book alignment G1, G2; LS7 I.1):
 *   name_law          name the law behind a given transformation (Begriffstraining)
 *   compute_cleverly  compute a term „möglichst geschickt“ (reorder with KG/AG, Ausklammern with DG)
 * Laws use the book's names and abbreviations: KG+, KG·, AG+, AG·, DG, Plusklammerregel, Minusklammerregel.
 *
 * Independent solvers
 *  - name_law: `classifyStep` parses both sides and matches the AST change against the law patterns
 *    (structural, no use of the generator's chosen law).
 *  - compute_cleverly: exact evaluation of the task term (expr.js); L4 compares the non-integer
 *    intermediate results of both routes.
 */
const U = require('../util');
const X = require('../../expr');
const { F, hints, tex, $, numTex, numMachine, evalMachine } = U;

const SKILL = 'ch1.numterms.evaluate';
const LAWS = ['KG+', 'KG·', 'AG+', 'AG·', 'DG', 'PLUS', 'MINUS'];
const L1_LAWS = ['KG+', 'KG·', 'AG+', 'AG·', 'DG'];
const LAW_NAME = {
  'KG+': 'Kommutativgesetz der Addition (KG+)', 'KG·': 'Kommutativgesetz der Multiplikation (KG·)',
  'AG+': 'Assoziativgesetz der Addition (AG+)', 'AG·': 'Assoziativgesetz der Multiplikation (AG·)',
  DG: 'Distributivgesetz (DG)', PLUS: 'Plusklammerregel', MINUS: 'Minusklammerregel',
};
/** Article (nominative/accusative is the same here): „das Distributivgesetz“, „die Plusklammerregel“. */
const ART = law => (law === 'PLUS' || law === 'MINUS' ? 'die' : 'das');
const Cap = w => w[0].toUpperCase() + w.slice(1);
const LAW_SHORT = { 'KG+': 'KG+', 'KG·': 'KG·', 'AG+': 'AG+', 'AG·': 'AG·', DG: 'DG', PLUS: 'Plusklammerregel', MINUS: 'Minusklammerregel' };
const LAW_PATTERN = {
  'KG+': '$a+b=b+a$', 'KG·': '$a\\cdot b=b\\cdot a$',
  'AG+': '$\\left(a+b\\right)+c=a+\\left(b+c\\right)$', 'AG·': '$\\left(a\\cdot b\\right)\\cdot c=a\\cdot \\left(b\\cdot c\\right)$',
  DG: '$a\\cdot \\left(b+c\\right)=a\\cdot b+a\\cdot c$', PLUS: '$a+\\left(b-c\\right)=a+b-c$',
  MINUS: '$a-\\left(b+c\\right)=a-b-c$ und $a-\\left(b-c\\right)=a-b+c$',
};
const LAW_CHANGE = {
  'KG+': 'Hier wurden zwei Summanden vertauscht.', 'KG·': 'Hier wurden zwei Faktoren vertauscht.',
  'AG+': 'Hier bleibt die Reihenfolge der Summanden gleich; nur die Klammer wandert.',
  'AG·': 'Hier bleibt die Reihenfolge der Faktoren gleich; nur die Klammer wandert.',
  DG: 'Hier wird ein Faktor mit jedem Glied einer Summe multipliziert (oder ausgeklammert).',
  PLUS: 'Hier fällt eine Klammer weg (oder kommt dazu), vor der ein Plus steht; die Rechenzeichen bleiben.',
  MINUS: 'Hier fällt eine Klammer weg (oder kommt dazu), vor der ein Minus steht; die Rechenzeichen in der Klammer drehen sich um.',
};
/** Most confusable laws first (misconceptions law_confusion, plus_rule_as_dg). */
const CONFUSE = {
  'KG+': ['AG+', 'KG·', 'PLUS'], 'KG·': ['AG·', 'KG+', 'DG'], 'AG+': ['KG+', 'AG·', 'PLUS'], 'AG·': ['KG·', 'AG+', 'DG'],
  DG: ['AG·', 'PLUS', 'KG·'], PLUS: ['DG', 'AG+', 'MINUS'], MINUS: ['PLUS', 'DG', 'AG+'],
};

// ---------------------------------------------------------------- independent classifier
const key = n => JSON.stringify(n);
const strip = n => (n.t === 'paren' ? strip(n.a) : n);
const isSumLike = (n, op) => n.t === op || (n.t === 'paren' && n.a.t === op);
/** Law that turns a into b at this node (one direction), or null. */
function matchLaw(a, b) {
  const eq = (x, y) => key(x) === key(y);
  for (const [op, law] of [['add', 'KG+'], ['mul', 'KG·']]) {
    if (a.t === op && b.t === op && eq(a.a, b.b) && eq(a.b, b.a) && !eq(a.a, a.b)) return law;
  }
  for (const [op, law] of [['add', 'AG+'], ['mul', 'AG·']]) {
    // (x∘y)∘z → x∘(y∘z); the left bracket may be written or implied by left-to-right reading
    if (a.t === op && isSumLike(a.a, op) && b.t === op && b.b.t === 'paren' && b.b.a.t === op) {
      const l = strip(a.a);
      if (eq(l.a, b.a) && eq(l.b, b.b.a.a) && eq(a.b, b.b.a.b)) return law;
    }
  }
  // DG: f·(y±z) → f·y ± f·z
  if (a.t === 'mul' && a.b.t === 'paren' && ['add', 'sub'].includes(a.b.a.t) && b.t === a.b.a.t &&
      b.a.t === 'mul' && b.b.t === 'mul' && eq(b.a.a, a.a) && eq(b.b.a, a.a) && eq(b.a.b, a.b.a.a) && eq(b.b.b, a.b.a.b)) return 'DG';
  // Plusklammerregel: x+(y−z) → x+y−z
  if (a.t === 'add' && a.b.t === 'paren' && a.b.a.t === 'sub' && b.t === 'sub' && b.a.t === 'add' &&
      eq(b.a.a, a.a) && eq(b.a.b, a.b.a.a) && eq(b.b, a.b.a.b)) return 'PLUS';
  // Minusklammerregel: x−(y+z) → x−y−z ; x−(y−z) → x−y+z
  if (a.t === 'sub' && a.b.t === 'paren' && ['add', 'sub'].includes(a.b.a.t)) {
    const inner = a.b.a, outer = inner.t === 'add' ? 'sub' : 'add';
    if (b.t === outer && b.a.t === 'sub' && eq(b.a.a, a.a) && eq(b.a.b, inner.a) && eq(b.b, inner.b)) return 'MINUS';
  }
  return null;
}
/** Which single law turns machine term A into machine term B? Returns a law id, null (identical) or 'unknown'. */
function classifyStep(A, B) {
  function cls(a, b) {
    if (key(a) === key(b)) return null;
    const m = matchLaw(a, b) || matchLaw(b, a);
    if (m) return m;
    if (a.t === b.t && a.a && b.a) {
      if (a.b && b.b && key(a.a) === key(b.a)) return cls(a.b, b.b);
      if (a.b && b.b && key(a.b) === key(b.b)) return cls(a.a, b.a);
      if (!a.b && !b.b) return cls(a.a, b.a);
    }
    return 'unknown';
  }
  return cls(X.parse(A), X.parse(B));
}

// ---------------------------------------------------------------- number pools
const FRACS = ['1/2', '1/3', '2/3', '1/4', '3/4', '1/5', '2/5', '3/5', '4/5', '1/6', '5/6', '3/8', '5/8', '7/10'];
const DECS = ['0.5', '1.5', '2.5', '0.25', '0.75', '1.2', '0.8', '3.5', '0.4', '2.4'];
function sampleNums(rng, level, style, n) {
  return Array.from({ length: n }, () => {
    if (level === 1 || style === 'int') return String(rng.int(2, 60));
    if (style === 'frac') return rng.pick(FRACS);
    return rng.pick(DECS);
  });
}
const m = (v, dec) => numMachine(F(v), { dec });

/** One transformation for `law` as [A, B] machine strings. */
function lawPair(law, v, variant, dec) {
  const [a, b, c] = v.map(x => m(x, dec));
  switch (law) {
    case 'KG+': return [[`${a}+${b}`, `${b}+${a}`], [`${a}+${b}+${c}`, `${b}+${a}+${c}`], [`${a}*${b}+${c}`, `${c}+${a}*${b}`]][variant % 3];
    case 'KG·': return [[`${a}*${b}`, `${b}*${a}`], [`${a}*${b}*${c}`, `${b}*${a}*${c}`], [`${a}+${b}*${c}`, `${a}+${c}*${b}`]][variant % 3];
    case 'AG+': return variant % 2 ? [`(${a}+${b})+${c}`, `${a}+(${b}+${c})`] : [`${a}+(${b}+${c})`, `(${a}+${b})+${c}`];
    case 'AG·': return variant % 2 ? [`(${a}*${b})*${c}`, `${a}*(${b}*${c})`] : [`${a}*(${b}*${c})`, `(${a}*${b})*${c}`];
    case 'DG': return [[`${a}*(${b}+${c})`, `${a}*${b}+${a}*${c}`], [`${a}*(${b}-${c})`, `${a}*${b}-${a}*${c}`],
      [`${a}*${b}+${a}*${c}`, `${a}*(${b}+${c})`]][variant % 3];
    case 'PLUS': return variant % 2 ? [`${a}+(${b}-${c})`, `${a}+${b}-${c}`] : [`${a}+${b}-${c}`, `${a}+(${b}-${c})`];
    case 'MINUS': return [[`${a}-(${b}+${c})`, `${a}-${b}-${c}`], [`${a}-(${b}-${c})`, `${a}-${b}+${c}`], [`${a}-${b}-${c}`, `${a}-(${b}+${c})`]][variant % 3];
    default: throw new Error(law);
  }
}
/** True if any sub-term of a machine term has a negative value (Kl. 7 rule-naming stays with positive numbers). */
function hasNegativeSub(machine) {
  let neg = false;
  (function walk(n) { if (n.a) walk(n.a); if (n.b) walk(n.b); if (X.evaluate(n, {}).sign() < 0) neg = true; })(X.parse(machine));
  return neg;
}
const lawTex = (A, B) => $(`${tex(A)} = ${tex(B)}`);

/** Deterministic option order from a key list (presentation only). */
function orderOptions(list, keys) {
  return list.map((o, i) => ({ o, k: (keys[i % keys.length] ^ Math.imul(i + 1, 2654435761)) >>> 0 })).sort((x, y) => x.k - y.k).map(x => x.o);
}

/** L3: two-step chains [law1, law2, build(nums) → [A, B, C]]. */
const CHAINS = [
  ['KG+', 'AG+', ([a, b, c]) => [`${a}+${b}+${c}`, `${b}+${a}+${c}`, `${b}+(${a}+${c})`]],
  ['KG·', 'AG·', ([a, b, c]) => [`${a}*${b}*${c}`, `${b}*${a}*${c}`, `${b}*(${a}*${c})`]],
  ['KG·', 'DG', ([a, b, c]) => [`${b}*${a}+${a}*${c}`, `${a}*${b}+${a}*${c}`, `${a}*(${b}+${c})`]],
  ['PLUS', 'KG+', ([a, b, c]) => [`${a}+(${b}-${c})`, `${a}+${b}-${c}`, `${b}+${a}-${c}`]],
  ['DG', 'KG·', ([a, b, c]) => [`${a}*(${b}+${c})`, `${a}*${b}+${a}*${c}`, `${b}*${a}+${a}*${c}`]],
];
const CHAIN_POOL = CHAINS;

/**
 * Template ch1.numterms.evaluate.name_law (family name_law)
 * Levels
 *  L1 Grundlagen    one transformation with whole numbers; KG+, KG·, AG+, AG·, DG.
 *  L2 Standard      one transformation with fractions or decimals; also Plus- and Minusklammerregel.
 *  L3 Anspruchsvoll two-step transformation; name both laws in the right order.
 * Misconceptions → wrong options: KG and AG confused (law_confusion), Plusklammerregel called
 *  Distributivgesetz (plus_rule_as_dg); L3 also offers the right laws in the wrong order.
 */
const nameLaw = {
  id: `${SKILL}.name_law`, version: 1, skillId: SKILL,
  families: ['name_law'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Eine Umformung mit ganzen Zahlen; KG+, KG·, AG+, AG·, DG.',
    2: 'Eine Umformung mit Brüchen oder Dezimalzahlen; auch Plus- und Minusklammerregel.',
    3: 'Zwei Umformungsschritte; beide Gesetze in der richtigen Reihenfolge benennen.',
  },
  misconceptions: ['law_confusion', 'plus_rule_as_dg'],
  sample(rng, level) {
    const law = level === 1 ? rng.pick(L1_LAWS) : rng.pick(LAWS);
    const mulLaw = ['KG·', 'AG·'].includes(law);
    const style = level === 1 ? 'int' : level === 3 ? rng.pick(['int', 'dec']) : (mulLaw ? 'dec' : rng.pick(['frac', 'dec']));
    const variant = rng.int(0, 5);
    const nums = sampleNums(rng, level, style, 3);
    // a fraction may only stand first in a product (2·3/4 would read as (2·3)/4): use whole numbers there
    if (style === 'frac' && law === 'DG') { nums[1] = String(rng.int(2, 20)); nums[2] = String(rng.int(2, 20)); }
    if (style === 'frac' && law === 'KG+' && variant % 3 === 2) nums[1] = String(rng.int(2, 20));
    return { law, style, chain: rng.int(0, CHAIN_POOL.length - 1), variant, nums, order: [rng.uint32(), rng.uint32()] };
  },
  signatureParams(p, level) { return level === 3 ? { chain: p.chain, nums: p.nums } : { law: p.law, variant: p.variant % 3, nums: p.nums }; },
  lines(p, level) {
    const dec = p.style === 'dec';
    if (level === 3) return CHAIN_POOL[p.chain][2](p.nums.map(x => m(x, dec)));
    return lawPair(p.law, p.nums, p.variant, dec);
  },
  constraints(p, level) {
    if (new Set(p.nums).size !== 3) return 'repeated number';
    const L = this.lines(p, level);
    const want = level === 3 ? CHAIN_POOL[p.chain].slice(0, 2) : [p.law];
    for (let i = 1; i < L.length; i++) if (classifyStep(L[i - 1], L[i]) !== want[i - 1]) return 'classifier disagrees';
    for (let i = 1; i < L.length; i++) if (!evalMachine(L[i - 1]).eq(evalMachine(L[i]))) return 'not equal';
    if (L.some(hasNegativeSub)) return 'negative intermediate value';
    return true;
  },
  options(p, level) {
    if (level === 3) {
      const [l1, l2] = CHAIN_POOL[p.chain];
      const t = (x, y) => `erst ${LAW_SHORT[x]}, dann ${LAW_SHORT[y]}`;
      const alt1 = CONFUSE[l1].find(z => z !== l2), alt2 = CONFUSE[l2].find(z => z !== l1 && z !== alt1);
      const raw = [
        { laws: [l1, l2], text: t(l1, l2) },
        { laws: [l2, l1], text: t(l2, l1), feedback: 'Beide Gesetze kommen vor, aber in der anderen Reihenfolge. Vergleiche zuerst Zeile 1 mit Zeile 2.' },
        { laws: [alt1, l2], text: t(alt1, l2), feedback: `Der erste Schritt ist nicht ${ART(alt1)} ${LAW_NAME[alt1]}. ${LAW_CHANGE[l1]}` },
        { laws: [l1, alt2], text: t(l1, alt2), feedback: `Der zweite Schritt ist nicht ${ART(alt2)} ${LAW_NAME[alt2]}. ${LAW_CHANGE[l2]}` },
      ];
      return orderOptions(raw, p.order).map((o, i) => ({ id: 'abcd'[i], text: o.text, laws: o.laws, ...(o.feedback ? { category: 'concept_confusion', feedback: o.feedback } : {}) }));
    }
    const pool = level === 1 ? L1_LAWS : LAWS;
    const wrong = CONFUSE[p.law].filter(z => pool.includes(z));
    for (const z of pool) if (wrong.length < 3 && z !== p.law && !wrong.includes(z)) wrong.push(z);
    const raw = [{ laws: [p.law], text: LAW_NAME[p.law] }, ...wrong.slice(0, 3).map(z => ({
      laws: [z], text: LAW_NAME[z], feedback: `${Cap(ART(z))} ${LAW_NAME[z]} sieht so aus: ${LAW_PATTERN[z]}. ${LAW_CHANGE[p.law]}`,
    }))];
    return orderOptions(raw, p.order).map((o, i) => ({ id: 'abcd'[i], text: o.text, laws: o.laws, ...(o.feedback ? { category: 'concept_confusion', feedback: o.feedback } : {}) }));
  },
  build(p, level) {
    const L = this.lines(p, level);
    const opts = this.options(p, level);
    const correct = opts.find(o => !o.feedback);
    const options = opts.map(({ laws: _l, ...o }) => o);
    if (level === 3) {
      const [l1, l2] = CHAIN_POOL[p.chain];
      const steps = [
        `Zeile 1 → Zeile 2: ${LAW_CHANGE[l1]} Das ist ${ART(l1)} ${LAW_NAME[l1]}: ${LAW_PATTERN[l1]}.`,
        `Zeile 2 → Zeile 3: ${LAW_CHANGE[l2]} Das ist ${ART(l2)} ${LAW_NAME[l2]}: ${LAW_PATTERN[l2]}.`,
      ];
      return {
        prompt: 'Welche Gesetze wurden in dieser Umformung nacheinander angewendet?',
        promptLines: [`Zeile 1: ${$(tex(L[0]))}`, `Zeile 2: ${$(`= ${tex(L[1])}`)}`, `Zeile 3: ${$(`= ${tex(L[2])}`)}`],
        instructions: 'Wähle die Gesetze in der richtigen Reihenfolge.',
        answer: { type: 'choice', options, correct: correct.id, canonical: correct.id },
        hints: hints(
          'Betrachte die beiden Schritte einzeln: zuerst Zeile 1 → Zeile 2, dann Zeile 2 → Zeile 3.',
          'Frage bei jedem Schritt: Wurde vertauscht (KG), wurde nur eine Klammer verschoben (AG), wurde ausmultipliziert oder ausgeklammert (DG), oder fällt eine Klammer nach Plus oder Minus weg?',
          steps[0],
          steps,
          'Kontrolle: Rechne alle drei Zeilen aus. Sie haben denselben Wert – die Gesetze ändern nur den Rechenweg, nicht das Ergebnis.'),
        solution: { steps, result: correct.text },
      };
    }
    const steps = [`${LAW_CHANGE[p.law]}`, `Das ist ${ART(p.law)} ${LAW_NAME[p.law]}: ${LAW_PATTERN[p.law]}.`];
    return {
      prompt: `Welches Gesetz oder welche Regel wurde hier angewendet? ${lawTex(L[0], L[1])}`,
      instructions: 'Wähle das passende Gesetz.',
      answer: { type: 'choice', options, correct: correct.id, canonical: correct.id },
      hints: hints(
        'Vergleiche die linke und die rechte Seite: Was ist anders?',
        'Vertauschte Zahlen → Kommutativgesetz. Gleiche Reihenfolge, andere Klammer → Assoziativgesetz. Ein Faktor wird mit jedem Glied einer Summe multipliziert → Distributivgesetz. Eine Klammer nach Plus oder Minus fällt weg → Plus- bzw. Minusklammerregel.',
        steps[0],
        steps,
        'Merkhilfe: „kommutativ“ heißt vertauschbar, „assoziativ“ heißt verbindbar (Klammern umsetzen), „distributiv“ heißt verteilend.'),
      solution: { steps, result: correct.text },
    };
  },
  /** Independent: classify every step from the parsed lines, then pick the option naming exactly those laws. */
  solve(p, level) {
    const L = this.lines(p, level);
    const found = [];
    for (let i = 1; i < L.length; i++) found.push(classifyStep(L[i - 1], L[i]));
    const o = this.options(p, level).find(op => op.laws.join('|') === found.join('|'));
    return o ? o.id : 'none';
  },
};

// ---------------------------------------------------------------- compute_cleverly
const ROUND_PAIRS_MUL = [['25', '4'], ['4', '25'], ['2', '5'], ['5', '2'], ['20', '5'], ['50', '2'], ['125', '8'], ['8', '125'], ['2.5', '4'], ['0.5', '2'], ['0.25', '4'], ['1.25', '8']];
const COMP_FRACS = [['1/3', '2/3'], ['1/4', '3/4'], ['2/5', '3/5'], ['1/6', '5/6'], ['3/8', '5/8'], ['3/7', '4/7'], ['2/9', '7/9'], ['1/5', '9/5']];
const COMP_DECS = [['0.7', '0.3'], ['1.4', '0.6'], ['2.25', '0.75'], ['0.35', '1.65'], ['3.8', '1.2'], ['0.45', '2.55']];
const DG_FRACS = ['3/7', '2/3', '3/4', '5/6', '2/9', '4/5', '3/8'];
const DG_DECS = ['0.6', '1.5', '0.4', '2.5', '0.8', '1.2'];

/** Clever route for a parameter set: {task, clever:[machine lines], plain:[machine lines], lawText}. */
function cleverPlan(p) {
  const dec = !!p.dec;
  const mm = x => m(x, dec);
  if (p.kind === 'sum') {
    const [a, c] = p.pair, b = p.b;
    const ac = F(a).add(F(c)), abv = F(a).add(F(b));
    return {
      task: `${mm(a)}+${mm(b)}+${mm(c)}`,
      clever: [`${mm(a)}+${mm(b)}+${mm(c)}`, `${mm(a)}+${mm(c)}+${mm(b)}`, `(${mm(a)}+${mm(c)})+${mm(b)}`, `${mm(ac)}+${mm(b)}`],
      plain: [`${mm(a)}+${mm(b)}+${mm(c)}`, `${mm(abv)}+${mm(c)}`],
      lawText: `Vertauschen (KG+) und neu zusammenfassen (AG+): ${$(`${tex(mm(a))}+${tex(mm(c))}=${numTex(ac, { dec })}`)}`,
      pairText: `${$(tex(mm(a)))} und ${$(tex(mm(c)))}`,
      pairValue: ac,
    };
  }
  if (p.kind === 'prod') {
    const [a, c] = p.pair, b = p.b;
    const ac = F(a).mul(F(c)), abv = F(a).mul(F(b));
    return {
      task: `${mm(a)}*${mm(b)}*${mm(c)}`,
      clever: [`${mm(a)}*${mm(b)}*${mm(c)}`, `${mm(a)}*${mm(c)}*${mm(b)}`, `(${mm(a)}*${mm(c)})*${mm(b)}`, `${mm(ac)}*${mm(b)}`],
      plain: [`${mm(a)}*${mm(b)}*${mm(c)}`, `${mm(abv)}*${mm(c)}`],
      lawText: `Vertauschen (KG·) und neu zusammenfassen (AG·): ${$(`${tex(mm(a))}\\cdot ${tex(mm(c))}=${numTex(ac, { dec })}`)}`,
      pairText: `${$(tex(mm(a)))} und ${$(tex(mm(c)))}`,
      pairValue: ac,
    };
  }
  // dg: f·b ± f·c = f·(b ± c)
  const f = p.f, b = String(p.b), c = String(p.c), op = p.op;
  const inner = op === '+' ? F(b).add(F(c)) : F(b).sub(F(c));
  const fb = F(f).mul(F(b)), fc = F(f).mul(F(c));
  const fM = mm(f);
  return {
    task: `${fM}*${b}${op}${fM}*${c}`,
    clever: [`${fM}*${b}${op}${fM}*${c}`, `${fM}*(${b}${op}${c})`, `${fM}*${inner.toString()}`],
    plain: [`${fM}*${b}${op}${fM}*${c}`, `${mm(fb)}${op}${mm(fc)}`],
    lawText: `Ausklammern (DG rückwärts): ${$(`${tex(`${fM}*${b}${op}${fM}*${c}`)}=${tex(`${fM}*(${b}${op}${c})`)}`)}`,
    pairText: `${$(b)} und ${$(c)}`,
    pairValue: inner,
  };
}
/**
 * Number of non-integer numbers in the lines after the first that do not occur in the task itself
 * (= inconvenient intermediate results such as 15/7 or 3,4).
 */
function nonIntegerSteps(lines) {
  const lits = node => {
    const out = [];
    (function walk(n) {
      if (n.t === 'num') { out.push(n.v); return; }
      if (n.t === 'div' && n.a.t === 'num' && n.b.t === 'num') { out.push(n.a.v.div(n.b.v)); return; }
      if (n.a) walk(n.a); if (n.b) walk(n.b);
    })(node);
    return out;
  };
  const given = lits(X.parse(lines[0]));
  let n = 0;
  for (const l of lines.slice(1)) for (const v of lits(X.parse(l))) if (!v.isInteger() && !given.some(g => g.eq(v))) n++;
  return n;
}

/**
 * Template ch1.numterms.evaluate.compute_cleverly (family compute_cleverly)
 * „Berechne möglichst geschickt.“ Terms are built so that a clever order gives whole (round) numbers.
 * Levels
 *  L2 Standard      reorder with KG/AG: a + b + c with a + c whole, or a · b · c with a · c ∈ {1, 10, 100, 1000}.
 *  L3 Anspruchsvoll Ausklammern (DG backwards) with a fraction or decimal factor: f·b + f·c = f·(b + c).
 *  L4 Transfer      two routes are shown; decide which one is cleverer and why (choice).
 * The answer is the value (L2/L3); naming the law is practised in name_law (D84).
 * Misconceptions: computing strictly left to right (left_to_right_only); DG backwards forgetting the
 *  factor for the second summand (distractor f·b + c).
 */
const computeCleverly = {
  id: `${SKILL}.compute_cleverly`, version: 1, skillId: SKILL,
  families: ['compute_cleverly'],
  levels: [2, 3, 4],
  levelNotes: {
    2: 'Umstellen mit KG und AG, sodass ganze oder runde Zahlen entstehen.',
    3: 'Ausklammern (Distributivgesetz rückwärts) mit Bruch oder Dezimalzahl als Faktor.',
    4: 'Zwei Rechenwege vergleichen: Welcher ist geschickter und warum?',
  },
  misconceptions: ['left_to_right_only', 'strich_vor_punkt'],
  sample(rng, level) {
    let kind;
    if (level === 2) kind = rng.pick(['sum', 'prod']);
    else if (level === 3) kind = 'dg';
    else kind = rng.pick(['sum', 'dg']);
    const p = { kind, order: [rng.uint32(), rng.uint32()], cleverFirst: rng.bool() };
    if (kind === 'sum') {
      p.dec = rng.bool();
      p.pair = rng.pick(p.dec ? COMP_DECS : COMP_FRACS);
      if (rng.bool()) p.pair = [p.pair[1], p.pair[0]];
      p.b = p.dec ? rng.pick(['1.9', '2.6', '0.15', '4.3', '3.05', '1.8']) : rng.pick(['1/2', '5/7', '3/10', '7/8', '4/9', '1/6']);
    } else if (kind === 'prod') {
      p.pair = rng.pick(ROUND_PAIRS_MUL);
      p.dec = p.pair.some(x => x.includes('.'));
      p.b = String(rng.int(3, 99));
    } else {
      p.dec = rng.bool();
      p.f = rng.pick(p.dec ? DG_DECS : DG_FRACS);
      p.op = rng.pick(['+', '+', '-']);
      p.b = rng.int(3, 40); p.c = rng.int(2, 39);
    }
    return p;
  },
  signatureParams(p) { const { order: _o, cleverFirst: _c, ...rest } = p; return rest; },
  constraints(p, level) {
    const plan = cleverPlan(p);
    const v = evalMachine(plan.task);
    if (v.sign() <= 0) return 'non-positive value';
    if (p.kind === 'sum') {
      if (!plan.pairValue.isInteger()) return 'pair not whole';
      if (F(p.b).eq(F(p.pair[0])) || F(p.b).eq(F(p.pair[1]))) return 'repeated number';
      if (F(p.b).add(F(p.pair[0])).isInteger()) return 'plain route also whole';
    }
    if (p.kind === 'prod' && Number(p.b) % 10 === 0) return 'b already round';
    if (p.kind === 'dg') {
      const inner = plan.pairValue;
      if (p.b === p.c) return 'equal';
      if (inner.sign() <= 0) return 'negative bracket';
      if (!F(p.f).mul(inner).isInteger()) return 'result not whole';
      const fb = F(p.f).mul(F(p.b)), fc = F(p.f).mul(F(p.c));
      if (fb.isInteger() && fc.isInteger()) return 'plain route already whole';
      if (inner.n % 5n !== 0n && !(F(p.f).d > 1n && inner.n % F(p.f).d === 0n)) return 'bracket not round';
    }
    if (v.abs().cmp(F(level === 2 ? 2000 : 200)) > 0) return 'too large';
    if (level === 4 && !(nonIntegerSteps(plan.clever) < nonIntegerSteps(plan.plain))) return 'clever route not clearly better';
    for (const lines of [plan.clever, plan.plain]) for (const l of lines) if (!evalMachine(l).eq(v)) return 'route not equivalent';
    return true;
  },
  routeTex(lines, value, dec) { return $(`${lines.map(l => tex(l)).join(' = ')} = ${numTex(value, { dec })}`); },
  build(p, level) {
    const plan = cleverPlan(p);
    const dec = !!p.dec;
    const v = evalMachine(plan.task);
    const cleverSteps = [plan.lawText, this.routeTex(plan.clever, v, dec)];
    if (level === 4) {
      const letters = p.cleverFirst ? { clever: 'A', plain: 'B' } : { clever: 'B', plain: 'A' };
      const routeLines = { A: null, B: null };
      routeLines[letters.clever] = plan.clever; routeLines[letters.plain] = plan.plain;
      const raw = [
        { text: `Weg ${letters.clever}, weil ${plan.pairText} zusammen eine ganze Zahl ergeben.`, ok: true },
        { text: `Weg ${letters.plain}, weil man immer von links nach rechts rechnen muss.`, feedback: 'Bei reinen Summen (oder reinen Produkten) darfst du nach KG und AG umstellen und neu zusammenfassen; beim Ausklammern hilft das DG.' },
        { text: `Weg ${letters.plain}, weil Umstellen den Wert des Terms verändern kann.`, feedback: 'Beide Wege liefern denselben Wert. Die Rechengesetze ändern nur den Rechenweg, nicht das Ergebnis.' },
        { text: 'Beide Wege sind gleich geschickt, weil das Ergebnis gleich ist.', feedback: `Das Ergebnis ist gleich, aber Weg ${letters.plain} hat unbequeme Zwischenergebnisse (Brüche oder Kommazahlen).` },
      ];
      const options = orderOptions(raw, p.order).map((o, i) => ({ id: 'abcd'[i], text: o.text, ...(o.ok ? {} : { category: 'concept_confusion', feedback: o.feedback }) }));
      const correct = options.find(o => !o.feedback);
      const steps = [`Weg ${letters.clever}: ${this.routeTex(routeLines[letters.clever], v, dec)}`, `Weg ${letters.plain}: ${this.routeTex(routeLines[letters.plain], v, dec)}`,
        `Weg ${letters.clever} ist geschickter: ${plan.lawText}. Dadurch entstehen ganze Zahlen statt Brüchen oder Kommazahlen.`];
      return {
        prompt: `Lena und Tim berechnen ${$(tex(plan.task))} auf zwei Wegen. Welcher Weg ist geschickter?`,
        promptLines: [`Weg A: ${this.routeTex(routeLines.A, v, dec)}`, `Weg B: ${this.routeTex(routeLines.B, v, dec)}`],
        instructions: 'Wähle die Antwort mit der richtigen Begründung.',
        answer: { type: 'choice', options, correct: correct.id, canonical: correct.id },
        hints: hints(
          'Beide Wege führen zum selben Ergebnis. Es geht darum, welcher Weg weniger Rechenarbeit macht.',
          'Achte auf die Zwischenergebnisse: Wo entstehen ganze oder runde Zahlen, wo Brüche oder Kommazahlen?',
          `Schau dir an, was mit ${plan.pairText} passiert.`,
          steps,
          'Geschickt rechnen heißt: erst die Zahlen zusammenfassen, die gut zusammenpassen (z. B. zu 1, 10 oder 100) – das erlauben KG, AG und DG.'),
        solution: { steps, result: correct.text },
      };
    }
    const fb = p.kind === 'dg' ? F(p.f).mul(F(p.b)) : null;
    const dis = p.kind === 'dg'
      ? [{ value: (p.op === '+' ? fb.add(F(p.c)) : fb.sub(F(p.c))).toString(), category: 'concept_confusion', feedback: 'Der Faktor gehört zu beiden Produkten. Klammere ihn aus: $f\\cdot b+f\\cdot c=f\\cdot \\left(b+c\\right)$.' }]
      : [];
    const steps = [...cleverSteps, `Ergebnis: ${$(numTex(v, { dec }))}`];
    return {
      prompt: `Berechne möglichst geschickt: ${$(tex(plan.task))}`,
      instructions: dec ? 'Gib das Ergebnis als Zahl ein (Komma oder Bruch).' : 'Gib das Ergebnis als Zahl ein (ganze Zahl oder Bruch).',
      answer: { type: 'fraction', value: v.toString(), canonical: U.numInput(v, { dec }), distractors: U.numDistractors(v, dis) },
      hints: hints(
        p.kind === 'dg' ? 'Beide Produkte haben einen gemeinsamen Faktor.' : 'Suche zwei Zahlen, die zusammen eine ganze oder runde Zahl ergeben.',
        p.kind === 'dg' ? 'Klammere den gemeinsamen Faktor aus (Distributivgesetz rückwärts) und rechne zuerst die Klammer.'
          : 'Du darfst in einer reinen Summe (bzw. einem reinen Produkt) die Reihenfolge ändern (KG) und anders zusammenfassen (AG).',
        `Fasse zuerst ${plan.pairText} zusammen: Das ergibt ${$(numTex(plan.pairValue, { dec }))}.`,
        steps,
        `Zum Vergleich der ungeschickte Weg von links nach rechts: ${this.routeTex(plan.plain, v, dec)}. Das Ergebnis ist gleich, aber die Zwischenergebnisse sind unbequemer.`),
      solution: { steps, result: $(numTex(v, { dec })) },
    };
  },
  /** Independent: exact value of the task term (L2/L3); L4: route with fewer non-integer intermediates. */
  solve(p, level) {
    const plan = cleverPlan(p);
    if (level !== 4) return evalMachine(plan.task).toString();
    const cleverLetter = nonIntegerSteps(plan.clever) < nonIntegerSteps(plan.plain) ? (p.cleverFirst ? 'A' : 'B') : null;
    const o = this.build(p, level).answer.options.find(op => op.text.startsWith(`Weg ${cleverLetter}, weil`) && op.text.includes('ganze Zahl'));
    return o ? o.id : 'none';
  },
};

module.exports = [nameLaw, computeCleverly];
module.exports.classifyStep = classifyStep;
module.exports.nonIntegerSteps = nonIntegerSteps;
