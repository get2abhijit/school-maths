'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/index.js');

const SKILLS = E.skillsWithTemplates();
const freeze = o => JSON.stringify(o);

test('autoLevels ramps through available levels', () => {
  assert.deepEqual(E.autoLevels([1, 2, 3, 4], 10), [1, 1, 1, 2, 2, 3, 3, 3, 4, 4]);
  assert.deepEqual(E.autoLevels([2, 3, 4], 5), [2, 2, 3, 3, 4]);
  assert.deepEqual(E.autoLevels([3, 1, 2], 5), [1, 1, 2, 2, 3]);
});

test('createSession: every skill × mode × count, deterministic, no duplicate signatures, levels as planned', () => {
  for (const skillId of SKILLS) {
    for (const mode of ['auto', ...E.levelsForSkill(skillId)]) {
      for (const count of E.SESSION_COUNTS) {
        const a = E.createSession({ skillId, levelMode: mode, count, baseSeed: 777 });
        const b = E.createSession({ skillId, levelMode: mode, count, baseSeed: 777 });
        assert.equal(freeze(a.session), freeze(b.session));
        assert.equal(a.session.items.length, count);
        assert.equal(new Set(a.session.items.map(i => i.signature)).size, count, `${skillId} ${mode} ${count}`);
        assert.deepEqual(a.session.items.map(i => i.level), E.plannedLevels(skillId, mode, count));
        a.questions.forEach(q => assert.equal(q.skillId, skillId));
        assert.ok(E.isValidSession(JSON.parse(JSON.stringify(a.session))));
      }
    }
  }
});

test('createSession rejects bad parameters', () => {
  assert.throws(() => E.createSession({ skillId: 'ch1.terms.evaluate', count: 7, baseSeed: 1 }), RangeError);
  assert.throws(() => E.createSession({ skillId: 'ch1.terms.evaluate', count: 5, baseSeed: -1 }), RangeError);
  assert.throws(() => E.createSession({ skillId: 'ch1.numterms.evaluate', levelMode: 9, count: 5, baseSeed: 1 }), E.GenerationError);
  assert.throws(() => E.createSession({ skillId: 'ch4.nothing', count: 5, baseSeed: 1 }), E.GenerationError);
});

test('full session walk: correct answers, regenerate from stored ids, summary', () => {
  for (const skillId of SKILLS) {
    let { session } = E.createSession({ skillId, levelMode: 'auto', count: 5, baseSeed: 4242 });
    const events = [];
    while (!session.finished) {
      const stored = JSON.parse(JSON.stringify(session)); // as after a reload
      const q = E.questionFor(E.currentItem(stored));
      const r = E.submitAnswer(stored, q, E.canonicalInput(q.answer));
      assert.equal(r.result.status, 'correct', q.id);
      events.push(...r.events);
      session = E.advance(r.session);
    }
    const s = E.summarize(session);
    assert.equal(s.questions, 5);
    assert.equal(s.solvedFirstTry, 5);
    assert.equal(s.attempts, 5);
    assert.equal(events.filter(e => e.isFirst).length, 5);
  }
});

test('invalid input is not an attempt; wrong then right; hints counted once; reveal closes item', () => {
  let { session, questions } = E.createSession({ skillId: 'ch1.terms.expand_factor', levelMode: 1, count: 5, baseSeed: 9 });
  let q = questions[0];
  let r = E.submitAnswer(session, q, '3x+(');
  assert.equal(r.result.status, 'invalid');
  assert.equal(r.events.length, 0);
  assert.equal(r.session, session, 'session unchanged on invalid input');

  let h = E.openHint(session, 2); session = h.session; assert.equal(h.events.length, 1);
  h = E.openHint(session, 2); assert.equal(h.events.length, 0, 'same hint twice is counted once');
  assert.throws(() => E.openHint(session, 5), RangeError);

  r = E.submitAnswer(session, q, '0');
  assert.equal(r.result.status, 'incorrect');
  assert.equal(r.events[0].isFirst, true);
  assert.equal(r.events[0].hintsBefore, 1);
  session = r.session;
  r = E.submitAnswer(session, q, E.canonicalInput(q.answer));
  assert.equal(r.result.status, 'correct');
  assert.equal(r.events[0].isFirst, false);
  session = E.advance(r.session);
  assert.throws(() => E.submitAnswer(session, q, '1'), /current item/);

  q = E.questionFor(E.currentItem(session));
  const rv = E.revealSolution(session);
  assert.deepEqual(rv.events, [{ type: 'reveal', skillId: 'ch1.terms.expand_factor', templateId: E.parseQuestionId(rv.session.items[0].qid).templateId, level: rv.session.items[0].level, hadAttempt: false }]);
  session = rv.session;
  assert.throws(() => E.submitAnswer(session, q, E.canonicalInput(q.answer)), /closed/);
  assert.equal(E.revealSolution(session).events.length, 0);
  const s = E.summarize(E.advance(session));
  assert.equal(s.solvedLater, 1);
  assert.equal(s.revealed, 1);
  assert.equal(s.hintsUsed, 1);
  assert.equal(s.errors.other !== undefined || Object.keys(s.errors).length === 1, true);
});

test('replaceWithVariant: same template and level, new signature, position unchanged, deterministic', () => {
  for (const skillId of SKILLS) {
    for (const level of E.levelsForSkill(skillId)) {
      let { session } = E.createSession({ skillId, levelMode: level, count: 5, baseSeed: 31 });
      const before = E.position(session);
      const old = E.currentItem(session);
      const a = E.replaceWithVariant(session);
      const b = E.replaceWithVariant(session);
      assert.equal(a.question.id, b.question.id, 'deterministic');
      assert.equal(E.parseQuestionId(a.question.id).templateId, E.parseQuestionId(old.qid).templateId);
      assert.equal(a.question.level, old.level);
      assert.ok(!session.items.some(i => i.signature === a.question.signature));
      assert.deepEqual(E.position(a.session), before);
      assert.equal(a.events[0].type, 'skip');
      // Second replacement in a row gives yet another question.
      const c = E.replaceWithVariant(a.session);
      assert.notEqual(c.question.signature, a.question.signature);
      // Finishing still requires exactly `count` counted items.
      let s = c.session;
      while (!s.finished) {
        const q = E.questionFor(E.currentItem(s));
        s = E.advance(E.submitAnswer(s, q, E.canonicalInput(q.answer)).session);
      }
      const sum = E.summarize(s);
      assert.equal(sum.questions, 5);
      assert.equal(sum.replaced, 2);
    }
  }
});

test('isValidSession rejects garbage', () => {
  assert.equal(E.isValidSession(null), false);
  assert.equal(E.isValidSession({}), false);
  assert.equal(E.isValidSession({ schema: 'mathe7-session', version: 1, skillId: 'x', items: [{ qid: 'nonsense', attempts: [], hintsSeen: [] }], current: 0 }), false);
  const { session } = E.createSession({ skillId: 'ch1.terms.evaluate', count: 5, baseSeed: 3 });
  assert.equal(E.isValidSession({ ...session, current: 5 }), false);
});

test('a session stored under an older template version is refused on regeneration', () => {
  const { session } = E.createSession({ skillId: 'ch1.terms.evaluate', count: 5, baseSeed: 3 });
  const bad = JSON.parse(JSON.stringify(session));
  bad.items[0].qid = bad.items[0].qid.replace(/@\d+\//, '@99/');
  assert.throws(() => E.questionFor(bad.items[0]), E.GenerationError);
});

test('makeReport carries id, seed, version and truncates the note', () => {
  const q = E.generateQuestion('ch1.terms.collect_like.collect', 5, 2);
  const r = E.makeReport(q, { note: 'x'.repeat(2000), answerGiven: '3x', engineVersion: E.ENGINE_VERSION, catalogVersion: '0.2.0', createdAt: '2026-10-26' });
  assert.equal(r.questionId, q.id);
  assert.equal(r.seed, 5);
  assert.equal(r.templateVersion, q.templateVersion);
  assert.equal(r.note.length, 1000);
  assert.equal(E.regenerateQuestion(r.questionId).signature, q.signature);
});

test('labels exist for every hint kind, error category and level mode', () => {
  E.HINT_KINDS.forEach(k => assert.ok(E.HINT_LABELS_DE[k]));
  E.ERROR_CATEGORIES.forEach(c => assert.ok(E.ERROR_LABELS_DE[c]));
  ['auto', 1, 2, 3, 4].forEach(m => assert.ok(E.LEVEL_MODE_LABELS_DE[m]));
});

test('endSession closes early; open items count as unsolved', () => {
  let { session, questions } = E.createSession({ skillId: 'ch1.terms.evaluate', count: 5, baseSeed: 12 });
  session = E.advance(E.submitAnswer(session, questions[0], E.canonicalInput(questions[0].answer)).session);
  const before = JSON.stringify(session);
  const ended = E.endSession(session);
  assert.equal(JSON.stringify(session), before, 'input not mutated');
  assert.equal(ended.finished, true);
  const sum = E.summarize(ended);
  assert.equal(sum.questions, 5);
  assert.equal(sum.solvedFirstTry, 1);
  assert.equal(sum.unsolved, 4);
});
