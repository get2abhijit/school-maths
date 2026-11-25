'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
const skills = catalog.chapters.flatMap(c => c.topics.flatMap(t => t.skills.map(s => ({ ...s, chapter: c.id, topic: t.id }))));
const SKILL_STATUS = ['planned', 'modelled', 'implemented', 'validated'];
const MAP_STATUS = ['provisional', 'verified'];

test('catalog has the 7 chapters in book order', () => {
  assert.deepEqual(catalog.chapters.map(c => c.roman), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
  assert.equal(catalog.chapters[0].name, 'Terme mit einer Variable');
  assert.deepEqual(catalog.errorCategories, [...E.ERROR_CATEGORIES]);
});

test('ids are unique and prefixed by their chapter', () => {
  const ids = [...catalog.chapters.map(c => c.id), ...catalog.chapters.flatMap(c => c.topics.map(t => t.id)), ...skills.map(s => s.id)];
  assert.equal(new Set(ids).size, ids.length);
  for (const s of skills) assert.ok(s.id.startsWith(s.chapter + '.'), s.id);
});

test('every skill has the required fields with valid values', () => {
  for (const s of skills) {
    for (const f of ['name', 'description', 'objective', 'textbookRef', 'curriculum', 'prerequisites', 'families', 'misconceptions', 'levels', 'estimatedMinutes', 'status']) {
      assert.ok(s[f] !== undefined, `${s.id}.${f}`);
    }
    assert.ok(SKILL_STATUS.includes(s.status), s.id);
    assert.ok(s.curriculum.length >= 1, s.id);
    for (const m of s.curriculum) {
      assert.ok(MAP_STATUS.includes(m.status) && /^\d\.\d/.test(m.standard), `${s.id} ${m.standard}`);
      for (const k of Object.keys(m)) assert.ok(['standard', 'status', 'source', 'note'].includes(k), `${s.id} ${m.standard}: ${k}`);
      if (m.note !== undefined) assert.equal(typeof m.note, 'string');
    }
    assert.ok(MAP_STATUS.includes(s.textbookRef.status), s.id);
    assert.deepEqual(Object.keys(s.levels), ['L1', 'L2', 'L3', 'L4'], s.id);
    assert.ok(s.families.length >= 1, s.id);
    assert.equal(new Set(s.families.map(f => f.id)).size, s.families.length, s.id);
    for (const f of s.families) assert.ok(SKILL_STATUS.includes(f.status), `${s.id}/${f.id}`);
    for (const m of s.misconceptions) assert.ok(E.ERROR_CATEGORIES.includes(m.category), `${s.id}/${m.id}`);
    assert.ok(Number.isInteger(s.estimatedMinutes) && s.estimatedMinutes > 0, s.id);
  }
});

test('prerequisites resolve and form no cycle', () => {
  const known = new Set([...skills.map(s => s.id), ...catalog.externalPrerequisites.map(p => p.id)]);
  for (const s of skills) for (const p of s.prerequisites) assert.ok(known.has(p), `${s.id} → ${p}`);
  const graph = Object.fromEntries(skills.map(s => [s.id, s.prerequisites]));
  const state = {};
  const visit = (id, trail) => {
    if (state[id] === 'done' || !graph[id]) return;
    assert.notEqual(state[id], 'active', `cycle: ${[...trail, id].join(' → ')}`);
    state[id] = 'active';
    for (const p of graph[id]) visit(p, [...trail, id]);
    state[id] = 'done';
  };
  for (const id of Object.keys(graph)) visit(id, []);
});

test('Chapter 1 skills are validated; scope-limited families stay planned and flagged', () => {
  const ch1 = skills.filter(s => s.chapter === 'ch1');
  assert.equal(ch1.length, 6);
  for (const s of ch1) {
    assert.equal(s.status, 'validated', s.id);
    assert.ok(Array.isArray(s.templates) && s.templates.length >= 2, s.id);
  }
  const fam = (skill, id) => skills.find(s => s.id === skill).families.find(f => f.id === id);
  assert.ok(fam('ch1.terms.expand_factor', 'sum_times_sum').flags.includes('disabled_by_default'));
  assert.equal(fam('ch1.terms.expand_factor', 'sum_times_sum').status, 'planned');
  assert.equal(fam('ch1.terms.simplify_products', 'term_times_term').status, 'planned');
  // S12: the first two Chapter V skills have generators; the rest of the geometry is still planned
  const geometryDone = ['ch5.angles.lines', 'ch5.angles.triangle_sum'];
  for (const s of skills.filter(s => !['ch1', 'ch2', 'ch4', 'ch6', 'ch7'].includes(s.chapter))) assert.equal(s.status, geometryDone.includes(s.id) ? 'validated' : 'planned', s.id);
});

test('Chapter 4 skills are validated with ≥ 2 families and listed templates; mappings stay provisional where unverified', () => {
  const ch4 = skills.filter(s => s.chapter === 'ch4');
  assert.equal(ch4.length, 4);
  for (const s of ch4) {
    assert.equal(s.status, 'validated', s.id);
    assert.ok(s.families.filter(f => f.status === 'validated').length >= 2, s.id);
    assert.ok(Array.isArray(s.templates) && s.templates.length >= 2, s.id);
    assert.equal(s.textbookRef.chapter, 'IV', s.id);
  }
  // S4 lists only 3.2.1(20), (22) for Ch IV; 3.2.1(5) belongs to Ch I and was removed (Session 9)
  for (const s of ch4) assert.ok(s.curriculum.every(m => m.status === 'verified' && ['3.2.1(20)', '3.2.1(22)'].includes(m.standard)), s.id);
});

test('Chapter 6 skills are validated with ≥ 2 families and listed templates; textbook refs point to VI', () => {
  const ch6 = skills.filter(s => s.chapter === 'ch6');
  assert.equal(ch6.length, 4);
  for (const s of ch6) {
    assert.equal(s.status, 'validated', s.id);
    assert.ok(s.families.filter(f => f.status === 'validated').length >= 2, s.id);
    assert.ok(Array.isArray(s.templates) && s.templates.length >= 2, s.id);
    assert.equal(s.textbookRef.chapter, 'VI', s.id);
  }
  // loan → 3.2.1(4) verified via S4; the spreadsheet itself is not modelled, which the note must say
  const loan = skills.find(s => s.id === 'ch6.interest.loan').curriculum[0];
  assert.deepEqual([loan.standard, loan.status], ['3.2.1(4)', 'verified']);
  assert.match(loan.note, /Tabellenkalkulation nicht modelliert/);
});

test('Chapter 2 skills are validated with ≥ 2 families, listed templates and L1–L4; 3.2.4(1), (4) verified, (3) not mapped', () => {
  const ch2 = skills.filter(s => s.chapter === 'ch2');
  assert.equal(ch2.length, 2);
  for (const s of ch2) {
    assert.equal(s.status, 'validated', s.id);
    assert.ok(s.families.filter(f => f.status === 'validated').length >= 2, s.id);
    assert.ok(Array.isArray(s.templates) && s.templates.length >= 2, s.id);
    assert.equal(s.textbookRef.chapter, 'II', s.id);
    assert.deepEqual(E.levelsForSkill(s.id), [1, 2, 3, 4], s.id);
    const map = Object.fromEntries(s.curriculum.map(m => [m.standard, m.status]));
    assert.deepEqual(map, { '3.2.4(4)': 'verified', '3.2.4(1)': 'verified' }, s.id);
  }
});

test('Chapter 7 skills are validated with ≥ 2 families, listed templates and L1–L4; refs point to VII; no tree diagrams', () => {
  const ch7 = skills.filter(s => s.chapter === 'ch7');
  assert.equal(ch7.length, 5);
  const verified = { 'ch7.data.analyze': ['3.2.5(1)', '3.2.5(2)'], 'ch7.prob.experiments': ['3.2.5(4)', '3.2.5(5)'], 'ch7.prob.determine': ['3.2.5(3)', '3.2.5(8)', '3.2.5(10)'], 'ch7.prob.frequency': ['3.2.5(6)', '3.2.5(7)'], 'ch7.prob.laplace': ['3.2.5(8)', '3.2.5(9)'] };
  for (const s of ch7) {
    assert.equal(s.status, 'validated', s.id);
    assert.ok(s.families.filter(f => f.status === 'validated').length >= 2, s.id);
    assert.ok(Array.isArray(s.templates) && s.templates.length >= 1, s.id);
    assert.equal(s.textbookRef.chapter, 'VII', s.id);
    assert.deepEqual(E.levelsForSkill(s.id), [1, 2, 3, 4], s.id);
    const map = Object.fromEntries(s.curriculum.map(m => [m.standard, m.status]));
    assert.deepEqual(Object.keys(map).sort(), verified[s.id].slice().sort(), s.id);
    for (const [std, st] of Object.entries(map)) assert.equal(st, 'verified', `${s.id} ${std}`);
    // Baumdiagramme / Pfadregeln (3.2.5(11), (12)) have no LS7 section: never mapped
    assert.ok(!map['3.2.5(11)'] && !map['3.2.5(12)'], s.id);
  }
});
