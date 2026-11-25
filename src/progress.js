'use strict';
/**
 * progress.js — per-skill progress record (pure, JSON-serialisable, no DOM, no storage).
 * The UI loads/saves the object (localStorage) and feeds it events from practice.js.
 * Dates are local calendar dates 'YYYY-MM-DD' passed in by the caller (testable, no clock here).
 *
 * Rules are deliberately simple and tunable (PROGRESS_RULES); the adaptive engine of a later session
 * replaces nextReview/mastery logic. See docs/progress-rules.md.
 */
const { ERROR_CATEGORIES } = require('./question');
const { emptyCoverage, validateCoverage } = require('./coverage');

const PROGRESS_RULES = Object.freeze({
  recentWindow: 10,          // last N questions used for mastery and review interval
  masteryMinQuestions: 10,   // never "sicher" from fewer questions (no mastery from one answer)
  masteryAccuracy: 0.8,      // share of first-try-correct (without the worked solution) in the window
  reviewDaysWeak: 1,         // window accuracy < weakBelow → review tomorrow
  weakBelow: 0.6,
  reviewDaysMedium: 3,       // weakBelow ≤ accuracy < masteryAccuracy
  reviewDaysStrongMin: 7,    // ≥ masteryAccuracy: double previous interval, at least 7 …
  reviewDaysStrongMax: 28,   // … at most 28 days
  // A first-try-correct answer counts for mastery only if the worked solution (hint index 3) was not opened before.
  maxReports: 50,
  detailWindow: 24,          // S10: per-answer evidence kept per skill ({level, outcome, date}); read by src/adaptive.js
});

const MASTERY_LABELS_DE = Object.freeze({ new: 'Noch nicht geübt', learning: 'In Arbeit', secure: 'Sicher' });

function emptyProgress() {
  return { schema: 'mathe7-progress', version: 1, skills: {}, settings: { currentChapter: null, theme: 'system', coverage: emptyCoverage() }, reports: [], diagnostics: {}, exams: {} };
}
function emptySkill() {
  return { questions: 0, attempts: 0, correct: 0, firstAttemptCorrect: 0, hintsUsed: 0, solutionsShown: 0, skipped: 0,
    lastPractised: null, nextReview: null, intervalDays: 0, errors: {}, recent: [], detail: [], box: 0 };
}

/** First-try outcome of one question: 'clean' (right, no hint), 'hinted' (right after a hint), 'miss' (wrong, or worked solution seen). */
const OUTCOMES = Object.freeze(['clean', 'hinted', 'miss']);
const DIAG_VERDICTS = Object.freeze(['secure', 'partial', 'gap']);
/** Template ids are stored with each answer from S11 on (key `t`, D89) so the KA mode can count per checklist item. */
const TEMPLATE_ID_RE = /^[a-z0-9_.]{3,120}$/;
function pushDetail(rec, level, outcome, today, templateId) {
  const e = { l: Number.isInteger(level) && level >= 1 && level <= 4 ? level : null, o: outcome, d: today };
  if (typeof templateId === 'string' && TEMPLATE_ID_RE.test(templateId)) e.t = templateId;
  rec.detail.push(e);
  if (rec.detail.length > PROGRESS_RULES.detailWindow) rec.detail.splice(0, rec.detail.length - PROGRESS_RULES.detailWindow);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function pushRecent(rec, value) {
  rec.recent.push(value);
  if (rec.recent.length > PROGRESS_RULES.recentWindow) rec.recent.splice(0, rec.recent.length - PROGRESS_RULES.recentWindow);
}

/** Apply one practice event (from practice.js). Returns a new progress object. */
function applyEvent(progress, ev, today) {
  if (!DATE_RE.test(today)) throw new RangeError('today must be YYYY-MM-DD');
  const p = JSON.parse(JSON.stringify(progress));
  const rec = p.skills[ev.skillId] || (p.skills[ev.skillId] = emptySkill());
  rec.lastPractised = today;
  switch (ev.type) {
    case 'attempt':
      rec.attempts++;
      if (ev.status === 'correct') rec.correct++;
      else if (ev.errorCategory && ERROR_CATEGORIES.includes(ev.errorCategory)) rec.errors[ev.errorCategory] = (rec.errors[ev.errorCategory] || 0) + 1;
      if (ev.isFirst) {
        rec.questions++;
        const clean = ev.status === 'correct' && !ev.sawSolution;
        if (ev.status === 'correct') rec.firstAttemptCorrect++;
        pushRecent(rec, clean ? 1 : 0);
        pushDetail(rec, ev.level, !clean ? 'miss' : ev.hintsBefore > 0 ? 'hinted' : 'clean', today, ev.templateId);
      }
      break;
    case 'hint': rec.hintsUsed++; break;
    case 'reveal':
      rec.solutionsShown++;
      if (!ev.hadAttempt) { rec.questions++; pushRecent(rec, 0); pushDetail(rec, ev.level, 'miss', today, ev.templateId); }
      break;
    case 'skip': rec.skipped++; break;
    default: throw new Error(`unknown event ${ev.type}`);
  }
  return p;
}

/** Window accuracy (0..1) or null if no questions. */
function recentAccuracy(rec) {
  if (!rec || !rec.recent.length) return null;
  return rec.recent.reduce((a, b) => a + b, 0) / rec.recent.length;
}

function masteryOf(rec) {
  if (!rec || rec.questions === 0) return 'new';
  const acc = recentAccuracy(rec);
  if (rec.recent.length >= PROGRESS_RULES.masteryMinQuestions && acc >= PROGRESS_RULES.masteryAccuracy) return 'secure';
  return 'learning';
}

/** Called when a session ends: sets the next review date from the recent window. */
function scheduleReview(progress, skillId, today) {
  const p = JSON.parse(JSON.stringify(progress));
  const rec = p.skills[skillId];
  if (!rec || !rec.questions) return p;
  const R = PROGRESS_RULES;
  const acc = recentAccuracy(rec);
  let days;
  if (acc < R.weakBelow) days = R.reviewDaysWeak;
  else if (acc < R.masteryAccuracy || rec.recent.length < R.masteryMinQuestions) days = R.reviewDaysMedium;
  else days = Math.min(R.reviewDaysStrongMax, Math.max(R.reviewDaysStrongMin, rec.intervalDays * 2));
  rec.intervalDays = days;
  rec.nextReview = addDays(today, days);
  return p;
}

/** Skills whose review date is today or earlier, most overdue first. */
function dueSkills(progress, today) {
  return Object.entries(progress.skills)
    .filter(([, r]) => r.nextReview && r.nextReview <= today)
    .sort((a, b) => (a[1].nextReview < b[1].nextReview ? -1 : a[1].nextReview > b[1].nextReview ? 1 : a[0].localeCompare(b[0])))
    .map(([id, r]) => ({ skillId: id, nextReview: r.nextReview }));
}

/** Display-ready stats for one skill. */
function skillStats(progress, skillId) {
  const rec = progress.skills[skillId];
  if (!rec) return { skillId, mastery: 'new', questions: 0 };
  const topError = Object.entries(rec.errors).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    skillId, mastery: masteryOf(rec), questions: rec.questions, attempts: rec.attempts, correct: rec.correct,
    firstAttemptRate: rec.questions ? rec.firstAttemptCorrect / rec.questions : null,
    recentAccuracy: recentAccuracy(rec), hintsUsed: rec.hintsUsed, solutionsShown: rec.solutionsShown,
    lastPractised: rec.lastPractised, nextReview: rec.nextReview, topError: topError ? topError[0] : null, errors: { ...rec.errors },
  };
}

function addReport(progress, report) {
  const p = JSON.parse(JSON.stringify(progress));
  p.reports.push(report);
  if (p.reports.length > PROGRESS_RULES.maxReports) p.reports.splice(0, p.reports.length - PROGRESS_RULES.maxReports);
  return p;
}

const nonNegInt = v => Number.isInteger(v) && v >= 0;
/**
 * Validate imported JSON (an export file or localStorage content).
 * Returns {ok:true, value} with a cleaned copy, or {ok:false, errors}. Unknown fields are dropped.
 */
function validateProgress(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Keine gültige Datei.'] };
  if (obj.schema !== 'mathe7-progress') return { ok: false, errors: ['Diese Datei ist kein Fortschritt der Mathe-7-App.'] };
  if (obj.version !== 1) return { ok: false, errors: [`Unbekannte Version ${obj.version}.`] };
  const out = emptyProgress();
  if (obj.settings && typeof obj.settings === 'object') {
    if (obj.settings.currentChapter === null || typeof obj.settings.currentChapter === 'string') out.settings.currentChapter = obj.settings.currentChapter;
    if (['system', 'light', 'dark'].includes(obj.settings.theme)) out.settings.theme = obj.settings.theme;
    // optional since Session 9; older exports without it import with the filter off
    const cov = validateCoverage(obj.settings.coverage);
    if (cov.ok) out.settings.coverage = cov.value; else errors.push(...cov.errors);
  }
  for (const [id, r] of Object.entries(obj.skills || {})) {
    if (!/^[a-z0-9_.]+$/.test(id) || !r || typeof r !== 'object') { errors.push(`Ungültiger Eintrag ${id}.`); continue; }
    const rec = emptySkill();
    for (const k of ['questions', 'attempts', 'correct', 'firstAttemptCorrect', 'hintsUsed', 'solutionsShown', 'skipped', 'intervalDays']) {
      if (r[k] === undefined) continue;
      if (!nonNegInt(r[k])) errors.push(`${id}.${k} ist keine gültige Zahl.`); else rec[k] = r[k];
    }
    for (const k of ['lastPractised', 'nextReview']) {
      if (r[k] === null || r[k] === undefined) continue;
      if (typeof r[k] !== 'string' || !DATE_RE.test(r[k])) errors.push(`${id}.${k} ist kein Datum.`); else rec[k] = r[k];
    }
    for (const [c, n] of Object.entries(r.errors || {})) {
      if (!ERROR_CATEGORIES.includes(c) || !nonNegInt(n)) errors.push(`${id}: unbekannte Fehlerart ${c}.`); else rec.errors[c] = n;
    }
    if (Array.isArray(r.recent) && r.recent.every(v => v === 0 || v === 1)) rec.recent = r.recent.slice(-PROGRESS_RULES.recentWindow);
    else if (r.recent !== undefined) errors.push(`${id}.recent ist ungültig.`);
    // optional since Session 10 (older exports have neither): per-answer evidence and the review box
    if (r.detail !== undefined) {
      const okDetail = Array.isArray(r.detail) && r.detail.length <= 200 && r.detail.every(x => x && typeof x === 'object' &&
        (x.l === null || (Number.isInteger(x.l) && x.l >= 1 && x.l <= 4)) && OUTCOMES.includes(x.o) && (x.d === null || (typeof x.d === 'string' && DATE_RE.test(x.d))) &&
        (x.t === undefined || (typeof x.t === 'string' && TEMPLATE_ID_RE.test(x.t))));
      if (okDetail) rec.detail = r.detail.slice(-PROGRESS_RULES.detailWindow).map(x => ({ l: x.l, o: x.o, d: x.d, ...(x.t ? { t: x.t } : {}) }));
      else errors.push(`${id}.detail ist ungültig.`);
    }
    if (r.box !== undefined) { if (!nonNegInt(r.box) || r.box > 10) errors.push(`${id}.box ist keine gültige Zahl.`); else rec.box = r.box; }
    if (rec.correct > rec.attempts || rec.firstAttemptCorrect > rec.questions) errors.push(`${id}: Zahlen passen nicht zusammen.`);
    out.skills[id] = rec;
  }
  if (obj.diagnostics !== undefined) {
    const d = validateDiagnostics(obj.diagnostics);
    if (d.ok) out.diagnostics = d.value; else errors.push(...d.errors);
  }
  if (obj.exams !== undefined) {
    const d = validateExamState(obj.exams);
    if (d.ok) out.exams = d.value; else errors.push(...d.errors);
  }
  if (Array.isArray(obj.reports)) out.reports = obj.reports.filter(r => r && r.schema === 'mathe7-report' && typeof r.questionId === 'string').slice(-PROGRESS_RULES.maxReports);
  return errors.length ? { ok: false, errors } : { ok: true, value: out };
}

/** Stored diagnostic results: { chN: { date, skills: { skillId: { verdict, level, n, correct } } } } (latest per chapter only). */
function validateDiagnostics(obj) {
  const bad = { ok: false, errors: ['Die gespeicherte Standortbestimmung ist ungültig.'] };
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return bad;
  const value = {};
  for (const [ch, d] of Object.entries(obj)) {
    if (!/^ch\d{1,2}$/.test(ch) || !d || typeof d !== 'object' || typeof d.date !== 'string' || !DATE_RE.test(d.date) || !d.skills || typeof d.skills !== 'object') return bad;
    const skills = {};
    for (const [id, s] of Object.entries(d.skills)) {
      if (!/^[a-z0-9_.]+$/.test(id) || !s || !DIAG_VERDICTS.includes(s.verdict) || !nonNegInt(s.n) || !nonNegInt(s.correct) || s.correct > s.n ||
        !(s.level === null || (Number.isInteger(s.level) && s.level >= 1 && s.level <= 4))) return bad;
      skills[id] = { verdict: s.verdict, level: s.level, n: s.n, correct: s.correct };
    }
    value[ch] = { date: d.date, skills };
  }
  return { ok: true, value };
}

/**
 * Klassenarbeit-mode state (S11, docs/klassenarbeit-mode.md, docs/privacy.md). Only: the KA date, self-ratings,
 * Zusatz switches, timer, ticked plan days and finished mock rounds (seed, code, points per task). Nothing else.
 *   exams: { ka1: { date, ratings:{itemId:0..3}, zusatz:{id:bool}, timer:0..180, planDone:[date],
 *                   mocks:[{round, seed, code, mode:'screen'|'paper', date, total, max, tasks:{n:points}}] } }
 */
const MAX_MOCKS = 20;
function validateExamState(obj) {
  const bad = what => ({ ok: false, errors: [`Die gespeicherten Daten zur Klassenarbeit sind ungültig (${what}).`] });
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return bad('Format');
  const half = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 200 && Math.round(x * 2) === x * 2;
  const value = {};
  for (const [id, e] of Object.entries(obj)) {
    if (!/^[a-z0-9_]{1,20}$/.test(id) || !e || typeof e !== 'object') return bad('Kennung');
    const v = { date: null, ratings: {}, zusatz: {}, timer: 0, planDone: [], mocks: [] };
    if (e.date !== undefined && e.date !== null) { if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) return bad('Datum'); v.date = e.date; }
    for (const [k, r] of Object.entries(e.ratings || {})) { if (!/^[a-z0-9_.]{1,40}$/.test(k) || ![0, 1, 2, 3].includes(r)) return bad('Selbsteinschätzung'); v.ratings[k] = r; }
    for (const [k, z] of Object.entries(e.zusatz || {})) { if (!/^[a-z0-9_]{1,40}$/.test(k) || typeof z !== 'boolean') return bad('Zusatz'); v.zusatz[k] = z; }
    if (e.timer !== undefined) { if (!nonNegInt(e.timer) || e.timer > 180) return bad('Zeit'); v.timer = e.timer; }
    if (e.planDone !== undefined) {
      if (!Array.isArray(e.planDone) || e.planDone.length > 200 || !e.planDone.every(d => typeof d === 'string' && DATE_RE.test(d))) return bad('Lernplan');
      v.planDone = [...new Set(e.planDone)].sort();
    }
    if (e.mocks !== undefined) {
      if (!Array.isArray(e.mocks)) return bad('Runden');
      for (const m of e.mocks.slice(-MAX_MOCKS)) {
        if (!m || ![1, 2].includes(m.round) || !nonNegInt(m.seed) || m.seed > 0xffffffff || typeof m.code !== 'string' || !/^KA-[0-9A-F]{6}$/.test(m.code) ||
          !['screen', 'paper'].includes(m.mode) || typeof m.date !== 'string' || !DATE_RE.test(m.date) || !half(m.total) || !half(m.max) || m.total > m.max ||
          !m.tasks || typeof m.tasks !== 'object') return bad('Runde');
        const tasks = {};
        for (const [n, pts] of Object.entries(m.tasks)) { if (!/^\d{1,2}$/.test(n) || !half(pts)) return bad('Punkte'); tasks[n] = pts; }
        v.mocks.push({ round: m.round, seed: m.seed, code: m.code, mode: m.mode, date: m.date, total: m.total, max: m.max, tasks });
      }
    }
    value[id] = v;
  }
  return { ok: true, value };
}

module.exports = {
  OUTCOMES, DIAG_VERDICTS, validateDiagnostics, validateExamState, MAX_MOCKS,
  PROGRESS_RULES, MASTERY_LABELS_DE, emptyProgress, applyEvent, recentAccuracy, masteryOf, scheduleReview,
  dueSkills, skillStats, addReport, validateProgress, addDays,
};
