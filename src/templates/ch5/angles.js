'use strict';
/**
 * Chapter V (LS7 V.1, V.2) — angles at intersecting lines and the angle sum in a triangle (Session 12, D97).
 *
 * Every question carries a `diagram` built from explicit geometry data (src/diagram.js). The diagram is drawn
 * accurately from the parameters; answers are never read from it by the student's side — but the INDEPENDENT
 * SOLVERS of the computation templates measure the asked angle from the diagram's coordinates (atan2) and round
 * to whole degrees. So the picture, the numbers in the text and the answer key are checked against each other.
 *
 * Angle names: at S₁ (on g) α, β, γ, δ counter-clockwise from the right-upper angle; at S₂ (on h) α′, β′, γ′, δ′.
 * Positions: 0 = rechts oben, 1 = links oben, 2 = links unten, 3 = rechts unten (relative to the line and t).
 * Wechselwinkel are only asked for the inner pair (between the parallels, „Z-Figur“); the outer alternate pair and
 * the co-interior pair are never named, so no task depends on a naming convention that may differ between books.
 */
const U = require('../util');
const D = require('../../diagram');
const { F, hints, $ } = U;

const IDS = ['a', 'b', 'c', 'd'];
const NAMES = ['α', 'β', 'γ', 'δ'];
const TEXN = ['\\alpha', '\\beta', '\\gamma', '\\delta'];
const RAYS = [['R', 'U'], ['U', 'L'], ['L', 'D'], ['D', 'R']];
const deg = v => `$${v}^\\circ$`;
const nm = (k, pos) => NAMES[pos] + (k === 2 ? '′' : '');
const tn = (k, pos) => `$${TEXN[pos]}${k === 2 ? "'" : ''}$`;
const REL = { scheitel: 'Scheitelwinkel', neben: 'Nebenwinkel', stufen: 'Stufenwinkel', wechsel: 'Wechselwinkel' };

function arrange(list, key) {
  return list.map((c, i) => ({ c, k: (key ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0 })).sort((x, y) => x.k - y.k).map(o => o.c);
}

// ---------------------------------------------------------------- configurations (diagram data)
/** Rays of one intersection: line direction lam, transversal direction th (degrees). */
function rays(points, k, S, lam, th) {
  points[`S${k}`] = S;
  points[`R${k}`] = D.polar(S, 46, lam); points[`L${k}`] = D.polar(S, 46, lam + 180);
  points[`U${k}`] = D.polar(S, 46, th); points[`D${k}`] = D.polar(S, 46, th + 180);
}
const angleEl = (k, pos, extra) => ({ t: 'angle', at: `S${k}`, from: `${RAYS[pos][0]}${k}`, to: `${RAYS[pos][1]}${k}`, ...extra });

/** Two lines g (horizontal) and t (direction th) through S. */
function crossing(th, marks, alt) {
  const points = {};
  rays(points, 1, D.pt(160, 100), 0, th);
  points.G1 = D.polar(points.S1, 80, 180); points.G2 = D.polar(points.S1, 80, 0);
  points.T1 = D.polar(points.S1, 80, th + 180); points.T2 = D.polar(points.S1, 80, th);
  return { kind: 'accurate', width: 320, height: 200, points, alt,
    elements: [{ t: 'line', a: 'G1', b: 'G2', label: 'g' }, { t: 'line', a: 'T1', b: 'T2', label: 't' }, ...marks.map(m => angleEl(1, m.pos, m.el)), { t: 'point', p: 'S1', label: 'S', dir: -60 }] };
}
/** g (horizontal, y = 140) and h (direction phi, through S₂ at y = 60), cut by t (direction th). */
function parallels(th, phi, marks, showParallel, alt) {
  const off = 40 / Math.tan(th * Math.PI / 180);
  const points = {};
  rays(points, 1, D.pt(160 + off, 140), 0, th);
  rays(points, 2, D.pt(160 - off, 60), phi, th);
  points.G1 = D.pt(10, 140); points.G2 = D.pt(310, 140);
  points.H1 = D.polar(points.S2, 150, phi + 180); points.H2 = D.polar(points.S2, 150, phi);
  const els = [{ t: 'line', a: 'G1', b: 'G2', label: 'g' }, { t: 'line', a: 'H1', b: 'H2', label: 'h' }, { t: 'line', a: 'S2', b: 'S1', label: 't' }];
  if (showParallel) els.push({ t: 'parallel', a: 'G1', b: 'G2' }, { t: 'parallel', a: 'H1', b: 'H2' });
  for (const m of marks) els.push(angleEl(m.k, m.pos, m.el));
  return { kind: 'accurate', width: 320, height: 200, points, elements: els, alt };
}
/** Angle size at (k, pos) for transversal th and line direction lam (S₁: lam = 0, S₂: lam = phi). */
function value(th, lam, pos) { const a = th - lam; return pos % 2 === 0 ? a : 180 - a; }

/** Measure an angle element of a diagram from its coordinates (independent solver), in whole degrees. */
function measure(d, k, pos) {
  const S = d.points[`S${k}`], A = d.points[`${RAYS[pos][0]}${k}`], B = d.points[`${RAYS[pos][1]}${k}`];
  let a = Math.atan2(B.y - S.y, B.x - S.x) - Math.atan2(A.y - S.y, A.x - S.x);
  while (a < 0) a += 2 * Math.PI;
  return Math.round(a * 180 / Math.PI);
}
/** Relation of two angles classified from the diagram geometry (bisector directions; independent solver). */
function classify(d, k1, p1, k2, p2) {
  const bis = (k, pos) => {
    const S = d.points[`S${k}`], A = d.points[`${RAYS[pos][0]}${k}`], B = d.points[`${RAYS[pos][1]}${k}`];
    const ua = [A.x - S.x, A.y - S.y], ub = [B.x - S.x, B.y - S.y];
    const na = Math.hypot(...ua), nb = Math.hypot(...ub);
    return [ua[0] / na + ub[0] / nb, ua[1] / na + ub[1] / nb];
  };
  const b1 = bis(k1, p1), b2 = bis(k2, p2);
  const cos = (b1[0] * b2[0] + b1[1] * b2[1]) / (Math.hypot(...b1) * Math.hypot(...b2));
  if (k1 === k2) return cos < -0.99 ? 'scheitel' : 'neben';
  const S1 = d.points[`S${k1}`], S2 = d.points[`S${k2}`];
  // tolerance 0.99 (≈ 8°): at L3 the line h may be tilted by up to 9°, which turns a bisector at S₂ by half of it
  if (cos > 0.99) return 'stufen';
  if (cos < -0.99) {
    const towards = (b, A, B) => b[0] * (B.x - A.x) + b[1] * (B.y - A.y) > 0;
    return towards(b1, S1, S2) && towards(b2, S2, S1) ? 'wechsel' : 'outer';
  }
  return 'other';
}
/** Relation from the positions alone (used by build; the solvers use `classify`). */
function relationOf(k1, p1, k2, p2) {
  if (k1 === k2) return Math.abs(p1 - p2) === 2 ? 'scheitel' : 'neben';
  if (p1 === p2) return 'stufen';
  const [a, b] = k1 === 1 ? [p1, p2] : [p2, p1];
  if ((a === 2 && b === 0) || (a === 3 && b === 1)) return 'wechsel';
  return Math.abs(a - b) === 2 ? 'outer' : 'other';
}
const sampleTheta = rng => rng.pick([rng.int(35, 80), rng.int(100, 145)]);

// ---------------------------------------------------------------- ch5.angles.lines
const LINES = 'ch5.angles.lines';
/**
 * Template ch5.angles.lines.angle_chase (family angle_chase)
 * Levels
 *  L1 Grundlagen    two intersecting lines; one given angle → Scheitel- or Nebenwinkel (one step).
 *  L2 Standard      two parallels cut by t; given angle at one point, asked angle at the other point that is
 *                   neither Stufen- nor Wechselwinkel to it (two relations: Stufenwinkel, then Nebenwinkel).
 *  L3 Anspruchsvoll two angles given as terms in x (Scheitel-/Stufen-/Wechselwinkel → equal, Nebenwinkel → 180°);
 *                   set up and solve the equation (Chapter IV), then the angle size.
 * Misconceptions: neben_equal (Nebenwinkel taken as equal), scheitel_supplement (Scheitelwinkel as 180° − α).
 */
const angleChase = {
  id: `${LINES}.angle_chase`, version: 1, skillId: LINES,
  families: ['angle_chase'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Zwei sich schneidende Geraden: Scheitel- oder Nebenwinkel in einem Schritt.',
    2: 'Zwei Parallelen und eine Schnittgerade: zwei Beziehungen nacheinander (Stufenwinkel, dann Nebenwinkel).',
    3: 'Zwei Winkel als Terme mit x: Gleichung aufstellen und lösen, dann die Winkelgröße angeben.',
  },
  misconceptions: ['neben_equal', 'stufen_wechsel'],
  sample(rng, level) {
    const th = sampleTheta(rng);
    if (level === 1) { const g = rng.int(0, 3); return { th, g: [1, g], a: [1, rng.intExcept(0, 3, [g])] }; }
    if (level === 2) {
      const from = rng.int(1, 2), g = rng.int(0, 3);
      return { th, g: [from, g], a: [3 - from, rng.pick([(g + 1) % 4, (g + 3) % 4])] };
    }
    // L3: a related pair, both angles as terms a·x + b
    const kind = rng.pick(['scheitel', 'neben', 'stufen', 'wechsel']);
    const p1 = rng.int(0, 3);
    let pair;
    if (kind === 'scheitel') pair = [[1, p1], [1, (p1 + 2) % 4]];
    else if (kind === 'neben') pair = [[1, p1], [1, (p1 + 1) % 4]];
    else if (kind === 'stufen') pair = [[1, p1], [2, p1]];
    else pair = rng.bool() ? [[1, 2], [2, 0]] : [[1, 3], [2, 1]];
    if (rng.bool()) pair.reverse();
    const x = rng.int(4, 30), a1 = rng.int(1, 5), a2 = rng.intExcept(1, 5, [a1]);
    return { th, g: pair[0], a: pair[1], x, a1, a2 };
  },
  constraints(p, level) {
    if (level === 3) {
      const v1 = value(p.th, 0, p.g[1]), v2 = value(p.th, 0, p.a[1]);
      const b1 = v1 - p.a1 * p.x, b2 = v2 - p.a2 * p.x;
      if (b1 === 0 || b2 === 0 || Math.abs(b1) > 120 || Math.abs(b2) > 120) return 'awkward constants';
      if (relationOf(p.g[0], p.g[1], p.a[0], p.a[1]) === 'neben' && p.a1 + p.a2 === 0) return 'degenerate';
    }
    return true;
  },
  terms(p) {
    const v1 = value(p.th, 0, p.g[1]), v2 = value(p.th, 0, p.a[1]);
    const t = (a, b) => U.polyMachine([[a, 1], [b, 0]]);
    return { m1: t(p.a1, v1 - p.a1 * p.x), m2: t(p.a2, v2 - p.a2 * p.x) };
  },
  diagram(p, level) {
    const asked = { k: p.a[0], pos: p.a[1], el: { label: nm(...p.a), mark: level < 3 } };
    const given = { k: p.g[0], pos: p.g[1], el: { label: nm(...p.g) } };
    const alt = level === 1
      ? `Zwei Geraden g und t schneiden sich im Punkt S. Markiert sind die Winkel ${nm(...p.g)} und ${nm(...p.a)}.`
      : `Zwei parallele Geraden g und h werden von der Geraden t geschnitten. Markiert sind die Winkel ${nm(...p.g)} und ${nm(...p.a)}.`;
    return level === 1 ? crossing(p.th, [given, asked], alt) : parallels(p.th, 0, [given, asked], true, alt);
  },
  build(p, level) {
    const diagram = this.diagram(p, level);
    const gv = value(p.th, 0, p.g[1]), av = value(p.th, 0, p.a[1]);
    const G = tn(...p.g), A = tn(...p.a);
    const rel = relationOf(p.g[0], p.g[1], p.a[0], p.a[1]);
    if (level === 3) {
      const { m1, m2 } = this.terms(p);
      const eqRel = rel !== 'neben';
      const t1 = U.tex(m1), t2 = U.tex(m2);
      const eqTex = eqRel ? `${t1} = ${t2}` : `\\left(${t1}\\right) + \\left(${t2}\\right) = 180`;
      const steps = [
        `${G} und ${A} sind ${REL[rel]}${rel === 'stufen' || rel === 'wechsel' ? ' an den Parallelen $g$ und $h$' : ''}. ${eqRel ? 'Sie sind gleich groß.' : 'Sie ergänzen sich zu $180^\\circ$.'}`,
        `Gleichung: $${eqTex}$.`,
        `Lösung: $x = ${p.x}$.`,
        `Einsetzen in ${G} $= \\left(${t1}\\right)^\\circ$ mit $x = ${p.x}$: ${G} $= ${gv}^\\circ$.`,
      ];
      const cells = [
        { id: 'x', label: '$x$', spec: { type: 'integer', value: String(p.x), canonical: String(p.x), variable: 'x' } },
        { id: 'w', label: `${G} in Grad`, spec: { type: 'integer', value: String(gv), canonical: String(gv), unit: '°',
          distractors: U.numDistractors(gv, [{ value: 180 - gv, category: 'concept_confusion', feedback: 'Setze $x$ in den Term für diesen Winkel ein.' }]) } },
      ];
      return {
        prompt: `Die Geraden $g$ und $h$ sind parallel. Es gilt ${G} $= \\left(${t1}\\right)^\\circ$ und ${A} $= \\left(${t2}\\right)^\\circ$. Berechne $x$ und die Größe von ${G}.`,
        instructions: 'Stelle mit der passenden Winkelbeziehung eine Gleichung auf.',
        diagram,
        answer: { type: 'table', cells },
        hints: hints(
          `Welche Beziehung haben ${G} und ${A}? Schau in die Zeichnung.`,
          'Gleich große Winkel: Terme gleichsetzen. Nebenwinkel: Die Summe der Terme ist $180$.',
          `Stelle die Gleichung auf: $${eqTex}$.`,
          steps,
          `Probe: Setze $x=${p.x}$ in beide Terme ein. ${eqRel ? 'Beide Winkel müssen gleich groß sein.' : 'Die Summe muss $180^\\circ$ sein.'}`),
        solution: { steps, result: `$x = ${p.x}$; ${G} $= ${gv}^\\circ$` },
      };
    }
    const steps = level === 1
      ? [`${G} und ${A} sind ${REL[rel]}. ${rel === 'scheitel' ? 'Scheitelwinkel sind gleich groß.' : 'Nebenwinkel ergänzen sich zu $180^\\circ$.'}`,
        rel === 'scheitel' ? `${A} $= ${gv}^\\circ$` : `${A} $= 180^\\circ - ${gv}^\\circ = ${av}^\\circ$`]
      : [`${G} und ${tn(p.a[0], p.g[1])} sind Stufenwinkel an den Parallelen $g$ und $h$, also ${tn(p.a[0], p.g[1])} $= ${gv}^\\circ$.`,
        `${tn(p.a[0], p.g[1])} und ${A} sind Nebenwinkel: ${A} $= 180^\\circ - ${gv}^\\circ = ${av}^\\circ$.`];
    const dis = rel === 'scheitel'
      ? [{ value: 180 - gv, category: 'concept_confusion', feedback: 'Scheitelwinkel liegen sich gegenüber und sind gleich groß – sie ergänzen sich nicht zu $180^\\circ$.' }]
      : [{ value: gv, category: 'concept_confusion', feedback: 'Die beiden Winkel liegen an einer Geraden nebeneinander. Sie ergänzen sich zu $180^\\circ$.' }];
    return {
      prompt: level === 1
        ? `Die Geraden $g$ und $t$ schneiden sich. Es ist ${G} $= ${gv}^\\circ$. Berechne ${A}.`
        : `Die Geraden $g$ und $h$ sind parallel. Es ist ${G} $= ${gv}^\\circ$. Berechne ${A}.`,
      instructions: 'Gib die Winkelgröße in Grad an.',
      diagram,
      answer: { type: 'integer', value: String(av), canonical: String(av), unit: '°', distractors: U.numDistractors(av, dis) },
      hints: hints(
        level === 1 ? 'Liegen die beiden Winkel gegenüber oder nebeneinander?' : 'Gehe in zwei Schritten: Übertrage den Winkel zuerst an den anderen Schnittpunkt.',
        level === 1 ? 'Scheitelwinkel sind gleich groß. Nebenwinkel ergänzen sich zu $180^\\circ$.' : 'An Parallelen sind Stufenwinkel gleich groß. Danach hilft ein Nebenwinkel.',
        steps[0], steps,
        'Schätze in der Zeichnung: Ist der gesuchte Winkel spitz (kleiner als $90^\\circ$) oder stumpf? Passt dein Ergebnis dazu?'),
      solution: { steps, result: `${A} = $${av}$°` },
    };
  },
  solve(p, level) {
    const d = this.diagram(p, level);
    const measuredGiven = measure(d, ...p.g), measuredAsked = measure(d, ...p.a);
    if (level < 3) return String(measuredAsked);
    // L3: solve a1·x + b1 = measured size of the first angle; check the second term at that x
    const { m1, m2 } = this.terms(p);
    const b1 = U.evalMachine(m1, { x: F(0) });
    const x = F(measuredGiven).sub(b1).div(p.a1);
    if (!U.evalMachine(m2, { x }).eq(measuredAsked)) return null;
    return { x: x.toString(), w: String(measuredGiven) };
  },
};

/**
 * Template ch5.angles.lines.name_relation (family name_relation)
 * Levels
 *  L1 Grundlagen    name the relation of two marked angles (Scheitel-, Neben-, Stufen- oder Wechselwinkel).
 *  L3 Anspruchsvoll Umkehrung: given one angle at each point (Stufen- or Wechselwinkel pair) — are g and h parallel?
 *                   The diagram is drawn true to the numbers (h tilted when they differ).
 *  L4 Transfer      choose the correct justification for a computed angle (name of the relation AND the premise
 *                   „an Parallelen“).
 * Misconceptions: stufen_wechsel, judging parallelism by eye, missing premise („Stufenwinkel sind immer gleich“).
 */
const nameRelation = {
  id: `${LINES}.name_relation`, version: 1, skillId: LINES,
  families: ['name_relation'],
  levels: [1, 3, 4],
  levelNotes: {
    1: 'Zwei markierte Winkel: Scheitel-, Neben-, Stufen- oder Wechselwinkel?',
    3: 'Umkehrung: Sind die Geraden parallel? Entscheiden mit Stufen- oder Wechselwinkeln.',
    4: 'Die richtige Begründung für eine Winkelgröße auswählen (Beziehung und Voraussetzung „an Parallelen“).',
  },
  misconceptions: ['stufen_wechsel', 'parallel_by_eye'],
  sample(rng, level) {
    const th = sampleTheta(rng);
    const kind = rng.pick(level === 1 ? ['scheitel', 'neben', 'stufen', 'wechsel'] : ['stufen', 'wechsel']);
    let pair;
    const p1 = rng.int(0, 3);
    if (kind === 'scheitel') { const k = rng.int(1, 2); pair = [[k, p1], [k, (p1 + 2) % 4]]; }
    else if (kind === 'neben') { const k = rng.int(1, 2); pair = [[k, p1], [k, (p1 + 1) % 4]]; }
    else if (kind === 'stufen') pair = [[1, p1], [2, p1]];
    else pair = rng.bool() ? [[1, 2], [2, 0]] : [[1, 3], [2, 1]];
    if (rng.bool()) pair.reverse();
    const parallel = level === 3 ? rng.bool() : true;
    const phi = parallel ? 0 : rng.pick([-1, 1]) * rng.int(3, 9);
    return { th, kind, g: pair[0], a: pair[1], phi, order: rng.uint32() };
  },
  signatureParams(p) { return { th: p.th, g: p.g, a: p.a, phi: p.phi }; },
  diagram(p, level) {
    const marks = [{ k: p.g[0], pos: p.g[1], el: { label: nm(...p.g), mark: level === 1 } }, { k: p.a[0], pos: p.a[1], el: { label: nm(...p.a), mark: true } }];
    const alt = level === 3
      ? `Zwei Geraden g und h werden von der Geraden t geschnitten. Markiert sind die Winkel ${nm(...p.g)} und ${nm(...p.a)}.`
      : `Zwei parallele Geraden g und h werden von der Geraden t geschnitten. Markiert sind die Winkel ${nm(...p.g)} und ${nm(...p.a)}.`;
    return parallels(p.th, p.phi, marks, level !== 3, alt);
  },
  val(p, k, pos) { return value(p.th, k === 2 ? p.phi : 0, pos); },
  options(p, level) {
    const rel = relationOf(p.g[0], p.g[1], p.a[0], p.a[1]);
    const G = tn(...p.g), A = tn(...p.a);
    if (level === 1) {
      return ['scheitel', 'neben', 'stufen', 'wechsel'].map(r => ({ key: r, text: REL[r], ok: r === rel,
        category: 'concept_confusion',
        fb: r === 'stufen' && rel === 'wechsel' ? 'Stufenwinkel liegen auf derselben Seite von $t$ (F-Figur). Hier liegen die Winkel auf verschiedenen Seiten (Z-Figur).'
          : r === 'wechsel' && rel === 'stufen' ? 'Wechselwinkel liegen auf verschiedenen Seiten von $t$ (Z-Figur). Hier liegen die Winkel auf derselben Seite (F-Figur).'
            : (r === 'scheitel' || r === 'neben') && p.g[0] !== p.a[0] ? 'Scheitel- und Nebenwinkel haben denselben Scheitelpunkt. Diese Winkel liegen an verschiedenen Schnittpunkten.'
              : 'Schau, ob die Winkel einen Schenkel gemeinsam haben (Nebenwinkel) oder sich gegenüberliegen (Scheitelwinkel).' }));
    }
    const vg = this.val(p, ...p.g), va = this.val(p, ...p.a);
    if (level === 3) {
      const par = vg === va;
      return [
        { key: 'yes', ok: par, text: `Ja. ${G} und ${A} sind ${REL[rel]} und gleich groß.`, category: 'concept_confusion', fb: `${G} und ${A} sind nicht gleich groß. Dann sind $g$ und $h$ nicht parallel.` },
        { key: 'no', ok: !par, text: `Nein. ${G} und ${A} sind ${REL[rel]}, aber nicht gleich groß.`, category: 'concept_confusion', fb: `${G} und ${A} sind gleich groß. Gleich große ${REL[rel]} zeigen: $g$ und $h$ sind parallel.` },
        { key: 'eye', ok: false, text: 'Ja. Die Geraden sehen in der Zeichnung parallel aus.', category: 'concept_confusion', fb: 'Nach Augenmaß kann man kleine Unterschiede nicht sehen. Entscheide mit den Winkelgrößen.' },
        { key: 'cannot', ok: false, text: 'Das kann man ohne Messen der Abstände nicht entscheiden.', category: 'concept_confusion', fb: `Die Umkehrung des Stufen- und Wechselwinkelsatzes hilft: Sind ${REL[rel]} gleich groß, sind die Geraden parallel.` },
      ];
    }
    const other = rel === 'stufen' ? 'wechsel' : 'stufen';
    return [
      { key: 'right', ok: true, text: `${A} $= ${va}^\\circ$, weil ${G} und ${A} ${REL[rel]} an den Parallelen $g$ und $h$ sind.` },
      { key: 'name', ok: false, text: `${A} $= ${va}^\\circ$, weil ${G} und ${A} ${REL[other]} an den Parallelen $g$ und $h$ sind.`, category: 'concept_confusion', fb: 'Das Ergebnis stimmt, aber die Winkelbeziehung ist falsch benannt. Stufenwinkel: F-Figur; Wechselwinkel: Z-Figur.' },
      { key: 'premise', ok: false, text: `${A} $= ${va}^\\circ$, weil ${REL[rel]} immer gleich groß sind.`, category: 'concept_confusion', fb: `${REL[rel]} sind nur an Parallelen gleich groß. Die Voraussetzung „an Parallelen“ gehört in die Begründung.` },
      { key: 'value', ok: false, text: `${A} $= ${180 - va}^\\circ$, weil ${G} und ${A} Nebenwinkel sind.`, category: 'concept_confusion', fb: 'Nebenwinkel haben denselben Scheitelpunkt. Diese Winkel liegen an verschiedenen Schnittpunkten.' },
    ];
  },
  constraints(p, level) {
    if (level === 4 && this.val(p, ...p.g) === 90) return 'right angle';
    return true;
  },
  build(p, level) {
    const diagram = this.diagram(p, level);
    const opts = level === 1 ? this.options(p, level) : arrange(this.options(p, level), p.order);
    const options = opts.map((o, i) => ({ id: IDS[i], text: o.text, ...(o.ok ? {} : { category: o.category, feedback: o.fb }) }));
    const correct = IDS[opts.findIndex(o => o.ok)];
    const rel = relationOf(p.g[0], p.g[1], p.a[0], p.a[1]);
    const G = tn(...p.g), A = tn(...p.a);
    const relHint = 'Scheitelwinkel: gleicher Scheitelpunkt, gegenüber. Nebenwinkel: gleicher Scheitelpunkt, ein gemeinsamer Schenkel. Stufenwinkel: verschiedene Schnittpunkte, gleiche Lage (F-Figur). Wechselwinkel: verschiedene Schnittpunkte, zwischen den Geraden auf verschiedenen Seiten von $t$ (Z-Figur).';
    if (level === 1) {
      const steps = [relHint, `${G} und ${A} sind ${REL[rel]}.`];
      return {
        prompt: `Wie heißen die Winkel ${G} und ${A} zueinander?`,
        instructions: 'Wähle die passende Winkelbeziehung aus.',
        diagram,
        answer: { type: 'choice', options, correct, canonical: correct },
        hints: hints('Haben die beiden Winkel denselben Scheitelpunkt oder liegen sie an verschiedenen Schnittpunkten?',
          'Fahre mit dem Finger die Schenkel nach: Entsteht ein F oder ein Z?', relHint, steps,
          'Stelle dir vor, du verschiebst $g$ entlang $t$ auf $h$. Stufenwinkel kommen dabei genau aufeinander zu liegen.'),
        solution: { steps, result: REL[rel] },
      };
    }
    const vg = this.val(p, ...p.g), va = this.val(p, ...p.a);
    if (level === 3) {
      const steps = [`${G} und ${A} sind ${REL[rel]}.`, `${G} $= ${vg}^\\circ$, ${A} $= ${va}^\\circ$.`,
        vg === va ? `Die ${REL[rel]} sind gleich groß, also sind $g$ und $h$ parallel (Umkehrung).` : `Die ${REL[rel]} sind verschieden groß, also sind $g$ und $h$ nicht parallel.`];
      return {
        prompt: `Die Gerade $t$ schneidet die Geraden $g$ und $h$. Es ist ${G} $= ${vg}^\\circ$ und ${A} $= ${va}^\\circ$. Sind $g$ und $h$ parallel?`,
        instructions: 'Entscheide mit den Winkelgrößen, nicht nach Augenmaß.',
        diagram,
        answer: { type: 'choice', options, correct, canonical: correct },
        hints: hints('Welche Beziehung haben die beiden Winkel?', `Umkehrung: Sind ${REL[rel]} gleich groß, dann sind die Geraden parallel. Sind sie verschieden groß, dann nicht.`,
          `Vergleiche $${vg}^\\circ$ und $${va}^\\circ$.`, steps,
          'Wären $g$ und $h$ parallel, könnte man $g$ entlang $t$ auf $h$ schieben. Dann müssten die Winkel genau übereinstimmen.'),
        solution: { steps, result: opts.find(o => o.ok).text },
      };
    }
    const steps = [`${G} und ${A} sind ${REL[rel]} an den Parallelen $g$ und $h$.`, `${REL[rel]} an Parallelen sind gleich groß: ${A} $= ${G} = ${vg}^\\circ$.`,
      'Eine vollständige Begründung nennt die Beziehung und die Voraussetzung „an Parallelen“.'];
    return {
      prompt: `Die Geraden $g$ und $h$ sind parallel. Es ist ${G} $= ${vg}^\\circ$. Welche Begründung für die Größe von ${A} ist richtig?`,
      instructions: 'Wähle die vollständig richtige Begründung aus.',
      diagram,
      answer: { type: 'choice', options, correct, canonical: correct },
      hints: hints('Prüfe bei jeder Begründung zwei Dinge: Stimmt der Wert? Stimmt die Begründung?', 'Eine Begründung braucht die richtige Winkelbeziehung und ihre Voraussetzung.',
        `${G} und ${A}: F-Figur oder Z-Figur?`, steps, relHint),
      solution: { steps, result: opts.find(o => o.ok).text },
    };
  },
  solve(p, level) {
    const d = this.diagram(p, level);
    const rel = classify(d, ...p.g, ...p.a);
    const q = this.build(p, level);
    const ids = q.answer.options;
    if (level === 1) return (ids.find(o => o.text === REL[rel]) || {}).id || null;
    const mg = measure(d, ...p.g), ma = measure(d, ...p.a);
    if (level === 3) {
      const key = mg === ma ? 'Ja. ' : 'Nein. ';
      const hit = ids.filter(o => o.text.startsWith(key) && o.text.includes(REL[rel]));
      return hit.length === 1 ? hit[0].id : null;
    }
    const want = `${tn(...p.a)} $= ${ma}^\\circ$, weil ${tn(...p.g)} und ${tn(...p.a)} ${REL[rel]} an den Parallelen $g$ und $h$ sind.`;
    return (ids.find(o => o.text === want) || {}).id || null;
  },
};

// ---------------------------------------------------------------- ch5.angles.triangle_sum
const TRI = 'ch5.angles.triangle_sum';
/** Triangle with angles a (at A) and b (at B), scaled into a 320 × 200 box; C above AB. Optional extension D. */
function triangle(a, b, opts = {}) {
  const ra = a * Math.PI / 180, rb = b * Math.PI / 180;
  // A = (0,0), B = (1,0); C = intersection of the rays
  const t = Math.sin(rb) / Math.sin(ra + rb);
  const C0 = { x: t * Math.cos(ra), y: t * Math.sin(ra) };
  const xs = [0, 1, C0.x], ext = opts.extendBC ? 0.45 : 0;
  const Dx = C0.x + (C0.x - 1) * ext / Math.hypot(C0.x - 1, C0.y), Dy = C0.y + C0.y * ext / Math.hypot(C0.x - 1, C0.y);
  if (ext) xs.push(Dx);
  const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(C0.y, ext ? Dy : 0, opts.parallel ? C0.y : 0);
  const s = Math.min(260 / (maxX - minX), 150 / maxY);
  const tr = (x, y) => D.pt(30 + (x - minX) * s + (260 - (maxX - minX) * s) / 2, 28 + y * s);
  const points = { A: tr(0, 0), B: tr(1, 0), C: tr(C0.x, C0.y) };
  if (ext) points.D = tr(Dx, Dy);
  if (opts.parallel) { points.P1 = D.pt(points.C.x - 150, points.C.y); points.P2 = D.pt(points.C.x + 150, points.C.y); }
  return points;
}
/** Angle element with the counter-clockwise order chosen so that the arc is the inner angle (< 180°). */
function innerAngle(points, at, p, q, extra) {
  const S = points[at], u = points[p], v = points[q];
  const cross = (u.x - S.x) * (v.y - S.y) - (u.y - S.y) * (v.x - S.x);
  return cross > 0 ? { t: 'angle', at, from: p, to: q, ...extra } : { t: 'angle', at, from: q, to: p, ...extra };
}
function measureAt(points, at, p, q) {
  const S = points[at], u = points[p], v = points[q];
  const a = Math.abs(Math.atan2(u.y - S.y, u.x - S.x) - Math.atan2(v.y - S.y, v.x - S.x));
  return Math.round((a > Math.PI ? 2 * Math.PI - a : a) * 180 / Math.PI);
}
const triPoints = [{ t: 'point', p: 'A', label: 'A', dir: 225 }, { t: 'point', p: 'B', label: 'B', dir: -45 }, { t: 'point', p: 'C', label: 'C', dir: 90 }];

/**
 * Template ch5.angles.triangle_sum.missing_angle (family missing_angle)
 * Levels
 *  L1 Grundlagen    two angles given, the third is asked.
 *  L2 Standard      all three angles as terms in x; equation „Summe = 180°“, then x and the three angles.
 *  L3 Anspruchsvoll combined with angles at lines: Außenwinkel ε at C (Nebenwinkel of γ) and β given, α asked.
 * Misconceptions: sum_360 (angle sum taken as 360°), outer angle taken as γ.
 * Independent solver: measures the asked angle from the diagram coordinates (L1, L3); L2 solves the sum equation.
 */
const missingAngle = {
  id: `${TRI}.missing_angle`, version: 1, skillId: TRI,
  families: ['missing_angle'],
  levels: [1, 2, 3],
  levelNotes: {
    1: 'Zwei Winkel gegeben, der dritte Winkel ist gesucht.',
    2: 'Alle drei Winkel als Terme mit x: Gleichung mit der Winkelsumme aufstellen und lösen.',
    3: 'Mit Winkeln an Geraden kombiniert: Außenwinkel (Nebenwinkel) und ein Innenwinkel gegeben.',
  },
  misconceptions: ['sum_360', 'outer_as_inner'],
  sample(rng, level) {
    if (level === 2) {
      const x = rng.int(10, 40), k = [rng.int(1, 3), rng.int(1, 3), rng.int(1, 3)];
      return { level, x, k, b1: 0, b2: rng.int(-20, 40), perm: rng.int(0, 2) };
    }
    return { level, a: rng.int(25, 110), b: rng.int(25, 110), asked: level === 1 ? rng.pick(['A', 'B', 'C']) : 'A' };
  },
  angles(p) {
    if (p.level !== 2) return [p.a, p.b, 180 - p.a - p.b];
    const v1 = p.k[0] * p.x + p.b1, v2 = p.k[1] * p.x + p.b2;
    return [v1, v2, 180 - v1 - v2];
  },
  terms(p) {
    const vs = this.angles(p);
    const bs = [p.b1, p.b2, vs[2] - p.k[2] * p.x];
    const ts = [0, 1, 2].map(i => U.polyMachine([[p.k[i], 1], [bs[i], 0]]));
    // rotate which vertex gets which term (perm), so the plain „x“ term is not always at A
    return [0, 1, 2].map(i => ts[(i + p.perm) % 3]);
  },
  constraints(p) {
    let vs = this.angles(p);
    if (p.level === 2) { const ts = this.terms(p); vs = ts.map(t => Number(U.evalMachine(t, { x: F(p.x) }).n)); }
    if (vs.some(v => v < 15 || v > 140)) return 'angle out of range';
    if (p.level === 2 && new Set(vs).size < 2) return 'all equal';
    if (p.level === 3 && 180 - vs[2] === vs[0]) return 'ambiguous';
    return true;
  },
  diagram(p) {
    let vs = this.angles(p);
    if (p.level === 2) vs = this.terms(p).map(t => Number(U.evalMachine(t, { x: F(p.x) }).n));
    const pts = triangle(vs[0], vs[1], { extendBC: p.level === 3 });
    const asked = p.level === 1 ? p.asked : p.level === 3 ? 'A' : null;
    const lab = { A: 'α', B: 'β', C: 'γ' };
    const els = [{ t: 'polygon', pts: ['A', 'B', 'C'] },
      innerAngle(pts, 'A', 'B', 'C', { label: 'α', mark: asked === 'A' }),
      innerAngle(pts, 'B', 'C', 'A', { label: 'β', mark: asked === 'B' })];
    if (p.level === 3) els.push({ t: 'segment', a: 'C', b: 'D' }, innerAngle(pts, 'C', 'A', 'D', { label: 'ε' }));
    else els.push(innerAngle(pts, 'C', 'A', 'B', { label: 'γ', mark: asked === 'C' }));
    els.push(...triPoints);
    return { kind: 'accurate', width: 320, height: 200, points: pts, elements: els,
      alt: p.level === 3 ? 'Dreieck ABC. Die Seite BC ist über C hinaus verlängert; dort liegt der Außenwinkel ε. Markiert sind α, β und ε.'
        : `Dreieck ABC mit den Winkeln α bei A, β bei B und γ bei C${asked ? `; gesucht ist ${lab[asked]}` : ''}.` };
  },
  build(p, level) {
    const diagram = this.diagram(p);
    const help = (a, b, c) => hints('Die drei Innenwinkel eines Dreiecks ergeben zusammen $180^\\circ$.', a, b, c,
      'Kontrolle: Addiere am Ende alle drei Winkel. Es müssen genau $180^\\circ$ herauskommen.');
    if (level === 2) {
      const ts = this.terms(p), tx = ts.map(t => U.tex(t));
      const vs = ts.map(t => Number(U.evalMachine(t, { x: F(p.x) }).n));
      const sum = U.solveExpanded(ts.map(t => `(${t})`).join('+'));
      const steps = [`Winkelsumme: $\\left(${tx[0]}\\right) + \\left(${tx[1]}\\right) + \\left(${tx[2]}\\right) = 180$`,
        `Zusammenfassen: $${U.tex(sum)} = 180$, also $x = ${p.x}$.`,
        `$\\alpha = ${vs[0]}^\\circ$, $\\beta = ${vs[1]}^\\circ$, $\\gamma = ${vs[2]}^\\circ$.`];
      const cell = (id, label, v) => ({ id, label, spec: { type: 'integer', value: String(v), canonical: String(v), unit: '°' } });
      return {
        prompt: `Im Dreieck $ABC$ gilt $\\alpha = \\left(${tx[0]}\\right)^\\circ$, $\\beta = \\left(${tx[1]}\\right)^\\circ$ und $\\gamma = \\left(${tx[2]}\\right)^\\circ$. Berechne $x$ und die drei Winkel.`,
        instructions: 'Stelle mit der Winkelsumme eine Gleichung auf.',
        diagram,
        answer: { type: 'table', cells: [
          { id: 'x', label: '$x$', spec: { type: 'integer', value: String(p.x), canonical: String(p.x), variable: 'x' } },
          cell('a', '$\\alpha$ in Grad', vs[0]), cell('b', '$\\beta$ in Grad', vs[1]), cell('c', '$\\gamma$ in Grad', vs[2])] },
        hints: help('Setze die Summe der drei Terme gleich $180$.', steps[0], steps),
        solution: { steps, result: `$x = ${p.x}$; $\\alpha = ${vs[0]}^\\circ$, $\\beta = ${vs[1]}^\\circ$, $\\gamma = ${vs[2]}^\\circ$` },
      };
    }
    const [a, b, c] = this.angles(p);
    if (level === 3) {
      const eps = 180 - c, alpha = a;
      const steps = [`$\\gamma$ und $\\varepsilon$ sind Nebenwinkel: $\\gamma = 180^\\circ - ${eps}^\\circ = ${c}^\\circ$.`,
        `Winkelsumme im Dreieck: $\\alpha = 180^\\circ - ${b}^\\circ - ${c}^\\circ = ${alpha}^\\circ$.`];
      return {
        prompt: `Die Seite $BC$ des Dreiecks $ABC$ ist über $C$ hinaus verlängert. Es ist $\\beta = ${b}^\\circ$ und der Außenwinkel $\\varepsilon = ${eps}^\\circ$. Berechne $\\alpha$.`,
        instructions: 'Gib die Winkelgröße in Grad an.',
        diagram,
        answer: { type: 'integer', value: String(alpha), canonical: String(alpha), unit: '°', distractors: U.numDistractors(alpha, [
          { value: 180 - b - eps, category: 'concept_confusion', feedback: '$\\varepsilon$ ist kein Innenwinkel des Dreiecks. Berechne zuerst $\\gamma$ als Nebenwinkel von $\\varepsilon$.' },
          { value: c, category: 'concept_confusion', feedback: 'Das ist $\\gamma$. Gesucht ist $\\alpha$.' },
          { value: 360 - b - c, category: 'concept_confusion', feedback: 'Die Winkelsumme im Dreieck ist $180^\\circ$, nicht $360^\\circ$.' }].filter(d => d.value > 0)) },
        hints: help('$\\varepsilon$ und $\\gamma$ liegen an einer Geraden nebeneinander: Nebenwinkel.', steps[0], steps),
        solution: { steps, result: `$\\alpha$ = $${alpha}$°` },
      };
    }
    const vals = { A: a, B: b, C: c }, tex = { A: '\\alpha', B: '\\beta', C: '\\gamma' };
    const given = ['A', 'B', 'C'].filter(k => k !== p.asked);
    const ans = vals[p.asked];
    const steps = [`$${tex[p.asked]} = 180^\\circ - ${vals[given[0]]}^\\circ - ${vals[given[1]]}^\\circ = ${ans}^\\circ$`];
    return {
      prompt: `Im Dreieck $ABC$ ist $${tex[given[0]]} = ${vals[given[0]]}^\\circ$ und $${tex[given[1]]} = ${vals[given[1]]}^\\circ$. Berechne $${tex[p.asked]}$.`,
      instructions: 'Gib die Winkelgröße in Grad an.',
      diagram,
      answer: { type: 'integer', value: String(ans), canonical: String(ans), unit: '°', distractors: U.numDistractors(ans, [
        { value: 360 - vals[given[0]] - vals[given[1]], category: 'concept_confusion', feedback: 'Die Winkelsumme im Dreieck ist $180^\\circ$, nicht $360^\\circ$ (das gilt im Viereck).' }]) },
      hints: help('Ziehe die beiden bekannten Winkel von $180^\\circ$ ab.', `$${tex[p.asked]} = 180^\\circ - ${vals[given[0]]}^\\circ - ${vals[given[1]]}^\\circ$`, steps),
      solution: { steps, result: `$${tex[p.asked]}$ = $${ans}$°` },
    };
  },
  solve(p, level) {
    const d = this.diagram(p);
    const P = d.points;
    if (level === 1) return String(p.asked === 'A' ? measureAt(P, 'A', 'B', 'C') : p.asked === 'B' ? measureAt(P, 'B', 'A', 'C') : measureAt(P, 'C', 'A', 'B'));
    if (level === 3) return String(measureAt(P, 'A', 'B', 'C'));
    // L2: solve (sum of the three terms) = 180 with exact fractions
    const ts = this.terms(p);
    const s0 = ts.reduce((acc, t) => acc.add(U.evalMachine(t, { x: F(0) })), F(0));
    const s1 = ts.reduce((acc, t) => acc.add(U.evalMachine(t, { x: F(1) })), F(0));
    const x = F(180).sub(s0).div(s1.sub(s0));
    const v = ts.map(t => U.evalMachine(t, { x }).toString());
    return { x: x.toString(), a: v[0], b: v[1], c: v[2] };
  },
};

/**
 * Template ch5.angles.triangle_sum.proof_order (family proof_order) — first structured proof (not free text).
 * L4 Transfer: put the steps of the proof of the angle sum theorem into the right order. Two proof variants:
 *   wechsel  parallel p to AB through C; both base angles move to C as Wechselwinkel
 *   stufen   parallel through C and extension of BC beyond C; β moves as Stufenwinkel, α as Wechselwinkel
 * Graded as an ordering (first wrong position is reported); the worked solution states why each step depends on the
 * one before. Misconception: conclusion before the premises (circular order).
 */
const PROOFS = {
  wechsel: [
    'Zeichne durch $C$ die Parallele $p$ zu $AB$.',
    "$\\alpha$ und $\\alpha'$ sind Wechselwinkel an den Parallelen $AB$ und $p$, also $\\alpha' = \\alpha$.",
    "$\\beta$ und $\\beta'$ sind Wechselwinkel an den Parallelen $AB$ und $p$, also $\\beta' = \\beta$.",
    "$\\alpha'$, $\\gamma$ und $\\beta'$ liegen bei $C$ nebeneinander an der Geraden $p$: $\\alpha' + \\gamma + \\beta' = 180^\\circ$.",
    'Setzt man ein, erhält man $\\alpha + \\beta + \\gamma = 180^\\circ$.',
  ],
  stufen: [
    'Zeichne durch $C$ die Parallele $p$ zu $AB$ und verlängere $BC$ über $C$ hinaus.',
    "$\\alpha$ und $\\alpha'$ sind Wechselwinkel an den Parallelen $AB$ und $p$, also $\\alpha' = \\alpha$.",
    "$\\beta$ und $\\beta'$ sind Stufenwinkel an den Parallelen $AB$ und $p$, also $\\beta' = \\beta$.",
    "$\\gamma$, $\\alpha'$ und $\\beta'$ ergeben zusammen den gestreckten Winkel an der Geraden $BC$: $\\gamma + \\alpha' + \\beta' = 180^\\circ$.",
    'Setzt man ein, erhält man $\\alpha + \\beta + \\gamma = 180^\\circ$.',
  ],
};
const proofOrder = {
  id: `${TRI}.proof_order`, version: 1, skillId: TRI,
  families: ['proof_order'],
  levels: [4],
  levelNotes: { 4: 'Beweis des Winkelsummensatzes: Beweisschritte in die richtige Reihenfolge bringen (zwei Beweisvarianten).' },
  misconceptions: ['circular_order'],
  sample(rng) { return { variant: rng.pick(['wechsel', 'stufen']), a: rng.int(35, 85), b: rng.int(35, 85), order: rng.uint32() }; },
  signatureParams(p) { return { variant: p.variant, a: p.a, b: p.b }; },
  constraints(p) {
    const ids = this.shuffled(p).map(s => s.i);
    if (ids.every((v, i) => v === i)) return 'already in order';
    if (180 - p.a - p.b < 30) return 'flat triangle';
    return true;
  },
  shuffled(p) { return arrange(PROOFS[p.variant].map((text, i) => ({ i, text })), p.order); },
  diagram(p) {
    const pts = triangle(p.a, p.b, { parallel: true, extendBC: p.variant === 'stufen' });
    // α' between p (towards P1) and CA, β' between CB / extension and p (towards P2)
    const els = [{ t: 'polygon', pts: ['A', 'B', 'C'] }, { t: 'line', a: 'P1', b: 'P2', label: 'p' },
      innerAngle(pts, 'A', 'B', 'C', { label: 'α' }), innerAngle(pts, 'B', 'C', 'A', { label: 'β' }),
      innerAngle(pts, 'C', 'A', 'B', { label: 'γ' })];
    if (p.variant === 'wechsel') els.push(innerAngle(pts, 'C', 'P1', 'A', { label: "α'" }), innerAngle(pts, 'C', 'B', 'P2', { label: "β'" }));
    else els.push({ t: 'segment', a: 'C', b: 'D', dashed: true }, innerAngle(pts, 'C', 'A', 'P1', { label: "α'" }), innerAngle(pts, 'C', 'P1', 'D', { label: "β'" }));
    els.push(...triPoints);
    return { kind: 'schematic', width: 320, height: 200, points: pts, elements: els,
      alt: `Dreieck ABC mit der Parallelen p zu AB durch C${p.variant === 'stufen' ? ' und der Verlängerung von BC über C hinaus' : ''}. Bei C liegen die Winkel α′, γ und β′.` };
  },
  build(p) {
    const items = this.shuffled(p).map((s, k) => ({ id: `s${k + 1}`, text: s.text, i: s.i }));
    const correct = items.slice().sort((x, y) => x.i - y.i).map(s => s.id);
    const steps = [
      'Voraussetzung: $ABC$ ist ein Dreieck. Behauptung: $\\alpha + \\beta + \\gamma = 180^\\circ$.',
      ...PROOFS[p.variant].map((t, i) => `${i + 1}. ${t}`),
      'Die Hilfslinie kommt zuerst, weil alle Winkelbeziehungen sie brauchen. Die Behauptung steht am Ende, weil sie aus den Schritten davor folgt.',
    ];
    return {
      prompt: 'Bringe die Schritte des Beweises für den Winkelsummensatz im Dreieck in die richtige Reihenfolge.',
      instructions: 'Ordne die Schritte von oben (erster Schritt) nach unten (letzter Schritt). Die Zeichnung ist eine Skizze.',
      diagram: this.diagram(p),
      answer: { type: 'ordering', items: items.map(({ id, text }) => ({ id, text })), correct, canonical: correct },
      hints: hints('Ein Beweis beginnt mit dem, was man zeichnet oder weiß, und endet mit der Behauptung.',
        'Die Hilfslinie (Parallele durch $C$) muss zuerst gezeichnet sein, bevor man Winkel an ihr benutzen kann.',
        'Der letzte Schritt ist die Behauptung $\\alpha + \\beta + \\gamma = 180^\\circ$. Davor steht der gestreckte Winkel bei $C$.',
        steps, 'Lies deine Reihenfolge laut vor: Benutzt jeder Schritt nur Dinge, die vorher schon gezeigt oder gezeichnet sind?'),
      solution: { steps, result: correct.map(id => items.find(s => s.id === id).text).join(' → ') },
    };
  },
  solve(p) {
    // dependency order: construction first, then the two angle transfers (as listed), then the straight angle,
    // then the conclusion — recovered by matching the shown texts against the proof's dependency list
    const q = this.build(p);
    const rank = t => (/^Zeichne/.test(t) ? 0 : /alpha' = \\alpha\$/.test(t) ? 1 : /beta' = \\beta\$/.test(t) ? 2 : /180\^\\circ\$\.$/.test(t) && /Setzt man/.test(t) ? 4 : 3);
    return q.answer.items.slice().sort((x, y) => rank(x.text) - rank(y.text)).map(s => s.id);
  },
};

module.exports = [angleChase, nameRelation, missingAngle, proofOrder];
