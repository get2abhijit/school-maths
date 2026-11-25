'use strict';
/** Klassenarbeit mode (S11): blueprint schema, mock tests, scoring oracle, study plan, practice filter, progress `t`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const examsFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exams.json'), 'utf8'));
const bp = examsFile.exams[0];
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
const skills = Object.fromEntries(catalog.chapters.flatMap(c => c.topics.flatMap(t => t.skills)).map(s => [s.id, s]));

// ---------------------------------------------------------------- schema
test('exams.json: schema, every referenced skill/family exists and is validated, nothing excluded or out of book scope in a target', () => {
  assert.equal(examsFile.schemaVersion, 1);
  assert.deepEqual(E.listExams(examsFile), [{ id: 'ka1', title: bp.title, defaultDate: '2026-11-16' }]);
  assert.deepEqual(E.validateBlueprint(bp), []);
  const allFamilies = new Set();
  for (const it of bp.items) {
    assert.match(it.id, /^ka1\.[a-z_]+$/);
    assert.ok(['planner', 'skill', 'mixed', 'mock'].includes(it.kind), it.id);
    assert.ok(it.statement.startsWith('Ich '), it.id);
    for (const tg of it.targets) {
      if (tg.fromItems) continue;
      const s = skills[tg.skill];
      assert.ok(s, `${it.id}: unknown skill ${tg.skill}`);
      for (const f of tg.families) {
        const fam = s.families.find(x => x.id === f);
        assert.ok(fam, `${it.id}: unknown family ${tg.skill}/${f}`);
        assert.equal(fam.status, 'validated', `${it.id}: ${f} is ${fam.status}`);
        assert.notEqual(fam.inBookScope, false, `${it.id}: ${f} is outside the book scope`);
        allFamilies.add(`${tg.skill}/${f}`);
      }
      for (const ex of it.excluded || []) assert.ok(!(ex.skill === tg.skill && ex.families.some(f => tg.families.includes(f))), `${it.id}: excluded family targeted`);
    }
    for (const ex of it.excluded || []) for (const f of ex.families) assert.ok(skills[ex.skill].families.some(x => x.id === f && x.inBookScope === false), `${ex.skill}/${f} should be flagged inBookScope:false`);
  }
  for (const t of bp.mock.tasks) {
    const item = bp.items.find(i => i.id === t.item);
    assert.ok(item, `task ${t.n}`);
    assert.ok(E.taskPool(bp, t, {}).length > 0, `task ${t.n} has templates`);
  }
  assert.equal(bp.mock.tasks.reduce((s, t) => s + t.points, 0), 30);
  assert.ok(bp.mock.tasks.length >= 7 && bp.mock.tasks.length <= 8);
  // the excluded x·x / sum×sum families never reach a KA practice filter
  for (const it of bp.items) for (const g of E.itemPractice(bp, it.id, {})) for (const id of g.filter.templates) assert.ok(!/term_times_term|sum_times_sum/.test(id), id);
});

test('blueprint validation catches broken data', () => {
  const broken = JSON.parse(JSON.stringify(bp));
  broken.items[1].targets[0].families.push('no_such_family');
  broken.mock.tasks[0].points = 3; // 3 points over 2 parts is fine (1,5 each) …
  broken.mock.tasks[1].parts = 4;   // … but 4 points over … still fine; make it impossible:
  broken.mock.tasks[1].points = 3;  // 3 over 4 parts = 0,75 → not half points
  broken.items[5].targets[0].families.push('sum_times_sum');
  const errs = E.validateBlueprint(broken);
  assert.ok(errs.some(e => /no_such_family/.test(e)));
  assert.ok(errs.some(e => /half points/.test(e)));
  assert.ok(errs.some(e => /excluded family/.test(e)));
});

// ---------------------------------------------------------------- mock tests
test('mock tests: 200 seeds × 2 rounds — reproducible, no duplicate signature, validated, with solutions, key matches instances, reload exact', () => {
  for (let seed = 1; seed <= 200; seed++) for (const round of [1, 2]) {
    const a = E.buildMock(bp, round, seed * 7919, {}, E.ENGINE_VERSION);
    const b = E.buildMock(bp, round, seed * 7919, {}, E.ENGINE_VERSION);
    const sigs = a.tasks.flatMap(t => t.questions.map(q => q.signature));
    assert.deepEqual(sigs, b.tasks.flatMap(t => t.questions.map(q => q.signature)), `seed ${seed} R${round} not reproducible`);
    assert.equal(new Set(sigs).size, sigs.length, `seed ${seed} R${round} duplicate`);
    assert.equal(a.record.code, b.record.code);
    assert.equal(a.maxPoints, 30);
    for (const t of a.tasks) {
      const task = bp.mock.tasks.find(x => x.n === t.n);
      assert.equal(t.questions.length, task.parts);
      for (const q of t.questions) {
        assert.equal(q.level, task.level, `task ${t.n}`);
        assert.ok(E.validateQuestion(q).ok, q.id);
        assert.ok(q.solution.steps.length && q.solution.result, q.id);
        assert.equal(E.evaluateQuestion(q, E.canonicalInput(q.answer)).status, 'correct', q.id);
      }
    }
    const L = E.mockPrintLayout(a, { keyMode: 'worked' });
    const qs = a.tasks.flatMap(t => t.questions);
    assert.equal(L.student.length, qs.length);
    L.key.forEach((k, i) => {
      assert.equal(k.qid, qs[i].id);
      assert.equal(L.student[i].qid, qs[i].id);
      assert.ok(k.result && k.steps && k.steps.length, `key entry ${i}`);
      assert.equal(k.label, L.student[i].label);
    });
    for (const st of L.student) for (const k of ['result', 'steps', 'letters', 'cells']) assert.equal(st[k], undefined, 'student sheet must not contain answers');
    const loaded = E.loadMock(bp, JSON.parse(JSON.stringify(a.record)));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.mock.tasks.flatMap(t => t.questions.map(q => q.id)), qs.map(q => q.id));
  }
});

test('mock tests: rounds and seeds differ; Zusatz off drops task 7 (27 points); tampered records are refused', () => {
  const r1 = E.buildMock(bp, 1, 5, {}), r2 = E.buildMock(bp, 2, 5, {}), r3 = E.buildMock(bp, 1, 6, {});
  assert.notEqual(r1.record.code, r2.record.code);
  assert.notEqual(r1.record.code, r3.record.code);
  const off = E.buildMock(bp, 1, 5, { zusatz: { ausklammern: false } });
  assert.deepEqual(off.tasks.map(t => t.n), [1, 2, 3, 4, 5, 6, 8]);
  assert.equal(off.maxPoints, 27);
  assert.equal(E.loadMock(bp, off.record).ok, true);
  const bad = JSON.parse(JSON.stringify(r1.record)); bad.tasks[0].signatures[0] = 'x';
  assert.equal(E.loadMock(bp, bad).reason, 'outdated');
  const bumped = JSON.parse(JSON.stringify(r1.record)); bumped.tasks[0].qids[0] = bumped.tasks[0].qids[0].replace(/@\d+\//, '@99/');
  assert.equal(E.loadMock(bp, bumped).reason, 'outdated');
  const code = JSON.parse(JSON.stringify(r1.record)); code.code = 'KA-000000';
  assert.equal(E.loadMock(bp, code).reason, 'invalid');
  assert.equal(E.loadMock(bp, null).ok, false);
  assert.throws(() => E.buildMock(bp, 3, 5, {}), RangeError);
});

// ---------------------------------------------------------------- scoring oracle
test('scoring oracle: hand-computed totals with partial credit, invalid input and empty answers', () => {
  const m = E.buildMock(bp, 1, 2026, {});
  const byN = Object.fromEntries(m.tasks.map(t => [t.n, t]));
  const right = q => E.canonicalInput(q.answer);
  const answers = {};
  // task 1 (4 P, 2 parts): both right → 4
  answers[byN[1].questions[0].id] = right(byN[1].questions[0]); answers[byN[1].questions[1].id] = right(byN[1].questions[1]);
  // task 4 (3 P, 2 parts): one right, one wrong → 1,5
  answers[byN[4].questions[0].id] = right(byN[4].questions[0]); answers[byN[4].questions[1].id] = '999x+1';
  // task 6 (5 P, 2 parts): one right, one invalid („3x+(“) → 2,5
  answers[byN[6].questions[0].id] = right(byN[6].questions[0]);
  const q62 = byN[6].questions[1];
  answers[q62.id] = q62.answer.type === 'integer' ? '3,,5' : '3x+(';
  // task 8 (4 P, 1 part): right → 4. Everything else empty → 0
  answers[byN[8].questions[0].id] = right(byN[8].questions[0]);
  const s = E.scoreMock(m, answers);
  const pts = Object.fromEntries(s.tasks.map(t => [t.n, t.points]));
  assert.deepEqual(pts, { 1: 4, 2: 0, 3: 0, 4: 1.5, 5: 0, 6: 2.5, 7: 0, 8: 4 });
  assert.equal(s.total, 12);
  assert.equal(s.max, 30);
  const p6 = s.tasks.find(t => t.n === 6).parts[1];
  assert.equal(p6.status, 'invalid');
  assert.equal(p6.label, 'ungültige Eingabe');
  assert.equal(s.tasks.find(t => t.n === 4).parts[1].label, 'falsch');
  assert.equal(s.tasks.find(t => t.n === 2).parts[0].label, 'keine Antwort');
  // per item: laws = tasks 1+2 (4/8), brackets = tasks 6+7 (2,5/8), challenge = task 8 (4/4)
  assert.deepEqual(s.items['ka1.laws'], { points: 4, max: 8, tasks: [1, 2] });
  assert.deepEqual(s.items['ka1.brackets'], { points: 2.5, max: 8, tasks: [6, 7] });
  assert.deepEqual(s.items['ka1.challenge'], { points: 4, max: 4, tasks: [8] });
});

test('scoring oracle: paper mode with self-marked points; out-of-range marks count 0 and are reported', () => {
  const m = E.buildMock(bp, 2, 11, {});
  const s = E.scorePaper(m, { 1: 4, 2: 3.5, 3: '2', 6: 7, 7: 1.25, 8: 0 });
  // 4 + 3,5 + 2 + 0 (6: above max 5) + 0 (7: not a half point) + 0 = 9,5
  assert.equal(s.total, 9.5);
  assert.deepEqual(s.errors, [6, 7]);
  assert.equal(s.max, 30);
});

// ---------------------------------------------------------------- item status
test('item status: counts only answers of the item’s templates (field t); legacy answers are reported as untracked; mismatch notes', () => {
  const day = '2026-11-02';
  let p = E.emptyProgress();
  const ev = (templateId, status, extra = {}) => ({ type: 'attempt', skillId: E.REGISTRY[templateId].skillId, templateId, level: 2, status, isFirst: true, hintsBefore: 0, sawSolution: false, ...extra });
  for (let i = 0; i < 2; i++) p = E.applyEvent(p, ev('ch1.numterms.evaluate.order_ops', 'correct'), day);
  for (let i = 0; i < 4; i++) p = E.applyEvent(p, ev('ch1.numterms.evaluate.name_law', 'incorrect'), day);
  p = E.applyEvent(p, ev('ch1.numterms.evaluate.insert_brackets', 'correct'), day); // not part of ka1.laws
  p = E.applyEvent(p, { type: 'attempt', skillId: 'ch1.numterms.evaluate', level: 2, status: 'correct', isFirst: true, hintsBefore: 0, sawSolution: false }, day); // legacy, no t
  const st = Object.fromEntries(E.itemStatus(bp, p, { 'ka1.laws': 3, 'ka1.sums': 0 }, {}).map(s => [s.itemId, s]));
  const laws = st['ka1.laws'];
  assert.equal(laws.attempts, 6);
  assert.equal(laws.firstTry, 2);
  assert.equal(laws.untracked, 1);
  assert.equal(laws.mismatch, 'overconfident');
  assert.equal(laws.mismatchNote, 'Du schätzt dich sicher ein, in der App waren es zuletzt 2 von 6. Noch eine Runde üben?');
  assert.equal(laws.open, true);
  assert.equal(st['ka1.sums'].attempts, 0);
  assert.equal(st['ka1.sums'].mismatch, null);
  assert.equal(st['ka1.sums'].weakness, 1);
  assert.equal(st['ka1.plan'].attempts, undefined);
  // a progress export keeps t; malformed t is rejected on import
  const exported = JSON.parse(JSON.stringify(p));
  const r = E.validateProgress(exported);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.value.skills['ch1.numterms.evaluate'].detail[0].t, 'ch1.numterms.evaluate.order_ops');
  const bad = JSON.parse(JSON.stringify(p));
  bad.skills['ch1.numterms.evaluate'].detail[0].t = '<script>';
  assert.equal(E.validateProgress(bad).ok, false);
});

// ---------------------------------------------------------------- study plan
function randomStatus(seed) {
  const rng = new E.Rng(seed);
  return bp.items.map(it => {
    if (it.kind !== 'skill') return { itemId: it.id, kind: it.kind };
    const w = rng.int(0, 10) / 10;
    return { itemId: it.id, kind: 'skill', weakness: w, open: w > 0.2 || rng.bool() };
  });
}
test('study plan properties: every open item before the date, nothing on/after it, empty when past, deterministic, last 2 days without new items', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const status = randomStatus(seed);
    const rng = new E.Rng(seed + 99);
    const today = E.addDaysKa('2026-10-20', rng.int(0, 30));
    const exam = '2026-11-16';
    const plan = E.buildStudyPlan(bp, status, today, exam);
    const n = E.daysUntil(today, exam);
    if (n <= 0) { assert.deepEqual(plan, []); continue; }
    assert.equal(plan.length, n);
    assert.deepEqual(plan, E.buildStudyPlan(bp, status, today, exam), 'deterministic');
    for (const d of plan) { assert.ok(d.date >= today && d.date < exam, d.date); assert.ok(d.minutes >= 0); }
    assert.equal(plan[plan.length - 1].kind, 'final');
    assert.equal(plan[plan.length - 1].mockRound, 2);
    const open = status.filter(s => s.open && s.kind === 'skill').map(s => s.itemId);
    for (const id of open) assert.ok(plan.some(d => d.items.includes(id)), `seed ${seed}: ${id} not scheduled`);
    if (n > 2) {
      const firstSeen = {};
      plan.forEach((d, i) => d.items.forEach(id => { if (firstSeen[id] === undefined) firstSeen[id] = i; }));
      for (const id of open) assert.ok(firstSeen[id] < n - 2, `seed ${seed}: ${id} first appears in the last 2 days`);
      assert.ok(plan.some(d => d.mockRound === 1));
    }
  }
});

test('study plan edge cases: exam today/past → empty; tomorrow → only the final day; weakest first', () => {
  const status = randomStatus(3);
  assert.deepEqual(E.buildStudyPlan(bp, status, '2026-11-16', '2026-11-16'), []);
  assert.deepEqual(E.buildStudyPlan(bp, status, '2026-11-20', '2026-11-16'), []);
  const one = E.buildStudyPlan(bp, status, '2026-11-15', '2026-11-16');
  assert.equal(one.length, 1);
  assert.equal(one[0].kind, 'final');
  const fixed = bp.items.map(it => ({ itemId: it.id, kind: it.kind, weakness: it.id === 'ka1.brackets' ? 0.9 : 0.4, open: it.kind === 'skill' }));
  const plan = E.buildStudyPlan(bp, fixed, '2026-11-01', '2026-11-16');
  assert.equal(plan[0].items[0], 'ka1.brackets');
  assert.throws(() => E.buildStudyPlan(bp, fixed, '1.11.2026', '2026-11-16'), RangeError);
});

// ---------------------------------------------------------------- practice filter
test('practice filter: sessions use only the item’s templates and levels; adaptive start moves into the filter; invalid filter refused', () => {
  const [g] = E.itemPractice(bp, 'ka1.products', {});
  for (const mode of [2, 'auto', 'adaptive']) {
    let { session, questions } = E.createSession({ skillId: g.skillId, levelMode: mode, count: 10, baseSeed: 77, startLevel: 4, filter: g.filter });
    assert.deepEqual(session.filter, g.filter);
    assert.ok(E.isValidSession(session));
    let all = questions.slice();
    if (mode === 'adaptive') {
      assert.ok(g.filter.levels.includes(session.startLevel));
      for (let i = 0; i < 6; i++) {
        const q = E.questionFor(E.currentItem(session));
        session = E.submitAnswer(session, q, E.canonicalInput(q.answer)).session;
        session = E.advance(session);
        if (!session.finished) all.push(E.questionFor(E.currentItem(session)));
      }
    }
    for (const q of all) {
      assert.ok(g.filter.templates.includes(q.templateId), `${mode}: ${q.templateId}`);
      assert.ok(g.filter.levels.includes(q.level), `${mode}: L${q.level}`);
    }
  }
  const quotientOnly = { templates: ['ch1.terms.simplify_products.quotient'], levels: [3] };
  const { questions } = E.createSession({ skillId: 'ch1.terms.simplify_products', levelMode: 3, count: 5, baseSeed: 1, filter: quotientOnly });
  assert.ok(questions.every(q => q.templateId === 'ch1.terms.simplify_products.quotient' && q.level === 3));
  assert.throws(() => E.createSession({ skillId: 'ch1.terms.simplify_products', levelMode: 2, count: 5, baseSeed: 1, filter: { templates: ['ch1.terms.expand_factor.expand'] } }), RangeError);
  // without a filter, sessions are exactly as before (no filter key stored)
  assert.equal('filter' in E.createSession({ skillId: g.skillId, levelMode: 2, count: 5, baseSeed: 1 }).session, false);
});

test('progress: answers carry the template id (t) from practice and diagnostic events; reveal too', () => {
  const { session, questions } = E.createSession({ skillId: 'ch1.terms.collect_like', levelMode: 2, count: 5, baseSeed: 3 });
  const r = E.submitAnswer(session, questions[0], E.canonicalInput(questions[0].answer));
  assert.equal(r.events[0].templateId, questions[0].templateId);
  let p = E.applyEvent(E.emptyProgress(), r.events[0], '2026-11-01');
  assert.equal(p.skills['ch1.terms.collect_like'].detail[0].t, questions[0].templateId);
  const rev = E.revealSolution(E.advance(r.session));
  assert.equal(rev.events[0].templateId, questions[1].templateId);
});
