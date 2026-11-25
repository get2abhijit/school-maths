'use strict';
/** Chapter diagnostic (Session 10): flow, ladder, coverage filter, evidence, verdicts, storage. Deterministic. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src');
const catalog = require('../catalog.json');

const TODAY = '2026-10-30';
const CHAPTERS = ['ch1', 'ch2', 'ch4', 'ch6', 'ch7'];

/** Run a diagnostic; `answerer(item, question, index)` returns 'right' | 'wrong' | 'unknown' | 'invalid-then-right'. */
function run(chapterId, answerer, { coverage = E.emptyCoverage(), seed = 77, progress = E.emptyProgress() } = {}) {
  let { diagnostic: d } = E.createDiagnostic({ catalog, coverage, chapterId, baseSeed: seed });
  let p = progress;
  const log = [];
  for (let i = 0; !d.finished && i < 100; i++) {
    const item = E.currentDiagnosticItem(d);
    const q = E.diagnosticQuestionFor(item);
    const how = answerer(item, q, i);
    let r;
    if (how === 'unknown') r = E.dontKnow(d);
    else {
      if (how === 'invalid-then-right') {
        const bad = E.submitDiagnosticAnswer(d, q, '');
        assert.equal(bad.result.status, 'invalid'); assert.equal(bad.events.length, 0); assert.deepEqual(bad.diagnostic, d, 'invalid input changes nothing');
      }
      r = E.submitDiagnosticAnswer(d, q, how === 'wrong' ? 'xx?' : E.canonicalInput(q.answer));
      if (how === 'wrong' && r.result.status === 'invalid') r = E.dontKnow(d);
    }
    log.push({ skillId: item.skillId, level: item.level, status: r.diagnostic.items[d.current].status });
    r.events.forEach(ev => { p = E.applyEvent(p, ev, TODAY); });
    d = E.advanceDiagnostic(r.diagnostic);
  }
  return { d, p, log };
}

test('a diagnostic asks perSkill questions for every offered skill of the chapter, skill by skill', () => {
  for (const ch of CHAPTERS) {
    const { d, log } = run(ch, () => 'right');
    const skills = E.diagnosticSkills(catalog, E.emptyCoverage(), ch).available;
    assert.deepEqual(d.skills, skills);
    assert.equal(log.length, skills.length * E.ADAPTIVE_RULES.diagQuestionsPerSkill, ch);
    assert.deepEqual(log.map(l => l.skillId), skills.flatMap(s => Array(3).fill(s)), 'questions are grouped by skill');
    assert.ok(d.finished);
    assert.equal(new Set(d.items.map(i => i.signature)).size, d.items.length, 'no duplicate question');
  }
});

test('ladder: starts at level 2, one level up after a right answer, one down after a wrong one, clamped to the skill\'s levels', () => {
  const all = run('ch4', () => 'right');
  for (const s of all.d.skills) {
    const lv = E.levelsForSkill(s), got = all.log.filter(l => l.skillId === s).map(l => l.level);
    const start = lv.reduce((b, L) => (Math.abs(L - 2) < Math.abs(b - 2) ? L : b), lv[0]);
    const up = i => lv[Math.min(lv.length - 1, lv.indexOf(i) + 1)];
    assert.deepEqual(got, [start, up(start), up(up(start))], s);
  }
  const none = run('ch4', () => 'unknown');
  for (const s of none.d.skills) {
    const lv = E.levelsForSkill(s), got = none.log.filter(l => l.skillId === s).map(l => l.level);
    assert.ok(got.every((l, i) => i === 0 || l <= got[i - 1]), `${s}: levels never rise after wrong answers`);
    assert.ok(got.every(l => lv.includes(l)));
  }
});

test('deterministic: same seed and answers give the same diagnostic; another seed gives other questions', () => {
  const a = run('ch6', i => (i.level > 2 ? 'wrong' : 'right'), { seed: 5 }), b = run('ch6', i => (i.level > 2 ? 'wrong' : 'right'), { seed: 5 });
  assert.deepEqual(a.d, b.d);
  assert.notDeepEqual(run('ch6', () => 'right', { seed: 6 }).d.items.map(i => i.qid), run('ch6', () => 'right', { seed: 5 }).d.items.map(i => i.qid));
});

test('invalid input is not an answer; a valid answer is final; "Weiß ich nicht" counts as wrong', () => {
  const { d, p, log } = run('ch1', (item, q, i) => (i === 0 ? 'invalid-then-right' : i === 1 ? 'unknown' : 'right'));
  assert.equal(log[1].status, 'unknown');
  const first = d.skills[0], rec = p.skills[first];
  assert.equal(rec.questions, 3, 'three evidence entries for the first skill');
  assert.deepEqual(rec.detail.map(x => x.o), ['clean', 'miss', 'clean']);
  assert.equal(rec.hintsUsed, 0);
  let { diagnostic } = E.createDiagnostic({ catalog, coverage: E.emptyCoverage(), chapterId: 'ch1', baseSeed: 1 });
  const q = E.diagnosticQuestionFor(E.currentDiagnosticItem(diagnostic));
  diagnostic = E.submitDiagnosticAnswer(diagnostic, q, E.canonicalInput(q.answer)).diagnostic;
  assert.throws(() => E.submitDiagnosticAnswer(diagnostic, q, E.canonicalInput(q.answer)), /already answered/);
  assert.throws(() => E.dontKnow(diagnostic), /not open/);
  assert.throws(() => E.advanceDiagnostic(E.createDiagnostic({ catalog, coverage: E.emptyCoverage(), chapterId: 'ch1', baseSeed: 1 }).diagnostic), /answer the current/);
});

test('"Im Unterricht behandelt": only offered skills are asked; nothing offered → RangeError', () => {
  let cov = E.setCoverageEnabled(E.emptyCoverage(), true);
  assert.throws(() => E.createDiagnostic({ catalog, coverage: cov, chapterId: 'ch6', baseSeed: 1 }), /no skill/);
  cov = E.setSectionCovered(catalog, cov, 'ch6.s1', true);
  cov = E.setSectionCovered(catalog, cov, 'ch6.s2', true);
  const ds = E.diagnosticSkills(catalog, cov, 'ch6');
  assert.deepEqual(ds.available, E.partitionSkills(catalog, cov, ['ch6.pct.compare', 'ch6.pct.basic_tasks', 'ch6.interest.simple_compound', 'ch6.interest.loan']).available.filter(id => ds.available.includes(id)));
  assert.deepEqual(ds.available, ['ch6.pct.compare'], 'VI.2–4 is only partly marked');
  assert.equal(ds.hidden.length, 3);
  const { d } = run('ch6', () => 'right', { coverage: cov });
  assert.deepEqual([...new Set(d.items.map(i => i.skillId))], ['ch6.pct.compare']);
  assert.throws(() => E.createDiagnostic({ catalog, coverage: E.emptyCoverage(), chapterId: 'ch3', baseSeed: 1 }), /no skill/, 'geometry has no generators yet');
  assert.throws(() => E.diagnosticSkills(catalog, E.emptyCoverage(), 'ch99'), /unknown chapter/);
});

test('verdicts: secure / partial / gap from the answers', () => {
  const sec = E.summarizeDiagnostic(run('ch4', () => 'right').d);
  assert.ok(sec.every(s => s.verdict === 'secure' && s.correct === 3 && s.n === 3), JSON.stringify(sec));
  const gap = E.summarizeDiagnostic(run('ch4', () => 'unknown').d);
  assert.ok(gap.every(s => s.verdict === 'gap' && s.maxCorrectLevel === null && s.level === E.levelsForSkill(s.skillId)[0]));
  const mix = E.summarizeDiagnostic(run('ch4', (item, q, i) => (i % 3 === 2 ? 'wrong' : 'right')).d);
  assert.ok(mix.every(s => s.verdict === 'partial' && s.correct === 2), 'two of three right');
  assert.ok(mix.every(s => s.level === s.maxCorrectLevel));
  const oneRight = E.summarizeDiagnostic(run('ch4', (item, q, i) => (i % 3 === 0 ? 'right' : 'unknown')).d);
  assert.ok(oneRight.every(s => s.verdict === 'gap'), '1/3 = 0.33 < 0.4');
});

test('evidence: answers count as first-try evidence but three answers never make a skill secure and set no review date', () => {
  const { d, p } = run('ch4', () => 'right');
  for (const s of d.skills) {
    const rec = p.skills[s];
    assert.equal(rec.questions, 3);
    assert.equal(rec.nextReview, null);
    assert.equal(E.adaptiveMastery(rec, 4), 'learning');
    assert.equal(rec.hintsUsed, 0);
  }
  // …and the evidence feeds the start-level recommendation for practice
  const s0 = d.skills[0];
  assert.ok(E.recommendLevel(p.skills[s0], E.levelsForSkill(s0)) >= 2, 'right at level 2 and 3 → practice starts at 2 or higher');
});

test('diagnosticToProgress stores verdicts only (no answers), replaces the earlier result of the chapter, validates', () => {
  const first = run('ch4', () => 'unknown'), second = run('ch4', () => 'right', { seed: 9 });
  let p = E.diagnosticToProgress(first.p, first.d, '2026-10-01');
  assert.ok(Object.values(p.diagnostics.ch4.skills).every(s => s.verdict === 'gap'));
  p = E.diagnosticToProgress(p, second.d, TODAY);
  assert.equal(p.diagnostics.ch4.date, TODAY);
  assert.ok(Object.values(p.diagnostics.ch4.skills).every(s => s.verdict === 'secure'));
  assert.deepEqual(Object.keys(p.diagnostics), ['ch4']);
  assert.ok(E.validateProgress(JSON.parse(JSON.stringify(p))).ok);
  assert.ok(!JSON.stringify(p.diagnostics).includes('qid'), 'no question ids or answers are stored');
  assert.throws(() => E.diagnosticToProgress(p, second.d, 'heute'), /YYYY-MM-DD/);
  const early = E.endDiagnostic(E.createDiagnostic({ catalog, coverage: E.emptyCoverage(), chapterId: 'ch4', baseSeed: 3 }).diagnostic);
  assert.deepEqual(E.diagnosticToProgress(E.emptyProgress(), early, TODAY).diagnostics, {}, 'nothing answered → nothing stored');
});

test('stored diagnostics: structural check, position, early end rates only answered skills', () => {
  const { diagnostic } = E.createDiagnostic({ catalog, coverage: E.emptyCoverage(), chapterId: 'ch7', baseSeed: 2 });
  assert.ok(E.isValidDiagnostic(diagnostic));
  assert.equal(E.isValidDiagnostic({ ...diagnostic, schema: 'x' }), false);
  assert.equal(E.isValidDiagnostic({ ...diagnostic, current: 5 }), false);
  assert.equal(E.isValidDiagnostic(null), false);
  assert.deepEqual(E.diagnosticPosition(diagnostic), { number: 1, total: 15, skill: 1, skills: 5 });
  const q = E.diagnosticQuestionFor(E.currentDiagnosticItem(diagnostic));
  let d = E.submitDiagnosticAnswer(diagnostic, q, E.canonicalInput(q.answer)).diagnostic;
  d = E.endDiagnostic(E.advanceDiagnostic(d));
  assert.equal(E.summarizeDiagnostic(d).length, 1);
  assert.equal(E.diagnosticQuestionFor(E.currentDiagnosticItem(d)) && true, true);
  assert.ok(E.DIAGNOSTIC_NOTE_DE.includes('keine Klassenarbeit') && E.DIAGNOSTIC_NOTE_DE.includes('keine Note'));
});
