'use strict';
/**
 * Skill ch4.eq.word_problems — Lineare Gleichungen im Sachzusammenhang (LS7 IV.5).
 * All contexts are original. Angle contexts are left out until Chapter V (Winkelsätze) is implemented (D49).
 */
const U = require('../util');
const Lq = require('./linear');
const { F, hints, $, numTex, numInput, numDistractors } = U;

const SKILL = 'ch4.eq.word_problems';
const x = c => ({ t: 'x', c: String(c) });
const n = c => ({ t: 'n', c: String(c) });
const br = (f, a, b) => ({ t: 'br', f: String(f), a: String(a), b: String(b) });
const NAMES = [['Lea', 'Ben'], ['Aylin', 'Tom'], ['Mia', 'Noah'], ['Emma', 'Luca'], ['Sofia', 'Elias'], ['Hanna', 'Paul']];

/**
 * Context kinds. Each: sample(rng) → numbers; text(p) → situation; varDef(p) → meaning of x; eq(p) → {L, R} (parts);
 * holds(p, v) → story check by plain arithmetic (independent path); asks: {key: {q, val(p, v), say(p, value), unit}}.
 */
const KINDS = {
  ages_sum: {
    family: 'age_number_problems',
    sample: rng => ({ d: rng.int(2, 9), y: rng.int(6, 16), names: rng.int(0, NAMES.length - 1) }),
    total: p => 2 * p.y + p.d,
    text: p => { const [A, B] = NAMES[p.names]; return `${A} ist ${p.d} Jahre älter als ${B}. Zusammen sind beide ${KINDS.ages_sum.total(p)} Jahre alt.`; },
    varDef: p => `Alter von ${NAMES[p.names][1]} in Jahren`,
    eq: p => ({ L: [x(1), br(1, 1, p.d)], R: [n(KINDS.ages_sum.total(p))] }),
    holds: (p, v) => v + (v + p.d) === KINDS.ages_sum.total(p),
    asks: {
      base: { q: p => `Wie alt ist ${NAMES[p.names][1]}?`, val: (p, v) => v, say: (p, a) => `${NAMES[p.names][1]} ist ${a} Jahre alt.` },
      other: { q: p => `Wie alt ist ${NAMES[p.names][0]}?`, val: (p, v) => v + p.d, say: (p, a) => `${NAMES[p.names][0]} ist ${a} Jahre alt.` },
    },
    probe: (p, v) => `${v} + ${v + p.d} = ${KINDS.ages_sum.total(p)}`,
    strategy: 'Drücke das Alter der älteren Person mit $x$ aus: $x$ plus der Unterschied. Die Summe beider Alter ist bekannt.',
  },
  consecutive: {
    family: 'age_number_problems',
    sample: rng => ({ y: rng.int(3, 60) }),
    total: p => 3 * p.y + 3,
    text: p => `Die Summe von drei aufeinanderfolgenden natürlichen Zahlen ist ${KINDS.consecutive.total(p)}.`,
    varDef: () => 'die kleinste der drei Zahlen',
    eq: p => ({ L: [x(1), br(1, 1, 1), br(1, 1, 2)], R: [n(KINDS.consecutive.total(p))] }),
    holds: (p, v) => v + (v + 1) + (v + 2) === KINDS.consecutive.total(p),
    asks: {
      base: { q: () => 'Wie heißt die kleinste der drei Zahlen?', val: (p, v) => v, say: (p, a) => `Die kleinste Zahl ist ${a}.` },
      other: { q: () => 'Wie heißt die größte der drei Zahlen?', val: (p, v) => v + 2, say: (p, a) => `Die größte Zahl ist ${a}.` },
    },
    probe: (p, v) => `${v} + ${v + 1} + ${v + 2} = ${KINDS.consecutive.total(p)}`,
    strategy: 'Aufeinanderfolgende Zahlen: $x$, $x+1$, $x+2$. Ihre Summe ist bekannt.',
  },
  rectangle: {
    family: 'geometry_equations',
    sample: rng => ({ d: rng.int(1, 12), y: rng.int(2, 20) }),
    total: p => 2 * p.y + 2 * (p.y + p.d),
    text: p => `Ein Rechteck ist ${p.d} cm länger als breit. Sein Umfang beträgt ${KINDS.rectangle.total(p)} cm.`,
    varDef: () => 'Breite des Rechtecks in cm',
    eq: p => ({ L: [x(2), br(2, 1, p.d)], R: [n(KINDS.rectangle.total(p))] }),
    holds: (p, v) => 2 * v + 2 * (v + p.d) === KINDS.rectangle.total(p),
    asks: {
      base: { q: () => 'Wie breit ist das Rechteck (in cm)?', val: (p, v) => v, say: (p, a) => `Das Rechteck ist ${a} cm breit.` },
      other: { q: () => 'Wie lang ist das Rechteck (in cm)?', val: (p, v) => v + p.d, say: (p, a) => `Das Rechteck ist ${a} cm lang.` },
    },
    probe: (p, v) => `2 \\cdot ${v} + 2 \\cdot ${v + p.d} = ${KINDS.rectangle.total(p)}`,
    strategy: 'Umfang eines Rechtecks: $2\\cdot$ Breite $+ 2\\cdot$ Länge. Die Länge ist Breite plus Unterschied.',
  },
  isosceles: {
    family: 'geometry_equations',
    sample: rng => ({ d: rng.int(1, 9), y: rng.int(2, 20) }),
    total: p => p.y + 2 * (p.y + p.d),
    text: p => `In einem gleichschenkligen Dreieck ist jeder der beiden Schenkel ${p.d} cm länger als die Basis. Der Umfang beträgt ${KINDS.isosceles.total(p)} cm.`,
    varDef: () => 'Länge der Basis in cm',
    eq: p => ({ L: [x(1), br(2, 1, p.d)], R: [n(KINDS.isosceles.total(p))] }),
    holds: (p, v) => v + 2 * (v + p.d) === KINDS.isosceles.total(p),
    asks: {
      base: { q: () => 'Wie lang ist die Basis (in cm)?', val: (p, v) => v, say: (p, a) => `Die Basis ist ${a} cm lang.` },
      other: { q: () => 'Wie lang ist ein Schenkel (in cm)?', val: (p, v) => v + p.d, say: (p, a) => `Jeder Schenkel ist ${a} cm lang.` },
    },
    probe: (p, v) => `${v} + 2 \\cdot ${v + p.d} = ${KINDS.isosceles.total(p)}`,
    strategy: 'Umfang = Basis + zwei Schenkel. Ein Schenkel ist Basis plus Unterschied.',
  },
  stickers: {
    family: 'age_number_problems',
    sample: rng => ({ d: rng.int(2, 15), y: rng.int(3, 30), names: rng.int(0, NAMES.length - 1) }),
    total: p => p.y + 2 * p.y + (p.y + p.d),
    text: p => { const [A, B] = NAMES[p.names]; return `${A}, ${B} und Kim teilen sich ${KINDS.stickers.total(p)} Sticker. ${B} bekommt doppelt so viele wie ${A}. Kim bekommt ${p.d} mehr als ${A}.`; },
    varDef: p => `Anzahl der Sticker von ${NAMES[p.names][0]}`,
    eq: p => ({ L: [x(1), x(2), br(1, 1, p.d)], R: [n(KINDS.stickers.total(p))] }),
    holds: (p, v) => v + 2 * v + (v + p.d) === KINDS.stickers.total(p),
    asks: {
      base: { q: p => `Wie viele Sticker bekommt ${NAMES[p.names][0]}?`, val: (p, v) => v, say: (p, a) => `${NAMES[p.names][0]} bekommt ${a} Sticker.` },
      other: { q: () => 'Wie viele Sticker bekommt Kim?', val: (p, v) => v + p.d, say: (p, a) => `Kim bekommt ${a} Sticker.` },
    },
    probe: (p, v) => `${v} + ${2 * v} + ${v + p.d} = ${KINDS.stickers.total(p)}`,
    strategy: 'Drücke alle Anteile mit $x$ aus: $x$, $2x$ und $x$ plus Unterschied. Zusammen ergeben sie die Gesamtzahl.',
  },
  ages_future: {
    family: 'age_number_problems',
    // mother k·y today; in t years m times as old as the child: k·y + t = m·(y + t)
    sample: rng => { const m = rng.int(2, 3), k = m + rng.int(1, 3), y = rng.int(3, 12); return { k, m, y, names: rng.int(0, NAMES.length - 1) }; },
    t: p => (p.k - p.m) * p.y / (p.m - 1),
    text: p => `${NAMES[p.names][0]}s Mutter ist heute ${p.k}-mal so alt wie ${NAMES[p.names][0]}. In ${KINDS.ages_future.t(p)} Jahren ist sie nur noch ${p.m}-mal so alt.`,
    varDef: p => `Alter von ${NAMES[p.names][0]} heute in Jahren`,
    eq: p => ({ L: [x(p.k), n(KINDS.ages_future.t(p))], R: [br(p.m, 1, KINDS.ages_future.t(p))] }),
    holds: (p, v) => p.k * v + KINDS.ages_future.t(p) === p.m * (v + KINDS.ages_future.t(p)),
    asks: {
      base: { q: p => `Wie alt ist ${NAMES[p.names][0]} heute?`, val: (p, v) => v, say: (p, a) => `${NAMES[p.names][0]} ist heute ${a} Jahre alt.` },
      other: { q: () => 'Wie alt ist die Mutter heute?', val: (p, v) => p.k * v, say: (p, a) => `Die Mutter ist heute ${a} Jahre alt.` },
    },
    probe: (p, v) => { const t = KINDS.ages_future.t(p); return `${p.k * v} + ${t} = ${p.k * v + t} = ${p.m} \\cdot ${v + t}`; },
    strategy: 'Heute: Kind $x$, Mutter das Vielfache. In einigen Jahren sind BEIDE um diese Jahre älter – auch das Kind.',
  },
};
const KINDS_BY_LEVEL = {
  1: ['ages_sum', 'consecutive', 'rectangle'],
  2: ['ages_sum', 'consecutive', 'rectangle', 'isosceles'],
  3: ['stickers', 'ages_future', 'rectangle', 'isosceles', 'ages_sum'],
};

/**
 * Template ch4.eq.word_problems.contexts (families age_number_problems, geometry_equations)
 * Levels
 *  L1 Grundlagen    the equation is given (x is named); solve it and answer the question about x.
 *  L2 Standard      set up the equation yourself (one relation: older than, consecutive numbers, perimeter); answer x.
 *  L3 Anspruchsvoll several relations (sharing in three parts, ages now and later) and/or the question asks for a
 *                   quantity derived from x (the length instead of the width, the mother's age).
 * Misconceptions: no_interpretation (answers x although another quantity is asked), future_age (only one person ages),
 *   perimeter_half (only two sides counted).
 * Build path: Lq.chain on the equation parts. Independent solver: brute force over whole numbers 0…300 with the
 *   story relation in plain arithmetic, then the asked quantity.
 */
const contexts = {
  id: `${SKILL}.contexts`, version: 1, skillId: SKILL,
  families: ['age_number_problems', 'geometry_equations'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Die Gleichung ist vorgegeben; lösen und die Frage beantworten.',
    2: 'Gleichung selbst aufstellen (älter als, aufeinanderfolgende Zahlen, Umfang); gesucht ist x.',
    3: 'Mehrere Beziehungen (Aufteilen, Alter heute und später) oder eine aus x abgeleitete Größe ist gefragt.',
  },
  misconceptions: ['no_interpretation', 'future_age', 'perimeter_half'],
  sample(rng, level) {
    const kind = rng.pick(KINDS_BY_LEVEL[level]);
    const ask = level === 3 && (kind === 'rectangle' || kind === 'isosceles' || kind === 'ages_sum' || rng.bool()) ? 'other' : 'base';
    return { kind, ask, ...KINDS[kind].sample(rng) };
  },
  constraints(p, level) {
    const K = KINDS[p.kind];
    if (p.kind === 'ages_future' && !Number.isInteger(K.t(p))) return 'future years not whole';
    if (p.kind === 'ages_future' && (K.t(p) < 2 || K.t(p) > 30 || p.k * p.y > 50 || p.k * p.y < 24)) return 'implausible ages';
    const ch = Lq.chain(K.eq(p));
    if (ch.kind !== 'one' || !ch.value.eq(p.y)) return 'equation does not give y';
    if (level === 1 && K.asks[p.ask] !== K.asks.base) return 'L1 asks for x';
    return true;
  },
  build(p, level) {
    const K = KINDS[p.kind], eq = K.eq(p), ch = Lq.chain(eq), v = ch.value;
    const A = K.asks[p.ask], ans = F(A.val(p, Number(v.toString())));
    const varLine = `Wähle $x$: ${K.varDef(p)}.`;
    const eqLine = `Gleichung: ${$(Lq.eqTex(eq))}`;
    const steps = [varLine, eqLine, ...ch.lines.map(l => Lq.lineText(l)),
      ...(p.ask === 'other' ? [`Gefragt ist nicht $x$: ${A.say(p, ans.toString())}`] : [`Antwort: ${A.say(p, ans.toString())}`]),
      `Probe am Text: ${$(K.probe(p, Number(v.toString())))} ✓`];
    const wrong = [];
    if (p.ask === 'other') wrong.push({ value: v, category: 'concept_confusion', feedback: 'Das ist der Wert von $x$. Lies die Frage noch einmal: Gefragt ist eine andere Größe.' });
    if (p.kind === 'consecutive' && p.ask === 'base') wrong.push({ value: F(K.total(p)).div(3), category: 'concept_confusion', feedback: 'Die Summe geteilt durch 3 ergibt die mittlere Zahl. Gefragt ist die kleinste.' });
    if (p.kind === 'ages_sum') wrong.push({ value: F(K.total(p)).div(2), category: 'concept_confusion', feedback: 'Die beiden sind nicht gleich alt. Berücksichtige den Altersunterschied.' });
    if (p.kind === 'rectangle') wrong.push({ value: F(K.total(p)).sub(p.d).div(2), category: 'concept_confusion', feedback: 'Ein Rechteck hat vier Seiten: zweimal die Breite und zweimal die Länge.' });
    // child-only ageing: k·x = m·(x + t)  →  x = m·t / (k − m)
    if (p.kind === 'ages_future') wrong.push({ value: F(K.t(p)).mul(p.m).div(p.k - p.m).mul(p.ask === 'other' ? p.k : 1), category: 'concept_confusion', feedback: 'In einigen Jahren sind beide älter – rechne auch bei der Mutter die Jahre dazu.' });
    for (const d of wrong.splice(0)) if (d.value.isInteger() && d.value.sign() > 0) wrong.push(d);
    const distractors = numDistractors(ans, wrong);
    const given = level === 1;
    return {
      prompt: `${K.text(p)} ${A.q(p)}`,
      ...(given ? { promptLines: [`Mit $x$ = ${K.varDef(p)} gilt: ${$(Lq.eqTex(eq))}`] } : {}),
      instructions: 'Gib nur die Zahl an, ohne Einheit.',
      answer: { type: 'integer', value: ans.toString(), canonical: numInput(ans), distractors },
      hints: hints(
        given ? 'Die Gleichung ist schon aufgestellt. Löse sie und beantworte dann die Frage.' : 'Lege fest, wofür $x$ steht. Drücke alle anderen Größen mit $x$ aus und stelle eine Gleichung auf.',
        K.strategy,
        given ? `${Lq.opWords(ch.lines[0].op)}: ${$(Lq.eqTex(ch.lines[1].eq))}.` : `${varLine} ${eqLine}`,
        steps,
        'Prüfe dein Ergebnis am Text, nicht nur an der Gleichung: Passen alle Angaben? Und beantwortet die Zahl genau die gestellte Frage?'),
      solution: { steps, result: $(numTex(ans)) },
    };
  },
  /** Independent: whole-number search with the story relation in plain arithmetic. */
  solve(p) {
    const K = KINDS[p.kind];
    for (let v = 0; v <= 300; v++) if (K.holds(p, v)) return String(K.asks[p.ask].val(p, v));
    return 'none';
  },
};

// ---------------------------------------------------------------- interpret the solution
/**
 * Interpretation contexts: the equation always has exactly one solution, but it may not fit the situation.
 * Each: sample → numbers; text, question, eq; valid(p) by plain arithmetic (independent path).
 */
const INTERP = {
  consecutive: {
    sample: rng => ({ S: rng.int(20, 150) }),
    text: p => `Gesucht sind drei aufeinanderfolgende natürliche Zahlen mit der Summe ${p.S}.`,
    eq: p => ({ L: [x(1), br(1, 1, 1), br(1, 1, 2)], R: [n(p.S)] }),
    varDef: 'die kleinste der drei Zahlen',
    valid: p => { for (let v = 0; v <= p.S; v++) if (3 * v + 3 === p.S) return true; return false; },
    fits: v => v.isInteger() && v.sign() >= 0,
    say: v => `Die kleinste Zahl ist ${$(numTex(v, { dec: true }))}.`,
    why: v => `${$(`x = ${numTex(v)}`)} ist keine natürliche Zahl.`,
    near: v => F(v).add(1),
  },
  bus: {
    sample: rng => ({ S: rng.int(12, 90), k: rng.int(2, 4) }),
    text: p => `In einem Bus sitzen ${p.k === 2 ? 'doppelt' : p.k === 3 ? 'dreimal' : 'viermal'} so viele Kinder wie Erwachsene, zusammen ${p.S} Personen.`,
    eq: p => ({ L: [x(1), x(p.k)], R: [n(p.S)] }),
    varDef: 'Anzahl der Erwachsenen',
    valid: p => { for (let v = 0; v <= p.S; v++) if (v + p.k * v === p.S) return true; return false; },
    fits: v => v.isInteger() && v.sign() > 0,
    say: v => `Im Bus sitzen ${$(numTex(v, { dec: true }))} Erwachsene.`,
    why: v => `${$(`x = ${numTex(v)}`)} ist keine ganze Zahl – es gibt keine Bruchteile von Personen.`,
    near: v => F(v).add(1),
  },
  rectangle: {
    sample: rng => { const d = rng.int(3, 12); return { d, P: rng.bool() ? rng.int(4, 2 * d) : 2 * d + rng.int(1, 40) }; },
    text: p => `Ein Rechteck soll ${p.d} cm länger als breit sein und einen Umfang von ${p.P} cm haben.`,
    eq: p => ({ L: [x(2), br(2, 1, p.d)], R: [n(p.P)] }),
    varDef: 'Breite in cm',
    valid: p => p.P - 2 * p.d > 0, // 4·Breite = P − 2d must be positive
    fits: v => v.sign() > 0,
    say: v => `Das Rechteck ist ${$(numTex(v, { dec: true }))} cm breit.`,
    why: v => `${$(`x = ${numTex(v, { dec: true })}`)} ist keine sinnvolle Breite, denn eine Länge muss größer als $0$ sein.`,
    near: v => F(v).add(1),
  },
};

/**
 * Template ch4.eq.word_problems.interpret (family check_interpretation)
 * L4 Transfer only: an equation for a situation is given; solve it and decide whether the solution fits the
 *   situation (natural numbers for counts, positive lengths). About half of the instances fit.
 * Misconceptions: no_interpretation (accepts any solution of the equation), rounding (rounds to make it fit),
 *   drop_sign (ignores a negative sign).
 * Independent solver: decides validity by plain arithmetic on the situation (search / sign check), not via the equation.
 */
const interpret = {
  id: `${SKILL}.interpret`, version: 1, skillId: SKILL,
  families: ['check_interpretation'],
  levels: [4],
  levelNotes: { 4: 'Gleichung lösen und prüfen, ob die Lösung zur Situation passt (Anzahlen, Längen); sonst begründen, warum es keine passende Lösung gibt.' },
  misconceptions: ['no_interpretation', 'rounding', 'drop_sign'],
  sample(rng) {
    const kind = rng.pick(Object.keys(INTERP));
    return { kind, ...INTERP[kind].sample(rng), order: rng.shuffle([0, 1, 2, 3]) };
  },
  claims(p) {
    const K = INTERP[p.kind], ch = Lq.chain(K.eq(p)), v = ch.value;
    const fits = K.fits(v);
    const list = fits
      ? [{ id: 'c_val', text: K.say(v) },
        { id: 'c_none', text: 'Es gibt keine passende Lösung, weil die Gleichung keine Lösung hat.', category: 'concept_confusion', feedback: `Die Gleichung hat die Lösung ${$(`x = ${numTex(v)}`)}, und sie passt zur Situation.` },
        { id: 'c_near', text: K.say(K.near(v)), category: 'concept_confusion', feedback: 'Mache die Probe am Text: Mit dieser Zahl stimmen die Angaben nicht.' },
        { id: 'c_twice', text: K.say(v.mul(2)), category: 'concept_confusion', feedback: 'Löse die Gleichung sorgfältig und mache die Probe am Text.' }]
      : [{ id: 'c_none', text: `Es gibt keine passende Lösung: ${K.why(v)}` },
        { id: 'c_val', text: K.say(v), category: 'concept_confusion', feedback: 'Das ist die Lösung der Gleichung – aber sie passt nicht zur Situation. Prüfe, ob die Zahl überhaupt möglich ist.' },
        { id: 'c_near', text: K.say(p.kind === 'rectangle' ? v.abs() : F(v.round(0))), category: p.kind === 'rectangle' ? 'sign_error' : 'rounding', feedback: p.kind === 'rectangle' ? 'Ein Minuszeichen darf man nicht einfach weglassen. Dann stimmt der Umfang nicht mehr.' : 'Runden ist hier nicht erlaubt: Mit der gerundeten Zahl stimmt die Angabe im Text nicht mehr.' },
        { id: 'c_noeq', text: 'Es gibt keine passende Lösung, weil die Gleichung keine Lösung hat.', category: 'concept_confusion', feedback: `Die Gleichung hat sehr wohl eine Lösung, nämlich ${$(`x = ${numTex(v)}`)}. Sie passt aber nicht zur Situation.` }];
    return { ch, v, fits, list: p.order.map(i => list[i]) };
  },
  constraints(p) {
    const K = INTERP[p.kind];
    const { v, fits, list } = this.claims(p);
    if (fits !== K.valid(p)) return 'validity mismatch';
    if (v.d > 4n) return 'awkward fraction';
    if (p.kind === 'rectangle' && !v.isTerminatingDecimal()) return 'width not a terminating decimal';
    if (new Set(list.map(o => o.text)).size !== 4) return 'duplicate claims';
    if (p.kind === 'rectangle' && v.isZero()) return 'zero width';
    if (!fits && p.kind !== 'rectangle' && v.isInteger()) return 'integer but not valid';
    return true;
  },
  build(p) {
    const K = INTERP[p.kind];
    const { ch, v, fits, list } = this.claims(p);
    const right = fits ? 'c_val' : 'c_none';
    const options = list.map(o => (o.id === right ? { id: o.id, text: o.text } : { id: o.id, text: o.text, category: o.category, feedback: o.feedback }));
    const steps = [...ch.lines.map(l => Lq.lineText(l)), fits ? `Die Lösung passt zur Situation. ${K.say(v)}` : `Die Gleichung hat die Lösung ${$(`x = ${numTex(v, { dec: p.kind === 'rectangle' })}`)}, aber: ${K.why(v)} Also gibt es keine passende Lösung.`];
    return {
      prompt: `${K.text(p)} Mit $x$ = ${K.varDef} ergibt sich die Gleichung ${$(Lq.eqTex(K.eq(p)))}. Welche Antwort ist richtig?`,
      instructions: 'Löse die Gleichung und prüfe, ob die Lösung zur Situation passt.',
      answer: { type: 'choice', options, correct: right, canonical: right },
      hints: hints(
        'Löse zuerst die Gleichung. Prüfe dann, ob die Zahl in der Situation überhaupt möglich ist.',
        'Anzahlen von Personen oder natürliche Zahlen müssen ganze Zahlen sein; Längen müssen größer als $0$ sein.',
        `${Lq.opWords(ch.lines[0].op)}: ${$(Lq.eqTex(ch.lines[1].eq))}.`,
        steps,
        'Eine Gleichung kann eine Lösung haben, die trotzdem nicht zur Aufgabe passt. Dann lautet die Antwort: Es gibt keine passende Lösung – mit Begründung.'),
      solution: { steps, result: list.find(o => o.id === right).text },
    };
  },
  /** Independent: validity by plain arithmetic on the situation. */
  solve(p) { return INTERP[p.kind].valid(p) ? 'c_val' : 'c_none'; },
  signatureParams(p) { const { order, ...rest } = p; return rest; },
};

module.exports = [contexts, interpret];
