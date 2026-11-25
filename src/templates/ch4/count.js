'use strict';
/**
 * Skill ch4.eq.solution_count — Anzahl der Lösungen einer linearen Gleichung (LS7 IV.4).
 */
const X = require('../../expr');
const U = require('../util');
const Lq = require('./linear');
const { F, hints, $, numTex, numInput } = U;

const SKILL = 'ch4.eq.solution_count';
const x = c => ({ t: 'x', c: String(c) });
const n = c => ({ t: 'n', c: String(c) });
const br = (f, a, b) => ({ t: 'br', f: String(f), a: String(a), b: String(b) });

const RESULT_DE = {
  one: v => `Genau eine Lösung: ${$(`x = ${numTex(v)}`)}`,
  none: () => 'Keine Lösung',
  all: () => 'Unendlich viele Lösungen: Jede Zahl ist eine Lösung.',
};
/** Concluding sentence after the chain (build path). */
function conclusion(ch) {
  const last = ch.lines[ch.lines.length - 1].eq;
  if (ch.kind === 'one') return `Die Gleichung hat genau eine Lösung: ${$(`x = ${numTex(ch.value)}`)}.`;
  const st = $(Lq.eqTex(last));
  return ch.kind === 'all'
    ? `$x$ ist weggefallen. Die Aussage ${st} ist wahr – für jede Zahl $x$. Also ist jede Zahl eine Lösung.`
    : `$x$ ist weggefallen. Die Aussage ${st} ist falsch – für jede Zahl $x$. Also hat die Gleichung keine Lösung.`;
}

/** Left side for a classify instance; the right side is chosen to produce the wanted kind. */
function sampleLeft(rng, level) {
  if (level === 1) {
    const a = rng.intExcept(-9, 9, [0]), b = rng.intExcept(-15, 15, [0]);
    return { form: 'plain', L: rng.bool() ? [x(a), n(b)] : [n(b), x(a)] };
  }
  const form = rng.pick(['bracket', 'collect', 'two_brackets']);
  const f = rng.intExcept(-6, 6, [0, 1, -1]), b = rng.intExcept(-9, 9, [0]);
  if (form === 'bracket') return { form, L: [br(f, 1, b)] };
  if (form === 'collect') return { form, L: [x(rng.int(2, 9)), n(rng.intExcept(-12, 12, [0])), x(rng.intExcept(-9, 9, [0]))] };
  const g = rng.int(2, 6), e = rng.intExcept(-9, 9, [0]);
  return { form, L: [br(Math.abs(f), 1, b), br(-g, 1, e)] };
}
/** Right side producing the kind, displayed differently from the left (collected form, maybe swapped). */
function rightFor(L, kind, rng, level) {
  const { a: A, b: B } = Lq.lin(L);
  const swap = rng.bool();
  const side = (c, d) => { const s = [x(c), n(d)].filter(p => !F(p.c).isZero()); return swap ? s.reverse() : s; };
  if (kind === 'all') return { R: side(A, B), s: null };
  if (kind === 'none') { const d = B.add(rng.intExcept(-9, 9, [0])); return { R: side(A, d), s: null }; }
  const C = A.add(rng.intExcept(-5, 5, [0])), s = rng.int(-6, 8);
  if (level === 1 && rng.bool()) return { R: side(C, B), s: 0 }; // same number on both sides, different factors: x = 0
  return { R: side(C, A.sub(C).mul(s).add(B)), s };
}

/**
 * Template ch4.eq.solution_count.classify (family classify_count)
 * Answer type solution_set: genau eine Lösung (with its value) / keine Lösung / unendlich viele Lösungen.
 * Levels
 *  L1 Grundlagen    ax + b = cx + d where the sides differ only slightly (same factor → x vanishes at once).
 *  L2 Standard      the left side needs expanding or collecting first (one bracket, two brackets incl. minus, like terms).
 * Misconceptions: zero_eq_zero (0 = 0 read as "no solution" or as x = 0), false_statement_any (a false statement read
 *   as "every number").
 * Build path: Lq.chain. Independent solver: Lq.solveMachine on the displayed machine strings.
 */
const classify = {
  id: `${SKILL}.classify`, version: 1, skillId: SKILL,
  families: ['classify_count'],
  levels: [1, 2],
  levelNotes: {
    1: 'Seiten unterscheiden sich wenig: gleicher Faktor vor x → x fällt sofort weg; sonst genau eine Lösung.',
    2: 'Erst Klammern auflösen oder zusammenfassen (auch Minus vor der Klammer), dann entscheiden.',
  },
  misconceptions: ['zero_eq_zero', 'false_statement_any'],
  sample(rng, level) {
    const kind = rng.pick(['one', 'none', 'all']);
    const left = sampleLeft(rng, level);
    const right = rightFor(left.L, kind, rng, level);
    return { kind, form: left.form, L: left.L, R: right.R };
  },
  constraints(p, level) {
    const ch = Lq.chain({ L: p.L, R: p.R });
    if (ch.kind !== p.kind) return 'kind mismatch';
    if (!p.R.length) return 'empty right side';
    if (Lq.lin(p.L).a.isZero()) return 'x vanishes on the left already';
    if (Lq.sideMachine(p.L) === Lq.sideMachine(p.R)) return 'identical sides';
    if (ch.kind === 'one' && (!ch.value.isInteger() || ch.value.abs().cmp(F(20)) > 0)) return 'awkward solution';
    if (Lq.chainMax(ch).cmp(F(level === 1 ? 40 : 80)) > 0) return 'numbers too large';
    if (p.R.some(q => q.t === 'n' && F(q.c).isZero())) return 'zero constant';
    return true;
  },
  build(p) {
    const eq = { L: p.L, R: p.R };
    const ch = Lq.chain(eq);
    const steps = [...ch.lines.map(l => Lq.lineText(l)), conclusion(ch)];
    if (ch.kind === 'one') steps.push(Lq.probeText(eq, ch.value));
    const answer = { type: 'solution_set', variable: 'x', kind: ch.kind, canonical: { kind: ch.kind } };
    if (ch.kind === 'one') {
      answer.value = ch.value.toString();
      answer.canonical.value = numInput(ch.value);
      answer.distractors = ch.value.isZero() ? [] : [{ value: { kind: 'one', value: numInput(ch.value.neg()) }, category: 'sign_error', feedback: 'Achte beim Umformen auf die Vorzeichen. Mache die Probe.' }];
    } else {
      answer.distractors = ch.kind === 'all'
        ? [{ value: { kind: 'one', value: '0' }, category: 'concept_confusion', feedback: '$0 = 0$ bedeutet nicht $x = 0$: Die Aussage ist wahr, egal welche Zahl man für $x$ einsetzt. Jede Zahl ist eine Lösung.' },
          { value: { kind: 'none' }, category: 'concept_confusion', feedback: 'Die übrig gebliebene Aussage ist wahr. Eine wahre Aussage, die für jedes $x$ gilt, heißt: Jede Zahl ist eine Lösung.' }]
        : [{ value: { kind: 'all' }, category: 'concept_confusion', feedback: 'Die übrig gebliebene Aussage ist falsch. Sie wird für keine Zahl wahr – die Gleichung hat keine Lösung.' }];
    }
    const lastTwo = ch.lines.length > 1 ? ch.lines[1] : ch.lines[0];
    return {
      prompt: `Wie viele Lösungen hat die Gleichung ${$(Lq.eqTex(eq))}?`,
      instructions: 'Wähle aus. Bei genau einer Lösung gib sie auch an.',
      answer,
      hints: hints(
        'Forme die Gleichung um, bis $x$ allein steht – oder bis $x$ ganz wegfällt.',
        'Fällt $x$ weg, entscheidet die Aussage, die übrig bleibt: wahr (z. B. $3 = 3$) → jede Zahl ist eine Lösung; falsch (z. B. $3 = 5$) → keine Lösung.',
        `${Lq.opWords(ch.lines[0].op)}: ${$(Lq.eqTex(lastTwo.eq))}.`,
        steps,
        'Vergleiche die Seiten nach dem Vereinfachen: gleicher Faktor vor $x$ und gleiche Zahl → beide Seiten sind immer gleich; gleicher Faktor, andere Zahl → nie gleich; verschiedene Faktoren → genau eine Lösung.'),
      solution: { steps, result: RESULT_DE[ch.kind](ch.value) },
    };
  },
  solve(p) {
    const [Lm, Rm] = Lq.eqMachine({ L: p.L, R: p.R });
    const r = Lq.solveMachine(Lm, Rm);
    return r.kind === 'one' ? { kind: 'one', value: r.value.toString() } : { kind: r.kind };
  },
};

// ---------------------------------------------------------------- choose a parameter
/**
 * Parameter tasks. Machine strings use the letter a for the unknown parameter (variables x and a);
 * `want` is the required solution kind (or a given solution value).
 */
const PARAM_KINDS = {
  coef_none: {
    sample: rng => ({ p: rng.intExcept(-9, 9, [0, 1]), b: rng.intExcept(-12, 12, [0]), d: rng.intExcept(-12, 12, [0]) }),
    eq: q => [U.polyMachine([[q.p, 1], [q.b, 0]]), `ax${q.d < 0 ? '' : '+'}${q.d}`],
    want: () => ({ kind: 'none' }),
    answer: q => q.p,
    ask: 'keine Lösung',
    distractors: q => [{ value: -q.p, category: 'sign_error', feedback: 'Keine Lösung gibt es, wenn auf beiden Seiten derselbe Faktor vor $x$ steht und $x$ wegfällt.' },
      { value: q.d - q.b, category: 'concept_confusion', feedback: 'Gesucht ist der Faktor vor $x$, nicht die Zahl ohne $x$.' }],
    explain: q => [
      `Damit $x$ wegfällt, muss rechts derselbe Faktor vor $x$ stehen wie links: ${$(`a = ${q.p}`)}.`,
      `Dann steht da ${$(`${U.tex(U.polyMachine([[q.p, 1], [q.b, 0]]))} = ${U.tex(U.polyMachine([[q.p, 1], [q.d, 0]]))}`)}. ${q.p < 0 ? 'Addiert man' : 'Subtrahiert man'} ${$(U.tex(U.polyMachine([[Math.abs(q.p), 1]])))} auf beiden Seiten, bleibt ${$(`${q.b} = ${q.d}`)} – eine falsche Aussage. Also keine Lösung.`,
      'Für jede andere Zahl $a$ hat die Gleichung genau eine Lösung.',
    ],
  },
  const_all: {
    sample: rng => ({ f: rng.intExcept(-7, 7, [0, 1, -1]), b: rng.intExcept(-9, 9, [0]) }),
    eq: q => [`${q.f}(x${q.b < 0 ? '' : '+'}${q.b})`, `${q.f}x+a`],
    want: () => ({ kind: 'all' }),
    answer: q => q.f * q.b,
    ask: 'unendlich viele Lösungen',
    distractors: q => [{ value: q.b, category: 'concept_confusion', feedback: 'Beim Ausmultiplizieren wird auch die Zahl in der Klammer mit dem Faktor davor multipliziert.' },
      { value: -q.f * q.b, category: 'sign_error', feedback: 'Achte auf die Vorzeichen beim Ausmultiplizieren.' }],
    explain: q => [
      `Löse die Klammer auf: ${$(`${U.tex(`${q.f}(x${q.b < 0 ? '' : '+'}${q.b})`)} = ${U.tex(U.polyMachine([[q.f, 1], [q.f * q.b, 0]]))}`)}.`,
      `Beide Seiten sind gleich, wenn rechts dieselbe Zahl steht: ${$(`a = ${q.f * q.b}`)}. Dann ist die Gleichung für jede Zahl $x$ wahr.`,
      'Für jede andere Zahl $a$ fällt $x$ zwar auch weg, aber es bleibt eine falsche Aussage: keine Lösung.',
    ],
  },
  coef_all: {
    sample: rng => ({ p: rng.intExcept(-7, 7, [0, 1, -1]), b: rng.intExcept(-9, 9, [0]) }),
    eq: q => [`a(x${q.b < 0 ? '' : '+'}${q.b})`, U.polyMachine([[q.p, 1], [q.p * q.b, 0]])],
    want: () => ({ kind: 'all' }),
    answer: q => q.p,
    ask: 'unendlich viele Lösungen',
    distractors: q => [{ value: q.p * q.b, category: 'concept_confusion', feedback: 'Gesucht ist der Faktor vor der Klammer. Vergleiche die Faktoren vor $x$.' },
      { value: -q.p, category: 'sign_error', feedback: 'Achte auf das Vorzeichen des Faktors vor $x$.' }],
    explain: q => [
      `Ausmultiplizieren: ${$(`a\\left(x${q.b < 0 ? '' : '+'}${q.b}\\right) = ax${q.b < 0 ? '-' : '+'}${Math.abs(q.b) === 1 ? '' : Math.abs(q.b)}a`)}.`,
      `Für ${$(`a = ${q.p}`)} steht links ${$(U.tex(U.polyMachine([[q.p, 1], [q.p * q.b, 0]])))} – genau dasselbe wie rechts. Dann ist jede Zahl eine Lösung.`,
      `Für jede andere Zahl $a$ hat die Gleichung genau eine Lösung (nämlich ${$(`x = ${-q.b}`)}).`,
    ],
  },
  given_solution: {
    sample: rng => ({ s: rng.intExcept(-6, 6, [0, 1, -1]), aa: rng.intExcept(-8, 8, [0]), b: rng.intExcept(-15, 15, [0]) }),
    eq: q => [`ax${q.b < 0 ? '' : '+'}${q.b}`, `${q.aa * q.s + q.b}`],
    want: q => ({ kind: 'one', value: q.s }),
    answer: q => q.aa,
    ask: null,
    distractors: q => [{ value: (q.aa * q.s + 2 * q.b) / q.s, category: 'sign_error', feedback: 'Achte auf das Vorzeichen, wenn du die Zahl auf die andere Seite bringst.' },
      { value: q.aa * q.s + q.b - q.b * q.s, category: 'concept_confusion', feedback: 'Setze die Lösung für $x$ ein und löse dann nach $a$ auf.' }],
    explain: q => [
      `Setze ${$(`x = ${q.s}`)} ein: ${$(`a\\cdot ${q.s < 0 ? `\\left(${q.s}\\right)` : q.s}${q.b < 0 ? '' : '+'}${q.b} = ${q.aa * q.s + q.b}`)}.`,
      `Also ${$(`${q.s}a = ${q.aa * q.s}`)} und damit ${$(`a = ${q.aa}`)}.`,
      `Probe: ${$(`${q.aa}\\cdot ${q.s < 0 ? `\\left(${q.s}\\right)` : q.s}${q.b < 0 ? '' : '+'}${q.b} = ${q.aa * q.s + q.b}`)} ✓`,
    ],
  },
};
const mParse = m => X.parse(m, { variables: ['x', 'a'] });
const texA = m => X.toLatex(mParse(m));

/**
 * Template ch4.eq.solution_count.parameter (family choose_parameter)
 * L3 Anspruchsvoll only: choose the number a so that the equation has no solution / infinitely many solutions /
 *   a given solution. Kinds: coef_none (p·x + b = a·x + d), const_all (f(x + b) = f·x + a), coef_all
 *   (a(x + b) = p·x + p·b), given_solution (a·x + b = c with x = s).
 * Misconceptions: zero_eq_zero, param_role (confuses the factor before x with the number term).
 * Independent solver: brute force over a = −80…80, solving each resulting equation with expr.js; the answer must be the
 *   only a in that range with the wanted property.
 */
const parameter = {
  id: `${SKILL}.parameter`, version: 1, skillId: SKILL,
  families: ['choose_parameter'],
  levels: [3],
  levelNotes: { 3: 'Eine Zahl a so wählen, dass die Gleichung keine, unendlich viele oder eine vorgegebene Lösung hat.' },
  misconceptions: ['zero_eq_zero', 'param_role'],
  sample(rng) { const kind = rng.pick(Object.keys(PARAM_KINDS)); return { kind, ...PARAM_KINDS[kind].sample(rng) }; },
  /** All a in −80…80 with the wanted property (independent path). */
  search(p) {
    const K = PARAM_KINDS[p.kind], [Lm, Rm] = K.eq(p), want = K.want(p), hits = [];
    for (let a = -80; a <= 80; a++) {
      const sub = m => m.replace(/a/g, `(${a})`);
      const r = Lq.solveMachine(sub(Lm), sub(Rm));
      if (r.kind === want.kind && (want.kind !== 'one' || r.value.eq(want.value))) hits.push(a);
    }
    return hits;
  },
  constraints(p) {
    const K = PARAM_KINDS[p.kind];
    if (p.kind === 'coef_none' && p.b === p.d) return 'same constants';
    const hits = this.search(p);
    if (hits.length !== 1 || hits[0] !== K.answer(p)) return `parameter not unique (${hits.length})`;
    if (Math.abs(K.answer(p)) > 60) return 'too large';
    return true;
  },
  build(p) {
    const K = PARAM_KINDS[p.kind], [Lm, Rm] = K.eq(p), val = K.answer(p), want = K.want(p);
    const eqT = `${texA(Lm)} = ${texA(Rm)}`;
    const steps = K.explain(p);
    const dist = K.distractors(p).filter(d => Number.isInteger(d.value) && d.value !== val);
    const seen = new Set();
    const distractors = dist.filter(d => (seen.has(d.value) ? false : seen.add(d.value))).map(d => ({ ...d, value: String(d.value) }));
    return {
      prompt: want.kind === 'one'
        ? `Für welche Zahl $a$ hat die Gleichung ${$(eqT)} die Lösung ${$(`x = ${want.value}`)}?`
        : `Für welche Zahl $a$ hat die Gleichung ${$(eqT)} ${K.ask}?`,
      instructions: 'Gib die Zahl $a$ an.',
      answer: { type: 'integer', variable: 'a', value: String(val), canonical: String(val), distractors },
      hints: hints(
        want.kind === 'one' ? 'Eine Lösung erfüllt die Gleichung: Setze sie für $x$ ein.' : 'Bei keiner oder unendlich vielen Lösungen muss $x$ beim Umformen wegfallen.',
        want.kind === 'one' ? 'Nach dem Einsetzen steht eine Gleichung, in der nur noch $a$ unbekannt ist. Löse sie.'
          : (want.kind === 'all' ? 'Unendlich viele Lösungen: Nach dem Vereinfachen müssen beide Seiten genau gleich sein.' : 'Keine Lösung: Der Faktor vor $x$ muss auf beiden Seiten gleich sein, die Zahlen ohne $x$ aber verschieden.'),
        steps[0],
        steps,
        'Probiere zur Kontrolle eine andere Zahl für $a$ und forme um: Dann entsteht eine andere Lösungsmenge.'),
      solution: { steps, result: $(`a = ${val}`) },
    };
  },
  solve(p) { const h = this.search(p); return h.length === 1 ? String(h[0]) : 'none'; },
};

// ---------------------------------------------------------------- justify
/**
 * Template ch4.eq.solution_count.justify (family justify_count)
 * L4 Transfer only: a correct reduction is shown that ends in a statement without x; choose the correct conclusion
 *   with its reason. Distractor claims: "x vanished, so no solution" / "so every number", "x = 0", "x = the number left".
 * Misconceptions: zero_eq_zero, false_statement_any.
 * Independent solver: the kind of the ORIGINAL equation via expr.js (Lq.solveMachine) selects the claim.
 */
const justify = {
  id: `${SKILL}.justify`, version: 1, skillId: SKILL,
  families: ['justify_count'],
  levels: [4],
  levelNotes: { 4: 'Eine fertige Umformung endet ohne x; die richtige Schlussfolgerung mit Begründung auswählen.' },
  misconceptions: ['zero_eq_zero', 'false_statement_any'],
  sample(rng) {
    const kind = rng.pick(['none', 'all']);
    const left = sampleLeft(rng, 2);
    const right = rightFor(left.L, kind, rng, 2);
    return { kind, form: left.form, L: left.L, R: right.R, order: rng.shuffle([0, 1, 2, 3]), name: rng.pick(['Lena', 'Tim', 'Aylin', 'Jonas', 'Mia', 'Emil']) };
  },
  claims(p) {
    const ch = Lq.chain({ L: p.L, R: p.R });
    const last = ch.lines[ch.lines.length - 1].eq;
    const lB = Lq.lin(last.L).b, rB = Lq.lin(last.R).b;
    const st = $(Lq.eqTex(last));
    const out = [
      { id: 'c_all', text: `Jede Zahl ist eine Lösung, denn ${st} ist wahr – egal, welche Zahl man für $x$ einsetzt.` },
      { id: 'c_none', text: `Es gibt keine Lösung, denn ${st} ist falsch – egal, welche Zahl man für $x$ einsetzt.` },
      { id: 'c_x0', text: 'Es gibt genau eine Lösung, nämlich $x = 0$, weil $x$ weggefallen ist.' },
    ];
    const other = p.kind === 'all' ? lB : lB.sub(rB);
    out.push(other.isZero()
      ? { id: 'c_xv', text: p.kind === 'all' ? 'Es gibt keine Lösung, weil $x$ weggefallen ist.' : 'Jede Zahl ist eine Lösung, weil $x$ weggefallen ist.' }
      : { id: 'c_xv', text: `Es gibt genau eine Lösung, nämlich ${$(`x = ${numTex(other)}`)}.` });
    return { ch, last, list: p.order.map(i => out[i]) };
  },
  constraints(p) {
    const c = classify.constraints({ ...p }, 2);
    if (c !== true) return c;
    const { list } = this.claims(p);
    if (new Set(list.map(o => o.text)).size !== 4) return 'duplicate claims';
    return true;
  },
  build(p) {
    const { ch, last, list } = this.claims(p);
    const right = `c_${ch.kind}`;
    const FB = {
      c_all: 'Die Aussage, die übrig bleibt, ist falsch. Eine falsche Aussage wird durch keine Zahl wahr.',
      c_none: 'Die Aussage, die übrig bleibt, ist wahr – und das für jede Zahl $x$.',
      c_x0: 'Dass $x$ wegfällt, heißt nicht $x = 0$. Entscheidend ist, ob die übrig gebliebene Aussage wahr oder falsch ist.',
      c_xv: 'Die übrig gebliebene Aussage enthält kein $x$ mehr. Man kann daraus keinen Wert für $x$ ablesen.',
    };
    const options = list.map(o => (o.id === right ? { id: o.id, text: o.text } : { id: o.id, text: o.text, category: 'concept_confusion', feedback: FB[o.id] }));
    const steps = [conclusion(ch), `Kontrolle: Setze zwei verschiedene Zahlen für $x$ in die Ausgangsgleichung ein. ${ch.kind === 'all' ? 'Beide Male stimmen die Seiten überein.' : 'Beide Male sind die Seiten verschieden.'}`];
    return {
      prompt: `${p.name} hat die Gleichung ${$(Lq.eqTex({ L: p.L, R: p.R }))} umgeformt. Welche Schlussfolgerung ist richtig?`,
      promptLines: ch.lines.map(l => Lq.lineText(l)),
      instructions: 'Wähle die richtige Aussage mit der richtigen Begründung.',
      answer: { type: 'choice', options, correct: right, canonical: right },
      hints: hints(
        'Am Ende ist $x$ weggefallen. Es bleibt eine Aussage nur mit Zahlen.',
        'Ist diese Aussage wahr, gilt die Gleichung für jedes $x$. Ist sie falsch, gilt sie für kein $x$.',
        `Die letzte Zeile lautet ${$(Lq.eqTex(last))}. Ist das wahr oder falsch?`,
        steps,
        'Probe statt Umformen: Setze z. B. $x = 0$ und $x = 1$ in die Ausgangsgleichung ein und vergleiche jeweils beide Seiten.'),
      solution: { steps, result: list.find(o => o.id === right).text },
    };
  },
  solve(p) { const [Lm, Rm] = Lq.eqMachine({ L: p.L, R: p.R }); return `c_${Lq.solveMachine(Lm, Rm).kind}`; },
  signatureParams(p) { const { order, name, ...rest } = p; return rest; },
};

module.exports = [classify, parameter, justify];
