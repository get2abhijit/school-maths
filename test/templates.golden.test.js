'use strict';
/** Golden-output and reproducibility tests for all templates. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const { snapshot, GOLDEN_CHAPTERS } = require('../tools/golden');

const goldens = Object.fromEntries(GOLDEN_CHAPTERS.map(ch => [ch, JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', `${ch}.golden.json`), 'utf8'))]));
const allGoldenIds = Object.values(goldens).flatMap(g => Object.keys(g.questions));

for (const ch of GOLDEN_CHAPTERS) {
  test(`golden ${ch}: every template/level/seed renders exactly as recorded`, () => {
    const golden = goldens[ch];
    const now = snapshot(E, ch);
    assert.deepEqual(Object.keys(now).sort(), Object.keys(golden.questions).sort(), 'set of golden ids changed');
    for (const id of Object.keys(golden.questions)) assert.deepEqual(now[id], golden.questions[id], id);
  });
}

test('golden: every registered template is covered by a chapter golden file', () => {
  const covered = new Set(allGoldenIds.map(id => E.parseQuestionId(id).templateId));
  for (const t of E.TEMPLATES) assert.ok(covered.has(t.id), t.id);
});

test('golden: ids encode template, version, level and seed', () => {
  for (const id of allGoldenIds) {
    const ref = E.parseQuestionId(id);
    assert.ok(ref, id);
    assert.equal(E.REGISTRY[ref.templateId].version, ref.templateVersion, id);
  }
});

test('reproducible: same (template, version, seed, level) → identical question', () => {
  for (const t of E.TEMPLATES) for (const level of t.levels) for (const seed of [7, 4242, 2 ** 32 - 1]) {
    assert.deepEqual(E.generate(t, seed, level), E.generate(t, seed, level), `${t.id} L${level} ${seed}`);
  }
});

test('reproducible: regenerateQuestion(id) rebuilds the stored question; JSON round-trip is lossless', () => {
  for (const t of E.TEMPLATES) for (const level of t.levels) {
    const q = E.generate(t, 9001, level);
    assert.deepEqual(E.regenerateQuestion(q.id), q, q.id);
    assert.deepEqual(JSON.parse(JSON.stringify(q)), q, `${q.id} not plain JSON`);
  }
});

test('reproducible: skill sessions are deterministic from the base seed', () => {
  for (const skillId of E.skillsWithTemplates()) {
    const a = E.generateSkillSession(skillId, { baseSeed: 31337, count: 10, level: 2 }).map(q => q.id);
    const b = E.generateSkillSession(skillId, { baseSeed: 31337, count: 10, level: 2 }).map(q => q.id);
    assert.deepEqual(a, b, skillId);
  }
});

test('regeneration refuses a stored id whose template version changed', () => {
  const q = E.generate(E.TEMPLATES[0], 5, E.TEMPLATES[0].levels[0]);
  const bumped = q.id.replace(/@\d+\//, '@999/');
  assert.throws(() => E.regenerateQuestion(bumped), E.GenerationError);
  assert.throws(() => E.regenerateQuestion('not-an-id'), E.GenerationError);
});
