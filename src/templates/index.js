'use strict';
/**
 * Template registry. Adding a skill = data in catalog.json + one generator module listed here.
 * Template ids: <skillId>.<family-group>; question ids: <templateId>@<version>/L<level>/<seed>.
 */
const Q = require('../question');

const TEMPLATES = Object.freeze([
  ...require('./ch1/numterms'),
  ...require('./ch1/laws'),
  ...require('./ch1/translate'),
  ...require('./ch1/situations'),
  ...require('./ch1/term_values'),
  ...require('./ch1/collect_like'),
  ...require('./ch1/equivalence'),
  ...require('./ch1/products'),
  ...require('./ch1/quotients'),
  ...require('./ch1/expand_factor'),
  ...require('./ch1/fill_missing'),
  require('./ch2/tables').prop,
  require('./ch2/dreisatz').prop,
  ...require('./ch2/graph'),
  require('./ch2/tables').anti,
  require('./ch2/dreisatz').anti,
  ...require('./ch2/decide'),
  ...require('./ch4/setup'),
  ...require('./ch4/solve'),
  ...require('./ch4/count'),
  ...require('./ch4/word'),
  ...require('./ch5/angles'),
  ...require('./ch6/compare'),
  ...require('./ch6/basic'),
  ...require('./ch6/interest'),
  ...require('./ch6/loan'),
  ...require('./ch7/data'),
  ...require('./ch7/experiments'),
  ...require('./ch7/determine'),
  ...require('./ch7/frequency'),
  ...require('./ch7/laplace'),
]);
const REGISTRY = Object.freeze(Object.fromEntries(TEMPLATES.map(t => [t.id, t])));
if (Object.keys(REGISTRY).length !== TEMPLATES.length) throw new Error('duplicate template id');

function templatesForSkill(skillId, level) {
  return TEMPLATES.filter(t => t.skillId === skillId && (level === undefined || t.levels.includes(level)));
}
function levelsForSkill(skillId) {
  return [...new Set(templatesForSkill(skillId).flatMap(t => t.levels))].sort();
}
function skillsWithTemplates() { return [...new Set(TEMPLATES.map(t => t.skillId))]; }

/** Metadata only (no functions) — for the UI, docs and the coverage matrix. */
function templateInfo(t) {
  return { id: t.id, version: t.version, skillId: t.skillId, families: t.families.slice(), levels: t.levels.slice(), levelNotes: { ...t.levelNotes }, misconceptions: t.misconceptions.slice() };
}

/** "<templateId>@<version>/L<level>/<seed>" → reference, or null if malformed. */
function parseQuestionId(id) {
  const m = /^([a-z0-9_.]+)@(\d+)\/L([1-4])\/(\d+)$/.exec(String(id));
  return m ? { templateId: m[1], templateVersion: Number(m[2]), level: Number(m[3]), seed: Number(m[4]) } : null;
}

function generateQuestion(templateId, seed, level) {
  const t = REGISTRY[templateId];
  if (!t) throw new Q.GenerationError(`unknown template ${templateId}`);
  return Q.generate(t, seed, level);
}
/** Rebuild a question from its id (only the id/seed is ever stored). */
function regenerateQuestion(id) {
  const ref = parseQuestionId(id);
  if (!ref) throw new Q.GenerationError(`malformed question id ${id}`);
  return Q.regenerate(REGISTRY, ref);
}
/** Duplicate-free session for one skill at one level (only templates supporting that level). */
function generateSkillSession(skillId, { baseSeed, count, level }) {
  const ts = templatesForSkill(skillId, level);
  if (!ts.length) throw new Q.GenerationError(`no template for ${skillId} at L${level}`);
  return Q.generateSession(ts, { baseSeed, count, level });
}

module.exports = {
  TEMPLATES, REGISTRY, templatesForSkill, levelsForSkill, skillsWithTemplates, templateInfo,
  parseQuestionId, generateQuestion, regenerateQuestion, generateSkillSession,
};
