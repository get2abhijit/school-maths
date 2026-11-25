'use strict';
/**
 * diagram.js — geometry diagrams as DATA, rendered to an SVG string (no DOM access; S12, D96).
 *
 * A diagram is part of the canonical Question (field `diagram`), so practice, print, validation and the answer key all
 * show the same picture. It is generated from explicit geometry data by the template (points in math coordinates,
 * y pointing up), never drawn by hand and never used to compute an answer.
 *
 * Diagram = {
 *   kind: 'accurate' | 'schematic',   accurate = lengths/angles drawn true to the data; schematic = sketch, not to scale
 *   width, height,                     viewBox size in user units (math coordinates 0…width, 0…height)
 *   points: { A: {x, y} },             numbers, rounded to 0.01 by `pt`
 *   elements: [
 *     {t:'line', a, b, label?}              infinite line through a and b, clipped to the box; label near the end at b
 *     {t:'segment', a, b, label?, dashed?}
 *     {t:'polygon', pts:[…]}
 *     {t:'angle', at, from, to, label?, right?, mark?}  arc counter-clockwise from ray at→from to ray at→to;
 *                                            mark:true = shaded (the angle asked for); right:true = square marker
 *     {t:'point', p, label?, dir?}          dot with label; dir = label direction in degrees (default 45)
 *     {t:'parallel', a, b, count?}          arrow chevrons on line ab (marks parallel lines)
 *   ],
 *   alt: string                         German text alternative (screen readers, text fallback)
 * }
 * Labels are plain text (Unicode: α β γ δ ′ °); they are not KaTeX, because SVG text cannot hold KaTeX output.
 */
const KINDS = ['accurate', 'schematic'];
const ELEMENTS = ['line', 'segment', 'polygon', 'angle', 'point', 'parallel'];

const r2 = v => Math.round(v * 100) / 100;
/** Point helper with rounding (keeps diagram data short and stable). */
function pt(x, y) { return { x: r2(x), y: r2(y) }; }
const DEG = Math.PI / 180;
/** Point at distance r from p in direction deg (degrees, counter-clockwise from +x). */
function polar(p, r, deg) { return pt(p.x + r * Math.cos(deg * DEG), p.y + r * Math.sin(deg * DEG)); }

function validateDiagram(d) {
  const errors = [];
  if (!d || typeof d !== 'object') return { ok: false, errors: ['diagram missing'] };
  if (!KINDS.includes(d.kind)) errors.push('bad diagram kind');
  if (!(d.width > 0 && d.height > 0 && d.width <= 1000 && d.height <= 1000)) errors.push('bad diagram size');
  if (typeof d.alt !== 'string' || d.alt.length < 10) errors.push('diagram alt text missing');
  const pts = d.points || {};
  for (const [k, p] of Object.entries(pts)) {
    if (!/^[A-Za-z][A-Za-z0-9_']*$/.test(k)) errors.push(`bad point name ${k}`);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) errors.push(`point ${k} not finite`);
  }
  const has = k => Object.prototype.hasOwnProperty.call(pts, k);
  if (!Array.isArray(d.elements) || !d.elements.length) errors.push('diagram without elements');
  for (const [i, e] of (d.elements || []).entries()) {
    if (!e || !ELEMENTS.includes(e.t)) { errors.push(`element ${i}: bad type`); continue; }
    const refs = e.t === 'polygon' ? e.pts : e.t === 'angle' ? [e.at, e.from, e.to] : e.t === 'point' ? [e.p] : [e.a, e.b];
    if (!Array.isArray(refs) || refs.some(r => !has(r))) errors.push(`element ${i}: unknown point`);
    if (e.label !== undefined && (typeof e.label !== 'string' || !e.label || /[$<>&]/.test(e.label))) errors.push(`element ${i}: bad label`);
    if ((e.t === 'line' || e.t === 'segment' || e.t === 'parallel') && has(e.a) && has(e.b) && pts[e.a].x === pts[e.b].x && pts[e.a].y === pts[e.b].y) errors.push(`element ${i}: degenerate`);
  }
  return { ok: errors.length === 0, errors };
}

/** German caption shown under the picture. */
function diagramCaption(d) {
  return d.kind === 'schematic' ? 'Skizze – nicht maßstabsgetreu.' : 'Zeichnung zu den Angaben.';
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = v => String(r2(v));

/** Clip the infinite line through p, q to the box [m, w−m]×[m, h−m]; returns [P1, P2] ordered from p towards q. */
function clipLine(p, q, w, h, m) {
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, dd, lo, hi] of [[p.x, dx, m, w - m], [p.y, dy, m, h - m]]) {
    if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    let a = (lo - o) / dd, b = (hi - o) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  if (t0 > t1) return null;
  return [{ x: p.x + t0 * dx, y: p.y + t0 * dy }, { x: p.x + t1 * dx, y: p.y + t1 * dy }];
}

const CSS = '.dg-line,.dg-arc,.dg-mark{stroke:currentColor;fill:none;stroke-width:1.4;stroke-linecap:round}.dg-dashed{stroke-dasharray:5 4}'
  + '.dg-shape{fill:currentColor;fill-opacity:.06;stroke:currentColor;stroke-width:1.4}.dg-fill{fill:currentColor;fill-opacity:.18;stroke:none}'
  + '.dg-dot{fill:currentColor}.dg-label{fill:currentColor;font:13px system-ui,sans-serif}.dg-asked{font-weight:700}.dg-point{font-style:italic}';
const node = (tag, attrs, text) => (text === undefined ? { tag, attrs } : { tag, attrs, text: String(text) });

/**
 * Diagram → SVG node tree {tag, attrs, text?, children?}. The UI builds DOM nodes from it with createElementNS
 * (no innerHTML, no xmlns string in the page); `renderDiagram` serializes the same tree to a standalone SVG string.
 */
function diagramTree(d) {
  const v = validateDiagram(d);
  if (!v.ok) throw new Error(`renderDiagram: ${v.errors.join('; ')}`);
  const W = d.width, H = d.height, P = d.points;
  const X = p => f(p.x), Y = p => f(H - p.y);
  const out = [];
  const text = (x, y, s, cls) => out.push(node('text', { x: f(x), y: f(H - y), class: cls || 'dg-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, s));
  for (const e of d.elements) {
    if (e.t === 'polygon') out.push(node('polygon', { points: e.pts.map(k => `${X(P[k])},${Y(P[k])}`).join(' '), class: 'dg-shape' }));
  }
  for (const e of d.elements) {
    if (e.t === 'line' || e.t === 'segment') {
      const seg = e.t === 'line' ? clipLine(P[e.a], P[e.b], W, H, 4) : [P[e.a], P[e.b]];
      if (!seg) continue;
      out.push(node('line', { x1: X(seg[0]), y1: Y(seg[0]), x2: X(seg[1]), y2: Y(seg[1]), class: `dg-line${e.dashed ? ' dg-dashed' : ''}` }));
      if (e.label) {
        const a = seg[0], b = seg[1], len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        const base = e.t === 'line' ? { x: b.x - ux * 14, y: b.y - uy * 14 } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        text(base.x - uy * 11, base.y + ux * 11, e.label);
      }
    }
  }
  for (const e of d.elements) {
    if (e.t !== 'parallel') continue;
    const a = P[e.a], b = P[e.b], len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    for (let k = 0; k < (e.count || 1); k++) {
      const c = { x: (a.x + b.x) / 2 + ux * (k * 7 - 30), y: (a.y + b.y) / 2 + uy * (k * 7 - 30) };
      const tip = { x: c.x + ux * 4, y: c.y + uy * 4 }, l = { x: c.x - ux * 3 - uy * 4, y: c.y - uy * 3 + ux * 4 }, r = { x: c.x - ux * 3 + uy * 4, y: c.y - uy * 3 - ux * 4 };
      out.push(node('polyline', { points: `${X(l)},${Y(l)} ${X(tip)},${Y(tip)} ${X(r)},${Y(r)}`, class: 'dg-mark' }));
    }
  }
  for (const e of d.elements) {
    if (e.t !== 'angle') continue;
    const s = P[e.at], a1 = Math.atan2(P[e.from].y - s.y, P[e.from].x - s.x);
    let a2 = Math.atan2(P[e.to].y - s.y, P[e.to].x - s.x);
    while (a2 <= a1) a2 += 2 * Math.PI;
    const delta = a2 - a1, rad = e.r || (delta < 0.6 ? 26 : 18);
    const pa = { x: s.x + rad * Math.cos(a1), y: s.y + rad * Math.sin(a1) }, pb = { x: s.x + rad * Math.cos(a2), y: s.y + rad * Math.sin(a2) };
    if (e.right) {
      const q = 10, c1 = { x: s.x + q * Math.cos(a1), y: s.y + q * Math.sin(a1) }, c2 = { x: s.x + q * Math.cos(a2), y: s.y + q * Math.sin(a2) };
      const c3 = { x: c1.x + c2.x - s.x, y: c1.y + c2.y - s.y };
      out.push(node('polyline', { points: `${X(c1)},${Y(c1)} ${X(c3)},${Y(c3)} ${X(c2)},${Y(c2)}`, class: 'dg-arc' }));
    } else {
      const large = delta > Math.PI ? 1 : 0;
      const arc = `A${f(rad)} ${f(rad)} 0 ${large} 0 ${X(pb)} ${Y(pb)}`;
      if (e.mark) out.push(node('path', { d: `M${X(s)} ${Y(s)} L${X(pa)} ${Y(pa)} ${arc} Z`, class: 'dg-fill' }));
      out.push(node('path', { d: `M${X(pa)} ${Y(pa)} ${arc}`, class: 'dg-arc' }));
    }
    if (e.label) {
      const mid = (a1 + a2) / 2, lr = rad + (e.label.length > 3 ? 17 : 10);
      text(s.x + lr * Math.cos(mid), s.y + lr * Math.sin(mid), e.label, e.mark ? 'dg-label dg-asked' : 'dg-label');
    }
  }
  for (const e of d.elements) {
    if (e.t !== 'point') continue;
    const p = P[e.p];
    out.push(node('circle', { cx: X(p), cy: Y(p), r: '2.2', class: 'dg-dot' }));
    if (e.label) { const dir = (e.dir === undefined ? 45 : e.dir) * DEG; text(p.x + 11 * Math.cos(dir), p.y + 11 * Math.sin(dir), e.label, 'dg-label dg-point'); }
  }
  return { tag: 'svg', attrs: { viewBox: `0 0 ${f(W)} ${f(H)}`, class: 'diagram', role: 'img', 'aria-label': d.alt },
    children: [node('title', {}, d.alt), node('style', {}, CSS), ...out] };
}

function serialize(n, root) {
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const ns = root ? ' xmlns="http://www.w3.org/2000/svg"' : '';
  if (n.children) return `<${n.tag}${ns}${attrs}>${n.children.map(c => serialize(c)).join('')}</${n.tag}>`;
  if (n.text !== undefined) return `<${n.tag}${attrs}>${esc(n.text)}</${n.tag}>`;
  return `<${n.tag}${attrs}/>`;
}
/** Standalone SVG string (files, tests, golden output). */
function renderDiagram(d) { return serialize(diagramTree(d), true); }

module.exports = { pt, polar, validateDiagram, renderDiagram, diagramTree, diagramCaption, DIAGRAM_KINDS: KINDS };
