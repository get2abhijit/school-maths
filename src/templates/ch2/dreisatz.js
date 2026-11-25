'use strict';
/**
 * Dreisatz in Sachzusammenhängen (LS7 II.1, II.2) and model judgement (L4). All contexts are original.
 *
 * Build path: Fractions from the model parameter (unit rate r for proportional, product c for antiproportional).
 * Independent solver: Dreisatz as a term over the DISPLAYED pair only, evaluated by the expression engine.
 * L4: the solver recomputes the claimed value from the displayed pair; whether the model fits the situation is
 * a property of the situation (flag), not of numbers.
 */
const { hints, $, numTex } = require('../util');
const Z = require('./zuo');
const { F, deNum, texNum, eur } = Z;
const { Rng } = require('../../core');

const tq = f => (Z.fitsPlaces(f, 4) ? texNum(f) : numTex(f));
const vt = (q, v) => (q.money ? Z.eur2Tex(v) : texNum(v));
const suf = q => (q.money ? ' €' : (q.unit ? ` ${q.unit}` : ''));

/** Result for keys: the number in math (last $…$ segment is the answer), then the unit or noun: "$52{,}50$ €". */
function resultTex(q, v) { const t = q.text(v); return `${$(vt(q, v))}${t.includes(' ') ? t.slice(t.indexOf(' ')) : ''}`; }
/** Sample a plain Dreisatz task of type 'prop' | 'anti' at level 2 or 3. */
function sampleTask(rng, type, level) {
  const set = type === 'prop' ? Z.PROP : Z.ANTI, ci = rng.int(0, set.length - 1), ctx = set[ci];
  const ask = level >= 3 ? rng.pick(['y', 'x']) : 'y';
  if (type === 'prop') {
    const [x1, x2] = rng.shuffle(Z.pickDistinct(rng, Z.range(ctx.xr[level]), 2));
    return { type, ctx: ci, ask, r: rng.pick(ctx.r[level]), x1, x2 };
  }
  const [x1, x2] = rng.shuffle(Z.pickDistinct(rng, ctx.xs[level].map(String), 2));
  return { type, ctx: ci, ask, c: rng.pick(ctx.c[level]), x1, x2 };
}
function values(p) {
  const x1 = F(p.x1), x2 = F(p.x2);
  if (p.type === 'prop') { const r = F(p.r); return { x1, x2, y1: r.mul(x1), y2: r.mul(x2), k: r }; }
  const c = F(p.c); return { x1, x2, y1: c.div(x1), y2: c.div(x2), k: c };
}
function ctxOf(p) { return (p.type === 'prop' ? Z.PROP : Z.ANTI)[p.ctx]; }
function taskConstraints(p) {
  const ctx = ctxOf(p), v = values(p);
  if (v.x1.eq(v.x2)) return 'same x';
  if (v.x2.eq(1)) return 'asked value is the unit value itself';
  if (![v.y1, v.y2].every(y => Z.admissible(y, ctx.y)) || ![v.x1, v.x2].every(x => Z.admissible(x, ctx.x))) return 'value not admissible';
  if (ctx.y.money && !Z.fitsPlaces(v.y1, 2)) return 'money';
  return true;
}

/**
 * Build a Dreisatz task. opts.hiddenType: the prompt does not say which model applies (mixed tasks, decide L3).
 */
function buildTask(p, opts = {}) {
  const ctx = ctxOf(p), { x1, x2, y1, y2, k } = values(p), prop = p.type === 'prop';
  const X = ctx.x, Y = ctx.y, askY = p.ask === 'y';
  const kt = Y.money && Z.fitsPlaces(k, 2) ? Z.eur2Tex(k) : tq(k);   // unit value (or product) as shown
  const answer = askY ? y2 : x2, side = askY ? Y : X;
  const spec = Z.numSpec(answer, side);
  const fbOther = prop
    ? 'Das wäre richtig, wenn die Zuordnung antiproportional wäre. Hier gehört zum Doppelten das Doppelte.'
    : 'Das wäre richtig, wenn die Zuordnung proportional wäre. Hier gehört zum Doppelten die Hälfte.';
  const fbAdd = 'Du hast eine Differenz addiert bzw. abgezogen. Beim Dreisatz wird multipliziert und geteilt.';
  if (askY) {
    spec.distractors = Z.dist(answer, [
      { value: prop ? y1.mul(x1).div(x2) : y1.mul(x2).div(x1), category: 'concept_confusion', feedback: fbOther },
      { value: prop ? y1.add(x2.sub(x1)) : y1.sub(x2.sub(x1)), category: 'concept_confusion', feedback: fbAdd },
      { value: k, category: 'concept_confusion', feedback: prop ? `Das ist erst der Wert für ${X.text(F(1))}. Rechne noch auf ${X.text(x2)} hoch.` : 'Das ist erst das Produkt (der Wert für 1). Teile es noch durch den neuen ersten Wert.' },
    ]);
  } else {
    spec.distractors = Z.dist(answer, [
      { value: prop ? x1.mul(y1).div(y2) : x1.mul(y2).div(y1), category: 'concept_confusion', feedback: fbOther },
      ...(prop ? [{ value: y2.mul(k), category: 'concept_confusion', feedback: `Du hast mit dem Wert für 1 multipliziert. Hier musst du ${Y.text(y2)} durch ${$(tq(k))} teilen.` }] : []),
    ]);
  }
  // Worked Dreisatz: given pair → one unit → asked value.
  const l1 = `${X.text(x1)} → ${Y.text(y1)}`;
  let l2, l3;
  if (prop) {
    l2 = `${X.text(F(1))} → ${$(`${vt(Y, y1)} : ${texNum(x1)} = ${kt}`)}${suf(Y)}`;
    l3 = askY ? `${X.text(x2)} → ${$(`${kt} \\cdot ${texNum(x2)} = ${vt(Y, y2)}`)}${suf(Y)}`
      : `${Y.text(y2)}: ${$(`${vt(Y, y2)} : ${kt} = ${texNum(x2)}`)}, also ${X.text(x2)}`;
  } else {
    l2 = `Produkt: ${$(`${vt(Y, y1)} \\cdot ${texNum(x1)} = ${kt}`)}${Y.money ? ' €' : ''} – so viel wäre es bei ${X.text(F(1))}.`;
    l3 = askY ? `${X.text(x2)} → ${$(`${kt} : ${texNum(x2)} = ${vt(Y, y2)}`)}${suf(Y)}`
      : `${Y.text(y2)}: ${$(`${kt} : ${vt(Y, y2)} = ${texNum(x2)}`)}, also ${X.text(x2)}`;
  }
  const typeLine = prop ? 'Die Zuordnung ist proportional: Zum Doppelten gehört das Doppelte.' : 'Die Zuordnung ist antiproportional: Zum Doppelten gehört die Hälfte.';
  const steps = [...(opts.hiddenType ? [typeLine] : []), l1, l2, l3];
  const f = x2.div(x1), nice = Z.simpleFactor(f);
  const vtY = v => vt(Y, v);
  const alt = askY && nice
    ? `Ohne Umweg über 1: Der erste Wert wird ${Z.scaleStep(x1, f, texNum).word}, also wird der zweite Wert ${Z.scaleStep(y1, prop ? f : F(1).div(f), vtY).word}: ${$(Z.scaleStep(y1, prop ? f : F(1).div(f), vtY).calc)}.`
    : (prop ? `Probe: Der Quotient ${$(`${vt(Y, y2)} : ${texNum(x2)} = ${kt}`)} ist derselbe wie ${$(`${vt(Y, y1)} : ${texNum(x1)}`)}.`
      : `Probe: Das Produkt ${$(`${texNum(x2)} \\cdot ${vt(Y, y2)} = ${kt}`)} ist dasselbe wie ${$(`${texNum(x1)} \\cdot ${vt(Y, y1)}`)}.`);
  const note = !askY && ctx.xAnswerNote ? ctx.xAnswerNote : Z.unitHint(side);
  return {
    prompt: `${ctx.given(x1, y1)} ${askY ? ctx.askY(x2) : ctx.askX(y2)}`,
    instructions: [note, side.money ? 'Gib den Betrag in € an, z. B. 4,50.' : null].filter(Boolean).join(' ') || 'Gib nur die Zahl ein.',
    answer: spec,
    hints: hints(
      opts.hiddenType ? 'Entscheide zuerst, welche Zuordnung vorliegt: Was passiert mit dem zweiten Wert, wenn sich der erste Wert verdoppelt?' : typeLine,
      opts.hiddenType ? `${typeLine} Dreisatz: erst auf eine Einheit (1), dann auf die gesuchte Menge.`
        : (prop ? 'Dreisatz: Teile zuerst, um den Wert für 1 zu bekommen; multipliziere dann.' : 'Dreisatz: Multipliziere zuerst, um den Wert für 1 zu bekommen; teile dann.'),
      l2, steps, alt),
    solution: { steps, result: resultTex(side, answer) },
  };
}
function solveTask(p) {
  const x1 = p.x1, y1 = Z.dstr(values(p).y1);
  if (p.ask === 'y') return Z.deNum(p.type === 'prop' ? Z.propFrom(x1, y1, p.x2) : Z.antiFrom(x1, y1, p.x2));
  const y2 = Z.dstr(values(p).y2);
  return Z.deNum(p.type === 'prop' ? Z.propBack(x1, y1, y2) : Z.antiFrom(y1, x1, y2));
}

// ================================================================== L4: judge a model
/** Situations where the claimed model does NOT fit. Each returns {given, claim, why, x1, y1, x2, y2} (Fractions). */
const BAD = {
  prop: [
    rng => { const a1 = rng.int(2, 4), per = rng.pick([42, 44, 45, 46, 48]), a2 = rng.int(12, 16), h1 = a1 * per;
      return { id: 'height', x1: a1, y1: h1, x2: a2, y2: F(h1).div(a1).mul(a2), given: `${rng.pick(['Lisa', 'Nina', 'Ella', 'Jana'])} war mit ${a1} Jahren ${h1} cm groß.`, claim: v => `Dann ist sie mit ${a2} Jahren ${deNum(v)} cm groß.`,
        why: 'Kinder wachsen nicht gleichmäßig, und Erwachsene wachsen gar nicht mehr. Alter und Körpergröße sind nicht proportional.' }; },
    rng => { const t = rng.pick([11, 12, 13, 14]), d = rng.pick([5, 10, 20]);
      return { id: 'sprint', x1: 100, y1: t, x2: d * 1000, y2: F(t).mul(d * 10), given: `Ein Sprinter läuft 100 m in ${t} s.`, claim: v => `Dann läuft er ${d} km (also ${d * 1000} m) in ${deNum(v)} s.`,
        why: 'Das hohe Tempo eines Sprints hält niemand über viele Kilometer durch. Laufzeit und Strecke sind hier nicht proportional.' }; },
    rng => { const b = rng.pick(['3', '3.5', '4']), r = rng.pick(['2', '2.5', '2.2']), k1 = rng.int(3, 8), k2 = rng.int(9, 20), p1 = F(b).add(F(r).mul(k1));
      return { id: 'taxi', x1: k1, y1: p1, x2: k2, y2: p1.div(k1).mul(k2), given: `Eine Taxifahrt kostet ${eur(F(b))} Grundgebühr und ${eur(F(r))} pro km. ${k1} km kosten also ${eur(p1)}.`, claim: v => `Dann kosten ${k2} km ${eur(v)}.`, money: true,
        why: 'Wegen der Grundgebühr kostet die doppelte Strecke nicht das Doppelte. Der Fahrpreis ist nicht proportional zur Strecke.' }; },
    rng => { const n1 = rng.int(3, 6), t = rng.pick([2, 3]), n2 = n1 * rng.int(2, 3);
      return { id: 'laundry', x1: n1, y1: t, x2: n2, y2: F(t).div(n1).mul(n2), given: `${n1} T-Shirts trocknen auf der Wäscheleine in ${t} h.`, claim: v => `Dann trocknen ${n2} T-Shirts in ${deNum(v)} h.`,
        why: 'Alle T-Shirts hängen gleichzeitig auf der Leine und trocknen gleichzeitig. Mehr T-Shirts brauchen nicht länger.' }; },
  ],
  anti: [
    rng => { const n = rng.pick([30, 40, 50, 60]), t = rng.pick([30, 36, 40, 45]), m = n * 2;
      return { id: 'orchestra', x1: n, y1: t, x2: m, y2: F(t * n).div(m), given: `Ein Orchester mit ${n} Musikern spielt eine Sinfonie in ${t} min.`, claim: v => `Dann spielen ${m} Musiker die Sinfonie in ${deNum(v)} min.`,
        why: 'Ein Musikstück dauert gleich lang, egal wie viele Musiker es spielen.' }; },
    rng => { const n = rng.int(2, 4), t = rng.pick([8, 10, 12]), m = n * 2;
      return { id: 'eggs', x1: n, y1: t, x2: m, y2: F(t * n).div(m), given: `${n} Eier sind in einem Topf nach ${t} min hart gekocht.`, claim: v => `Dann sind ${m} Eier im selben Topf nach ${deNum(v)} min hart gekocht.`,
        why: 'Die Eier kochen gleichzeitig im selben Topf. Die Kochzeit hängt nicht von der Anzahl der Eier ab.' }; },
    rng => { const n = rng.int(2, 3), t = rng.pick([6, 8, 9, 12]), m = rng.pick([24, 36, 48]);
      return { id: 'painters', x1: n, y1: t, x2: m, y2: F(t * n).div(m), given: `${n} Maler streichen ein Zimmer in ${t} h.`, claim: v => `Dann streichen ${m} Maler das Zimmer in ${deNum(v)} h.`,
        why: 'So viele Maler passen nicht in ein Zimmer – sie behindern sich gegenseitig. Das antiproportionale Modell gilt hier nur für wenige Maler.' }; },
    rng => { const t = rng.pick([3, 4, 5, 6]), m = rng.int(2, 4);
      return { id: 'hikers', x1: 1, y1: t, x2: m, y2: F(t).div(m), given: `Ein Wanderer braucht für einen Rundweg ${t} h.`, claim: v => `Dann brauchen ${m} Wanderer, die zusammen gehen, ${deNum(v)} h.`,
        why: 'Jeder Wanderer muss den ganzen Weg selbst gehen. Zu mehreren geht es nicht schneller.' }; },
  ],
};

/** Sample a judge item: mode ok (correct calc, fitting model) | err (fitting model, wrong calc) | bad (unfitting model). */
function sampleJudge(rng, type) {
  const mode = rng.pick(['ok', 'err', 'bad']), name = rng.int(0, Z.NAMES.length - 1);
  if (mode === 'bad') { const bi = rng.int(0, BAD[type].length - 1); return { type, mode, bad: bi, seed: rng.int(0, 1e6), name }; }
  const t = sampleTask(rng, type, 2);
  return { ...t, ask: 'y', mode, wrong: rng.pick(['other', 'add']), name };
}
function badCase(p) {
  return BAD[p.type][p.bad](new Rng(p.seed >>> 0));
}
/** Claimed value of a judge item (build path). */
function claimed(p) {
  if (p.mode === 'bad') return F(badCase(p).y2);
  const v = values(p);
  if (p.mode === 'ok') return v.y2;
  if (p.wrong === 'other') return p.type === 'prop' ? v.y1.mul(v.x1).div(v.x2) : v.y1.mul(v.x2).div(v.x1);
  return p.type === 'prop' ? v.y1.add(v.x2.sub(v.x1)) : v.y1.sub(v.x2.sub(v.x1));
}
function judgeConstraints(p) {
  if (p.mode !== 'bad') { const c = taskConstraints(p); if (c !== true) return c; }
  const v = claimed(p);
  if (!Z.fitsPlaces(v, 2) || v.sign() <= 0) return 'claim not a short decimal';
  if (p.mode === 'err') { const ctx = ctxOf(p); if (!Z.admissible(v, ctx.y) || v.eq(values(p).y2)) return 'bad wrong claim'; }
  return true;
}
const ADJ = { prop: 'proportionale', anti: 'antiproportionale' };
function buildJudge(p) {
  const name = Z.NAMES[p.name], v = claimed(p);
  let given, claim, why, truth;
  if (p.mode === 'bad') { const b = badCase(p); given = b.given; claim = b.claim(v); why = b.why; truth = 'b'; }
  else {
    const ctx = ctxOf(p), val = values(p);
    given = ctx.given(val.x1, val.y1); claim = ctx.claim(val.x2, v);
    truth = p.mode === 'ok' ? 'a' : 'c';
    why = p.mode === 'ok' ? `Die Situation passt zu einer ${ADJ[p.type]}n Zuordnung, und der Wert stimmt.` : `Die Situation passt zu einer ${ADJ[p.type]}n Zuordnung, aber richtig wäre ${ctx.y.text(val.y2)}.`;
  }
  const fb = {
    a: truth === 'b' ? 'Die Rechnung passt zwar zum Modell, aber überlege, ob die Situation wirklich so funktioniert.' : 'Rechne nach: Stimmt der angegebene Wert?',
    b: truth === 'a' ? 'Hier passt das Modell zur Situation. Prüfe die Rechnung – sie stimmt auch.' : 'Hier passt das Modell zur Situation. Das Problem liegt in der Rechnung.',
    c: truth === 'a' ? 'Rechne nach: Der Wert stimmt.' : 'Rechne mit dem Modell nach: Der Wert passt zum Modell. Das Problem ist das Modell selbst.',
  };
  const texts = {
    a: 'Die Rechnung stimmt, und das Modell passt zur Situation.',
    b: `Die Rechnung passt zum Modell, aber eine ${ADJ[p.type]} Zuordnung passt nicht zur Situation.`,
    c: 'Das Modell passt zur Situation, aber die Rechnung ist falsch.',
  };
  const options = ['a', 'b', 'c'].map(id => (id === truth ? { id, text: texts[id] } : { id, text: texts[id], category: 'concept_confusion', feedback: fb[id] }));
  const steps = [];
  if (p.mode === 'bad') steps.push(`Rechnung im ${ADJ[p.type].replace(/e$/, 'en')} Modell: Der Wert ${deNum(v)} ergibt sich, wenn man ${p.type === 'prop' ? 'mit demselben Faktor vervielfacht' : 'das Produkt konstant hält'}.`, why);
  else {
    const val = values(p), ctx = ctxOf(p);
    steps.push(p.type === 'prop'
      ? `Wert für 1: ${$(`${vt(ctx.y, val.y1)} : ${texNum(val.x1)} = ${tq(val.k)}`)}; für ${ctx.x.text(val.x2)}: ${$(`${tq(val.k)} \\cdot ${texNum(val.x2)} = ${vt(ctx.y, val.y2)}`)}.`
      : `Produkt: ${$(`${texNum(val.x1)} \\cdot ${vt(ctx.y, val.y1)} = ${tq(val.k)}`)}; für ${ctx.x.text(val.x2)}: ${$(`${tq(val.k)} : ${texNum(val.x2)} = ${vt(ctx.y, val.y2)}`)}.`, why);
  }
  return {
    prompt: `${name} überlegt: „${given} ${claim}“ Beurteile die Überlegung.`,
    instructions: 'Prüfe zwei Dinge: Passt das Modell zur Situation? Stimmt die Rechnung?',
    answer: { type: 'choice', options, correct: truth, canonical: truth },
    hints: hints(
      `Frage 1: Ist die Zuordnung in dieser Situation wirklich ${ADJ[p.type].replace(/e$/, '')}? Frage 2: Stimmt die Rechnung?`,
      p.type === 'prop' ? 'Überlege, ob zum Doppelten wirklich das Doppelte gehört – auch für große Werte. Rechne dann mit dem Dreisatz nach.' : 'Überlege, ob zum Doppelten wirklich die Hälfte gehört – auch für große Werte. Rechne dann mit dem Dreisatz nach.',
      steps[0], steps,
      p.type === 'prop' ? 'Stell dir die Situation mit sehr großen Werten vor. Wenn das Ergebnis unsinnig wird, passt das Modell nicht.' : 'Stell dir die Situation mit sehr vielen Personen oder Dingen vor. Wenn das Ergebnis unsinnig wird, passt das Modell nicht.'),
    solution: { steps, result: texts[truth] },
  };
}
function solveJudge(p) {
  if (p.mode === 'bad') return 'b';
  const v = claimed(p), x1 = p.x1, y1 = Z.dstr(values(p).y1);
  const right = p.type === 'prop' ? Z.propFrom(x1, y1, p.x2) : Z.antiFrom(x1, y1, p.x2);
  return right.eq(v) ? 'a' : 'c';
}

// ================================================================== templates
function make(type) {
  const skillId = type === 'prop' ? 'ch2.prop.recognize_compute' : 'ch2.antiprop.recognize_compute';
  return {
    id: `${skillId}.dreisatz`, version: 1, skillId,
    families: type === 'prop' ? ['dreisatz_context', 'model_check'] : ['dreisatz_inverse', 'model_check'],
    levels: [2, 3, 4],
    levelNotes: type === 'prop' ? {
      2: 'Dreisatz im Sachzusammenhang mit ganzen ersten Werten (Preis, Wasser, Strecke, Rezept).',
      3: 'Dezimalzahlen (halbe Kilogramm, Cent-Beträge) und auch rückwärts: Wie viel bekommt man für …?',
      4: 'Eine Überlegung beurteilen: Passt das proportionale Modell (Wachstum, Sprint, Taxi-Grundgebühr, Wäsche) und stimmt die Rechnung?',
    } : {
      2: 'Antiproportionaler Dreisatz im Sachzusammenhang (Kosten teilen, Pumpen, Fahrzeit, Beete, Vorrat, Tüten).',
      3: 'Dezimalzahlen und auch rückwärts: Wie viele Pumpen/Personen braucht man für …?',
      4: 'Grenzen des Modells: Passt die antiproportionale Zuordnung (Orchester, Eier, viele Maler, Wanderer) und stimmt die Rechnung?',
    },
    misconceptions: type === 'prop' ? ['inverse_dreisatz', 'additive_reasoning', 'units', 'model_overreach'] : ['wrong_dreisatz', 'additive_reasoning', 'model_limits'],
    sample(rng, level) { return level === 4 ? sampleJudge(rng, type) : sampleTask(rng, type, level); },
    constraints(p, level) { return level === 4 ? judgeConstraints(p) : taskConstraints(p); },
    signatureParams(p, level) { if (level !== 4) return p; const { name, ...rest } = p; return rest; },
    build(p, level) { return level === 4 ? buildJudge(p) : buildTask(p); },
    solve(p, level) { return level === 4 ? solveJudge(p) : solveTask(p); },
  };
}

module.exports = { prop: make('prop'), anti: make('anti'), sampleTask, buildTask, solveTask, taskConstraints };
