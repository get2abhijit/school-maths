'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/index.js');

const SK = 'ch1.terms.collect_like';
const att = (status, isFirst, extra = {}) => ({ type: 'attempt', skillId: SK, status, errorCategory: status === 'correct' ? null : 'sign_error', isFirst, hintsBefore: 0, sawSolution: false, ...extra });

function run(events, today = '2026-10-26') {
  return events.reduce((p, ev) => E.applyEvent(p, ev, today), E.emptyProgress());
}

test('empty progress is valid and has no due skills', () => {
  const p = E.emptyProgress();
  assert.ok(E.validateProgress(p).ok);
  assert.deepEqual(E.dueSkills(p, '2026-10-26'), []);
  assert.equal(E.skillStats(p, SK).mastery, 'new');
});

test('attempt counting, first-attempt accuracy and error categories', () => {
  const p = run([att('incorrect', true), att('correct', false), att('correct', true), { type: 'hint', skillId: SK, hintIndex: 0 }]);
  const s = E.skillStats(p, SK);
  assert.equal(s.questions, 2);
  assert.equal(s.attempts, 3);
  assert.equal(s.correct, 2);
  assert.equal(s.firstAttemptRate, 0.5);
  assert.equal(s.hintsUsed, 1);
  assert.equal(s.topError, 'sign_error');
  assert.equal(s.lastPractised, '2026-10-26');
});

test('applyEvent does not mutate its input and validates the date', () => {
  const p = E.emptyProgress();
  const before = JSON.stringify(p);
  E.applyEvent(p, att('correct', true), '2026-10-26');
  assert.equal(JSON.stringify(p), before);
  assert.throws(() => E.applyEvent(p, att('correct', true), '26.10.2026'), RangeError);
  assert.throws(() => E.applyEvent(p, { type: 'nope', skillId: SK }, '2026-10-26'));
});

test('no mastery from one answer; mastery needs the full window at ≥ 80 %', () => {
  let p = run([att('correct', true)]);
  assert.equal(E.masteryOf(p.skills[SK]), 'learning');
  p = run(Array.from({ length: 9 }, () => att('correct', true)));
  assert.equal(E.masteryOf(p.skills[SK]), 'learning', '9 questions are not enough');
  p = run([...Array.from({ length: 8 }, () => att('correct', true)), att('incorrect', true), att('incorrect', true)]);
  assert.equal(E.masteryOf(p.skills[SK]), 'secure', '8/10');
  p = run([...Array.from({ length: 7 }, () => att('correct', true)), att('incorrect', true), att('incorrect', true), att('incorrect', true)]);
  assert.equal(E.masteryOf(p.skills[SK]), 'learning', '7/10');
});

test('answers after opening the worked solution do not count towards mastery; reveal counts as a failed question', () => {
  let p = run(Array.from({ length: 10 }, () => att('correct', true, { sawSolution: true })));
  assert.equal(E.recentAccuracy(p.skills[SK]), 0);
  assert.equal(p.skills[SK].firstAttemptCorrect, 10, 'raw first-attempt count still recorded');
  p = run([{ type: 'reveal', skillId: SK, hadAttempt: false }, { type: 'reveal', skillId: SK, hadAttempt: true }]);
  assert.equal(p.skills[SK].questions, 1);
  assert.equal(p.skills[SK].solutionsShown, 2);
});

test('recent window keeps the last 10', () => {
  const p = run([...Array.from({ length: 15 }, () => att('incorrect', true)), ...Array.from({ length: 10 }, () => att('correct', true))]);
  assert.deepEqual(p.skills[SK].recent, Array(10).fill(1));
});

test('review scheduling: weak → 1 day, medium → 3, strong doubles within 7..28', () => {
  const today = '2026-10-26';
  let p = E.scheduleReview(run([att('incorrect', true), att('incorrect', true), att('correct', true)]), SK, today);
  assert.equal(p.skills[SK].nextReview, '2026-10-27');
  p = E.scheduleReview(run([att('correct', true), att('correct', true), att('correct', true)]), SK, today);
  assert.equal(p.skills[SK].nextReview, '2026-10-29', 'too few questions for strong');
  p = run(Array.from({ length: 10 }, () => att('correct', true)));
  p = E.scheduleReview(p, SK, today); assert.equal(p.skills[SK].intervalDays, 7); assert.equal(p.skills[SK].nextReview, '2026-11-02');
  p = E.scheduleReview(p, SK, today); assert.equal(p.skills[SK].intervalDays, 14);
  p = E.scheduleReview(p, SK, today); assert.equal(p.skills[SK].intervalDays, 28);
  p = E.scheduleReview(p, SK, today); assert.equal(p.skills[SK].intervalDays, 28);
  assert.deepEqual(E.dueSkills(p, '2026-11-22'), []);
  assert.deepEqual(E.dueSkills(p, '2026-11-23'), [{ skillId: SK, nextReview: '2026-11-23' }]);
  assert.equal(E.addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(E.addDays('2028-02-28', 1), '2028-02-29');
});

test('dueSkills sorts most overdue first', () => {
  const p = E.emptyProgress();
  p.skills.b = { ...run([att('correct', true)]).skills[SK], nextReview: '2026-10-20' };
  p.skills.a = { ...run([att('correct', true)]).skills[SK], nextReview: '2026-10-25' };
  p.skills.c = { ...run([att('correct', true)]).skills[SK], nextReview: '2026-12-01' };
  assert.deepEqual(E.dueSkills(p, '2026-10-26').map(d => d.skillId), ['b', 'a']);
});

test('validateProgress: round trip, rejects foreign files and inconsistent numbers, drops unknown fields', () => {
  let p = run([att('incorrect', true), att('correct', false)]);
  p = E.scheduleReview(p, SK, '2026-10-26');
  p = E.addReport(p, { schema: 'mathe7-report', version: 1, questionId: 'a@1/L1/1', note: '' });
  const r = E.validateProgress(JSON.parse(JSON.stringify({ ...p, extra: 'drop me' })));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.value, p);
  assert.equal(E.validateProgress({ schema: 'other' }).ok, false);
  assert.equal(E.validateProgress('text').ok, false);
  assert.equal(E.validateProgress({ ...p, version: 2 }).ok, false);
  const bad = JSON.parse(JSON.stringify(p)); bad.skills[SK].correct = 99;
  assert.equal(E.validateProgress(bad).ok, false);
  const bad2 = JSON.parse(JSON.stringify(p)); bad2.skills[SK].attempts = -1;
  assert.equal(E.validateProgress(bad2).ok, false);
  const bad3 = JSON.parse(JSON.stringify(p)); bad3.skills[SK].errors.made_up = 1;
  assert.equal(E.validateProgress(bad3).ok, false);
  const bad4 = JSON.parse(JSON.stringify(p)); bad4.skills['<script>'] = {};
  assert.equal(E.validateProgress(bad4).ok, false);
});

test('reports are capped', () => {
  let p = E.emptyProgress();
  for (let i = 0; i < 60; i++) p = E.addReport(p, { schema: 'mathe7-report', version: 1, questionId: `x@1/L1/${i}` });
  assert.equal(p.reports.length, E.PROGRESS_RULES.maxReports);
  assert.equal(p.reports[0].questionId, 'x@1/L1/10');
});

test('practice events flow into progress end-to-end', () => {
  const today = '2026-10-26';
  let { session } = E.createSession({ skillId: SK, levelMode: 'auto', count: 10, baseSeed: 5 });
  let p = E.emptyProgress();
  let n = 0;
  while (!session.finished) {
    const q = E.questionFor(E.currentItem(session));
    let r;
    if (n++ % 3 === 0) { r = E.submitAnswer(session, q, '0'); r.events.forEach(ev => { p = E.applyEvent(p, ev, today); }); session = r.session; }
    if (E.currentItem(session).solved) { session = E.advance(session); continue; }
    r = E.submitAnswer(session, q, E.canonicalInput(q.answer));
    r.events.forEach(ev => { p = E.applyEvent(p, ev, today); });
    session = E.advance(r.session);
  }
  p = E.scheduleReview(p, SK, today);
  const st = E.skillStats(p, SK);
  const sum = E.summarize(session);
  assert.equal(st.questions, 10);
  assert.equal(st.attempts, sum.attempts);
  assert.equal(st.firstAttemptRate, sum.solvedFirstTry / 10);
  assert.ok(st.nextReview > today);
});
