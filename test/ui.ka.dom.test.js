'use strict';
/** KA mode in the built page (jsdom): overview, self-rating persistence, Üben filter, mock test screen + paper, plan, delete-all. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { skip, open, tick, nav, click, dump, fill } = require('./helpers/dom');

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
/** Storage with the KA date 10 days ahead (tests must not depend on the real calendar). */
function withDate(days, extra) {
  return { 'mathe7.progress.v1': JSON.stringify({ schema: 'mathe7-progress', version: 1, skills: {}, settings: { currentChapter: null, theme: 'system' }, reports: [], diagnostics: {},
    exams: { ka1: { date: inDays(days), ratings: {}, zusatz: {}, timer: 0, planDone: [], mocks: [], ...(extra || {}) } } }) };
}
const prog = ctx => JSON.parse(dump(ctx)['mathe7.progress.v1']);
async function confirm(ctx) { await tick(); click(ctx, '#dlg-actions [data-action="true"]'); await tick(); await tick(); }

test('dashboard card and overview: every checklist statement, book references, 4 labelled rating buttons; rating survives a reload', { skip }, async () => {
  let ctx = open(withDate(10));
  await tick();
  const card = ctx.d.getElementById('ka-card');
  assert.ok(card, 'dashboard card');
  assert.match(card.textContent, /10/);
  assert.match(card.textContent, /Klassenarbeit in 10 Tagen/);
  await nav(ctx, 'ka');
  const items = ctx.d.querySelectorAll('[data-ka-item]');
  assert.equal(items.length, 8);
  assert.match(ctx.d.querySelector('[data-ka-item="ka1.products"]').textContent, /Nachlesen S\. 21.*Auf der Checkliste steht S\. 15/);
  const btns = ctx.d.querySelectorAll('[data-item="ka1.sums"][data-rating]');
  assert.equal(btns.length, 4);
  for (const b of btns) assert.match(b.textContent, /[A-Za-zä]{4,}/, 'label text, not emoji only');
  click(ctx, '[data-item="ka1.sums"][data-rating="1"]');
  await tick();
  assert.equal(ctx.d.querySelector('[data-item="ka1.sums"][data-rating="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(prog(ctx).exams.ka1.ratings['ka1.sums'], 1);
  const storage = dump(ctx);
  ctx = open(storage, 'ka');
  await tick();
  assert.equal(ctx.d.querySelector('[data-item="ka1.sums"][data-rating="1"]').getAttribute('aria-pressed'), 'true', 'rating persisted across reload');
  assert.deepEqual(ctx.errors, []);
});

test('card hidden without an active exam (date more than a week past)', { skip }, async () => {
  const ctx = open(withDate(-8));
  await tick();
  assert.equal(ctx.d.getElementById('ka-card'), null);
});

test('Üben from the overview starts a session restricted to the statement’s families and levels', { skip }, async () => {
  const ctx = open(withDate(10), 'ka');
  await tick();
  click(ctx, '[data-ka-practise="ka1.products"]');
  await tick(); await tick();
  const st = JSON.parse(dump(ctx)['mathe7.session.v1']).session;
  const E = ctx.w.MathEngine;
  const groups = E.itemPractice(JSON.parse(ctx.d.getElementById('exams-data').textContent).exams[0], 'ka1.products', {});
  assert.equal(JSON.stringify(st.filter), JSON.stringify(groups[0].filter));
  assert.equal(st.skillId, 'ch1.terms.simplify_products');
  const qid = ctx.d.querySelector('[data-qid]').getAttribute('data-qid');
  assert.ok(st.filter.templates.includes(E.parseQuestionId(qid).templateId));
  assert.equal(ctx.w.location.hash, '#ueben');
});

test('mock test on screen: no feedback while answering, invalid input note, hand in, 30/30, stored round, review with solutions', { skip }, async () => {
  const ctx = open(withDate(10), 'ka');
  await tick();
  click(ctx, '#ka-tab-mock'); await tick();
  assert.match(ctx.d.getElementById('ka-mock-setup').textContent, /Keine echte Klassenarbeit und keine Notenprognose/);
  click(ctx, '#ka-start-screen'); await tick();
  const E = ctx.w.MathEngine;
  let guard = 0, sawInvalid = false;
  for (;;) {
    assert.ok(++guard < 40);
    const sec = ctx.d.getElementById('ka-screen');
    assert.ok(sec);
    assert.equal(ctx.d.getElementById('feedback'), null, 'no right/wrong feedback during the test');
    assert.equal(sec.querySelector('[data-hint]'), null, 'no hints during the test');
    const q = E.regenerateQuestion(sec.getAttribute('data-qid'));
    if (!sawInvalid && ['expression', 'integer', 'fraction'].includes(q.answer.type)) {
      fill(ctx, q, '3x+(');
      if (ctx.d.getElementById('ka-next')) {
        click(ctx, '#ka-next'); await tick();
        assert.ok(ctx.d.getElementById('ka-invalid'), 'invalid input note');
        sawInvalid = true;
      }
    }
    fill(ctx, q, E.canonicalInput(q.answer));
    if (ctx.d.getElementById('ka-next')) { click(ctx, '#ka-next'); await tick(); }
    else break;
  }
  assert.ok(sawInvalid);
  click(ctx, '#ka-submit');
  await confirm(ctx);
  const title = ctx.d.getElementById('ka-result-title');
  assert.ok(title, 'result page');
  assert.match(title.textContent, /30 von 30 Punkten/);
  assert.equal(ctx.d.querySelectorAll('#ka-result-table [data-task]').length, 8);
  assert.ok(ctx.d.querySelectorAll('.ka-review-item').length >= 15);
  assert.ok(ctx.d.querySelector('.ka-review-item .solution'), 'worked solution in the review');
  const m = prog(ctx).exams.ka1.mocks;
  assert.equal(m.length, 1);
  assert.equal(m[0].total, 30);
  assert.equal(m[0].mode, 'screen');
  assert.deepEqual(ctx.errors, []);
});

test('mock test on paper: both print views contain every task and sub-part; self-marking validates and scores', { skip }, async () => {
  const ctx = open(withDate(10, { zusatz: { ausklammern: false } }), 'ka');
  await tick();
  click(ctx, '#ka-tab-mock'); await tick();
  assert.match(ctx.d.getElementById('ka-mock-setup').textContent, /7 Aufgaben mit zusammen 27 Punkten/);
  click(ctx, '#ka-start-paper'); await tick();
  const run = JSON.parse(dump(ctx)['mathe7.ka.v1']);
  const qids = run.record.tasks.flatMap(t => t.qids);
  for (const kind of ['student', 'key']) {
    const paper = ctx.d.querySelector(`[data-paper="${kind}"]`);
    assert.ok(paper, kind);
    assert.deepEqual([...paper.querySelectorAll('[data-task]')].map(e => e.getAttribute('data-task')), ['1', '2', '3', '4', '5', '6', '8']);
    assert.deepEqual([...paper.querySelectorAll('.ws-q')].map(e => e.getAttribute('data-qid')), qids);
    assert.match(paper.textContent, /Keine echte Klassenarbeit/);
  }
  assert.ok(ctx.d.querySelector('[data-paper="key"] .ws-steps'), 'worked key');
  const set = (n, v) => { const i = ctx.d.getElementById(`ka-mark-${n}`); i.value = v; i.dispatchEvent(new ctx.w.Event('change')); };
  set(1, '9');
  click(ctx, '#ka-mark-done'); await tick();
  assert.match(ctx.d.getElementById('ka-mark-status').textContent, /Aufgabe 1/);
  set(1, '4'); set(2, '2.5'); set(6, '5');
  click(ctx, '#ka-mark-done'); await tick();
  assert.match(ctx.d.getElementById('ka-result-title').textContent, /11,5 von 27 Punkten/);
  assert.equal(prog(ctx).exams.ka1.mocks[0].mode, 'paper');
});

test('Lernplan: days until the date, ticking a day persists; empty state when the date has passed; delete-all removes KA data', { skip }, async () => {
  let ctx = open(withDate(6), 'ka');
  await tick();
  click(ctx, '#ka-tab-plan'); await tick();
  const days = ctx.d.querySelectorAll('.ka-day');
  assert.equal(days.length, 6);
  assert.match(days[5].textContent, /Runde 2/);
  const cb = ctx.d.getElementById(`ka-day-${inDays(0)}`);
  cb.checked = true; cb.dispatchEvent(new ctx.w.Event('change'));
  assert.deepEqual(prog(ctx).exams.ka1.planDone, [inDays(0)]);
  ctx = open(withDate(-1), 'ka');
  await tick();
  click(ctx, '#ka-tab-plan'); await tick();
  assert.ok(ctx.d.getElementById('ka-plan-empty'));
  // delete-all
  click(ctx, '#ka-tab-mock'); await tick();
  click(ctx, '#ka-start-screen'); await tick();
  assert.ok(dump(ctx)['mathe7.ka.v1']);
  await nav(ctx, 'fortschritt');
  click(ctx, '#delete-all-btn');
  await confirm(ctx);
  const s = dump(ctx);
  assert.equal(s['mathe7.ka.v1'], undefined);
  assert.ok(!s['mathe7.progress.v1'] || !JSON.parse(s['mathe7.progress.v1']).exams.ka1);
});
