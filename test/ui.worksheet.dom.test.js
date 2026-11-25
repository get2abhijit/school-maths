'use strict';
/**
 * Drives the worksheet section of the BUILT app (dist/mathe7.html) in jsdom: builder validation, creation,
 * student sheet vs answer key (same instances, same order), tab switch, print buttons (window.print stubbed),
 * standalone HTML export, persistence across reload, "new questions", recent list, outdated/corrupt storage,
 * delete-all. jsdom is optional (`npm run test:dev-deps`); without it this file is skipped.
 * jsdom does not lay out or print: page breaks, A4 size and page numbers are NOT verified here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) { JSDOM = null; }
const skip = JSDOM ? false : 'jsdom not installed (optional): npm i --no-save jsdom@24';
const root = path.join(__dirname, '..');
/** jsdom's CSS parser cannot read @page margin boxes (ui/print-page.css, own <style>); real Chromium can. Only that is tolerated. */
function isKnownPageCssError(e) {
  return !!e && e.type === 'css parsing' && typeof e.detail === 'string' && e.detail.includes('@bottom-center') && !e.detail.includes('.ws-q');
}

let HTML = null;
function html() {
  if (!HTML) { require(path.join(root, 'build.js')).build(); HTML = fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8'); }
  return HTML;
}
const KEY = 'mathe7.worksheet.v1';

function open(storage, { seed = 123456789, noPrint = false } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!isKnownPageCssError(e)) errors.push(String(e && (e.stack || e.message) || e)); });
  vc.on('error', e => errors.push(String(e)));
  const prints = [];
  const dom = new JSDOM(html(), {
    url: 'https://mathe7.test/#arbeitsblaetter', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      let n = seed;
      w.crypto.getRandomValues = a => { a[0] = n; n += 7919; return a; };
      w.scrollTo = () => {};
      if (noPrint) w.print = undefined;
      else w.print = () => { prints.push(w.document.querySelector('.paper:not([hidden])').getAttribute('data-paper')); };
    },
  });
  return { dom, w: dom.window, d: dom.window.document, errors, prints };
}
const tick = () => new Promise(r => setTimeout(r, 0));
/** Copy a value from the jsdom realm into Node's (deepStrictEqual compares prototypes). */
const own = x => JSON.parse(JSON.stringify(x));
function click(ctx, sel) { const el = typeof sel === 'string' ? ctx.d.querySelector(sel) : sel; assert.ok(el, `missing ${sel}`); el.click(); }
function dump(ctx) { const s = {}; for (let i = 0; i < ctx.w.localStorage.length; i++) { const k = ctx.w.localStorage.key(i); s[k] = ctx.w.localStorage.getItem(k); } return s; }
function setChecks(ctx, name, values) { ctx.d.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = values.includes(i.value); }); }
const qids = (ctx, kind) => [...ctx.d.querySelectorAll(`[data-paper="${kind}"] .ws-q`)].map(li => li.getAttribute('data-qid'));
/** Parse the grid path (only `Mx yHx2` and `Mx yVy2` commands) into horizontal [y,x1,x2] and vertical [x,y1,y2] lines. */
function gridLines(d) {
  const h = [], v = [];
  for (const m of d.matchAll(/M(\d+) (\d+)([HV])(\d+)/g)) {
    const [x, y, kind, end] = [Number(m[1]), Number(m[2]), m[3], Number(m[4])];
    if (kind === 'H') h.push([y, x, end]); else v.push([x, y, end]);
  }
  assert.equal(h.length * 0 + (d.match(/M/g) || []).length, h.length + v.length, 'path contains nothing but H/V lines');
  return { h, v };
}
/** What the UI should show for a $…$ string while KaTeX is not loaded (plain-text fallback). */
const shown = (ctx, text) => text.split('$').map((p, i) => (i % 2 ? ctx.w.MathApp.texToText(p) : p)).join('');

function configure(ctx, { skills, levels, count, space = 'medium', key = 'worked', name = false, date = true, title = 'Terme – Übung' }) {
  setChecks(ctx, 'ws-skill', skills);
  setChecks(ctx, 'ws-level', levels.map(String));
  setChecks(ctx, 'ws-count', [String(count)]);
  setChecks(ctx, 'ws-space', [space]);
  setChecks(ctx, 'ws-key', [key]);
  ctx.d.getElementById('ws-name').checked = name;
  ctx.d.getElementById('ws-date').checked = date;
  ctx.d.getElementById('ws-title').value = title;
}

test('worksheets: empty state, accessible builder, validation errors', { skip }, async () => {
  const ctx = open();
  await tick();
  assert.match(ctx.d.querySelector('h1').textContent, /Arbeitsblätter/);
  assert.match(ctx.d.getElementById('main').textContent, /Noch kein Arbeitsblatt/);
  const E = ctx.w.MathEngine;
  assert.equal(ctx.d.querySelectorAll('input[name="ws-skill"]').length, E.skillsWithTemplates().length);
  assert.match(ctx.d.getElementById('main').textContent, /Noch ohne Aufgaben: 3 /);
  for (const inp of ctx.d.querySelectorAll('.ws-builder input')) {
    const labelled = inp.closest('label') || (inp.id && ctx.d.querySelector(`label[for="${inp.id}"]`));
    assert.ok(labelled, `unlabelled input ${inp.name || inp.id}`);
  }
  setChecks(ctx, 'ws-skill', []);
  click(ctx, '#ws-create-btn');
  assert.match(ctx.d.getElementById('ws-status').textContent, /mindestens ein Thema/);
  setChecks(ctx, 'ws-skill', [E.skillsWithTemplates()[0]]);
  setChecks(ctx, 'ws-level', []);
  click(ctx, '#ws-create-btn');
  assert.match(ctx.d.getElementById('ws-status').textContent, /mindestens eine Stufe/);
  assert.equal(ctx.w.localStorage.getItem(KEY), null, 'nothing stored after a rejected build');
  assert.deepEqual(ctx.errors, []);
});

test('worksheets: student sheet and answer key come from the same instances; key text equals engine key', { skip }, async () => {
  const ctx = open();
  await tick();
  const E = ctx.w.MathEngine;
  const skills = own(E.skillsWithTemplates().slice(1, 4));
  configure(ctx, { skills, levels: [1, 3], count: 10 });
  click(ctx, '#ws-create-btn');
  await tick();
  const stored = JSON.parse(ctx.w.localStorage.getItem(KEY));
  const ws = stored.current.worksheet;
  assert.deepEqual(ws.spec.skills.slice().sort(), skills.slice().sort());
  assert.deepEqual(ws.spec.levels, [1, 3]);
  assert.equal(ws.spec.title, 'Terme – Übung');
  assert.ok(!JSON.stringify(stored).includes('"prompt"'), 'only ids/settings are stored, not question content');
  assert.equal(ctx.d.activeElement.id, 'ws-preview-title');

  // both papers rendered, same qids in the same order as the stored record
  const ids = ws.items.map(i => i.qid);
  assert.deepEqual(qids(ctx, 'student'), ids);
  assert.deepEqual(qids(ctx, 'key'), ids);
  assert.equal(ctx.d.querySelector('[data-paper="student"]').hasAttribute('hidden'), false);
  assert.equal(ctx.d.querySelector('[data-paper="key"]').hasAttribute('hidden'), true);

  // header: title, code on both sheets, date line only (name off)
  const student = ctx.d.querySelector('[data-paper="student"]'), key = ctx.d.querySelector('[data-paper="key"]');
  assert.equal(student.querySelector('.ws-title').textContent, 'Terme – Übung');
  assert.match(student.querySelector('.ws-code').textContent, new RegExp(ws.code));
  assert.match(key.querySelector('.ws-code').textContent, new RegExp(ws.code));
  assert.match(key.querySelector('.ws-title').textContent, /^Lösungen: /);
  assert.equal(student.querySelectorAll('[aria-label="Feld für den Namen"]').length, 0);
  assert.equal(student.querySelectorAll('[aria-label="Feld für das Datum"]').length, 1);
  assert.equal(student.querySelectorAll('.ws-space').length, 10);
  assert.ok([...student.querySelectorAll('.ws-space')].every(s => s.getAttribute('style') === 'height:30mm'));
  // karierter Rechenplatz: one SVG per field, user unit = 1 mm, a single path of plain lines every 5 mm.
  // No <pattern>/url(#…) (fails in embedded pages) and no CSS background (dropped when printing).
  for (const sp of student.querySelectorAll('.ws-space')) {
    const svg = sp.querySelector('svg.ws-grid');
    assert.ok(svg, 'grid svg');
    assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(svg.querySelectorAll('pattern, defs, [fill^="url("]').length, 0, 'no pattern/url references');
    assert.equal(svg.getAttribute('height'), '30mm');
    assert.equal(svg.getAttribute('width'), '190mm');
    assert.equal(svg.getAttribute('viewBox'), '0 0 190 30', 'user unit is exactly 1 mm');
    const path = svg.querySelector('path');
    assert.equal(path.getAttribute('fill'), 'none');
    assert.ok(path.getAttribute('stroke') && Number(path.getAttribute('stroke-width')) > 0, 'stroke set as attributes, independent of CSS');
    const { h: hs, v: vs } = gridLines(path.getAttribute('d'));
    assert.deepEqual(hs, [0, 5, 10, 15, 20, 25, 30].map(y => [y, 0, 190]), 'horizontal line every 5 mm across the field');
    assert.deepEqual(vs, Array.from({ length: 39 }, (_, i) => [i * 5, 0, 30]), 'vertical line every 5 mm over the full height');
  }
  assert.equal(student.querySelectorAll('.ws-space svg path').length, 10);

  // no answers on the student sheet
  assert.ok(!/Lösung:/.test(student.textContent));
  assert.equal(student.querySelectorAll('.ws-steps, .ws-result').length, 0);

  // DOM key == engine key for the regenerated instances (engine tests prove the key text is accepted as correct)
  const r = E.loadWorksheet(ws);
  assert.equal(r.ok, true);
  const L = own(E.worksheetLayout(r.worksheet, r.questions));
  const keyItems = [...key.querySelectorAll('.ws-list > .ws-q')];
  assert.equal(keyItems.length, 10);
  keyItems.forEach((li, i) => {
    const k = L.key[i];
    assert.equal(li.getAttribute('data-qid'), k.qid);
    if (k.cells) {
      const cells = [...li.querySelectorAll('.ws-table td')].map(td => td.textContent);
      assert.deepEqual(cells, k.cells.map(c => shown(ctx, c.value)));
    } else {
      assert.equal(li.querySelector('.ws-result').textContent, 'Lösung: ' + shown(ctx, k.result));
    }
    assert.equal(li.querySelectorAll('.ws-steps > li').length, k.steps.length, 'worked key shows every step');
    const sq = student.querySelectorAll('.ws-list > .ws-q')[i];
    assert.equal(sq.querySelector('.ws-prompt').textContent, shown(ctx, L.student[i].prompt));
    assert.match(sq.querySelector('.ws-level').textContent, new RegExp(`Stufe ${L.student[i].level}`));
    if (L.student[i].response.kind === 'choice') {
      assert.deepEqual([...sq.querySelectorAll('.ws-options b')].map(b => b.textContent.trim()), L.student[i].response.options.map(o => o.letter));
    }
    if (L.student[i].response.kind === 'table') assert.equal(sq.querySelectorAll('.ws-cell').length, L.student[i].response.cells.length);
  });
  assert.deepEqual(ctx.errors, []);
});

test('worksheets: Chapter 4 sheet – solution-set boxes, "x =" lines, worked lines; key text equals engine key', { skip }, async () => {
  const ctx = open();
  await tick();
  const E = ctx.w.MathEngine;
  const skills = own(E.skillsWithTemplates().filter(id => id.startsWith('ch4.')));
  assert.equal(skills.length, 4);
  configure(ctx, { skills, levels: [1, 2, 3, 4], count: 20, title: 'Lineare Gleichungen' });
  click(ctx, '#ws-create-btn');
  await tick();
  const ws = JSON.parse(ctx.w.localStorage.getItem(KEY)).current.worksheet;
  const r = E.loadWorksheet(ws);
  assert.equal(r.ok, true);
  const L = own(E.worksheetLayout(r.worksheet, r.questions));
  const student = ctx.d.querySelector('[data-paper="student"]'), key = ctx.d.querySelector('[data-paper="key"]');
  const sItems = [...student.querySelectorAll('.ws-list > .ws-q')], kItems = [...key.querySelectorAll('.ws-list > .ws-q')];
  assert.equal(sItems.length, 20);
  let sets = 0, xLines = 0, lines = 0;
  L.student.forEach((st, i) => {
    const li = sItems[i];
    if (st.response.kind === 'solution_set') {
      sets++;
      const opts = [...li.querySelectorAll('.ws-options li')].map(x => x.textContent);
      assert.equal(opts.length, 3);
      assert.match(opts[0], /^○genau eine Lösung:.*x =/);
      assert.match(opts[1], /keine Lösung/);
      assert.match(opts[2], /unendlich viele Lösungen/);
      assert.equal(li.querySelector('.ws-instr:last-of-type').textContent, E.PAPER_INSTRUCTIONS_DE.solution_set);
    }
    if (st.response.kind === 'line' && st.response.variable) { xLines++; assert.equal(li.querySelector('.ws-answer').textContent.replace(/\s+$/, ''), `Antwort: ${st.response.variable} =`); }
    if (st.promptLines) { lines++; assert.equal(li.querySelectorAll('.ws-lines > p').length, st.promptLines.length); }
    assert.equal(kItems[i].querySelector('.ws-result').textContent, 'Lösung: ' + shown(ctx, L.key[i].result));
  });
  assert.ok(sets > 0 && xLines > 0 && lines > 0, `coverage: ${sets} sets, ${xLines} x-lines, ${lines} with lines`);
  // no answers on the student sheet (the paper label "genau eine Lösung:" is lower-case; key texts start upper-case)
  assert.equal(student.querySelectorAll('.ws-result, .ws-steps').length, 0);
  assert.ok(!/Genau eine Lösung|Unendlich viele Lösungen:|Keine Lösung/.test(student.textContent), 'no answers on the student sheet');
  assert.ok(!/\$|\\[a-z]/.test(student.textContent + key.textContent), 'no raw LaTeX in the fallback');
  assert.deepEqual(ctx.errors, []);
});

test('worksheets: Chapter 6 sheet – grids with blank cells, unit after the answer line, filled grid in the key', { skip }, async () => {
  const ctx = open();
  await tick();
  const E = ctx.w.MathEngine;
  const skills = own(E.skillsWithTemplates().filter(id => id.startsWith('ch6.')));
  assert.equal(skills.length, 4);
  configure(ctx, { skills, levels: [1, 2, 3, 4], count: 20, title: 'Prozente und Zinsen' });
  click(ctx, '#ws-create-btn');
  await tick();
  const ws = JSON.parse(ctx.w.localStorage.getItem(KEY)).current.worksheet;
  const r = E.loadWorksheet(ws);
  assert.equal(r.ok, true);
  const L = own(E.worksheetLayout(r.worksheet, r.questions));
  const student = ctx.d.querySelector('[data-paper="student"]'), key = ctx.d.querySelector('[data-paper="key"]');
  const sItems = [...student.querySelectorAll('.ws-list > .ws-q')], kItems = [...key.querySelectorAll('.ws-list > .ws-q')];
  assert.equal(sItems.length, 20);
  let grids = 0, unitLines = 0;
  L.student.forEach((st, i) => {
    const li = sItems[i];
    if (st.response.kind === 'grid') {
      grids++;
      const t = li.querySelector('table.ws-grid');
      assert.ok(t, 'grid on the student sheet');
      assert.deepEqual([...t.querySelectorAll('thead th')].map(th => th.textContent), st.response.columns);
      const blanks = st.response.rows.flat().filter(e => e.blank).length;
      assert.equal(t.querySelectorAll('td.ws-cell').length, blanks);
      for (const td of t.querySelectorAll('td.ws-cell')) assert.equal(td.textContent, '', 'blank cell is empty');
      const kt = kItems[i].querySelector('table.ws-grid');
      assert.ok(kt, 'grid in the key');
      assert.equal(kt.querySelectorAll('td.ws-key-cell').length, blanks);
      const keyTexts = L.key[i].grid.rows.flat().map(e => shown(ctx, e.text));
      assert.deepEqual([...kt.querySelectorAll('tbody td')].map(td => td.textContent), keyTexts);
    } else {
      assert.equal(kItems[i].querySelector('.ws-result').textContent, 'Lösung: ' + shown(ctx, L.key[i].result));
    }
    if (st.response.kind === 'line' && st.response.unit) { unitLines++; assert.ok(li.querySelector('.ws-answer').textContent.trim().endsWith(st.response.unit)); }
  });
  assert.ok(grids > 0 && unitLines > 0, `coverage: ${grids} grids, ${unitLines} unit lines`);
  assert.equal(student.querySelectorAll('.ws-result, .ws-steps, .ws-key-cell').length, 0);
  assert.ok(!/\$|\\[a-z]/.test(student.textContent + key.textContent), `no raw LaTeX in the fallback: ${((student.textContent + key.textContent).match(/.{30}(\$|\\[a-z]).{30}/) || [''])[0]}`);
  assert.deepEqual(ctx.errors, []);
});

test('worksheets: Chapter 2 sheet – given value tables printed as tables on the student sheet only, never with answers', { skip }, async () => {
  const ctx = open();
  await tick();
  const E = ctx.w.MathEngine;
  const skills = own(E.skillsWithTemplates().filter(id => id.startsWith('ch2.')));
  assert.equal(skills.length, 2);
  configure(ctx, { skills, levels: [1, 2, 3, 4], count: 20, title: 'Zuordnungen' });
  click(ctx, '#ws-create-btn');
  await tick();
  const ws = JSON.parse(ctx.w.localStorage.getItem(KEY)).current.worksheet;
  const r = E.loadWorksheet(ws);
  assert.equal(r.ok, true);
  const L = own(E.worksheetLayout(r.worksheet, r.questions));
  const student = ctx.d.querySelector('[data-paper="student"]'), key = ctx.d.querySelector('[data-paper="key"]');
  const sItems = [...student.querySelectorAll('.ws-list > .ws-q')];
  let given = 0, grids = 0;
  L.student.forEach((st, i) => {
    const t = sItems[i].querySelector('.ws-given table');
    if (st.promptTable) {
      given++;
      assert.ok(t, 'given table on the student sheet');
      assert.deepEqual([...t.querySelectorAll('thead th')].map(th => th.textContent), st.promptTable.columns.map(c => shown(ctx, c)));
      assert.deepEqual([...t.querySelectorAll('tbody td')].map(td => td.textContent), st.promptTable.rows.flat().map(e => shown(ctx, e)));
    } else assert.equal(t, null);
    if (st.response.kind === 'grid') grids++;
  });
  assert.ok(given > 0 && grids > 0, `coverage: ${given} given tables, ${grids} grids`);
  assert.equal(key.querySelectorAll('.ws-given').length, 0, 'the key does not repeat the given tables');
  assert.ok(!/\$|\\[a-z]/.test(student.textContent + key.textContent), 'no raw LaTeX in the fallback');
  assert.deepEqual(ctx.errors, []);
});

test('worksheets: tabs, print buttons print the chosen paper, fallback without print, standalone HTML export', { skip }, async () => {
  const ctx = open();
  await tick();
  const E = ctx.w.MathEngine;
  configure(ctx, { skills: E.skillsWithTemplates(), levels: [1, 2, 3, 4], count: 12, key: 'answers', space: 'none' });
  click(ctx, '#ws-create-btn');
  await tick();
  click(ctx, '#ws-tab-key');
  assert.equal(ctx.d.querySelector('[data-paper="key"]').hasAttribute('hidden'), false);
  assert.equal(ctx.d.querySelector('[data-paper="student"]').hasAttribute('hidden'), true);
  assert.equal(ctx.d.getElementById('ws-tab-key').getAttribute('aria-pressed'), 'true');
  assert.equal(ctx.d.activeElement.id, 'ws-tab-key');
  assert.ok(ctx.d.querySelector('[data-paper="key"] .ws-list.compact'), 'answers-only key is compact');
  assert.equal(ctx.d.querySelectorAll('[data-paper="key"] .ws-steps').length, 0);
  assert.equal(ctx.d.querySelectorAll('[data-paper="student"] .ws-space').length, 0, 'space none');

  click(ctx, '#ws-print-student');
  click(ctx, '#ws-print-key');
  assert.deepEqual(ctx.prints, ['student', 'key']);
  assert.match(ctx.d.getElementById('ws-print-status').textContent, /Als PDF speichern/);
  assert.match(ctx.d.querySelector('.ws-help').textContent, /kein fertig erzeugtes PDF/);

  // standalone export: capture the Blob the fallback download creates
  let blob = null;
  ctx.w.URL.createObjectURL = b => { blob = b; return 'blob:mathe7-test'; };
  ctx.w.URL.revokeObjectURL = () => {};
  ctx.w.HTMLAnchorElement.prototype.click = function () {};
  click(ctx, '#ws-save-html');
  await tick();
  assert.ok(blob, 'a file was offered');
  assert.equal(blob.type, 'text/html');
  const text = await new Promise((res, rej) => { const fr = new ctx.w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsText(blob); });
  assert.match(text, /^<!doctype html>/);
  assert.match(text, /<html lang="de"/);
  assert.match(text, /<meta charset="utf-8">/);
  assert.match(text, /size: A4/);
  assert.match(text, /break-inside: avoid/);
  assert.ok(!/<script/i.test(text), 'export contains no scripts');
  assert.ok(!/https?:\/\//.test(text), 'export references nothing external');
  const exported = new JSDOM(text).window.document;
  assert.equal(exported.querySelectorAll('[data-paper="key"] .ws-q').length, 12);
  assert.equal(exported.querySelectorAll('[data-paper="student"]').length, 0, 'exports only the visible paper');
  click(ctx, '#ws-tab-student');
  // re-create with calculation space to check the grid survives the export
  setChecks(ctx, 'ws-space', ['small']);
  click(ctx, '#ws-create-btn');
  await tick();
  blob = null;
  click(ctx, '#ws-save-html');
  await tick();
  const text2 = await new Promise((res, rej) => { const fr = new ctx.w.FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsText(blob); });
  const ex2 = new JSDOM(text2).window.document;
  assert.equal(ex2.querySelectorAll('.ws-space svg.ws-grid path[d]').length, 12, '12 grid fields in the export');
  assert.ok(ex2.querySelector('.ws-grid path').getAttribute('stroke'), 'stroke survives as an attribute in the export');
  assert.ok(!/https?:\/\//.test(text2), 'export still references nothing external');
  assert.deepEqual(ctx.errors, []);

  const noPrint = open(dump(ctx), { noPrint: true });
  await tick();
  click(noPrint, '#ws-print-student');
  assert.match(noPrint.d.getElementById('ws-print-status').textContent, /HTML-Datei/);
  assert.deepEqual(noPrint.errors, []);
});

test('worksheets: reload restores the same sheet; new questions keep settings; recent list reopens exactly', { skip }, async () => {
  const a = open();
  await tick();
  const E = a.w.MathEngine;
  const skills = own(E.skillsWithTemplates().slice(0, 2));
  configure(a, { skills, levels: [2], count: 6, key: 'answers', space: 'small', name: true, date: false, title: 'Blatt A' });
  click(a, '#ws-create-btn');
  await tick();
  const first = { code: a.d.querySelector('.ws-code').textContent, ids: qids(a, 'student') };

  const b = open(dump(a), { seed: 42 });
  await tick();
  assert.equal(b.d.querySelector('.ws-code').textContent, first.code);
  assert.deepEqual(qids(b, 'student'), first.ids);
  assert.deepEqual([...b.d.querySelectorAll('input[name="ws-skill"]:checked')].map(i => i.value).sort(), skills.slice().sort());
  assert.equal(b.d.querySelector('input[name="ws-count"]:checked').value, '6');
  assert.equal(b.d.getElementById('ws-date').checked, false);
  assert.equal(b.d.getElementById('ws-title').value, 'Blatt A');

  click(b, '#ws-reroll');
  await tick();
  const second = { code: b.d.querySelector('.ws-code').textContent, ids: qids(b, 'student') };
  assert.notEqual(second.code, first.code);
  assert.notDeepEqual(second.ids, first.ids);
  const rec = JSON.parse(b.w.localStorage.getItem(KEY));
  assert.deepEqual(rec.current.worksheet.spec.skills, rec.recent[1].worksheet.spec.skills);
  assert.equal(rec.current.worksheet.spec.count, 6);
  const old = b.d.querySelector(`.ws-recent [data-code="${first.code.replace('Blatt ', '')}"]`);
  assert.ok(old, 'previous sheet listed under "Zuletzt erstellt"');
  old.click();
  await tick();
  assert.equal(b.d.querySelector('.ws-code').textContent, first.code);
  assert.deepEqual(qids(b, 'student'), first.ids);
  assert.deepEqual(b.errors, []);
});

test('worksheets: outdated or corrupt storage is handled; delete-all removes worksheets', { skip }, async () => {
  const a = open();
  await tick();
  const E = a.w.MathEngine;
  configure(a, { skills: E.skillsWithTemplates().slice(0, 1), levels: [1], count: 4 });
  click(a, '#ws-create-btn');
  await tick();
  const st = dump(a);
  const rec = JSON.parse(st[KEY]);
  rec.current.worksheet.items[0].qid = rec.current.worksheet.items[0].qid.replace(/@(\d+)\//, (_, n) => `@${Number(n) + 1}/`);
  const b = open({ ...st, [KEY]: JSON.stringify(rec) });
  await tick();
  assert.match(b.d.getElementById('ws-outdated').textContent, /älteren Version/);
  assert.deepEqual(b.errors, []);

  const c = open({ [KEY]: '{not json' });
  await tick();
  assert.match(c.d.getElementById('main').textContent, /Noch kein Arbeitsblatt/);
  const d = open({ [KEY]: JSON.stringify({ current: { worksheet: { schema: 'x' } }, recent: 'no' }) });
  await tick();
  assert.match(d.d.getElementById('main').textContent, /Noch kein Arbeitsblatt/);
  assert.deepEqual([...c.errors, ...d.errors], []);

  a.w.location.hash = 'fortschritt';
  await tick();
  click(a, '#delete-all-btn');
  await tick();
  click(a, '#dlg-actions [data-action="true"]');
  await tick();
  assert.equal(a.w.localStorage.getItem(KEY), null);
  a.w.location.hash = 'arbeitsblaetter';
  await tick();
  assert.match(a.d.getElementById('main').textContent, /Noch kein Arbeitsblatt/);
  assert.deepEqual(a.errors, []);
});

test('worksheets (S12): geometry tasks print their diagram on the student sheet', { skip }, async () => {
  const ctx = open();
  await tick();
  configure(ctx, { skills: ['ch5.angles.lines', 'ch5.angles.triangle_sum'], levels: [1, 2, 3, 4], count: 6, title: 'Winkel' });
  click(ctx, '#ws-create-btn');
  await tick();
  const student = ctx.d.querySelector('[data-paper="student"]');
  const ids = qids(ctx, 'student');
  assert.equal(ids.length, 6);
  const svgs = student.querySelectorAll('figure.diagram-wrap svg.diagram[role="img"]');
  assert.equal(svgs.length, 6, 'one diagram per geometry task');
  for (const s of svgs) assert.ok(s.getAttribute('aria-label').length > 10);
  assert.match(student.textContent, /Zeichnung zu den Angaben|Skizze – nicht maßstabsgetreu/);
  assert.deepEqual(ctx.errors, []);
});
