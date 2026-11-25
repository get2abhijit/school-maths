'use strict';
/**
 * diagnostic.js — chapter diagnostic ("Standortbestimmung", Session 10). Pure, JSON-serialisable, no DOM, no storage.
 *
 * NOT a test and NOT a grade: a short probe of ADAPTIVE_RULES.diagQuestionsPerSkill questions per skill of one chapter, so the
 * student (and the app) can see where to start. Rules (docs/adaptive-rules.md):
 *  - only skills that are practicable AND offered by "Im Unterricht behandelt" (coverage.partitionSkills) take part;
 *  - per skill a small ladder: first question at diagStartLevel, then one level up after a right answer, one down after a wrong one;
 *  - no hints, one attempt per question, no feedback on right/wrong until the result page; "Weiß ich nicht" counts as wrong;
 *    invalid input is not an answer (the student can correct it);
 *  - answers are real first-try evidence for the progress record (same events as practice) — but three answers can never
 *    make a skill 'secure' (adaptive.adaptiveMastery needs ≥ 10 questions), and the diagnostic sets no review dates;
 *  - per skill verdict: 'secure' (score ≥ diagSecureAccuracy and a level ≥ 2 solved), 'gap' (score < diagGapBelow), else 'partial'.
 * Only the latest result per chapter is stored (progress.diagnostics) — no answers, only verdict, level and counts.
 */
const Q = require('./question');
const T = require('./templates');
const P = require('./practice');
const C = require('./coverage');
const { ADAPTIVE_RULES } = require('./adaptive');

const DIAGNOSTIC_NOTE_DE = 'Das ist keine Klassenarbeit, keine Note – nur eine Einschätzung, wo du gerade stehst.';
const DIAG_VERDICT_LABELS_DE = Object.freeze({ secure: 'Sieht sicher aus', partial: 'Teilweise sicher', gap: 'Hier gibt es noch Lücken' });
const DIAG_CURSOR = 3000;
const clone = s => JSON.parse(JSON.stringify(s));

/** Skills of a chapter that a diagnostic would cover now (practicable + offered), in catalog order. */
function diagnosticSkills(catalog, coverage, chapterId) {
  const ch = catalog.chapters.find(c => c.id === chapterId);
  if (!ch) throw new RangeError(`unknown chapter ${chapterId}`);
  const ids = [];
  for (const t of ch.topics) for (const s of t.skills) if (T.levelsForSkill(s.id).length) ids.push(s.id);
  const part = C.partitionSkills(catalog, coverage, ids);
  return { available: part.available, hidden: part.hidden };
}

function nearest(levels, want) {
  return levels.reduce((best, L) => (Math.abs(L - want) < Math.abs(best - want) ? L : best), levels[0]);
}
function newItem(skillId, q) {
  return { skillId, qid: q.id, signature: q.signature, level: q.level, answered: false, status: null, errorCategory: null };
}

/** Level of the next question of the skill the diagnostic is currently on. */
function nextLevel(diag, skillId) {
  const levels = T.levelsForSkill(skillId);
  const mine = diag.items.filter(it => it.skillId === skillId && it.answered);
  if (!mine.length) return nearest(levels, ADAPTIVE_RULES.diagStartLevel);
  const last = mine[mine.length - 1];
  const i = levels.indexOf(last.level);
  return last.status === 'correct' ? levels[Math.min(levels.length - 1, i + 1)] : levels[Math.max(0, i - 1)];
}

function makeItem(diag, skillId) {
  const seen = new Set(diag.items.map(it => it.signature));
  const level = nextLevel(diag, skillId);
  const { q } = P.pickQuestion(skillId, level, diag.baseSeed, DIAG_CURSOR + diag.items.length * P.MAX_VARIANT_TRIES, seen);
  return newItem(skillId, q);
}

/** Start a diagnostic for one chapter. Throws RangeError when no skill of the chapter is offered. Returns {diagnostic, question}. */
function createDiagnostic({ catalog, coverage, chapterId, baseSeed, skillIds }) {
  if (!Number.isInteger(baseSeed) || baseSeed < 0) throw new RangeError('baseSeed must be a non-negative integer');
  let skills = diagnosticSkills(catalog, coverage, chapterId).available;
  if (skillIds) skills = skills.filter(id => skillIds.includes(id));
  if (!skills.length) throw new RangeError('no skill of this chapter is offered for a diagnostic');
  const diag = { schema: 'mathe7-diagnostic', version: 1, chapterId, baseSeed: baseSeed >>> 0, perSkill: ADAPTIVE_RULES.diagQuestionsPerSkill, skills, current: 0, finished: false, items: [] };
  const item = makeItem(diag, skills[0]);
  diag.items.push(item);
  return { diagnostic: diag, question: T.regenerateQuestion(item.qid) };
}

const currentItem = diag => diag.items[diag.current];
function questionFor(item) { return T.regenerateQuestion(item.qid); }
function position(diag) {
  return { number: diag.current + 1, total: diag.skills.length * diag.perSkill, skill: diag.skills.indexOf(currentItem(diag).skillId) + 1, skills: diag.skills.length };
}

/**
 * Check an answer for the current item. Invalid input changes nothing and gives no event. A valid answer is final.
 * Returns {diagnostic, result, events}; the UI must NOT show right/wrong from `result` before the result page.
 */
function submitDiagnosticAnswer(diag, question, raw) {
  const item = currentItem(diag);
  if (diag.finished || !item || item.qid !== question.id) throw new Error('question does not belong to the current item');
  if (item.answered) throw new Error('item is already answered');
  const result = Q.evaluateQuestion(question, raw);
  if (result.status === 'invalid') return { diagnostic: diag, result, events: [] };
  const d = clone(diag);
  const it = currentItem(d);
  it.answered = true; it.status = result.status; it.errorCategory = result.status === 'incorrect' ? (result.errorCategory || null) : null;
  return { diagnostic: d, result, events: [{ type: 'attempt', skillId: it.skillId, templateId: T.parseQuestionId(it.qid).templateId, level: it.level, status: result.status, errorCategory: it.errorCategory, isFirst: true, hintsBefore: 0, sawSolution: false }] };
}

/** "Weiß ich nicht": the item counts as wrong. */
function dontKnow(diag) {
  const item = currentItem(diag);
  if (diag.finished || item.answered) throw new Error('item is not open');
  const d = clone(diag);
  const it = currentItem(d);
  it.answered = true; it.status = 'unknown';
  return { diagnostic: d, events: [{ type: 'attempt', skillId: it.skillId, templateId: T.parseQuestionId(it.qid).templateId, level: it.level, status: 'incorrect', errorCategory: null, isFirst: true, hintsBefore: 0, sawSolution: false }] };
}

/** Next question, next skill, or finished. The current item must be answered. */
function advanceDiagnostic(diag) {
  if (diag.finished) return diag;
  if (!currentItem(diag).answered) throw new Error('answer the current question first');
  const d = clone(diag);
  const skillId = currentItem(d).skillId;
  const done = d.items.filter(it => it.skillId === skillId).length;
  let next = null;
  if (done < d.perSkill) next = makeItem(d, skillId);
  else {
    const k = d.skills.indexOf(skillId) + 1;
    if (k < d.skills.length) next = makeItem(d, d.skills[k]);
  }
  if (!next) d.finished = true;
  else { d.items.push(next); d.current = d.items.length - 1; }
  return d;
}

/** Stop early; skills without an answer are not rated. */
function endDiagnostic(diag) { const d = clone(diag); d.finished = true; return d; }

/** Per-skill result of the answered items: [{skillId, n, correct, maxCorrectLevel, level, verdict, items:[{level,status}]}]. */
function summarizeDiagnostic(diag) {
  const R = ADAPTIVE_RULES;
  const out = [];
  for (const skillId of diag.skills) {
    const items = diag.items.filter(it => it.skillId === skillId && it.answered);
    if (!items.length) continue;
    const levels = T.levelsForSkill(skillId);
    const correct = items.filter(it => it.status === 'correct');
    const maxCorrectLevel = correct.length ? Math.max(...correct.map(it => it.level)) : null;
    const acc = correct.length / items.length;
    const need = Math.min(2, levels[levels.length - 1]);
    let verdict = 'partial';
    if (acc < R.diagGapBelow) verdict = 'gap';
    else if (acc >= R.diagSecureAccuracy && maxCorrectLevel !== null && maxCorrectLevel >= need) verdict = 'secure';
    out.push({ skillId, n: items.length, correct: correct.length, maxCorrectLevel, level: maxCorrectLevel === null ? levels[0] : maxCorrectLevel, verdict, items: items.map(it => ({ level: it.level, status: it.status === 'correct' ? 'correct' : 'wrong' })) });
  }
  return out;
}

/** Store the latest result of this chapter in the progress record (no answers, only verdict / level / counts). Returns new progress. */
function diagnosticToProgress(progress, diag, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new RangeError('today must be YYYY-MM-DD');
  const p = clone(progress);
  const skills = {};
  for (const s of summarizeDiagnostic(diag)) skills[s.skillId] = { verdict: s.verdict, level: s.level, n: s.n, correct: s.correct };
  if (!Object.keys(skills).length) return p;
  p.diagnostics = p.diagnostics || {};
  p.diagnostics[diag.chapterId] = { date: today, skills };
  return p;
}

/** Structural check of a stored diagnostic (localStorage). */
function isValidDiagnostic(d) {
  if (!d || d.schema !== 'mathe7-diagnostic' || d.version !== 1) return false;
  if (!/^ch\d{1,2}$/.test(String(d.chapterId)) || !Array.isArray(d.skills) || !d.skills.length || !Array.isArray(d.items) || !d.items.length) return false;
  if (!Number.isInteger(d.current) || d.current < 0 || d.current >= d.items.length || !Number.isInteger(d.perSkill)) return false;
  return d.items.every(it => it && typeof it.qid === 'string' && T.parseQuestionId(it.qid) && d.skills.includes(it.skillId) && typeof it.answered === 'boolean');
}

module.exports = {
  DIAGNOSTIC_NOTE_DE, DIAG_VERDICT_LABELS_DE, diagnosticSkills, createDiagnostic, diagnosticQuestionFor: questionFor, currentDiagnosticItem: currentItem,
  diagnosticPosition: position, submitDiagnosticAnswer, dontKnow, advanceDiagnostic, endDiagnostic, summarizeDiagnostic, diagnosticToProgress, isValidDiagnostic,
};
