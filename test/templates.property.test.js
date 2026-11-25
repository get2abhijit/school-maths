'use strict';
/**
 * Property tests for every registered template, every supported level, seeds 1…SEEDS.
 * Each instance must: generate (no GenerationError), pass validateQuestion, have its
 * template's independent solution accepted, accept its canonical answer, reject every
 * distractor, and contain only well-formed German/LaTeX text.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const SEEDS = 500;
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));
const skills = Object.fromEntries(catalog.chapters.flatMap(c => c.topics.flatMap(t => t.skills)).map(s => [s.id, s]));

/** All human-readable strings of a question. */
function texts(q) {
  const out = [q.prompt, q.instructions || '', ...(q.promptLines || []), ...(q.promptTable ? [...q.promptTable.columns, ...q.promptTable.rows.flat()] : []), ...q.hints.map(h => h.text), ...q.solution.steps, q.solution.result];
  const specs = q.answer.type === 'table' ? q.answer.cells.map(c => c.spec) : [q.answer];
  if (q.answer.type === 'table') out.push(...q.answer.cells.map(c => c.label || ''));
  for (const s of specs) {
    for (const d of s.distractors || []) out.push(d.feedback || '');
    for (const o of s.options || []) out.push(o.text, o.feedback || '');
  }
  return out.filter(Boolean);
}
/** Returns a list of problems in one text (empty = ok). */
function lint(t) {
  const errs = [];
  if (/undefined|NaN|\[object|null|Infinity/.test(t)) errs.push('placeholder leaked');
  const dollars = (t.match(/\$/g) || []).length;
  if (dollars % 2) errs.push('odd number of $');
  const maths = t.split('$').filter((_, i) => i % 2 === 1);
  for (const m of maths) {
    let depth = 0;
    for (const ch of m) { if (ch === '{') depth++; if (ch === '}') depth--; if (depth < 0) break; }
    if (depth !== 0) errs.push(`unbalanced braces in ${m}`);
    if ((m.match(/\\left/g) || []).length !== (m.match(/\\right/g) || []).length) errs.push(`unpaired \\left/\\right in ${m}`);
    if (/[+-]\s*[+-]/.test(m)) errs.push(`double sign in ${m}`);
    if (/(^|[^0-9.,}{])1x(?![0-9])/.test(m)) errs.push(`coefficient 1 written in ${m}`);
    if (/\./.test(m.replace(/\\ldots|\\cdot/g, ''))) errs.push(`decimal point instead of comma in ${m}`);
  }
  return errs;
}

test('registry: every template is complete and matches the catalog', () => {
  assert.ok(E.TEMPLATES.length >= 12);
  for (const t of E.TEMPLATES) {
    const s = skills[t.skillId];
    assert.ok(s, `${t.id}: unknown skill`);
    assert.ok(t.id.startsWith(`${t.skillId}.`), t.id);
    assert.ok(Number.isInteger(t.version) && t.version >= 1, t.id);
    for (const f of ['sample', 'constraints', 'build', 'solve']) assert.equal(typeof t[f], 'function', `${t.id}.${f}`);
    assert.ok(t.levels.length >= 1 && t.levels.every(l => [1, 2, 3, 4].includes(l)), t.id);
    for (const l of t.levels) assert.ok(t.levelNotes[l] && t.levelNotes[l].length > 10, `${t.id}: level note L${l}`);
    for (const f of t.families) assert.ok(s.families.some(ff => ff.id === f), `${t.id}: family ${f} not in catalog`);
    for (const m of t.misconceptions) assert.ok(s.misconceptions.some(mm => mm.id === m), `${t.id}: misconception ${m} not in catalog`);
    assert.ok(s.templates.includes(t.id), `${t.id} not listed in catalog skill`);
  }
});

test('catalog family status "validated" ⇔ a template covers the family', () => {
  for (const s of Object.values(skills)) {
    const covered = new Set(E.templatesForSkill(s.id).flatMap(t => t.families));
    for (const f of s.families) assert.equal(f.status === 'validated', covered.has(f.id), `${s.id}/${f.id}`);
    for (const id of s.templates || []) assert.ok(E.REGISTRY[id], `${s.id}: catalog lists unknown template ${id}`);
  }
});

test('every Chapter 1 and Chapter 4 skill: ≥2 families with templates, levels L1–L4 covered', () => {
  for (const s of catalog.chapters.filter(c => c.id === 'ch1' || c.id === 'ch4').flatMap(c => c.topics.flatMap(t => t.skills))) {
    const fams = new Set(E.templatesForSkill(s.id).flatMap(t => t.families));
    assert.ok(fams.size >= 2, `${s.id}: ${fams.size} families`);
    assert.deepEqual(E.levelsForSkill(s.id), [1, 2, 3, 4], s.id);
  }
});

for (const t of E.TEMPLATES) {
  for (const level of t.levels) {
    test(`property ${t.id} L${level}: ${SEEDS} seeds valid, independently verified, well-formed`, () => {
      const problems = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        let q;
        try { q = E.generate(t, seed, level); } catch (e) { problems.push(`seed ${seed}: ${e.message}`); continue; }
        const v = E.validateQuestion(q);
        if (!v.ok) problems.push(`seed ${seed}: ${v.errors.join('; ')}`);
        const indep = E.validateAnswer(q.answer, t.solve(q.meta.params, level));
        if (indep.status !== 'correct') problems.push(`seed ${seed}: independent solution ${indep.status}`);
        if (E.evaluateQuestion(q, E.canonicalInput(q.answer)).status !== 'correct') problems.push(`seed ${seed}: canonical rejected`);
        const specs = q.answer.type === 'table' ? q.answer.cells.map(c => c.spec) : [q.answer];
        for (const s of specs) for (const d of s.distractors || []) {
          const r = E.validateAnswer(s, d.value);
          if (r.status !== 'incorrect' || r.errorCategory !== d.category) problems.push(`seed ${seed}: distractor ${d.value} → ${r.status}/${r.errorCategory}`);
        }
        if (q.skillId !== t.skillId || q.level !== level) problems.push(`seed ${seed}: wrong ids`);
        for (const txt of texts(q)) for (const e of lint(txt)) problems.push(`seed ${seed}: ${e} :: ${txt.slice(0, 120)}`);
        if (problems.length > 5) break;
      }
      assert.deepEqual(problems, []);
    });
  }
}

test('sessions: 20 questions per skill and level, no duplicate signature, all valid', () => {
  for (const skillId of E.skillsWithTemplates()) {
    for (const level of E.levelsForSkill(skillId)) {
      for (let base = 1; base <= 10; base++) {
        const qs = E.generateSkillSession(skillId, { baseSeed: base * 7919, count: 20, level });
        assert.equal(qs.length, 20);
        assert.equal(new Set(qs.map(q => q.signature)).size, 20, `${skillId} L${level} base ${base}`);
        assert.equal(new Set(qs.map(q => q.id)).size, 20);
        for (const q of qs) assert.equal(q.level, level);
      }
    }
  }
});

test('diversity: ≥ 30 distinct signatures per template and level over the first 200 seeds', () => {
  for (const t of E.TEMPLATES) for (const level of t.levels) {
    const sigs = new Set();
    for (let seed = 1; seed <= 200; seed++) sigs.add(E.generate(t, seed, level).signature);
    assert.ok(sigs.size >= 30, `${t.id} L${level}: only ${sigs.size}`);
  }
});

test('lint helper catches the problems it is meant to catch', () => {
  assert.ok(lint('$3+-2$').length);
  assert.ok(lint('$3- -2$').length);
  assert.deepEqual(lint('$3-\\left(-2\\right)$'), []);
  assert.ok(lint('$1x+2$').length);
  assert.ok(lint('$0.5x$').length);
  assert.ok(lint('Wert undefined').length);
  assert.ok(lint('$\\frac{1}{2$').length);
  assert.deepEqual(lint('$11x+\\frac{1}{2}x-0{,}5\\cdot \\left(-3\\right)$; $2;\\ 3;\\ \\ldots$'), []);
});
