'use strict';
/**
 * adaptive.js — adaptive rules (Session 10). Pure, deterministic, JSON in / JSON out, no DOM, no clock, no storage.
 * Every function is a function of the stored history (progress.skills[id].detail / box / nextReview) and of the
 * parameters in ADAPTIVE_RULES, so the same history always gives the same recommendation. Documented in
 * docs/adaptive-rules.md; none of this is a formal assessment.
 *
 * Evidence = the first-try outcome of each question: 'clean' (right, no hint), 'hinted' (right after a hint),
 * 'miss' (wrong, or the worked solution was opened). Scores: clean 1, hinted ADAPTIVE_RULES.hintCredit, miss 0.
 * Records written before Session 10 carry only `recent` (0/1 without level); they are read as level-less evidence.
 */
const { addDays, PROGRESS_RULES } = require('./progress');
const { findSkill } = require('./coverage');

const ADAPTIVE_RULES = Object.freeze({
  hintCredit: 0.5,               // score of a question solved right after opening a hint (no worked solution)
  // --- mastery ("sicher"): never from one answer
  masteryWindow: 12,             // accuracy is measured over the last N questions
  masteryMinQuestions: 10,       // at least this many questions in the window
  masteryAccuracy: 0.8,
  masteryProofLevel: 3,          // a level counts as proven with ≥ masteryProofMin questions at that level or above …
  masteryProofMin: 3,            // … and mean score ≥ masteryProofAccuracy (needed up to this level, capped at the skill's top level)
  masteryProofAccuracy: 0.75,
  // --- "braucht Hilfe" (internal flag, not a label): triggers the prerequisite advice
  helpWindow: 8,
  helpMinQuestions: 5,
  helpBelow: 0.5,
  // --- recommended start level for the next session
  levelWindow: 12,               // last N level-tagged questions
  supportMin: 2,                 // a level L is "supported" by ≥ this many questions at L or above …
  supportAccuracy: 0.6,          // … with mean score ≥ this (the lowest available level is always supported)
  upMin: 4,                      // step one level up from the supported level after ≥ this many questions at/above it …
  upAccuracy: 0.8,               // … with mean score ≥ this
  // --- level inside a session ('adaptive' mode)
  sessionUpStreak: 2,            // this many clean answers in a row at the current level → one level up
  sessionDownStreak: 2,          // this many misses in a row → one level down
  // --- spaced revision (replaces the fixed 1/3/7–28 days of docs/progress-rules.md)
  reviewLadder: Object.freeze([1, 2, 4, 7, 14, 28]),   // days per box
  reviewWindow: 8,
  reviewGrowMin: 6,              // a box only grows with ≥ this many questions in the window …
  reviewGrowFrom: 0.8,           // … and mean score ≥ this …
  reviewLapseBelow: 0.5,         // mean score below this halves the box (rounded down)
  maxBoxUnsecure: 3,             // without mastery ('sicher') the interval stays ≤ ladder[3] = 7 days
  // --- prerequisite fallback
  prereqDepth: 2,                // look this many steps back in the catalog's prerequisite chain
  // --- diagnostic (src/diagnostic.js)
  diagQuestionsPerSkill: 3,
  diagStartLevel: 2,
  diagSecureAccuracy: 0.8,       // mean score ≥ this and a level ≥ 2 answered right → 'secure'
  diagGapBelow: 0.4,             // mean score below this → 'gap'
});

const SCORE = (o, R = ADAPTIVE_RULES) => (o === 'clean' ? 1 : o === 'hinted' ? R.hintCredit : 0);
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** Evidence of a skill record, oldest → newest: [{l: level|null, o: outcome}]. Reads legacy `recent` when there is no detail. */
function evidenceOf(rec) {
  if (!rec) return [];
  if (Array.isArray(rec.detail) && rec.detail.length) return rec.detail.map(x => ({ l: x.l, o: x.o }));
  return (rec.recent || []).map(v => ({ l: null, o: v ? 'clean' : 'miss' }));
}
const scoresOf = (ev, R) => ev.map(e => SCORE(e.o, R));
const tail = (a, n) => a.slice(Math.max(0, a.length - n));

// ------------------------------------------------------------------ mastery
/** Mean score over the last `masteryWindow` questions, or null. */
function windowScore(rec, R = ADAPTIVE_RULES) { return mean(scoresOf(tail(evidenceOf(rec), R.masteryWindow), R)); }

/**
 * Highest level proven by the evidence: ≥ masteryProofMin questions at that level or above with mean score ≥ masteryProofAccuracy.
 * null when no level qualifies or the evidence has no level information (legacy records).
 */
function provenLevel(rec, R = ADAPTIVE_RULES) {
  const ev = tail(evidenceOf(rec), PROGRESS_RULES.detailWindow).filter(e => e.l !== null);
  let best = null;
  for (const L of [1, 2, 3, 4]) {
    const at = scoresOf(ev.filter(e => e.l >= L), R);
    if (at.length >= R.masteryProofMin && mean(at) >= R.masteryProofAccuracy) best = L;
  }
  return best;
}

/**
 * 'new' | 'learning' | 'secure'. 'secure' needs ≥ masteryMinQuestions in the window, window score ≥ masteryAccuracy and — when the
 * evidence knows its levels — a proven level ≥ min(masteryProofLevel, topLevel). One answer (or one level only) never makes a skill secure.
 */
function adaptiveMastery(rec, topLevel = 4, R = ADAPTIVE_RULES) {
  if (!rec || rec.questions === 0) return 'new';
  const ev = tail(evidenceOf(rec), R.masteryWindow);
  if (ev.length < R.masteryMinQuestions || mean(scoresOf(ev, R)) < R.masteryAccuracy) return 'learning';
  if (evidenceOf(rec).some(e => e.l !== null)) {
    const need = Math.min(R.masteryProofLevel, topLevel);
    const pl = provenLevel(rec, R);
    if (pl === null || pl < need) return 'learning';
  }
  return 'secure';
}

/** Internal flag: the last questions went badly (≥ helpMinQuestions, mean score < helpBelow). */
function needsHelp(rec, R = ADAPTIVE_RULES) {
  const ev = tail(evidenceOf(rec), R.helpWindow);
  return ev.length >= R.helpMinQuestions && mean(scoresOf(ev, R)) < R.helpBelow;
}

// ------------------------------------------------------------------ level recommendation (between sessions)
const sortedLevels = available => [...new Set(available)].sort((a, b) => a - b);

/**
 * Level to start the next session at, from the last `levelWindow` level-tagged questions:
 *  - supported(L) = ≥ supportMin questions at levels ≥ L with mean score ≥ supportAccuracy (the lowest level always is);
 *  - base = highest supported level; one level higher when ≥ upMin questions at/above base have mean score ≥ upAccuracy.
 * A single miss never lowers the level (support needs two questions); no evidence → the lowest available level.
 */
function recommendLevel(rec, available, R = ADAPTIVE_RULES) {
  const lv = sortedLevels(available);
  if (!lv.length) throw new RangeError('no levels available');
  const ev = tail(evidenceOf(rec).filter(e => e.l !== null), R.levelWindow);
  if (!ev.length) return lv[0];
  let base = lv[0];
  for (const L of lv) {
    const at = scoresOf(ev.filter(e => e.l >= L), R);
    if (L === lv[0] || (at.length >= R.supportMin && mean(at) >= R.supportAccuracy)) base = L;
  }
  const at = scoresOf(ev.filter(e => e.l >= base), R);
  const idx = lv.indexOf(base);
  if (at.length >= R.upMin && mean(at) >= R.upAccuracy && idx + 1 < lv.length) return lv[idx + 1];
  return base;
}

// ------------------------------------------------------------------ level inside a session
/** Outcome of a session item: 'clean' | 'hinted' | 'miss' | null while the item is open or replaced. */
function itemOutcome(item) {
  if (item.replaced) return null;
  if (item.revealed) return 'miss';
  if (!item.solved) return null;
  const sawSolution = item.hintsSeen.includes(3);
  if (item.attempts.length !== 1 || sawSolution) return 'miss';
  return item.hintsSeen.length ? 'hinted' : 'clean';
}

/** Replay a list of outcomes from `start` and return the level for the next question. */
function replayLevel(outcomes, start, available, R = ADAPTIVE_RULES) {
  const lv = sortedLevels(available);
  let i = Math.max(0, lv.indexOf(start));
  if (lv.indexOf(start) < 0) i = lv.reduce((best, L, k) => (Math.abs(L - start) < Math.abs(lv[best] - start) ? k : best), 0);
  let run = [];
  for (const o of outcomes) {
    run.push(o);
    const up = R.sessionUpStreak, down = R.sessionDownStreak;
    if (run.length >= up && run.slice(-up).every(x => x === 'clean') && i + 1 < lv.length) { i++; run = []; }
    else if (run.length >= down && run.slice(-down).every(x => x === 'miss') && i > 0) { i--; run = []; }
  }
  return lv[i];
}

/** Level of the next item of an 'adaptive' session, from the closed items so far (replaced items are ignored). */
function nextSessionLevel(session, available, R = ADAPTIVE_RULES) {
  const outcomes = session.items.map(itemOutcome).filter(o => o !== null);
  return replayLevel(outcomes, session.startLevel, available, R);
}

// ------------------------------------------------------------------ spaced revision
/**
 * Set the next review date after a session (Leitner-style boxes, deterministic):
 *  - mean score of the last `reviewWindow` questions < reviewLapseBelow → box = floor(box / 2);
 *  - ≥ reviewGrowFrom with ≥ reviewGrowMin questions → box + 1, but only when the topic was due (today ≥ nextReview) or never scheduled —
 *    practising twice on one day does not climb the ladder;
 *  - otherwise the box stays. Without mastery the box is capped at maxBoxUnsecure.
 * interval = reviewLadder[box] days. Returns a new progress object.
 */
function scheduleReviewAdaptive(progress, skillId, today, topLevel = 4, R = ADAPTIVE_RULES) {
  const p = JSON.parse(JSON.stringify(progress));
  const rec = p.skills[skillId];
  if (!rec || !rec.questions) return p;
  const win = tail(evidenceOf(rec), R.reviewWindow);
  if (!win.length) return p;
  const acc = mean(scoresOf(win, R));
  const wasDue = !rec.nextReview || today >= rec.nextReview;
  let box = rec.box || 0;
  if (acc < R.reviewLapseBelow) box = Math.floor(box / 2);
  else if (acc >= R.reviewGrowFrom && win.length >= R.reviewGrowMin && wasDue) box += 1;
  if (adaptiveMastery(rec, topLevel, R) !== 'secure') box = Math.min(box, R.maxBoxUnsecure);
  box = Math.max(0, Math.min(box, R.reviewLadder.length - 1));
  rec.box = box;
  rec.intervalDays = R.reviewLadder[box];
  rec.nextReview = addDays(today, rec.intervalDays);
  return p;
}

// ------------------------------------------------------------------ prerequisite fallback
/**
 * Advice for a skill the student struggles with. Reads catalog `prerequisites` (skill ids and external Klasse-6 ids).
 * Returns {action:'continue'} when the student is not struggling or nothing helps, else
 *   {action:'fallback', skillId, reason:'weak'|'untested'|'unsure', depth, external:[names]}.
 * Only skills for which isOffered(id) is true are recommended (practicable and allowed by "Im Unterricht behandelt").
 * Candidates: needs-help first, then never practised, then not yet secure; ties → deeper in the chain first, then catalog order.
 */
function prerequisiteAdvice(catalog, progress, skillId, isOffered, R = ADAPTIVE_RULES, levelsOf = () => [1, 2, 3, 4]) {
  const own = progress.skills[skillId];
  if (!needsHelp(own, R)) return { action: 'continue', external: [] };
  const externalNames = new Map((catalog.externalPrerequisites || []).map(e => [e.id, e.name]));
  const cands = [];
  const external = [];
  const seen = new Set([skillId]);
  let order = 0;
  let frontier = [skillId];
  for (let depth = 1; depth <= R.prereqDepth; depth++) {
    const next = [];
    for (const id of frontier) {
      const f = findSkill(catalog, id);
      for (const pid of (f ? f.skill.prerequisites : []) || []) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        if (externalNames.has(pid)) { external.push(externalNames.get(pid)); continue; }
        if (!findSkill(catalog, pid)) continue;
        next.push(pid);
        if (!isOffered(pid)) continue;
        const rec = progress.skills[pid];
        const m = adaptiveMastery(rec, Math.max(...levelsOf(pid), 1), R);
        if (m === 'secure') continue;
        const reason = needsHelp(rec, R) ? 'weak' : m === 'new' ? 'untested' : 'unsure';
        cands.push({ skillId: pid, reason, depth, order: order++ });
      }
    }
    frontier = next;
  }
  const rank = { weak: 0, untested: 1, unsure: 2 };
  cands.sort((a, b) => rank[a.reason] - rank[b.reason] || b.depth - a.depth || a.order - b.order);
  if (!cands.length) return { action: 'continue', external };
  const c = cands[0];
  return { action: 'fallback', skillId: c.skillId, reason: c.reason, depth: c.depth, external };
}

// ------------------------------------------------------------------ display
/** Display-ready adaptive stats of one skill (levelsOf: skill id → available levels). */
function adaptiveStats(progress, skillId, levelsOf = () => [1, 2, 3, 4], R = ADAPTIVE_RULES) {
  const rec = progress.skills[skillId];
  const levels = sortedLevels(levelsOf(skillId));
  const top = levels.length ? levels[levels.length - 1] : 4;
  return {
    skillId,
    mastery: adaptiveMastery(rec, top, R),
    needsHelp: needsHelp(rec, R),
    windowScore: rec ? windowScore(rec, R) : null,
    provenLevel: rec ? provenLevel(rec, R) : null,
    recommendedLevel: levels.length ? recommendLevel(rec, levels, R) : null,
    box: rec ? rec.box || 0 : 0,
    intervalDays: rec ? rec.intervalDays || 0 : 0,
  };
}

module.exports = {
  ADAPTIVE_RULES, evidenceOf, windowScore, provenLevel, adaptiveMastery, needsHelp, recommendLevel, itemOutcome, replayLevel,
  nextSessionLevel, scheduleReviewAdaptive, prerequisiteAdvice, adaptiveStats, outcomeScore: SCORE,
};
