'use strict';
/**
 * "Im Unterricht behandelt" in the BUILT app (dist/mathe7.html) under jsdom: marking sections in Kapitel, the
 * effect on Üben / Wiederholen / Arbeitsblätter / Start, persistence across reload, export → import, delete all.
 * The UI only renders; which skill is offered is decided by the engine (src/coverage.js) — the test checks the
 * screen against E.partitionSkills on the test side.
 * jsdom is optional (`npm run test:dev-deps`); without it this file is skipped.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
const skip = JSDOM ? false : 'jsdom not installed (optional): npm i --no-save jsdom@24';
const root = path.join(__dirname, '..');
const KEY = 'mathe7.progress.v1';

let built = null;
function html() {
  if (!built) { require(path.join(root, 'build.js')).build(); built = fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8'); }
  return built;
}
function isKnownPageCssError(e) {
  return !!e && e.type === 'css parsing' && typeof e.detail === 'string' && e.detail.includes('@bottom-center') && !e.detail.includes('.ws-q');
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
      w.crypto.getRandomValues = a => { a[0] = 123456789; return a; };
      w.scrollTo = () => {};
    },
  });
  return { dom, w: dom.window, d: dom.window.document, errors };
}
const tick = () => new Promise(r => setTimeout(r, 0));
async function nav(ctx, route) { ctx.w.location.hash = route; await tick(); }
function click(ctx, sel) { const el = typeof sel === 'string' ? ctx.d.querySelector(sel) : sel; assert.ok(el, `missing ${sel}`); el.click(); }
function main(ctx) { return ctx.d.getElementById('main').textContent; }
function stored(ctx) { return JSON.parse(ctx.w.localStorage.getItem(KEY)); }
function skillOptions(ctx) {
  return [...ctx.d.querySelectorAll('#skill-select option')].map(o => ({ id: o.value, disabled: o.disabled, text: o.textContent }));
}
function catalog(ctx) { return JSON.parse(ctx.d.getElementById('catalog-data').textContent); }
async function tickSection(ctx, sectionId, on = true) {
  const cb = ctx.d.querySelector(`[data-section="${sectionId}"]`);
  assert.ok(cb, `no checkbox for ${sectionId}`);
  if (cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new ctx.w.Event('change')); await tick(); }
}
async function enableFilter(ctx, on = true) {
  const cb = ctx.d.getElementById('cov-enabled');
  cb.checked = on; cb.dispatchEvent(new ctx.w.Event('change')); await tick();
}

test('default: filter off, 36 unchecked sections, every practicable skill offered', { skip }, async () => {
  const ctx = open(null, 'kapitel');
  const E = ctx.w.MathEngine;
  assert.equal(ctx.d.getElementById('cov-enabled').checked, false);
  const boxes = ctx.d.querySelectorAll('[data-section]');
  assert.equal(boxes.length, 36);
  assert.ok([...boxes].every(b => !b.checked));
  // every checkbox has an accessible label with the book section and page
  const lab = ctx.d.querySelector('label[for="cov-ch6-s4"]');
  assert.match(lab.textContent, /VI\.4 Grundwerte berechnen \(S\. 149\)/);
  assert.match(main(ctx), /Ausgeschaltet: Alle 23 übbaren Themen/);
  assert.match(main(ctx), /Kapitel I, II, IV, V, VI, VII/, 'chapter note is computed, not the stale "Kapitel I" text');
  assert.equal(ctx.d.querySelectorAll('[data-coverage]').length, 0, 'no coverage tags while the filter is off');
  await nav(ctx, 'ueben');
  const opts = skillOptions(ctx).filter(o => E.skillsWithTemplates().includes(o.id));
  assert.equal(opts.length, 23);
  assert.ok(opts.every(o => !o.disabled));
  assert.equal(ctx.d.querySelector('.cov-note'), null);
  assert.deepEqual(ctx.errors, []);
});

test('filter on with nothing marked: empty states in Üben and Arbeitsblätter', { skip }, async () => {
  const ctx = open(null, 'kapitel');
  await enableFilter(ctx);
  assert.equal(ctx.d.activeElement && ctx.d.activeElement.id, 'cov-enabled', 'focus stays on the switch after re-render');
  assert.match(ctx.d.getElementById('cov-status').textContent, /Noch kein Thema freigegeben/);
  assert.equal(stored(ctx).settings.coverage.enabled, true);
  await nav(ctx, 'ueben');
  assert.ok(ctx.d.getElementById('cov-empty'));
  assert.equal(ctx.d.getElementById('skill-select'), null);
  assert.equal(ctx.d.querySelector('#cov-empty a').getAttribute('href'), '#kapitel');
  await nav(ctx, 'arbeitsblaetter');
  assert.ok(ctx.d.getElementById('ws-cov-empty'));
  assert.equal(ctx.d.querySelectorAll('input[name="ws-skill"]').length, 0);
  assert.match(main(ctx), /23 Themen sind ausgeblendet, weil sie/);
  click(ctx, '#ws-create-btn');
  await tick();
  assert.ok(ctx.d.getElementById('ws-error'), 'creating without a topic reports an error, no crash');
  assert.deepEqual(ctx.errors, []);
});

test('marking sections: multi-section skill needs all of them; Üben and Kapitel follow the engine', { skip }, async () => {
  const ctx = open(null, 'kapitel');
  const E = ctx.w.MathEngine;
  const C = catalog(ctx);
  await enableFilter(ctx);
  await tickSection(ctx, 'ch6.s1');
  assert.equal(ctx.d.activeElement && ctx.d.activeElement.getAttribute('data-section'), 'ch6.s1', 'focus returns to the ticked box');
  assert.ok(ctx.d.querySelector('details[data-chapter="ch6"]').open, 'chapter stays open after re-render');
  await tickSection(ctx, 'ch6.s2');
  assert.deepEqual(stored(ctx).settings.coverage, { enabled: true, sections: ['ch6.s1', 'ch6.s2'] });

  const row = id => ctx.d.querySelector(`[data-skill-row="${id}"]`);
  assert.equal(row('ch6.pct.compare').querySelector('[data-coverage]').getAttribute('data-coverage'), 'covered');
  assert.equal(row('ch6.pct.basic_tasks').querySelector('[data-coverage]').textContent, 'Teilweise behandelt', 'state as text, not colour only');
  assert.match(row('ch6.pct.basic_tasks').textContent, /sobald alle Abschnitte VI\.2–4 angehakt sind/);
  assert.equal(row('ch6.pct.basic_tasks').querySelector('[data-skill]'), null, 'no practise button for a hidden skill');
  assert.ok(row('ch6.pct.compare').querySelector('[data-skill="ch6.pct.compare"]'));
  assert.match(ctx.d.querySelector('details[data-chapter="ch6"] summary').textContent, /2 von 6 Abschnitten behandelt/);

  await nav(ctx, 'ueben');
  const expected = E.partitionSkills(C, stored(ctx).settings.coverage, E.skillsWithTemplates());
  const enabled = skillOptions(ctx).filter(o => !o.disabled).map(o => o.id);
  assert.deepEqual(enabled, [...expected.available]); // copy: the array comes from the jsdom realm
  assert.deepEqual(enabled, ['ch6.pct.compare']);
  assert.equal(ctx.d.getElementById('skill-select').value, 'ch6.pct.compare');
  assert.match(skillOptions(ctx).find(o => o.id === 'ch6.pct.basic_tasks').text, /\(noch nicht behandelt\)/);
  assert.match(skillOptions(ctx).find(o => o.id.startsWith('ch3.')).text, /\(folgt\)/);
  assert.match(ctx.d.querySelector('.cov-note').textContent, /22 Themen sind ausgeblendet/);

  // a session can be started for the offered skill
  click(ctx, '#start-btn');
  await tick();
  assert.ok(ctx.d.querySelector('[data-qid]'), 'question on screen');
  assert.match(ctx.d.querySelector('[data-qid]').getAttribute('data-qid'), /^ch6\.pct\.compare\./);
  assert.deepEqual(ctx.errors, []);
});

test('chapter buttons, worksheet selection and the dashboard follow the filter', { skip }, async () => {
  const ctx = open(null, 'kapitel');
  await enableFilter(ctx);
  ctx.d.querySelector('details[data-chapter="ch7"]').open = true;
  click(ctx, '#cov-all-ch7');
  await tick();
  assert.equal(ctx.d.activeElement && ctx.d.activeElement.id, 'cov-none-ch7', 'focus moves to the still-enabled counterpart');
  assert.deepEqual(stored(ctx).settings.coverage.sections, ['ch7.s1', 'ch7.s2', 'ch7.s3', 'ch7.s4', 'ch7.s5']);
  assert.equal(ctx.d.getElementById('cov-all-ch7').disabled, true);

  await nav(ctx, 'arbeitsblaetter');
  const ws = [...ctx.d.querySelectorAll('input[name="ws-skill"]')].map(i => i.value);
  assert.deepEqual(ws, ['ch7.data.analyze', 'ch7.prob.experiments', 'ch7.prob.determine', 'ch7.prob.frequency', 'ch7.prob.laplace']);
  click(ctx, '#ws-create-btn');
  await tick();
  assert.equal(ctx.d.getElementById('ws-error'), null);

  await nav(ctx, 'start');
  const sel = ctx.d.getElementById('chapter-select');
  sel.value = 'ch1'; sel.dispatchEvent(new ctx.w.Event('change')); await tick();
  assert.equal(ctx.d.querySelectorAll('[data-skill^="ch1."]').length, 0, 'no practise buttons for chapter I (not covered)');
  assert.match(main(ctx), /noch nicht behandelt/);

  await nav(ctx, 'kapitel');
  click(ctx, '#cov-none-ch7');
  await tick();
  assert.deepEqual(stored(ctx).settings.coverage.sections, []);
  assert.deepEqual(ctx.errors, []);
});

test('Wiederholen and the dashboard count only offered due skills; hidden ones are mentioned', { skip }, async () => {
  const E = require(path.join(root, 'engine.js'));
  const p = E.emptyProgress();
  const rec = { questions: 3, attempts: 3, correct: 1, firstAttemptCorrect: 1, recent: [1, 0, 0], lastPractised: '2026-01-01', nextReview: '2026-01-02', errors: {} };
  p.skills['ch1.terms.evaluate'] = { ...rec };
  p.skills['ch6.pct.compare'] = { ...rec };
  p.settings.coverage = { enabled: true, sections: ['ch6.s1'] };
  const ctx = open({ [KEY]: JSON.stringify(p) }, 'wiederholen');
  assert.ok(ctx.d.querySelector('[data-skill="ch6.pct.compare"]'));
  assert.equal(ctx.d.querySelector('[data-skill="ch1.terms.evaluate"]'), null);
  assert.match(ctx.d.querySelector('.cov-note').textContent, /1 Thema ist ausgeblendet, weil es/);
  await nav(ctx, 'start');
  assert.match(main(ctx), /1\s*Thema zum Wiederholen fällig/);
  // switching the filter off brings the hidden skill back without losing the marks
  await nav(ctx, 'kapitel');
  await enableFilter(ctx, false);
  await nav(ctx, 'wiederholen');
  assert.ok(ctx.d.querySelector('[data-skill="ch1.terms.evaluate"]'));
  assert.deepEqual(stored(ctx).settings.coverage, { enabled: false, sections: ['ch6.s1'] });
  assert.deepEqual(ctx.errors, []);
});

test('persistence: reload keeps the marks; export → import restores them; delete all clears them', { skip }, async () => {
  let ctx = open(null, 'kapitel');
  await enableFilter(ctx);
  await tickSection(ctx, 'ch1.s1');
  await tickSection(ctx, 'ch4.s1');
  const saved = ctx.w.localStorage.getItem(KEY);

  ctx = open({ [KEY]: saved }, 'kapitel');
  assert.equal(ctx.d.getElementById('cov-enabled').checked, true);
  assert.equal(ctx.d.querySelector('[data-section="ch1.s1"]').checked, true);
  assert.equal(ctx.d.querySelector('[data-section="ch4.s1"]').checked, true);
  assert.equal(ctx.d.querySelectorAll('[data-section]:checked').length, 2);

  await nav(ctx, 'fortschritt');
  assert.match(main(ctx), /welche Abschnitte im Unterricht behandelt wurden/);
  click(ctx, '#export-text-btn');
  const exported = ctx.d.querySelector('#dlg-body textarea').value;
  assert.deepEqual(JSON.parse(exported).settings.coverage, { enabled: true, sections: ['ch1.s1', 'ch4.s1'] });
  click(ctx, '[data-action="close"]');

  click(ctx, '#delete-all-btn');
  click(ctx, '[data-action="true"]');
  await tick();
  assert.equal(ctx.w.localStorage.getItem(KEY), null);
  await nav(ctx, 'kapitel');
  assert.equal(ctx.d.getElementById('cov-enabled').checked, false);
  assert.equal(ctx.d.querySelectorAll('[data-section]:checked').length, 0);

  await nav(ctx, 'fortschritt');
  click(ctx, '#import-text-btn');
  ctx.d.getElementById('import-text').value = exported;
  click(ctx, '[data-action="load"]');
  await tick();
  click(ctx, '[data-action="true"]');
  await tick();
  assert.match(ctx.d.getElementById('data-status').textContent, /importiert/);
  assert.deepEqual(stored(ctx).settings.coverage, { enabled: true, sections: ['ch1.s1', 'ch4.s1'] });
  await nav(ctx, 'ueben');
  assert.deepEqual(skillOptions(ctx).filter(o => !o.disabled).map(o => o.id), ['ch1.numterms.evaluate', 'ch4.eq.setup_trial']);

  // a manipulated import is refused, the stored marks stay untouched
  await nav(ctx, 'fortschritt');
  const bad = JSON.parse(exported); bad.settings.coverage.sections = ['ch1.s1', 'nicht-gültig'];
  click(ctx, '#import-text-btn');
  ctx.d.getElementById('import-text').value = JSON.stringify(bad);
  click(ctx, '[data-action="load"]');
  await tick();
  assert.match(ctx.d.getElementById('data-status').textContent, /Import abgelehnt.*Im Unterricht behandelt/);
  assert.deepEqual(stored(ctx).settings.coverage.sections, ['ch1.s1', 'ch4.s1']);
  assert.deepEqual(ctx.errors, []);
});
