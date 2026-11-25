'use strict';
/**
 * practice.js — practice-session state machine (pure, JSON-serialisable, no DOM).
 *
 * The UI keeps a Session object, calls these functions and renders the result.
 * Only question ids are stored; question content is regenerated from the id.
 *
 * Session = {
 *   schema:'mathe7-session', version:1, skillId, levelMode: 1|2|3|4|'auto'|'adaptive', count, baseSeed, [startLevel],
 *   [filter: {templates:[templateId…], levels:[1..4]}]  (S11, D88: restricts the pool, e.g. „Üben“ from the KA overview),
 *   variantCounter, current, finished,
 *   items: [{ qid, signature, level, attempts:[{status, errorCategory, equivalent, hintsBefore}],
 *             hintsSeen:[0..4], solved, revealed, replaced }]
 * }
 * An item is "open" until it is solved, revealed or replaced. Invalid input is never stored as an attempt.
 * Functions return a NEW session object (input is not mutated) plus any progress events, which the UI passes
 * to progress.applyEvent.
 */
const { Rng, deriveSeed } = require('./core');
const Q = require('./question');
const T = require('./templates');
const A = require('./adaptive');

const SESSION_COUNTS = Object.freeze([5, 10, 15, 20]);
const MAX_VARIANT_TRIES = 60;
const SOLUTION_HINT = 3;
const ADAPTIVE_CURSOR = 2000; // first seed index of adaptive items (variants start at 500000, planned sessions at 1000) // index of the worked-solution hint (HINT_KINDS[3] === 'solution')

const HINT_LABELS_DE = Object.freeze({
  orientation: 'Tipp 1: Worum geht es?',
  strategy: 'Tipp 2: Wie gehe ich vor?',
  step: 'Tipp 3: Erster Schritt',
  solution: 'Lösungsweg',
  alternative: 'Anders erklärt',
});
const ERROR_LABELS_DE = Object.freeze({
  sign_error: 'Vorzeichenfehler',
  order_of_operations: 'Rechenreihenfolge',
  unit_confusion: 'Einheiten verwechselt',
  rounding: 'Rundungsfehler',
  concept_confusion: 'Begriff verwechselt',
  other: 'Sonstiger Fehler',
});
const LEVEL_MODE_LABELS_DE = Object.freeze({ adaptive: 'Automatisch (passt sich an)', auto: 'Gemischt, steigend', 1: 'Grundlagen', 2: 'Standard', 3: 'Anspruchsvoll', 4: 'Transfer' });

const clone = s => JSON.parse(JSON.stringify(s));
const isOpen = it => !it.solved && !it.revealed && !it.replaced;

/**
 * Levels for 'auto' mode: a deterministic ramp through the skill's available levels
 * (e.g. 10 questions over L1–L4 → 1,1,1,2,2,3,3,3,4,4). Not adaptive (see docs/decisions.md D31).
 */
function autoLevels(available, count) {
  const lv = available.slice().sort((a, b) => a - b);
  return Array.from({ length: count }, (_, i) => lv[Math.floor(i * lv.length / count)]);
}

/** Levels the session will use per position. */
/** Templates of a skill (optionally at one level) allowed by a session filter. */
function poolFor(skillId, level, filter) {
  let pool = T.templatesForSkill(skillId, level);
  if (filter && filter.templates) pool = pool.filter(t => filter.templates.includes(t.id));
  if (filter && filter.levels && level !== undefined && !filter.levels.includes(level)) pool = [];
  return pool;
}
/** Levels available to a session (skill levels, narrowed by the filter). */
function levelsFor(skillId, filter) {
  const lv = [...new Set(poolFor(skillId, undefined, filter).flatMap(t => t.levels))].sort((a, b) => a - b);
  return filter && filter.levels ? lv.filter(l => filter.levels.includes(l)) : lv;
}
/** Normalised filter or null; throws RangeError when it leaves nothing to practise. */
function normalizeFilter(skillId, filter) {
  if (!filter) return null;
  const f = {};
  if (Array.isArray(filter.templates)) f.templates = filter.templates.filter(id => T.REGISTRY[id] && T.REGISTRY[id].skillId === skillId).sort();
  if (Array.isArray(filter.levels)) f.levels = [...new Set(filter.levels.filter(l => [1, 2, 3, 4].includes(l)))].sort();
  if (!levelsFor(skillId, f).length) throw new RangeError(`filter leaves no question for ${skillId}`);
  return f;
}

function plannedLevels(skillId, levelMode, count, filter) {
  if (levelMode === 'adaptive') throw new RangeError("levelMode 'adaptive' has no fixed plan: levels follow the answers");
  const available = levelsFor(skillId, filter);
  if (!available.length) throw new Q.GenerationError(`skill ${skillId} has no templates`);
  if (levelMode === 'auto') return autoLevels(available, count);
  if (!available.includes(levelMode)) throw new Q.GenerationError(`skill ${skillId} has no level ${levelMode}`);
  return Array(count).fill(levelMode);
}

/** Generate one question for a skill/level that does not collide with `seen` signatures. */
function pickQuestion(skillId, level, baseSeed, startIndex, seen, templateId, filter) {
  const pool = templateId ? T.templatesForSkill(skillId, level).filter(t => t.id === templateId) : poolFor(skillId, level, filter);
  if (!pool.length) throw new Q.GenerationError(`no template for ${skillId} L${level}`);
  for (let k = 0; k < MAX_VARIANT_TRIES; k++) {
    const seed = deriveSeed(baseSeed, startIndex + k);
    const rng = new Rng(seed);
    const t = pool[rng.int(0, pool.length - 1)];
    const q = Q.generate(t, seed, level);
    if (!seen.has(q.signature)) return { q, used: k + 1 };
  }
  throw new Q.GenerationError(`no unseen question for ${skillId} L${level}`);
}

function newItem(q) {
  return { qid: q.id, signature: q.signature, level: q.level, attempts: [], hintsSeen: [], solved: false, revealed: false, replaced: false };
}

/** Create a session. Returns {session, questions} (questions = generated objects, for caching by the UI). */
function createSession({ skillId, levelMode = 'auto', count = 10, baseSeed, startLevel, filter }) {
  if (!SESSION_COUNTS.includes(count)) throw new RangeError(`count must be one of ${SESSION_COUNTS.join(', ')}`);
  if (!Number.isInteger(baseSeed) || baseSeed < 0) throw new RangeError('baseSeed must be a non-negative integer');
  const f = normalizeFilter(skillId, filter);
  if (levelMode === 'adaptive') return createAdaptiveSession({ skillId, count, baseSeed, startLevel, filter: f });
  const levels = plannedLevels(skillId, levelMode, count, f);
  const seen = new Set();
  const items = [], questions = [];
  let cursor = 1000;
  for (const lv of levels) {
    const { q, used } = pickQuestion(skillId, lv, baseSeed, cursor, seen, undefined, f);
    cursor += used;
    seen.add(q.signature);
    items.push(newItem(q));
    questions.push(q);
  }
  const session = { schema: 'mathe7-session', version: 1, skillId, levelMode, count, baseSeed: baseSeed >>> 0, variantCounter: 0, current: 0, finished: false, items, ...(f ? { filter: f } : {}) };
  return { session, questions };
}

/**
 * Adaptive session (S10, docs/adaptive-rules.md): only the first item exists at the start; `advance` appends each next item at the
 * level A.nextSessionLevel derives from the items closed so far. `startLevel` comes from A.recommendLevel (the UI passes it in), so a
 * session is a deterministic function of (baseSeed, startLevel, the student's answers).
 */
function createAdaptiveSession({ skillId, count, baseSeed, startLevel, filter }) {
  const available = levelsFor(skillId, filter);
  if (!available.length) throw new Q.GenerationError(`skill ${skillId} has no templates`);
  // a recommended start level outside the filter is moved to the nearest allowed level
  let start = startLevel === undefined ? available[0] : startLevel;
  if (filter && !available.includes(start)) start = available.slice().sort((a, b) => Math.abs(a - start) - Math.abs(b - start) || a - b)[0];
  if (!available.includes(start)) throw new Q.GenerationError(`skill ${skillId} has no level ${start}`);
  const { q } = pickQuestion(skillId, start, baseSeed, ADAPTIVE_CURSOR, new Set(), undefined, filter);
  const session = { schema: 'mathe7-session', version: 1, skillId, levelMode: 'adaptive', count, baseSeed: baseSeed >>> 0, startLevel: start, variantCounter: 0, current: 0, finished: false, items: [newItem(q)], ...(filter ? { filter } : {}) };
  return { session, questions: [q] };
}

/** Rebuild the question for an item (throws GenerationError if the template version changed). */
function questionFor(item) { return T.regenerateQuestion(item.qid); }

function currentItem(session) { return session.items[session.current]; }

/**
 * Check an answer for the current item.
 * Returns {session, result, events}. `result` is evaluateQuestion's output.
 * Invalid input leaves the session unchanged and produces no events.
 */
function submitAnswer(session, question, raw) {
  const item = currentItem(session);
  if (!item || item.qid !== question.id) throw new Error('question does not belong to the current item');
  if (!isOpen(item)) throw new Error('item is already closed');
  const result = Q.evaluateQuestion(question, raw);
  if (result.status === 'invalid') return { session, result, events: [] };
  const s = clone(session);
  const it = currentItem(s);
  const isFirst = it.attempts.length === 0;
  it.attempts.push({ status: result.status, errorCategory: result.errorCategory || null, equivalent: !!result.equivalent, hintsBefore: it.hintsSeen.length });
  if (result.status === 'correct') it.solved = true;
  const events = [{ type: 'attempt', skillId: s.skillId, templateId: question.templateId, level: it.level, status: result.status, errorCategory: result.errorCategory || null, isFirst, hintsBefore: it.hintsSeen.length, sawSolution: it.hintsSeen.includes(SOLUTION_HINT) }];
  return { session: s, result, events };
}

/** Open hint k (0..4). Any hint is directly accessible. Counted once per item and hint. */
function openHint(session, k) {
  if (!Number.isInteger(k) || k < 0 || k > 4) throw new RangeError('hint index 0..4');
  const item = currentItem(session);
  if (item.hintsSeen.includes(k)) return { session, events: [] };
  const s = clone(session);
  currentItem(s).hintsSeen.push(k);
  return { session: s, events: [{ type: 'hint', skillId: s.skillId, hintIndex: k }] };
}

/** Show the full worked solution and close the item as not solved. */
function revealSolution(session) {
  const item = currentItem(session);
  if (!isOpen(item)) return { session, events: [] };
  const s = clone(session);
  const it = currentItem(s);
  it.revealed = true;
  return { session: s, events: [{ type: 'reveal', skillId: s.skillId, templateId: T.parseQuestionId(it.qid).templateId, level: it.level, hadAttempt: it.attempts.length > 0 }] };
}

/**
 * "Neue Zahlen": replace the current item by a fresh instance of the same template and level
 * (different signature from everything in this session). The old item is kept as `replaced`.
 * Returns {session, question}.
 */
function replaceWithVariant(session) {
  const item = currentItem(session);
  const ref = T.parseQuestionId(item.qid);
  const seen = new Set(session.items.map(i => i.signature));
  const s = clone(session);
  const { q } = pickQuestion(s.skillId, ref.level, s.baseSeed, 500000 + s.variantCounter * MAX_VARIANT_TRIES, seen, ref.templateId);
  s.variantCounter += 1;
  const events = [];
  const old = currentItem(s);
  if (old.attempts.length === 0 && !old.revealed) events.push({ type: 'skip', skillId: s.skillId });
  old.replaced = true;
  s.items.splice(s.current + 1, 0, newItem(q));
  s.current += 1;
  return { session: s, question: q, events };
}

/** Move to the next open item; marks the session finished when none is left. */
function advance(session) {
  const s = clone(session);
  let i = s.current + 1;
  while (i < s.items.length && !isOpen(s.items[i])) i++;
  if (i >= s.items.length && s.levelMode === 'adaptive' && s.items.filter(it => !it.replaced).length < s.count) {
    // adaptive: generate the next item at the level the closed items call for
    const level = A.nextSessionLevel(s, levelsFor(s.skillId, s.filter));
    const seen = new Set(s.items.map(it => it.signature));
    const { q } = pickQuestion(s.skillId, level, s.baseSeed, ADAPTIVE_CURSOR + s.items.length * MAX_VARIANT_TRIES, seen, undefined, s.filter);
    s.items.push(newItem(q));
    i = s.items.length - 1;
  }
  if (i >= s.items.length) { s.finished = true; s.current = s.items.length - 1; }
  else s.current = i;
  return s;
}

/** End the session early ("Übung beenden"). Open items stay unsolved. */
function endSession(session) {
  const s = clone(session);
  s.finished = true;
  return s;
}

/** Position for display: 1-based number among non-replaced items, and total. */
function position(session) {
  const counted = session.items.filter(it => !it.replaced);
  const cur = currentItem(session);
  const idx = counted.indexOf(cur);
  return { number: idx === -1 ? counted.length : idx + 1, total: session.levelMode === 'adaptive' ? Math.max(session.count, counted.length) : counted.length };
}

/** Session summary (only non-replaced items count as questions). */
function summarize(session) {
  const items = session.items.filter(it => !it.replaced);
  const all = session.items;
  const errors = {};
  for (const it of all) for (const a of it.attempts) if (a.status === 'incorrect' && a.errorCategory) errors[a.errorCategory] = (errors[a.errorCategory] || 0) + 1;
  const byLevel = {};
  for (const it of items) {
    const b = byLevel[it.level] || (byLevel[it.level] = { questions: 0, firstTry: 0 });
    b.questions++;
    if (it.solved && it.attempts.length === 1) b.firstTry++;
  }
  return {
    skillId: session.skillId,
    questions: items.length,
    solvedFirstTry: items.filter(it => it.solved && it.attempts.length === 1).length,
    solvedLater: items.filter(it => it.solved && it.attempts.length > 1).length,
    revealed: items.filter(it => it.revealed).length,
    unsolved: items.filter(it => !it.solved).length,
    attempts: all.reduce((n, it) => n + it.attempts.length, 0),
    hintsUsed: all.reduce((n, it) => n + it.hintsSeen.length, 0),
    replaced: all.filter(it => it.replaced).length,
    errors,
    byLevel,
  };
}

/** Structural check of a stored session (from localStorage). Returns true only for a usable session. */
function isValidSession(s) {
  if (!s || s.schema !== 'mathe7-session' || s.version !== 1) return false;
  if (typeof s.skillId !== 'string' || !Array.isArray(s.items) || !s.items.length) return false;
  if (!Number.isInteger(s.current) || s.current < 0 || s.current >= s.items.length) return false;
  if (s.levelMode === 'adaptive' && (!Number.isInteger(s.count) || !Number.isInteger(s.startLevel))) return false;
  if (s.filter !== undefined) { try { normalizeFilter(s.skillId, s.filter); } catch (e) { return false; } }
  return s.items.every(it => it && typeof it.qid === 'string' && T.parseQuestionId(it.qid) && Array.isArray(it.attempts) && Array.isArray(it.hintsSeen));
}

/** Data for "Problem melden". Contains no personal data unless the student types it into `note`. */
function makeReport(question, { note = '', answerGiven = null, engineVersion, catalogVersion, createdAt }) {
  return {
    schema: 'mathe7-report', version: 1,
    questionId: question.id, templateId: question.templateId, templateVersion: question.templateVersion,
    seed: question.seed, level: question.level, skillId: question.skillId, signature: question.signature,
    engineVersion, catalogVersion, createdAt,
    answerGiven: answerGiven === undefined ? null : answerGiven,
    note: String(note).slice(0, 1000),
  };
}

module.exports = {
  SESSION_COUNTS, MAX_VARIANT_TRIES, pickQuestion, HINT_LABELS_DE, ERROR_LABELS_DE, LEVEL_MODE_LABELS_DE,
  autoLevels, plannedLevels, levelsFor, createSession, questionFor, currentItem, submitAnswer, openHint,
  revealSolution, replaceWithVariant, advance, endSession, position, summarize, isValidSession, makeReport,
};
