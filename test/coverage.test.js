'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
const allSkills = catalog.chapters.flatMap(c => c.topics.flatMap(t => t.skills.map(s => s.id)));
const practicable = E.skillsWithTemplates();

// ---------------------------------------------------------------- catalog section data
test('catalog lists the 36 textbook sections in book order with stable ids', () => {
  const secs = E.textbookSections(catalog);
  assert.equal(secs.length, 36);
  assert.deepEqual(catalog.chapters.map(c => c.sections.length), [5, 2, 6, 5, 7, 6, 5]);
  assert.equal(new Set(secs.map(s => s.id)).size, 36);
  for (const ch of catalog.chapters) {
    ch.sections.forEach((s, i) => {
      assert.equal(s.id, `${ch.id}.s${i + 1}`);
      assert.equal(s.number, i + 1);
      if (i) assert.ok(s.page > ch.sections[i - 1].page, s.id);
    });
  }
  // spot checks against the Klett TOC (S1)
  const by = Object.fromEntries(secs.map(s => [s.label, s]));
  assert.deepEqual([by['III.3'].title, by['III.3'].page], ['Die Winkelhalbierende', 59]);
  assert.deepEqual([by['V.6'].title, by['V.6'].page], ['Der Inkreis', 124]);
  assert.deepEqual([by['VI.4'].title, by['VI.4'].page], ['Grundwerte berechnen', 149]);
});

test('every skill names its sections; first section and page agree with textbookRef; every section is used', () => {
  const used = new Set();
  for (const ch of catalog.chapters) for (const t of ch.topics) for (const s of t.skills) {
    const r = s.textbookRef;
    assert.ok(Array.isArray(r.sections) && r.sections.length >= 1, s.id);
    assert.equal(r.sections[0], r.section, s.id);
    assert.equal(ch.sections[r.section - 1].page, r.page, s.id);
    for (const n of r.sections) { assert.ok(ch.sections[n - 1], `${s.id} → ${n}`); used.add(`${ch.id}.s${n}`); }
  }
  assert.equal(used.size, 36, 'a section that no skill uses would be a checkbox without effect');
  assert.deepEqual(E.skillSectionIds(catalog, 'ch6.pct.basic_tasks'), ['ch6.s2', 'ch6.s3', 'ch6.s4']);
  assert.equal(E.skillSectionLabel(catalog, 'ch6.pct.basic_tasks'), 'VI.2–4');
  assert.equal(E.skillSectionLabel(catalog, 'ch1.terms.translate'), 'I.2');
});

test('S4 consistency: every content standard of a skill is listed for its chapter; known gaps are explicit', () => {
  const unmapped = {};
  for (const ch of catalog.chapters) {
    assert.equal(ch.curriculum.source, 'S4', ch.id);
    const listed = new Set(ch.curriculum.standards);
    const mapped = new Set();
    for (const t of ch.topics) for (const s of t.skills) for (const m of s.curriculum) {
      if (!/^3\.2\./.test(m.standard)) continue;
      assert.ok(listed.has(m.standard), `${s.id} maps ${m.standard}, which S4 does not list for ${ch.id}`);
      mapped.add(m.standard);
    }
    const gap = [...listed].filter(x => !mapped.has(x));
    if (gap.length) unmapped[ch.id] = gap;
  }
  // Tangenten (3.2.3(10)) and Kongruenz/Konstruierbarkeit in Ch V (3.2.3(5)) have no skill yet — geometry sessions.
  assert.deepEqual(unmapped, { ch3: ['3.2.3(10)'], ch5: ['3.2.3(5)', '3.2.3(10)'] });
});

test('verification state after Session 9: only the process-competence number stays provisional', () => {
  const prov = [];
  for (const ch of catalog.chapters) for (const t of ch.topics) for (const s of t.skills) {
    assert.equal(s.textbookRef.status, 'verified', s.id);
    for (const m of s.curriculum) if (m.status !== 'verified') prov.push(`${s.id} ${m.standard}`);
  }
  assert.deepEqual(prov, ['ch5.proof.isosceles 2.1']);
});

// ---------------------------------------------------------------- filter logic
test('filter disabled by default: everything practicable is available', () => {
  const p = E.emptyProgress();
  assert.deepEqual(p.settings.coverage, { enabled: false, sections: [] });
  for (const id of practicable) assert.equal(E.isSkillAvailable(catalog, p.settings.coverage, id), true, id);
  assert.deepEqual(E.partitionSkills(catalog, p.settings.coverage, practicable), { available: practicable, hidden: [] });
});

test('enabled with nothing marked: nothing is available', () => {
  const c = E.setCoverageEnabled(E.emptyCoverage(), true);
  const r = E.partitionSkills(catalog, c, practicable);
  assert.deepEqual(r.available, []);
  assert.deepEqual(r.hidden, practicable);
});

test('a multi-section skill needs ALL its sections (VI.2–4); single-section skills need theirs', () => {
  let c = E.setCoverageEnabled(E.emptyCoverage(), true);
  c = E.setSectionCovered(catalog, c, 'ch6.s1', true);
  c = E.setSectionCovered(catalog, c, 'ch6.s2', true);
  assert.equal(E.skillCoverage(catalog, c, 'ch6.pct.compare'), 'covered');
  assert.equal(E.skillCoverage(catalog, c, 'ch6.pct.basic_tasks'), 'partial');
  assert.equal(E.skillCoverage(catalog, c, 'ch6.interest.loan'), 'open');
  assert.equal(E.isSkillAvailable(catalog, c, 'ch6.pct.basic_tasks'), false);
  c = E.setSectionCovered(catalog, c, 'ch6.s3', true);
  c = E.setSectionCovered(catalog, c, 'ch6.s4', true);
  assert.equal(E.isSkillAvailable(catalog, c, 'ch6.pct.basic_tasks'), true);
  assert.deepEqual(E.partitionSkills(catalog, c, practicable).available, ['ch6.pct.compare', 'ch6.pct.basic_tasks']);
  // turning the filter off keeps the marks
  const off = E.setCoverageEnabled(c, false);
  assert.deepEqual(off.sections, c.sections);
  assert.equal(E.isSkillAvailable(catalog, off, 'ch6.interest.loan'), true);
});

test('chapter toggles, idempotence, ordering and immutability', () => {
  const base = E.setCoverageEnabled(E.emptyCoverage(), true);
  const frozen = JSON.stringify(base);
  let c = E.setChapterCovered(catalog, base, 'ch7', true);
  assert.equal(JSON.stringify(base), frozen, 'input not mutated');
  c = E.setSectionCovered(catalog, c, 'ch1.s2', true);
  c = E.setSectionCovered(catalog, c, 'ch1.s2', true);
  assert.deepEqual(c.sections, ['ch1.s2', 'ch7.s1', 'ch7.s2', 'ch7.s3', 'ch7.s4', 'ch7.s5']);
  assert.deepEqual(E.partitionSkills(catalog, c, practicable).available,
    ['ch1.terms.translate', 'ch1.terms.evaluate', 'ch7.data.analyze', 'ch7.prob.experiments', 'ch7.prob.determine', 'ch7.prob.frequency', 'ch7.prob.laplace']
      .filter(id => practicable.includes(id)).sort((a, b) => practicable.indexOf(a) - practicable.indexOf(b)));
  c = E.setChapterCovered(catalog, c, 'ch7', false);
  assert.deepEqual(c.sections, ['ch1.s2']);
  // ch10 sorts after ch2 (numeric, not lexicographic)
  assert.deepEqual(E.validateCoverage({ sections: ['ch10.s1', 'ch2.s1', 'ch1.s12'] }).value.sections, ['ch1.s12', 'ch2.s1', 'ch10.s1']);
  assert.throws(() => E.setSectionCovered(catalog, c, 'ch9.s1', true), RangeError);
  assert.throws(() => E.setChapterCovered(catalog, c, 'ch9', true), RangeError);
  assert.throws(() => E.skillCoverage(catalog, c, 'ch9.nope'), RangeError);
});

test('coverageSummary reports per-chapter state and per-skill coverage', () => {
  let c = E.setChapterCovered(catalog, E.emptyCoverage(), 'ch2', true);
  c = E.setSectionCovered(catalog, c, 'ch4.s2', true);
  const sum = Object.fromEntries(E.coverageSummary(catalog, c).map(x => [x.chapterId, x]));
  assert.equal(sum.ch2.state, 'covered');
  assert.deepEqual([sum.ch4.state, sum.ch4.sectionsMarked, sum.ch4.sectionsTotal], ['partial', 1, 5]);
  assert.equal(sum.ch1.state, 'open');
  assert.equal(sum.ch4.skills.find(s => s.skillId === 'ch4.eq.solve_equivalence').coverage, 'partial'); // IV.2–3, only IV.2
  assert.equal(sum.ch5.skills.length, 6);
});

test('stored section ids unknown to this catalog are kept but have no effect', () => {
  const c = E.validateCoverage({ enabled: true, sections: ['ch1.s1', 'ch8.s3'] });
  assert.ok(c.ok);
  assert.deepEqual(c.value.sections, ['ch1.s1', 'ch8.s3']);
  assert.deepEqual(E.partitionSkills(catalog, c.value, practicable).available, ['ch1.numterms.evaluate']);
  assert.equal(E.coverageSummary(catalog, c.value).reduce((a, x) => a + x.sectionsMarked, 0), 1);
});

// ---------------------------------------------------------------- persistence round-trip
test('export → JSON → import keeps coverage exactly; old exports without coverage import with the filter off', () => {
  let p = E.emptyProgress();
  let c = E.setCoverageEnabled(p.settings.coverage, true);
  c = E.setChapterCovered(catalog, c, 'ch1', true);
  c = E.setSectionCovered(catalog, c, 'ch6.s5', true);
  p.settings.coverage = c;
  p = E.applyEvent(p, { type: 'hint', skillId: 'ch1.terms.translate' }, '2026-10-29');
  const r = E.validateProgress(JSON.parse(JSON.stringify(p)));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.value.settings.coverage, c);
  assert.deepEqual(r.value, p);

  const old = JSON.parse(JSON.stringify(p));
  delete old.settings.coverage;
  const r2 = E.validateProgress(old);
  assert.ok(r2.ok);
  assert.deepEqual(r2.value.settings.coverage, { enabled: false, sections: [] });

  const noSettings = { schema: 'mathe7-progress', version: 1, skills: {} };
  assert.deepEqual(E.validateProgress(noSettings).value.settings.coverage, { enabled: false, sections: [] });
});

test('malformed coverage in an import is rejected with a German message', () => {
  const bad = [
    { enabled: 'yes', sections: [] },
    { enabled: true, sections: 'ch1.s1' },
    { enabled: true, sections: ['ch1.s1', '<script>'] },
    { enabled: true, sections: [7] },
    ['ch1.s1'],
    { enabled: true, sections: Array.from({ length: 201 }, (_, i) => `ch1.s${i % 99}`) },
  ];
  for (const cov of bad) {
    const r = E.validateProgress({ schema: 'mathe7-progress', version: 1, skills: {}, settings: { coverage: cov } });
    assert.equal(r.ok, false, JSON.stringify(cov).slice(0, 60));
    assert.match(r.errors.join(' '), /Im Unterricht behandelt/);
  }
});

test('coverage helpers never touch question generation: same session with and without filter', () => {
  const a = E.createSession({ skillId: 'ch1.terms.translate', levelMode: 2, count: 5, baseSeed: 4242 });
  const before = JSON.stringify(a);
  E.partitionSkills(catalog, { enabled: true, sections: [] }, practicable);
  const b = E.createSession({ skillId: 'ch1.terms.translate', levelMode: 2, count: 5, baseSeed: 4242 });
  assert.equal(JSON.stringify(b), before);
});

test('every catalog skill id resolves in the coverage helpers', () => {
  for (const id of allSkills) assert.ok(['covered', 'partial', 'open'].includes(E.skillCoverage(catalog, E.emptyCoverage(), id)), id);
});
