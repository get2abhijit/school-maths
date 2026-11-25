'use strict';
/**
 * Adaptive engine (Session 10): evidence, mastery, level recommendation, in-session level, spaced review,
 * prerequisite fallback, adaptive sessions. Everything is deterministic; histories are built through the real
 * applyEvent so the tests cover the whole path from practice events to recommendations.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src');
const catalog = require('../catalog.json');

const R = E.ADAPTIVE_RULES;
const TODAY = '2026-10-30';

/** Feed [[level, outcome], …] into a progress record through applyEvent. outcome: 'clean' | 'hinted' | 'miss'. */
function feed(p, skillId, entries, date = TODAY) {
  for (const [level, o] of entries) {
    const ev = { type: 'attempt', skillId, level, status: o === 'miss' ? 'incorrect' : 'correct', errorCategory: o === 'miss' ? 'other' : null,
      isFirst: true, hintsBefore: o === 'hinted' ? 1 : 0, sawSolution: false };
    p = E.applyEvent(p, ev, date);
  }
  return p;
}
const rep = (n, level, o) => Array.from({ length: n }, () => [level, o]);
const SK = 'ch4.eq.solve_equivalence';
const ALL = [1, 2, 3, 4];

// ------------------------------------------------------------------ evidence
test('events record level and outcome; hints and the worked solution change the outcome', () => {
  let p = E.emptyProgress();
  p = E.applyEvent(p, { type: 'attempt', skillId: SK, level: 2, status: 'correct', errorCategory: null, isFirst: true, hintsBefore: 0, sawSolution: false }, TODAY);
  p = E.applyEvent(p, { type: 'attempt', skillId: SK, level: 3, status: 'correct', errorCategory: null, isFirst: true, hintsBefore: 2, sawSolution: false }, TODAY);
  p = E.applyEvent(p, { type: 'attempt', skillId: SK, level: 3, status: 'correct', errorCategory: null, isFirst: true, hintsBefore: 4, sawSolution: true }, TODAY);
  p = E.applyEvent(p, { type: 'attempt', skillId: SK, level: 1, status: 'incorrect', errorCategory: 'sign_error', isFirst: true, hintsBefore: 0, sawSolution: false }, TODAY);
  p = E.applyEvent(p, { type: 'attempt', skillId: SK, level: 1, status: 'correct', errorCategory: null, isFirst: false, hintsBefore: 0, sawSolution: false }, TODAY);
  p = E.applyEvent(p, { type: 'reveal', skillId: SK, level: 4, hadAttempt: false }, TODAY);
  p = E.applyEvent(p, { type: 'reveal', skillId: SK, level: 4, hadAttempt: true }, TODAY);
  assert.deepEqual(p.skills[SK].detail.map(d => [d.l, d.o]), [[2, 'clean'], [3, 'hinted'], [3, 'miss'], [1, 'miss'], [4, 'miss']],
    'only the first attempt of a question and a reveal without attempt are evidence');
});

test('the evidence window is capped; legacy records (only `recent`) read as level-less evidence', () => {
  const p = feed(E.emptyProgress(), SK, rep(40, 2, 'clean'));
  assert.equal(p.skills[SK].detail.length, E.PROGRESS_RULES.detailWindow);
  const legacy = { questions: 10, recent: [1, 1, 0, 1], detail: [] };
  assert.deepEqual(E.evidenceOf(legacy), [{ l: null, o: 'clean' }, { l: null, o: 'clean' }, { l: null, o: 'miss' }, { l: null, o: 'clean' }]);
  assert.deepEqual(E.evidenceOf(undefined), []);
});

// ------------------------------------------------------------------ mastery
test('mastery: never from one answer, never from easy questions only, hints count half', () => {
  const m = rec => E.adaptiveMastery(rec, 4);
  assert.equal(m(undefined), 'new');
  let p = feed(E.emptyProgress(), SK, [[3, 'clean']]);
  assert.equal(m(p.skills[SK]), 'learning', 'one clean answer');
  p = feed(E.emptyProgress(), SK, rep(12, 1, 'clean'));
  assert.equal(m(p.skills[SK]), 'learning', '12 clean answers, but only at level 1');
  p = feed(E.emptyProgress(), SK, [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(4, 3, 'clean')]);
  assert.equal(m(p.skills[SK]), 'secure', 'levels 1–3 all clean');
  p = feed(E.emptyProgress(), SK, [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(2, 3, 'clean')]);
  assert.equal(m(p.skills[SK]), 'learning', 'only two questions at level 3 → level 3 not proven');
  p = feed(E.emptyProgress(), SK, rep(12, 3, 'hinted'));
  assert.equal(m(p.skills[SK]), 'learning', 'with hints every time: score 0.5 < 0.8');
  p = feed(E.emptyProgress(), SK, [...rep(9, 3, 'clean'), ...rep(3, 3, 'miss')]);
  assert.equal(m(p.skills[SK]), 'learning', '9/12 = 0.75 < 0.8');
});

test('mastery: a skill whose top level is 2 needs level 2 only; legacy records keep the old accuracy rule', () => {
  const p = feed(E.emptyProgress(), SK, [...rep(5, 1, 'clean'), ...rep(5, 2, 'clean')]);
  assert.equal(E.adaptiveMastery(p.skills[SK], 2), 'secure');
  assert.equal(E.adaptiveMastery(p.skills[SK], 4), 'learning', 'level 3 not proven yet');
  const legacy = { questions: 10, recent: Array(10).fill(1), detail: [] };
  assert.equal(E.adaptiveMastery(legacy, 4), 'secure');
  assert.equal(E.adaptiveMastery({ questions: 9, recent: Array(9).fill(1), detail: [] }, 4), 'learning');
});

test('needsHelp: ≥ 5 recent questions with mean score < 0.5', () => {
  assert.equal(E.needsHelp(feed(E.emptyProgress(), SK, rep(4, 2, 'miss')).skills[SK]), false, 'four misses are not yet enough evidence');
  assert.equal(E.needsHelp(feed(E.emptyProgress(), SK, rep(5, 2, 'miss')).skills[SK]), true);
  assert.equal(E.needsHelp(feed(E.emptyProgress(), SK, [...rep(3, 2, 'miss'), ...rep(2, 2, 'clean')]).skills[SK]), true, '2/5 = 0.4 < 0.5');
  assert.equal(E.needsHelp(feed(E.emptyProgress(), SK, [...rep(2, 2, 'miss'), ...rep(3, 2, 'clean')]).skills[SK]), false, '3/5 = 0.6');
  assert.equal(E.needsHelp(feed(E.emptyProgress(), SK, [...rep(6, 2, 'miss'), ...rep(8, 2, 'clean')]).skills[SK]), false, 'only the last 8 questions count');
});

// ------------------------------------------------------------------ level recommendation
test('recommendLevel: lowest level without evidence; up after a solid run; one miss does not lower it', () => {
  assert.equal(E.recommendLevel(undefined, ALL), 1);
  assert.equal(E.recommendLevel(undefined, [2, 3]), 2);
  assert.equal(E.recommendLevel(feed(E.emptyProgress(), SK, rep(3, 1, 'clean')).skills[SK], ALL), 1, '3 clean < upMin');
  assert.equal(E.recommendLevel(feed(E.emptyProgress(), SK, rep(4, 1, 'clean')).skills[SK], ALL), 2);
  const p2 = feed(E.emptyProgress(), SK, [...rep(4, 1, 'clean'), ...rep(3, 2, 'clean')]);
  assert.equal(E.recommendLevel(p2.skills[SK], ALL), 2, 'supported 2; level 3 needs ≥ 4 questions at/above it');
  const p3 = feed(p2, SK, [[2, 'miss']]);
  assert.equal(E.recommendLevel(p3.skills[SK], ALL), 2, 'a single miss changes nothing');
  const p4 = feed(E.emptyProgress(), SK, [...rep(6, 1, 'clean'), ...rep(4, 3, 'miss')]);
  assert.equal(E.recommendLevel(p4.skills[SK], ALL), 1, 'level 3 fails → back to what is supported');
  const top = feed(E.emptyProgress(), SK, rep(8, 4, 'clean'));
  assert.equal(E.recommendLevel(top.skills[SK], ALL), 4, 'never above the top level');
  assert.equal(E.recommendLevel(top.skills[SK], [1, 2, 3]), 3, 'clamped to the skill\'s available levels');
  assert.throws(() => E.recommendLevel(undefined, []), /no levels/);
});

test('recommendLevel is deterministic and stays inside the available levels (2000 random histories)', () => {
  const rng = new E.Rng(20261030);
  const outs = ['clean', 'hinted', 'miss'];
  for (let k = 0; k < 2000; k++) {
    const avail = [[1, 2, 3, 4], [1, 2, 3], [2, 3], [1, 2], [1, 3, 4]][rng.int(0, 4)];
    const entries = Array.from({ length: rng.int(0, 30) }, () => [avail[rng.int(0, avail.length - 1)], outs[rng.int(0, 2)]]);
    const rec = feed(E.emptyProgress(), SK, entries).skills[SK];
    const a = E.recommendLevel(rec, avail), b = E.recommendLevel(JSON.parse(JSON.stringify(rec || {})), avail);
    assert.equal(a, b);
    assert.ok(avail.includes(a), `${a} not in ${avail}`);
    const lv = entries.slice(-R.levelWindow);
    if (lv.length >= R.levelWindow && lv.every(e => e[1] === 'miss')) assert.equal(a, avail[0], 'only misses → lowest level');
    if (lv.length >= R.upMin && lv.every(e => e[1] === 'clean')) assert.ok(a >= Math.min(avail[avail.length - 1], Math.max(...lv.map(e => e[0]))) || a === avail[avail.length - 1], 'only clean answers never lower it below the highest level reached');
  }
});

// ------------------------------------------------------------------ level inside a session
test('replayLevel: two clean answers up, two misses down, anything else holds; clamped; start snaps to an available level', () => {
  const r = (o, s = 2, a = ALL) => E.replayLevel(o, s, a);
  assert.equal(r([]), 2);
  assert.equal(r(['clean']), 2, 'one answer never moves the level');
  assert.equal(r(['clean', 'clean']), 3);
  assert.equal(r(['clean', 'clean', 'clean']), 3, 'streak restarts after a change');
  assert.equal(r(['clean', 'clean', 'clean', 'clean']), 4);
  assert.equal(r(['clean', 'clean', 'clean', 'clean', 'clean', 'clean']), 4, 'clamped at the top');
  assert.equal(r(['miss', 'miss']), 1);
  assert.equal(r(['miss', 'miss', 'miss', 'miss']), 1, 'clamped at the bottom');
  assert.equal(r(['clean', 'miss', 'clean', 'miss']), 2, 'alternating holds');
  assert.equal(r(['clean', 'hinted', 'clean']), 2, 'a hinted answer breaks a clean streak');
  assert.equal(r(['hinted', 'hinted', 'hinted']), 2, 'hinted answers neither raise nor lower');
  assert.equal(r(['clean', 'clean'], 2, [1, 3, 4]), 3);
  assert.equal(r([], 2, [1, 3, 4]), 1, 'start 2 is not available → nearest (lower on ties)');
});

test('itemOutcome: clean / hinted / miss, open and replaced items give null', () => {
  const it = o => ({ attempts: [], hintsSeen: [], solved: false, revealed: false, replaced: false, ...o });
  assert.equal(E.itemOutcome(it({})), null);
  assert.equal(E.itemOutcome(it({ solved: true, attempts: [{}] })), 'clean');
  assert.equal(E.itemOutcome(it({ solved: true, attempts: [{}], hintsSeen: [0] })), 'hinted');
  assert.equal(E.itemOutcome(it({ solved: true, attempts: [{}], hintsSeen: [0, 3] })), 'miss');
  assert.equal(E.itemOutcome(it({ solved: true, attempts: [{}, {}] })), 'miss');
  assert.equal(E.itemOutcome(it({ revealed: true })), 'miss');
  assert.equal(E.itemOutcome(it({ replaced: true })), null);
});

// ------------------------------------------------------------------ adaptive sessions
function play(skillId, startLevel, count, strategy, seed = 4242) {
  let { session } = E.createSession({ skillId, levelMode: 'adaptive', count, baseSeed: seed, startLevel });
  const levels = [];
  for (let guard = 0; guard < 200 && !session.finished; guard++) {
    const item = E.currentItem(session);
    const q = E.questionFor(item);
    levels.push(item.level);
    const ok = strategy(levels.length - 1);
    if (ok) session = E.submitAnswer(session, q, E.canonicalInput(q.answer)).session;
    else session = E.revealSolution(session).session;
    session = E.advance(session);
  }
  return { session, levels };
}

test('adaptive session: exactly `count` questions, levels follow the answers, deterministic', () => {
  const up = play('ch1.terms.collect_like', 1, 10, () => true);
  assert.equal(up.session.items.length, 10);
  assert.deepEqual(up.levels, [1, 1, 2, 2, 3, 3, 4, 4, 4, 4]);
  const down = play('ch1.terms.collect_like', 3, 10, () => false);
  assert.deepEqual(down.levels, [3, 3, 2, 2, 1, 1, 1, 1, 1, 1]);
  const again = play('ch1.terms.collect_like', 1, 10, () => true);
  assert.deepEqual(again.session, up.session, 'same seed, start level and answers → identical session');
  const other = play('ch1.terms.collect_like', 1, 10, () => true, 99);
  assert.notDeepEqual(other.session.items.map(i => i.qid), up.session.items.map(i => i.qid));
});

test('adaptive session: position total is the planned count from the first question; replaced items do not count', () => {
  let { session } = E.createSession({ skillId: 'ch1.terms.collect_like', levelMode: 'adaptive', count: 5, baseSeed: 5, startLevel: 2 });
  assert.deepEqual(E.position(session), { number: 1, total: 5 });
  assert.equal(session.items.length, 1, 'items are generated one at a time');
  const q = E.questionFor(E.currentItem(session));
  session = E.submitAnswer(session, q, '99999').session;      // a wrong answer, then a variant
  const v = E.replaceWithVariant(session);
  session = v.session;
  assert.deepEqual(E.position(session), { number: 1, total: 5 }, 'the variant replaces the item, it does not add a question');
  assert.ok(E.isValidSession(session));
  assert.equal(E.isValidSession({ ...session, startLevel: undefined }), false);
});

test('adaptive sessions: valid, duplicate-free and level-correct for every practicable skill (20 questions, 3 answer strategies)', () => {
  const strategies = { allRight: () => true, allWrong: () => false, alternating: i => i % 2 === 0 };
  for (const skillId of E.skillsWithTemplates()) {
    const avail = E.levelsForSkill(skillId);
    for (const [name, strat] of Object.entries(strategies)) {
      const { session, levels } = play(skillId, avail[0], 20, strat, 1000 + skillId.length);
      assert.equal(session.items.length, 20, `${skillId}/${name}`);
      assert.equal(new Set(session.items.map(i => i.signature)).size, 20, `${skillId}/${name}: duplicate signature`);
      assert.ok(levels.every(l => avail.includes(l)), `${skillId}/${name}: level outside the skill's levels`);
      assert.ok(session.items.every(i => E.parseQuestionId(i.qid).level === i.level));
    }
    assert.equal(play(skillId, avail[0], 10, () => true).levels.at(-1), avail[avail.length - 1], `${skillId}: all right climbs to the top level`);
  }
});

// ------------------------------------------------------------------ spaced revision
function sessionEnd(p, skillId, today, entries, top = 4) {
  p = feed(p, skillId, entries, today);
  return E.scheduleReviewAdaptive(p, skillId, today, top);
}
test('spaced review: box ladder 1,2,4,7,… days; grows only when due; lapse halves; capped without mastery', () => {
  let p = sessionEnd(E.emptyProgress(), SK, '2026-10-01', rep(6, 2, 'clean'));
  assert.deepEqual([p.skills[SK].box, p.skills[SK].intervalDays, p.skills[SK].nextReview], [1, 2, '2026-10-03']);
  p = sessionEnd(p, SK, '2026-10-01', rep(6, 2, 'clean'));
  assert.equal(p.skills[SK].box, 1, 'a second session on the same day does not climb the ladder');
  p = sessionEnd(p, SK, '2026-10-03', rep(6, 2, 'clean'));
  assert.deepEqual([p.skills[SK].box, p.skills[SK].intervalDays, p.skills[SK].nextReview], [2, 4, '2026-10-07']);
  p = sessionEnd(p, SK, '2026-10-07', rep(6, 2, 'clean'));
  assert.equal(p.skills[SK].intervalDays, 7);
  p = sessionEnd(p, SK, '2026-10-14', rep(6, 2, 'clean'));
  assert.equal(p.skills[SK].box, 3, 'level 3 never proven → no mastery → capped at maxBoxUnsecure');
  p = sessionEnd(p, SK, '2026-10-21', rep(8, 3, 'miss'));
  assert.deepEqual([p.skills[SK].box, p.skills[SK].intervalDays], [1, 2], 'lapse: floor(3/2) = 1');
  p = sessionEnd(p, SK, '2026-10-22', rep(8, 3, 'miss'));
  assert.equal(p.skills[SK].box, 0);
  assert.equal(p.skills[SK].nextReview, '2026-10-23');
});

test('spaced review: secure topics reach 28 days; medium results keep the box; unknown skills and empty records are left alone', () => {
  let p = E.emptyProgress();
  const good = [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(6, 3, 'clean')];
  let day = new Date(Date.UTC(2026, 0, 1));
  const iso = d => d.toISOString().slice(0, 10);
  for (let i = 0; i < 8; i++) {
    p = sessionEnd(p, SK, iso(day), i === 0 ? good : rep(6, 3, 'clean'));
    day = new Date(day.getTime() + p.skills[SK].intervalDays * 86400000);
  }
  assert.equal(p.skills[SK].intervalDays, 28, 'ladder ends at 28 days');
  assert.equal(p.skills[SK].box, 5);
  const q = sessionEnd(E.emptyProgress(), SK, TODAY, [...rep(4, 2, 'clean'), ...rep(4, 2, 'miss')]);
  assert.equal(q.skills[SK].box, 0, '0.5 is neither lapse nor growth: box stays');
  assert.deepEqual(E.scheduleReviewAdaptive(E.emptyProgress(), 'nope', TODAY), E.emptyProgress());
  const before = JSON.stringify(p);
  E.scheduleReviewAdaptive(p, SK, '2027-06-01'); assert.equal(JSON.stringify(p), before, 'input is not mutated');
});

test('spaced review: every rule parameter is read from ADAPTIVE_RULES (tunable)', () => {
  const tuned = { ...R, reviewLadder: [3, 6, 9, 12, 15, 18], reviewGrowMin: 2 };
  let p = feed(E.emptyProgress(), SK, rep(2, 2, 'clean'), TODAY);
  p = E.scheduleReviewAdaptive(p, SK, TODAY, 4, tuned);
  assert.deepEqual([p.skills[SK].box, p.skills[SK].intervalDays], [1, 6]);
  const q = E.scheduleReviewAdaptive(feed(E.emptyProgress(), SK, rep(2, 2, 'clean'), TODAY), SK, TODAY);
  assert.equal(q.skills[SK].box, 0, 'default rules need 6 questions to grow');
  assert.throws(() => { R.upMin = 1; }, TypeError, 'the rule object is frozen');
});

// ------------------------------------------------------------------ prerequisite fallback
const offeredAll = id => E.levelsForSkill(id).length > 0;
const lv = id => E.levelsForSkill(id);
test('prerequisite advice: only when the student struggles; weak prerequisites first, then untested, then unsure', () => {
  const S = 'ch1.terms.expand_factor';     // prerequisites: collect_like, simplify_products
  let p = E.emptyProgress();
  assert.equal(E.prerequisiteAdvice(catalog, p, S, offeredAll).action, 'continue', 'no data');
  p = feed(p, S, rep(5, 2, 'clean'));
  assert.equal(E.prerequisiteAdvice(catalog, p, S, offeredAll).action, 'continue', 'doing well');
  p = feed(E.emptyProgress(), S, rep(5, 2, 'miss'));
  let a = E.prerequisiteAdvice(catalog, p, S, offeredAll, R, lv);
  assert.equal(a.action, 'fallback');
  assert.equal(a.reason, 'untested');
  assert.equal(a.skillId, 'ch1.terms.evaluate', 'both direct prerequisites are untested → deeper first (collect_like ← evaluate)');
  p = feed(p, 'ch1.terms.simplify_products', rep(6, 2, 'miss'));
  a = E.prerequisiteAdvice(catalog, p, S, offeredAll, R, lv);
  assert.deepEqual([a.skillId, a.reason], ['ch1.terms.simplify_products', 'weak'], 'evidence of weakness beats "untested"');
  p = feed(p, 'ch1.terms.collect_like', [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(4, 3, 'clean')]);
  p = feed(p, 'ch1.terms.evaluate', [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(4, 3, 'clean')]);
  a = E.prerequisiteAdvice(catalog, p, S, offeredAll, R, lv);
  assert.equal(a.skillId, 'ch1.terms.simplify_products');
  p = feed(p, 'ch1.terms.simplify_products', [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(8, 3, 'clean')]);
  assert.equal(E.prerequisiteAdvice(catalog, p, S, offeredAll, R, lv).action, 'continue', 'all prerequisites secure');
});

test('prerequisite advice respects "Im Unterricht behandelt", names external prerequisites, never mutates', () => {
  const S = 'ch4.eq.setup_trial';          // prerequisites: ch1.terms.evaluate, ch1.terms.translate
  const p = feed(E.emptyProgress(), S, rep(6, 2, 'miss'));
  const frozen = JSON.stringify(p);
  const notCh1 = id => offeredAll(id) && !id.startsWith('ch1.');
  const a = E.prerequisiteAdvice(catalog, p, S, notCh1, R, lv);
  assert.equal(a.action, 'continue', 'Chapter 1 is hidden by the filter → nothing to recommend');
  const b = E.prerequisiteAdvice(catalog, feed(E.emptyProgress(), 'ch1.numterms.evaluate', rep(6, 2, 'miss')), 'ch1.numterms.evaluate', offeredAll, R, lv);
  assert.equal(b.action, 'continue');
  assert.ok(b.external.length >= 1 && b.external.every(n => /Kl\. 5\/6/.test(n)), 'Klasse-6 foundations are named, not offered: ' + b.external);
  assert.equal(JSON.stringify(p), frozen);
});

test('catalog prerequisites resolve to skills or external prerequisites and contain no cycle', () => {
  const skills = new Map(); for (const ch of catalog.chapters) for (const t of ch.topics) for (const s of t.skills) skills.set(s.id, s);
  const ext = new Set(catalog.externalPrerequisites.map(e => e.id));
  for (const s of skills.values()) for (const pid of s.prerequisites) assert.ok(skills.has(pid) || ext.has(pid), `${s.id} → ${pid}`);
  const state = new Map();
  const visit = id => {
    if (!skills.has(id)) return;
    if (state.get(id) === 1) assert.fail('cycle at ' + id);
    if (state.get(id) === 2) return;
    state.set(id, 1); skills.get(id).prerequisites.forEach(visit); state.set(id, 2);
  };
  skills.forEach((_, id) => visit(id));
});

// ------------------------------------------------------------------ progress record
test('progress validation: detail, box and diagnostics round-trip; older exports import; malformed ones are refused', () => {
  const p0 = sessionEnd(E.emptyProgress(), SK, TODAY, [...rep(3, 2, 'clean'), [3, 'hinted'], [1, 'miss'], ...rep(2, 2, 'clean')]);
  const r = E.validateProgress(JSON.parse(JSON.stringify(p0)));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.value, p0);
  const old = JSON.parse(JSON.stringify(p0)); delete old.skills[SK].detail; delete old.skills[SK].box; delete old.diagnostics;
  const ro = E.validateProgress(old);
  assert.ok(ro.ok); assert.deepEqual(ro.value.skills[SK].detail, []); assert.equal(ro.value.skills[SK].box, 0); assert.deepEqual(ro.value.diagnostics, {});
  const bad = (mut) => { const x = JSON.parse(JSON.stringify(p0)); mut(x); return E.validateProgress(x); };
  assert.equal(bad(x => { x.skills[SK].detail[0].o = 'great'; }).ok, false);
  assert.equal(bad(x => { x.skills[SK].detail[0].l = 7; }).ok, false);
  assert.equal(bad(x => { x.skills[SK].detail[0].d = 'heute'; }).ok, false);
  assert.equal(bad(x => { x.skills[SK].box = -1; }).ok, false);
  assert.equal(bad(x => { x.diagnostics = { ch9x: {} }; }).ok, false);
  assert.equal(bad(x => { x.diagnostics = { ch4: { date: TODAY, skills: { [SK]: { verdict: 'genius', level: 1, n: 3, correct: 1 } } } }; }).ok, false);
  assert.equal(bad(x => { x.diagnostics = { ch4: { date: TODAY, skills: { [SK]: { verdict: 'gap', level: 1, n: 3, correct: 4 } } } }; }).ok, false);
});

test('adaptiveStats bundles mastery, help flag, recommended level and box', () => {
  let p = feed(E.emptyProgress(), SK, rep(5, 2, 'miss'));
  let s = E.adaptiveStats(p, SK, lv);
  assert.deepEqual([s.mastery, s.needsHelp, s.recommendedLevel, s.box], ['learning', true, 1, 0]);
  s = E.adaptiveStats(E.emptyProgress(), SK, lv);
  assert.deepEqual([s.mastery, s.needsHelp, s.recommendedLevel, s.provenLevel], ['new', false, 1, null]);
});
