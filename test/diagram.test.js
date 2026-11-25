'use strict';
/** Session 12 (D96): diagram module — validation, rendering, and every Chapter V question's diagram. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const base = () => ({
  kind: 'accurate', width: 320, height: 200, alt: 'Zwei Geraden schneiden sich in S.',
  points: { S: E.pt(160, 100), A: E.pt(260, 100), B: E.polar(E.pt(160, 100), 60, 50) },
  elements: [{ t: 'line', a: 'S', b: 'A', label: 'g' }, { t: 'segment', a: 'S', b: 'B' }, { t: 'angle', at: 'S', from: 'A', to: 'B', label: 'α', mark: true }, { t: 'point', p: 'S', label: 'S' }],
});

test('diagram: valid data renders to a self-contained, accessible SVG', () => {
  const d = base();
  assert.deepEqual(E.validateDiagram(d), { ok: true, errors: [] });
  const svg = E.renderDiagram(d);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 320 200" class="diagram" role="img" aria-label="Zwei Geraden schneiden sich in S\."><title>/);
  assert.ok(!/NaN|undefined|Infinity/.test(svg));
  assert.ok(!/<script|href=|url\(/i.test(svg), 'no scripts, links or external resources');
  assert.match(svg, />α<\/text>/);
  assert.match(svg, /class="dg-fill"/, 'the asked angle is shaded');
  assert.equal(E.diagramCaption(d), 'Zeichnung zu den Angaben.');
  assert.equal(E.diagramCaption({ ...d, kind: 'schematic' }), 'Skizze – nicht maßstabsgetreu.');
  assert.equal(E.renderDiagram(d), E.renderDiagram(JSON.parse(JSON.stringify(d))), 'deterministic, data survives JSON');
});

test('diagram: invalid data is rejected (unknown points, labels with markup, degenerate lines, missing alt)', () => {
  const bad = [
    d => { d.kind = 'photo'; },
    d => { d.alt = ''; },
    d => { d.elements.push({ t: 'segment', a: 'S', b: 'Z' }); },
    d => { d.elements.push({ t: 'line', a: 'S', b: 'S' }); },
    d => { d.elements[0].label = '<b>g</b>'; },
    d => { d.elements[0].label = '$g$'; },
    d => { d.points.S = { x: NaN, y: 1 }; },
    d => { d.elements.push({ t: 'circle', a: 'S' }); },
  ];
  for (const mutate of bad) {
    const d = base(); mutate(d);
    assert.equal(E.validateDiagram(d).ok, false, JSON.stringify(d.elements.slice(-1)));
    assert.throws(() => E.renderDiagram(d));
  }
});

test('diagram: a question with a broken diagram does not pass validateQuestion', () => {
  const q = E.generate(E.REGISTRY['ch5.angles.lines.angle_chase'], 1, 1);
  assert.ok(E.validateQuestion(q).ok);
  const broken = { ...q, diagram: { ...q.diagram, elements: [...q.diagram.elements, { t: 'segment', a: 'S1', b: 'NOPE' }] } };
  assert.match(E.validateQuestion(broken).errors.join(';'), /diagram: element .*unknown point/);
});

test('every Chapter V question (template × level × 200 seeds) has a valid diagram whose points stay in the box', () => {
  for (const t of E.TEMPLATES.filter(x => x.id.startsWith('ch5.'))) for (const level of t.levels) for (let seed = 1; seed <= 200; seed++) {
    const q = E.generate(t, seed, level);
    assert.ok(q.diagram, q.id);
    const svg = E.renderDiagram(q.diagram);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), q.id);
    for (const [k, p] of Object.entries(q.diagram.points)) {
      if (/^[GH]\d$|^P\d$/.test(k)) continue; // far ends of lines: clipped when drawn
      assert.ok(p.x >= 0 && p.x <= q.diagram.width && p.y >= 0 && p.y <= q.diagram.height, `${q.id}: ${k} outside`);
    }
    for (const e of q.diagram.elements.filter(x => x.label)) assert.ok(svg.includes(`>${e.label}<`), `${q.id}: label ${e.label}`);
  }
});

test('worksheet layout carries the diagram only for questions that have one', () => {
  const { worksheet, questions } = E.createWorksheet({ title: 'Winkel', skills: ['ch5.angles.lines', 'ch5.angles.triangle_sum', 'ch1.terms.collect_like'], levels: [1, 2], count: 6, baseSeed: 77, keyMode: 'worked', space: 'small' });
  const layout = E.worksheetLayout(worksheet, questions);
  layout.student.forEach((s, i) => {
    assert.equal(!!s.diagram, !!questions[i].diagram, s.qid);
    if (s.diagram) assert.deepEqual(s.diagram, questions[i].diagram);
  });
  assert.ok(layout.student.some(s => s.diagram));
});
