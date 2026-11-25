'use strict';
/**
 * Drives the BUILT single-file app (dist/mathe7.html) in jsdom: routes, practice flow for every skill and
 * level, invalid/incorrect/correct feedback, hints, "Neue Zahlen", reveal, summary, persistence across reload,
 * export/import validation and "delete all".
 * jsdom is an optional dev dependency (`npm i --no-save jsdom@24`); without it this file is skipped.
 * KaTeX is not loaded (no network), so the plain-text formula fallback is what gets exercised here.
 * Answers are taken from the engine on the TEST side; the UI never sees them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { JSDOM = null; }
const skip = JSDOM ? false : 'jsdom not installed (optional): npm i --no-save jsdom@24';

const root = path.join(__dirname, '..');
/** jsdom's CSS parser cannot read @page margin boxes (ui/print-page.css, own <style>); real Chromium can. Only that is tolerated. */
function isKnownPageCssError(e) {
  return !!e && e.type === 'css parsing' && typeof e.detail === 'string' && e.detail.includes('@bottom-center') && !e.detail.includes('.ws-q');
}

function html() {
  require(path.join(root, 'build.js')).build();
  return fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8');
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
function feedbackText(ctx) { const f = ctx.d.getElementById('feedback'); return f ? f.textContent : ''; }
function startPractice(ctx, skillId, level, count) {
  const sel = ctx.d.getElementById('skill-select');
  sel.value = skillId; sel.dispatchEvent(new ctx.w.Event('change'));
  ctx.d.querySelector(`input[name="level"][value="${level}"]`).checked = true;
  ctx.d.querySelector(`input[name="count"][value="${count}"]`).checked = true;
  click(ctx, '#start-btn');
}

test('every route renders without errors; empty states shown', { skip }, async () => {
  const ctx = open();
  assert.match(ctx.d.querySelector('h1').textContent, /Mathe üben/);
  for (const r of ['kapitel', 'ueben', 'arbeitsblaetter', 'wiederholen', 'fortschritt', 'start']) {
    await nav(ctx, r);
    assert.ok(!ctx.d.getElementById("main").textContent.includes('Etwas ist schiefgelaufen'), r);
    assert.equal(ctx.d.querySelector(`[data-route="${r}"]`).getAttribute('aria-current'), 'page');
  }
  await nav(ctx, 'fortschritt');
  assert.match(ctx.d.getElementById("main").textContent, /Noch keine Ergebnisse/);
  await nav(ctx, 'wiederholen');
  assert.match(ctx.d.getElementById("main").textContent, /Sobald du geübt hast/);
  await nav(ctx, 'kapitel');
  assert.equal(ctx.d.querySelectorAll('details.chapter').length, 7);
  assert.equal(ctx.d.querySelectorAll('.tag.ready').length, 23, 'six Ch1 + two Ch2 + four Ch4 + two Ch5 + four Ch6 + five Ch7 practicable skills');
  assert.deepEqual(ctx.errors, []);
});

test('every skill × level: correct answers through the real widgets, summary and progress', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  const seenTypes = new Set();
  for (const skillId of E.skillsWithTemplates()) {
    for (const level of ['auto', ...E.levelsForSkill(skillId)]) {
      await nav(ctx, 'ueben');
      if (ctx.d.getElementById('other-topic-btn')) { click(ctx, '#other-topic-btn'); await tick(); }
      startPractice(ctx, skillId, level, 5);
      await tick();
      await tick();
      for (let i = 1; i <= 5; i++) {
        assert.match(ctx.d.getElementById('q-title').textContent, new RegExp(`Aufgabe ${i} von 5`));
        const q = currentQuestion(ctx);
        seenTypes.add(q.answer.type);
        assert.ok(!/\$|\\[a-z]/.test(ctx.d.getElementById('main').textContent), `raw LaTeX visible in ${q.id}`);
        fill(ctx, q, E.canonicalInput(q.answer));
        click(ctx, '#check-btn');
        assert.match(feedbackText(ctx), /Richtig!/, `${q.id}: ${feedbackText(ctx)}`);
        assert.equal(ctx.d.activeElement.id, 'next-btn', 'focus moves to "next", described by the feedback');
        assert.equal(ctx.d.getElementById('margin-mark').textContent, '✓');
        click(ctx, '#next-btn');
      }
      assert.match(ctx.d.querySelector('h1').textContent, /Auswertung/);
      assert.match(ctx.d.getElementById("main").textContent, /5 von 5\s*beim ersten Versuch richtig/);
    }
  }
  assert.deepEqual([...seenTypes].sort(), ['choice', 'decimal', 'expression', 'fraction', 'integer', 'multiselect', 'ordering', 'solution_set', 'table']);
  const prog = JSON.parse(ctx.w.localStorage.getItem('mathe7.progress.v1'));
  assert.equal(Object.keys(prog.skills).length, E.skillsWithTemplates().length);
  for (const r of Object.values(prog.skills)) { assert.equal(r.correct, r.attempts); assert.ok(r.nextReview); }
  await nav(ctx, 'kapitel');
  assert.ok(!/\$|\\[a-z]/.test(ctx.d.getElementById('main').textContent));
  assert.deepEqual(ctx.errors, []);
});

test('invalid → wrong → hint → new numbers → reveal → summary; feedback is never colour-only', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  await nav(ctx, 'ueben');
  startPractice(ctx, 'ch1.terms.expand_factor', 1, 5);
  await tick();
  let q = currentQuestion(ctx);
  fill(ctx, q, '3x+(');
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /nicht auswerten/);
  assert.match(feedbackText(ctx), /zählt nicht als Fehler/);
  assert.equal(ctx.d.getElementById('answer-input').value, '3x+(', 'draft kept after re-render');
  assert.equal(ctx.d.getElementById('variant-btn'), null, 'no "Neue Zahlen" before a real attempt');

  fill(ctx, q, '0');
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Noch nicht richtig|Fast/);
  assert.equal(ctx.d.activeElement.id, 'answer-input', 'focus back in the field for a retry');
  assert.match(ctx.d.getElementById('answer-input').getAttribute('aria-describedby'), /feedback/);
  assert.equal(ctx.d.getElementById('margin-mark').textContent, '✗', 'symbol, not only colour');
  assert.ok(ctx.d.getElementById('variant-btn'));

  click(ctx, '#hint-tab-0');
  assert.match(ctx.d.getElementById('hint-body').textContent, /\S/);
  assert.equal(ctx.d.getElementById('hint-tab-0').getAttribute('aria-expanded'), 'true');
  click(ctx, '#hint-tab-3');
  assert.match(ctx.d.getElementById('hint-body').textContent, /Lösungsweg/);
  assert.ok(!/\$|\\cdot|\\left/.test(ctx.d.getElementById('hint-body').textContent), 'no raw LaTeX visible');

  const oldId = q.id;
  click(ctx, '#variant-btn');
  q = currentQuestion(ctx);
  assert.notEqual(q.id, oldId);
  assert.equal(q.templateId, E.parseQuestionId(oldId).templateId);
  assert.match(ctx.d.getElementById('q-title').textContent, /Aufgabe 1 von 5/);

  fill(ctx, q, '1');
  click(ctx, '#check-btn');
  click(ctx, '#reveal-btn');
  assert.match(ctx.d.getElementById("main").textContent, /Hier ist der Lösungsweg/);
  assert.equal(ctx.d.getElementById('check-btn'), null);
  click(ctx, '#next-btn');

  // Report dialog stores id/seed/version.
  click(ctx, '#report-btn');
  const report = JSON.parse(ctx.d.getElementById('report-json').value);
  assert.equal(report.questionId, currentQuestion(ctx).id);
  click(ctx, '[data-action="save"]');
  assert.equal(JSON.parse(ctx.w.localStorage.getItem('mathe7.progress.v1')).reports.length, 1);

  click(ctx, '#quit-btn');
  click(ctx, '[data-action="true"]');
  await tick();
  assert.match(ctx.d.querySelector('h1').textContent, /Auswertung/);
  assert.match(ctx.d.getElementById("main").textContent, /0 von 5\s*beim ersten Versuch richtig/);
  assert.match(ctx.d.getElementById("main").textContent, /1\s*mit Lösungsweg/);
  assert.deepEqual(ctx.errors, []);
});

test('choosing another topic while a session is open asks before discarding it', { skip }, async () => {
  const ctx = open();
  await nav(ctx, 'ueben');
  startPractice(ctx, 'ch1.terms.evaluate', 'auto', 5);
  await tick();
  await nav(ctx, 'start');
  ctx.d.getElementById('chapter-select').value = 'ch1';
  ctx.d.getElementById('chapter-select').dispatchEvent(new ctx.w.Event('change'));
  click(ctx, '[data-skill="ch1.terms.collect_like"]');
  await tick();
  assert.equal(ctx.d.getElementById('skill-select').value, 'ch1.terms.collect_like', 'setup preselected');
  assert.ok(ctx.d.getElementById('resume-btn'), 'open session still offered');
  click(ctx, '#start-btn');
  await tick();
  assert.match(ctx.d.getElementById('dlg-title').textContent, /verwerfen/);
  click(ctx, '[data-action="false"]');
  await tick();
  assert.equal(JSON.parse(ctx.w.localStorage.getItem('mathe7.session.v1')).session.skillId, 'ch1.terms.evaluate', 'kept on cancel');
  click(ctx, '#resume-btn');
  await tick();
  assert.equal(currentQuestion(ctx).skillId, 'ch1.terms.evaluate');
  assert.deepEqual(ctx.errors, []);
});

test('Chapter 4: solution-set widget (invalid, wrong kind with explanation, correct), "x =" field, draft across reload', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  await nav(ctx, 'ueben');
  startPractice(ctx, 'ch4.eq.solution_count', '1', 5);
  await tick();
  const q = currentQuestion(ctx);
  assert.equal(q.answer.type, 'solution_set');
  const fs = ctx.d.querySelector('fieldset.answer-area');
  assert.match(fs.querySelector('legend').textContent, /Wie viele Lösungen/);
  const radios = [...ctx.d.querySelectorAll('[data-answer="solution-kind"]')];
  assert.deepEqual(radios.map(r => r.value), ['one', 'none', 'all']);
  for (const r of radios) assert.ok(ctx.d.querySelector(`label[for="${r.id}"]`).textContent.length > 5, 'radio labelled');
  assert.ok(ctx.d.querySelector('[data-answer="solution-value"]').getAttribute('aria-label').includes('x ='));
  // nothing chosen → invalid, not counted as a mistake
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /kann ich so nicht auswerten/);
  assert.match(feedbackText(ctx), /zählt nicht als Fehler/);
  // a wrong kind → explanation from the engine (text, never colour only)
  const wrongKind = q.answer.kind === 'all' ? 'none' : q.answer.kind === 'none' ? 'all' : 'none';
  fill(ctx, q, { kind: wrongKind });
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Noch nicht richtig/);
  assert.equal(ctx.d.getElementById('margin-mark').textContent, '✗');
  assert.ok(feedbackText(ctx).length > 40, 'explanation shown');
  // draft (typed value) survives a reload
  fill(ctx, q, { kind: 'one', value: '7' });
  const b = open(dump(ctx), 'ueben');
  await tick();
  assert.equal(b.d.querySelector('[data-answer="solution-value"]').value, '7');
  assert.equal(b.d.querySelector('[data-answer="solution-kind"][value="one"]').checked, true);
  // correct answer
  fill(b, q, E.canonicalInput(q.answer));
  click(b, '#check-btn');
  assert.match(feedbackText(b), /Richtig!/);
  // a numeric equation answer shows the "x =" prefix; typing "x = …" is accepted too
  const c = open();
  await nav(c, 'ueben');
  startPractice(c, 'ch4.eq.solve_equivalence', '1', 5);
  await tick();
  assert.match(c.d.querySelector('label[for="answer-input"]').textContent, /x =/);
  assert.ok(c.d.querySelector('.prefixed .prefix'));
  const q2 = currentQuestion(c);
  fill(c, q2, `x = ${E.canonicalInput(q2.answer)}`);
  click(c, '#check-btn');
  assert.match(feedbackText(c), /Richtig!/);
  assert.deepEqual([...ctx.errors, ...b.errors, ...c.errors], []);
});

test('session survives a reload (same storage, new page)', { skip }, async () => {
  const a = open();
  await nav(a, 'ueben');
  startPractice(a, 'ch1.terms.evaluate', 'auto', 5);
  await tick();
  const q1 = currentQuestion(a);
  fill(a, q1, a.w.MathEngine.canonicalInput(q1.answer));
  click(a, '#check-btn');
  click(a, '#next-btn');
  const q2 = currentQuestion(a);
  click(a, '#hint-tab-1');
  const b = open(dump(a), 'start');
  assert.ok(b.d.getElementById('resume-btn'), 'dashboard offers to resume');
  click(b, '#resume-btn');
  await tick();
  assert.match(b.d.getElementById('q-title').textContent, /Aufgabe 2 von 5/);
  assert.equal(currentQuestion(b).id, q2.id);
  assert.match(b.d.getElementById('hint-tab-1').textContent, /gesehen/);
  assert.deepEqual(b.errors, []);
});

test('corrupt storage is ignored; import validates; delete all clears everything', { skip }, async () => {
  const ctx = open({ 'mathe7.progress.v1': '{not json', 'mathe7.session.v1': JSON.stringify({ session: { schema: 'x' } }) });
  assert.match(ctx.d.querySelector('h1').textContent, /Mathe üben/);
  assert.equal(ctx.w.localStorage.getItem('mathe7.session.v1'), null, 'invalid session removed');
  await nav(ctx, 'fortschritt');
  click(ctx, '#import-text-btn');
  ctx.d.getElementById('import-text').value = JSON.stringify({ schema: 'mathe7-progress', version: 1, skills: { 'ch1.terms.evaluate': { questions: 1, attempts: 1, correct: 5 } } });
  click(ctx, '[data-action="load"]');
  await tick();
  assert.match(ctx.d.getElementById('data-status').textContent, /Import abgelehnt/);

  const good = ctx.w.MathEngine.emptyProgress();
  good.skills['ch1.terms.evaluate'] = { questions: 2, attempts: 3, correct: 2, firstAttemptCorrect: 1, recent: [1, 0], lastPractised: '2026-10-01', nextReview: '2026-10-02', errors: { sign_error: 1 } };
  click(ctx, '#import-text-btn');
  ctx.d.getElementById('import-text').value = JSON.stringify(good);
  click(ctx, '[data-action="load"]');
  await tick();
  click(ctx, '[data-action="true"]');
  await tick();
  assert.match(ctx.d.getElementById('data-status').textContent, /importiert/);
  assert.match(ctx.d.getElementById("main").textContent, /Vorzeichenfehler/);
  await nav(ctx, 'wiederholen');
  assert.ok(ctx.d.querySelector('[data-skill="ch1.terms.evaluate"]'), 'imported skill is due for review');

  await nav(ctx, 'fortschritt');
  click(ctx, '#export-text-btn');
  assert.equal(JSON.parse(ctx.d.querySelector('#dlg-body textarea').value).schema, 'mathe7-progress');
  click(ctx, '[data-action="close"]');
  click(ctx, '#delete-all-btn');
  click(ctx, '[data-action="true"]');
  await tick();
  assert.equal(ctx.w.localStorage.getItem('mathe7.progress.v1'), null);
  assert.match(ctx.d.getElementById('data-status').textContent, /gelöscht/);
  assert.deepEqual(ctx.errors, []);
});

test('works when localStorage throws (private mode)', { skip }, async () => {
  const errors = [];
  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole(); vc.on('jsdomError', e => { if (!isKnownPageCssError(e)) errors.push(String(e)); });
  const dom = new JSDOM(html(), { url: 'https://mathe7.test/#ueben', runScripts: 'dangerously', virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError'); } });
      w.scrollTo = () => {};
    } });
  const d = dom.window.document;
  assert.match(d.getElementById("main").textContent, /Speichern nicht möglich/);
  d.getElementById('start-btn').click();
  await tick();
  assert.ok(d.querySelector('[data-qid]'), 'practice still works');
  assert.deepEqual(errors, []);
});

test('with KaTeX present (loaded late, as from the CDN), formulas are upgraded to MathML', { skip: skip || (() => { try { require.resolve('katex/dist/katex.min.js'); return false; } catch (e) { return 'katex not installed (optional)'; } })() }, async () => {
  const src = fs.readFileSync(require.resolve('katex/dist/katex.min.js'), 'utf8');
  const ctx = open(null, 'ueben');
  startPractice(ctx, 'ch1.terms.collect_like', 'auto', 5);
  await tick();
  assert.ok(ctx.d.querySelectorAll('[data-r="f"]').length > 0, 'fallback before KaTeX arrives');
  ctx.w.eval(src);                                                      // KaTeX arrives after the page rendered
  ctx.d.getElementById('katex-js').dispatchEvent(new ctx.w.Event('load'));
  assert.equal(ctx.d.querySelectorAll('[data-r="f"]').length, 0, 'all formulas upgraded');
  assert.ok(ctx.d.querySelectorAll('math').length > 0, 'MathML present');
  click(ctx, '#hint-tab-3');                                            // later renders use KaTeX directly
  assert.ok(ctx.d.querySelectorAll('#hint-body math').length > 0);
  await nav(ctx, 'kapitel');
  assert.equal(ctx.d.querySelectorAll('[data-r="f"]').length, 0);
  assert.deepEqual(ctx.errors, []);
});

test('grid table widget (Tilgungsplan) and unit suffix: labelled cells, per-cell marks, unit feedback', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  await nav(ctx, 'ueben');
  startPractice(ctx, 'ch6.interest.loan', '2', 5);
  await tick();
  const q = currentQuestion(ctx);
  assert.equal(q.answer.type, 'table');
  const table = ctx.d.querySelector('table.vt.grid');
  assert.ok(table, '2-D grid rendered');
  assert.deepEqual([...table.querySelectorAll('thead th')].map(th => th.textContent), [...q.answer.grid.columns]);
  const inputs = [...table.querySelectorAll('input[data-cell]')];
  assert.equal(inputs.length, q.answer.cells.length);
  for (const inp of inputs) assert.ok((inp.getAttribute('aria-label') || '').length > 5, 'cell has an accessible label');
  assert.ok(!/\$|\\[a-z]/.test(ctx.d.getElementById('main').textContent), 'no raw LaTeX in the grid');
  // one wrong cell → per-cell text marks (not colour only)
  const good = E.canonicalInput(q.answer);
  fill(ctx, q, { ...good, z2: '1' });
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Noch nicht richtig/);
  const marks = [...ctx.d.querySelectorAll('table.vt.grid .cell-res')].map(m => m.textContent); // page re-renders after checking
  assert.equal(marks.filter(m => m.includes('✗')).length, 1);
  assert.equal(marks.filter(m => m.includes('✓')).length, q.answer.cells.length - 1);
  fill(ctx, q, good);
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Richtig!/);
  // unit suffix: a money/percent answer shows its unit next to the field; a wrong unit gets an explanation
  const b = open();
  await nav(b, 'ueben');
  startPractice(b, 'ch6.interest.simple_compound', '1', 5);
  await tick();
  const q2 = currentQuestion(b);
  const unit = q2.answer.unit;
  assert.ok(unit, 'answer has a unit');
  assert.equal(b.d.querySelector('.prefixed .suffix').textContent, unit);
  assert.match(b.d.querySelector('label[for="answer-input"]').textContent, new RegExp(`in ${unit.replace('%', '%')}`));
  fill(b, q2, `${E.canonicalInput(q2.answer)} ${unit === '€' ? '%' : '€'}`);
  click(b, '#check-btn');
  assert.match(feedbackText(b), /Einheit/);
  fill(b, q2, `${E.canonicalInput(q2.answer)} ${unit}`);
  click(b, '#check-btn');
  assert.match(feedbackText(b), /Richtig!/);
  assert.deepEqual([...ctx.errors, ...b.errors], []);
});

test('practice: a given value table (promptTable) is rendered as a real table with column and row headers', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  let found = null;
  for (let base = 1; base < 60 && !found; base++) {
    await nav(ctx, 'ueben');
    if (ctx.d.getElementById('other-topic-btn')) { click(ctx, '#other-topic-btn'); await tick(); }
    startPractice(ctx, 'ch2.antiprop.recognize_compute', '2', 5);
    await tick();
    for (let i = 0; i < 5 && !found; i++) {
      const q = currentQuestion(ctx);
      if (q.promptTable) { found = q; break; }
      fill(ctx, q, E.canonicalInput(q.answer)); click(ctx, '#check-btn'); click(ctx, '#next-btn');
    }
    if (!found) { ctx.w.localStorage.clear(); }
  }
  assert.ok(found, 'a question with a given table appeared');
  const t = ctx.d.querySelector('.given-table table');
  assert.ok(t);
  assert.equal(t.querySelectorAll('thead th[scope="col"]').length, found.promptTable.columns.length);
  assert.equal(t.querySelectorAll('tbody th[scope="row"]').length, found.promptTable.rows.length);
  assert.equal(t.querySelectorAll('tbody tr').length, found.promptTable.rows.length);
  assert.ok(!/\$|\\[a-z]/.test(t.textContent));
  fill(ctx, found, E.canonicalInput(found.answer));
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Richtig!/);
  assert.deepEqual(ctx.errors, []);
});

test('practice without KaTeX: sets and \\text{} read naturally ({2; 4; 6}, „rot“), no backslash anywhere (Ch7)', { skip }, async () => {
  const ctx = open();
  const E = ctx.w.MathEngine;
  await nav(ctx, 'ueben');
  startPractice(ctx, 'ch7.prob.experiments', '2', 5);
  await tick();
  const q = currentQuestion(ctx);
  const main = ctx.d.getElementById('main').textContent;
  assert.ok(!/\\/.test(main), `raw backslash visible: ${main.slice(0, 300)}`);
  assert.match(main, /\{\d+(; \d+)*\}/, 'a set is shown with braces and semicolons');
  fill(ctx, q, E.canonicalInput(q.answer));
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Richtig!/);
  click(ctx, '#hint-tab-3');
  assert.ok(!/\\/.test(ctx.d.getElementById('hint-body').textContent));
  assert.deepEqual(ctx.errors, []);
});

test('text fallback converter (ui/app.js texToText): sets, \\text, empty set, fractions, percent', () => {
  const src = fs.readFileSync(path.join(root, 'ui', 'app.js'), 'utf8');
  const sup = /function sup\([\s\S]*?\n  \}\n/.exec(src);
  const body = /function texToText\(t\) \{[\s\S]*?\n  \}\n/.exec(src);
  assert.ok(body, 'texToText found');
  // eslint-disable-next-line no-new-func
  const texToText = new Function(`${sup ? sup[0] : 'function sup(e) { return e; }'}\n${body[0]}\nreturn texToText;`)();
  assert.equal(texToText('\\{2;\\ 4;\\ 6\\}'), '{2; 4; 6}');
  assert.equal(texToText('\\{\\text{blau};\\ \\text{grün}\\}'), '{blau; grün}');
  assert.equal(texToText('\\{\\,\\}'), '{ }');
  assert.equal(texToText('\\frac{3}{8}'), '3/8');
  assert.equal(texToText('37{,}5\\,\\%'), '37,5 %');
  assert.equal(texToText('(-3+\\left(-3\\right)) : 2'), '(−3+(−3)) : 2');
});

test('geometry (S12): practice shows the engine diagram with text alternative and caption', { skip }, async () => {
  const ctx = open();
  await nav(ctx, 'ueben');
  if (ctx.d.getElementById('other-topic-btn')) { click(ctx, '#other-topic-btn'); await tick(); }
  startPractice(ctx, 'ch5.angles.lines', '2', 5);
  await tick(); await tick();
  const q = currentQuestion(ctx);
  const fig = ctx.d.querySelector('#main figure.diagram-wrap');
  assert.ok(fig, 'diagram shown');
  const svg = fig.querySelector('svg.diagram');
  assert.equal(svg.getAttribute('aria-label'), q.diagram.alt);
  assert.equal(fig.querySelector('figcaption').textContent, 'Zeichnung zu den Angaben.');
  fill(ctx, q, `${q.answer.value}°`);
  click(ctx, '#check-btn');
  assert.match(feedbackText(ctx), /Richtig!/);
  assert.deepEqual(ctx.errors, []);
});
