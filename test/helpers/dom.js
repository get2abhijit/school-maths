'use strict';
/** Shared jsdom helpers for the built app (dist/mathe7.html). jsdom is optional (npm run test:dev-deps). */
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
const skip = JSDOM ? false : 'jsdom not installed (optional): npm i --no-save jsdom@24';
const root = path.join(__dirname, '..', '..');

function isKnownPageCssError(e) {
  return !!e && e.type === 'css parsing' && typeof e.detail === 'string' && e.detail.includes('@bottom-center') && !e.detail.includes('.ws-q');
}

let built = null;
function html() {
  if (!built) { require(path.join(root, 'build.js')).build(); built = fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8'); }
  return built;
}

function open(storage, hash = 'start') {
  const errors = [];
  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!isKnownPageCssError(e)) errors.push(String(e && (e.stack || e.message) || e)); });
  vc.on('error', e => errors.push(String(e)));
  const dom = new JSDOM(html(), {
    url: `https://mathe7.test/#${hash}`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      w.crypto.getRandomValues = a => { a[0] = 123456789; return a; }; // deterministic seeds in tests
      w.scrollTo = () => {};
    },
  });
  return { dom, w: dom.window, d: dom.window.document, errors };
}
const tick = () => new Promise(r => setTimeout(r, 0));
async function nav(ctx, route) { ctx.w.location.hash = route; await tick(); }
function click(ctx, sel) { const el = typeof sel === 'string' ? ctx.d.querySelector(sel) : sel; assert.ok(el, `missing ${sel}`); el.click(); }
function dump(ctx) { const s = {}; for (let i = 0; i < ctx.w.localStorage.length; i++) { const k = ctx.w.localStorage.key(i); s[k] = ctx.w.localStorage.getItem(k); } return s; }
function currentQuestion(ctx) {
  const sec = ctx.d.querySelector('[data-qid]');
  assert.ok(sec, 'no question on screen');
  return ctx.w.MathEngine.regenerateQuestion(sec.getAttribute('data-qid'));
}
/** Put a raw answer into the on-screen widget (as a student would). */
function fill(ctx, q, raw) {
  const t = q.answer.type;
  if (['integer', 'fraction', 'decimal', 'expression'].includes(t)) {
    const inp = ctx.d.getElementById('answer-input');
    inp.value = raw; inp.dispatchEvent(new ctx.w.Event('input'));
  } else if (t === 'choice') {
    ctx.d.querySelectorAll('[data-answer="option"]').forEach(i => { i.checked = i.value === raw; });
  } else if (t === 'multiselect') {
    ctx.d.querySelectorAll('[data-answer="option"]').forEach(i => { i.checked = raw.includes(i.value); });
  } else if (t === 'table') {
    for (const [id, v] of Object.entries(raw)) { const inp = ctx.d.querySelector(`[data-cell="${id}"]`); inp.value = v; inp.dispatchEvent(new ctx.w.Event('input')); }
  } else if (t === 'ordering') {
    // raw = ids in the correct order: press "nach oben" until each item is in place (as a student would)
    raw.forEach((id, target) => {
      for (let guard = 0; guard < 10; guard++) {
        const lis = [...ctx.d.querySelectorAll('.order-list li')];
        const at = lis.findIndex(li => li.getAttribute('data-item') === id);
        if (at === target) break;
        lis[at].querySelector('button[aria-label="nach oben"]').click();
      }
    });
  } else if (t === 'solution_set') {
    // raw = {kind, value?}: tick the radio, type the value (as a student would)
    ctx.d.querySelectorAll('[data-answer="solution-kind"]').forEach(i => { i.checked = i.value === raw.kind; i.dispatchEvent(new ctx.w.Event('change')); });
    const inp = ctx.d.querySelector('[data-answer="solution-value"]');
    inp.value = raw.kind === 'one' ? raw.value : ''; inp.dispatchEvent(new ctx.w.Event('input'));
    if (raw.kind !== 'one') ctx.d.querySelectorAll('[data-answer="solution-kind"]').forEach(i => { i.checked = i.value === raw.kind; });
  } else throw new Error(`no filler for ${t}`);
}

function main(ctx) { return ctx.d.getElementById('main').textContent; }
function feedbackText(ctx) { const f = ctx.d.getElementById('feedback'); return f ? f.textContent : ''; }
module.exports = { skip, root, open, tick, nav, click, main, dump, currentQuestion, fill, feedbackText };
