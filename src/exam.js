'use strict';
/**
 * exam.js — Klassenarbeit mode („KA vorbereiten“), pure: no DOM, no storage, no clock (dates are passed in).
 * Spec: docs/klassenarbeit-mode.md. Blueprints are data (exams.json, inlined by build.js); the UI passes them in.
 *
 * Every mock-test question is an ordinary canonical Question from the template registry (same validation,
 * hints and worked solutions). A mock test is reproducible from (examId, round, seed, engineVersion, zusatz);
 * its record stores the question ids, like a worksheet, so it reloads exactly or refuses ('outdated').
 *
 * API
 *   listExams(file)                                   → [{id, title, defaultDate}]
 *   validateBlueprint(bp)                             → [error strings] (empty = usable)
 *   itemPractice(bp, itemId, options)                 → [{skillId, filter:{templates, levels}}]  („Üben“ buttons)
 *   buildMock(bp, round, seed, options)               → {record, tasks:[{n,title,item,points,partPoints,questions}]}
 *   loadMock(bp, record)                              → {ok, mock} | {ok:false, reason, message}
 *   scoreMock(mock, answers)                          → screen mode: points per task / item; invalid ≠ wrong
 *   scorePaper(mock, marks)                           → paper mode: self-marked points per task
 *   itemStatus(bp, progress, ratings, options)        → per item {rating, attempts, firstTry, firstTryRate, mismatch, open, weakness}
 *   buildStudyPlan(bp, status, today, examDate, params) → days[]
 * Tunable parameters: KA_RULES (docs/adaptive-rules.md, section „Klassenarbeit mode“).
 */
const { Rng, deriveSeed, hashHex } = require('./core');
const Q = require('./question');
const T = require('./templates');
const W = require('./worksheet');

const KA_RULES = Object.freeze({
  minEvidence: 5,           // answers needed before the app result is compared with the self-rating
  overconfidentRating: 2,   // rating ≥ this …
  overconfidentBelow: 0.5,  // … and first-try rate below this → neutral note
  underconfidentRating: 1,  // rating ≤ this …
  underconfidentFrom: 0.8,  // … and first-try rate at least this → neutral note
  closedFrom: 0.8,          // item counts as „sitzt“ when the combined score reaches this with enough evidence
  minutesPerDay: 20,        // study plan: suggested minutes per day
  minutesPerItem: 10,       // study plan: minutes for one item
  noNewItemsLastDays: 2,    // study plan: no new items in the last N days before the KA
  maxTriesPerPart: 60,
});

const RESULT_LABELS_DE = Object.freeze({ correct: 'richtig', wrong: 'falsch', invalid: 'ungültige Eingabe', empty: 'keine Antwort' });
const MISMATCH_NOTE_DE = Object.freeze({
  overconfident: (r, n) => `Du schätzt dich sicher ein, in der App waren es zuletzt ${r} von ${n}. Noch eine Runde üben?`,
  underconfident: (r, n) => `Du bist unsicher, in der App waren es aber ${r} von ${n} richtig beim ersten Versuch. Das klappt schon gut!`,
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  const t = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}
/** Days from today until the exam date (0 = today, negative = past). */
function daysUntil(today, examDate) { return daysBetween(today, examDate); }

function listExams(file) {
  return (file && Array.isArray(file.exams) ? file.exams : []).map(e => ({ id: e.id, title: e.title, defaultDate: e.defaultDate }));
}
function findItem(bp, id) { return bp.items.find(it => it.id === id); }
const zusatzOn = (bp, options, id) => {
  const z = options && options.zusatz && Object.prototype.hasOwnProperty.call(options.zusatz, id) ? options.zusatz[id] : undefined;
  if (z !== undefined) return !!z;
  const def = (bp.zusatz || []).find(x => x.id === id);
  return def ? def.defaultOn !== false : true;
};

/** Skill targets of an item, expanded (fromItems resolved), optional targets dropped when switched off. */
function itemTargets(bp, item, options) {
  const out = [];
  for (const t of item.targets || []) {
    if (t.fromItems) {
      for (const id of t.fromItems) for (const sub of itemTargets(bp, findItem(bp, id), options)) out.push({ ...sub, levels: t.levels });
    } else {
      if (t.optional && !zusatzOn(bp, options, t.id)) continue;
      out.push({ skill: t.skill, families: t.families, levels: t.levels });
    }
  }
  return out;
}
/** Templates of one target at any of its levels. */
function targetTemplates(target) {
  return T.templatesForSkill(target.skill).filter(t => t.families.some(f => target.families.includes(f)) && t.levels.some(l => target.levels.includes(l)));
}

/** „Üben“ buttons for an item: one per skill, with the template/level filter for practice.createSession. */
function itemPractice(bp, itemId, options) {
  const item = findItem(bp, itemId);
  if (!item) return [];
  const bySkill = new Map();
  for (const tg of itemTargets(bp, item, options)) {
    const e = bySkill.get(tg.skill) || { skillId: tg.skill, templates: new Set(), levels: new Set() };
    for (const t of targetTemplates(tg)) { e.templates.add(t.id); for (const l of t.levels) if (tg.levels.includes(l)) e.levels.add(l); }
    bySkill.set(tg.skill, e);
  }
  return [...bySkill.values()].filter(e => e.templates.size)
    .map(e => ({ skillId: e.skillId, filter: { templates: [...e.templates].sort(), levels: [...e.levels].sort() } }));
}

/** Candidate templates for a mock task: families of the task inside the targets of its item, at the task level. */
function taskPool(bp, task, options) {
  const item = findItem(bp, task.item);
  if (!item) return [];
  const ids = new Set();
  for (const tg of itemTargets(bp, item, { ...options, zusatz: { ...(options && options.zusatz), ...(task.optional ? { [task.optional]: true } : {}) } })) {
    for (const t of T.templatesForSkill(tg.skill, task.level)) {
      if (t.families.some(f => task.families.includes(f) && tg.families.includes(f))) ids.add(t.id);
    }
  }
  return T.TEMPLATES.filter(t => ids.has(t.id)); // registry order → deterministic
}

/** Structural and semantic checks of a blueprint against the template registry. */
function validateBlueprint(bp) {
  const errors = [];
  if (!bp || typeof bp.id !== 'string' || !Array.isArray(bp.items)) return ['blueprint: id/items missing'];
  if (!DATE_RE.test(bp.defaultDate || '')) errors.push('defaultDate must be YYYY-MM-DD');
  const ids = bp.items.map(i => i.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate item id');
  const skills = new Set(T.skillsWithTemplates());
  for (const it of bp.items) {
    for (const tg of it.targets || []) {
      if (tg.fromItems) { for (const id of tg.fromItems) if (!findItem(bp, id)) errors.push(`${it.id}: unknown item ${id}`); continue; }
      if (!skills.has(tg.skill)) { errors.push(`${it.id}: skill ${tg.skill} has no templates`); continue; }
      for (const f of tg.families) {
        if (!T.templatesForSkill(tg.skill).some(t => t.families.includes(f) && t.levels.some(l => tg.levels.includes(l)))) errors.push(`${it.id}: no template for ${tg.skill}/${f} at levels ${tg.levels}`);
      }
      if (tg.optional && !(bp.zusatz || []).some(z => z.id === tg.id)) errors.push(`${it.id}: optional target without zusatz entry`);
      for (const ex of it.excluded || []) if (ex.skill === tg.skill && ex.families.some(f => tg.families.includes(f))) errors.push(`${it.id}: excluded family in a target`);
    }
  }
  const mock = bp.mock;
  if (!mock || !Array.isArray(mock.tasks) || !mock.tasks.length) errors.push('mock.tasks missing');
  else {
    const ns = mock.tasks.map(t => t.n);
    if (new Set(ns).size !== ns.length) errors.push('duplicate task number');
    for (const t of mock.tasks) {
      if (!findItem(bp, t.item)) errors.push(`task ${t.n}: unknown item`);
      if (!Number.isInteger(t.parts) || t.parts < 1 || !Number.isInteger(t.points) || t.points < 1) errors.push(`task ${t.n}: bad parts/points`);
      else if ((t.points * 2) % t.parts !== 0) errors.push(`task ${t.n}: points must split into half points`);
      if (!taskPool(bp, t, {}).length) errors.push(`task ${t.n}: no template for its families at L${t.level}`);
      if (t.optional && !(bp.zusatz || []).some(z => z.id === t.optional)) errors.push(`task ${t.n}: unknown zusatz ${t.optional}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- mock tests
function normOptions(bp, options) {
  const zusatz = {};
  for (const z of bp.zusatz || []) zusatz[z.id] = zusatzOn(bp, options, z.id);
  return { zusatz };
}
function activeTasks(bp, opts) { return bp.mock.tasks.filter(t => !t.optional || opts.zusatz[t.optional]); }
function partPoints(task) { return Array.from({ length: task.parts }, () => task.points / task.parts); }
function mockCode(record) {
  return 'KA-' + hashHex(Q.canonicalJSON({ e: record.examId, r: record.round, s: record.seed, z: record.options, q: record.tasks.map(t => t.qids) })).slice(0, 6).toUpperCase();
}

/** Build a mock test (deterministic). Throws GenerationError if a task cannot be filled without duplicates. */
function buildMock(bp, round, seed, options, engineVersion) {
  if (!Number.isInteger(round) || round < 1 || round > (bp.mock.rounds || 2)) throw new RangeError('bad round');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be a uint32');
  const opts = normOptions(bp, options);
  const base = deriveSeed(seed, round);
  const seen = new Set();
  let cursor = 3000;
  const tasks = activeTasks(bp, opts).map(task => {
    const pool = taskPool(bp, task, opts);
    const questions = [];
    for (let k = 0; k < task.parts; k++) {
      let q = null;
      for (let tries = 0; tries < KA_RULES.maxTriesPerPart && !q; tries++) {
        const s = deriveSeed(base, cursor++);
        const t = pool[new Rng(s).int(0, pool.length - 1)];
        const cand = Q.generate(t, s, task.level);
        if (!seen.has(cand.signature)) q = cand;
      }
      if (!q) throw new Q.GenerationError(`mock task ${task.n}: no unseen question`);
      seen.add(q.signature);
      questions.push(q);
    }
    return { n: task.n, title: task.title, item: task.item, level: task.level, points: task.points, partPoints: partPoints(task), optional: !!task.optional, questions };
  });
  const record = {
    schema: 'mathe7-mock', version: 1, examId: bp.id, round, seed: seed >>> 0, options: opts, engineVersion: engineVersion || null,
    tasks: tasks.map(t => ({ n: t.n, qids: t.questions.map(q => q.id), signatures: t.questions.map(q => q.signature) })),
  };
  record.code = mockCode(record);
  return { record, tasks, disclaimer: bp.disclaimer, title: bp.title, round, maxPoints: tasks.reduce((a, t) => a + t.points, 0) };
}

/** Rebuild a stored mock test from its question ids. Never throws. */
function loadMock(bp, record) {
  if (!record || record.schema !== 'mathe7-mock' || record.version !== 1 || record.examId !== bp.id || !Array.isArray(record.tasks)) return { ok: false, reason: 'invalid', message: 'Die gespeicherte Übungs-Klassenarbeit ist beschädigt.' };
  const opts = normOptions(bp, record.options);
  const active = activeTasks(bp, opts);
  if (active.length !== record.tasks.length) return { ok: false, reason: 'outdated', message: 'Die Aufgabenliste der Klassenarbeit hat sich geändert. Starte eine neue Runde.' };
  const tasks = [];
  for (let i = 0; i < active.length; i++) {
    const task = active[i], rt = record.tasks[i];
    if (rt.n !== task.n || !Array.isArray(rt.qids) || rt.qids.length !== task.parts) return { ok: false, reason: 'outdated', message: 'Die Aufgabenliste der Klassenarbeit hat sich geändert. Starte eine neue Runde.' };
    const questions = [];
    for (let k = 0; k < rt.qids.length; k++) {
      let q;
      try { q = T.regenerateQuestion(rt.qids[k]); } catch (e) { return { ok: false, reason: 'outdated', message: 'Diese Runde wurde mit einer älteren Version der Aufgaben erstellt. Starte eine neue Runde.' }; }
      if (q.signature !== rt.signatures[k]) return { ok: false, reason: 'outdated', message: 'Eine Aufgabe dieser Runde hat sich geändert. Starte eine neue Runde.' };
      questions.push(q);
    }
    tasks.push({ n: task.n, title: task.title, item: task.item, level: task.level, points: task.points, partPoints: partPoints(task), optional: !!task.optional, questions });
  }
  if (mockCode(record) !== record.code) return { ok: false, reason: 'invalid', message: 'Der Code der Übungs-Klassenarbeit passt nicht zum Inhalt.' };
  return { ok: true, mock: { record, tasks, disclaimer: bp.disclaimer, title: bp.title, round: record.round, maxPoints: tasks.reduce((a, t) => a + t.points, 0) } };
}

function isEmptyInput(raw) {
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'string') return raw.trim() === '';
  if (Array.isArray(raw)) return raw.length === 0;
  if (typeof raw === 'object') return Object.values(raw).every(v => v === undefined || v === null || String(v).trim() === '');
  return false;
}
function summarizeByItem(tasks) {
  const items = {};
  for (const t of tasks) {
    const e = items[t.item] || (items[t.item] = { points: 0, max: 0, tasks: [] });
    e.points += t.points; e.max += t.max; e.tasks.push(t.n);
  }
  return items;
}

/**
 * Screen mode. answers: {qid: raw input}. A part scores its share when evaluate says correct; invalid input
 * scores 0 and is labelled „ungültige Eingabe“ (not „falsch“); no input → „keine Antwort“.
 */
function scoreMock(mock, answers) {
  const a = answers || {};
  const tasks = mock.tasks.map(task => {
    const parts = task.questions.map((q, k) => {
      const raw = a[q.id];
      let status;
      if (isEmptyInput(raw)) status = 'empty';
      else {
        const r = Q.evaluateQuestion(q, raw);
        status = r.status === 'correct' ? 'correct' : r.status === 'invalid' ? 'invalid' : 'wrong';
      }
      const max = task.partPoints[k];
      return { qid: q.id, status, label: RESULT_LABELS_DE[status], points: status === 'correct' ? max : 0, max };
    });
    return { n: task.n, title: task.title, item: task.item, points: parts.reduce((s, p) => s + p.points, 0), max: task.points, parts };
  });
  return { mode: 'screen', tasks, total: tasks.reduce((s, t) => s + t.points, 0), max: tasks.reduce((s, t) => s + t.max, 0), items: summarizeByItem(tasks) };
}

/** Paper mode. marks: {n: points} entered by the student from the answer key (0…max in half points). */
function scorePaper(mock, marks) {
  const m = marks || {};
  const errors = [];
  const tasks = mock.tasks.map(task => {
    let p = m[task.n];
    if (p === undefined || p === null || p === '') p = 0;
    p = Number(p);
    if (!Number.isFinite(p) || p < 0 || p > task.points || Math.round(p * 2) !== p * 2) { errors.push(task.n); p = 0; }
    return { n: task.n, title: task.title, item: task.item, points: p, max: task.points, parts: [] };
  });
  return { mode: 'paper', tasks, errors, total: tasks.reduce((s, t) => s + t.points, 0), max: tasks.reduce((s, t) => s + t.max, 0), items: summarizeByItem(tasks) };
}

/**
 * Print data for a mock test through the existing worksheet path (student sheet + answer key from the SAME
 * instances). Adds the task structure: tasks:[{n, title, points, partPoints, parts:[index into student/key]}].
 * Sub-parts are labelled a), b) …; `label` is set on every student/key entry.
 */
function mockPrintLayout(mock, opts) {
  const o = opts || {};
  const questions = mock.tasks.flatMap(t => t.questions);
  const skills = [...new Set(questions.map(q => q.skillId))];
  const pseudo = {
    code: mock.record.code,
    spec: { title: `${mock.title} – Übungs-Klassenarbeit, Runde ${mock.round}`, keyMode: o.keyMode === 'answers' ? 'answers' : 'worked',
      space: W.SPACE_OPTIONS.includes(o.space) ? o.space : 'medium', nameField: o.nameField !== false, dateField: o.dateField !== false,
      count: questions.length, skills },
    items: questions.map(q => ({ qid: q.id })),
  };
  const L = W.worksheetLayout(pseudo, questions);
  let i = 0;
  const tasks = mock.tasks.map(t => {
    const parts = t.questions.map((_, k) => {
      const label = t.questions.length > 1 ? `${t.n}${'abcdefgh'[k]})` : `${t.n}.`;
      L.student[i].label = label; L.key[i].label = label;
      return i++;
    });
    return { n: t.n, title: t.title, points: t.points, partPoints: t.partPoints.slice(), optional: t.optional, parts };
  });
  return { ...L, tasks, disclaimer: mock.disclaimer, maxPoints: mock.maxPoints, round: mock.round };
}

// ---------------------------------------------------------------- item status
/** Per-item status from progress detail entries whose template belongs to the item (entries from S11 on carry `t`). */
function itemStatus(bp, progress, ratings, options) {
  const R = KA_RULES;
  const rs = ratings || {};
  return bp.items.map(item => {
    const rating = [0, 1, 2, 3].includes(rs[item.id]) ? rs[item.id] : null;
    const base = { itemId: item.id, kind: item.kind, rating };
    if (item.kind !== 'skill' && item.kind !== 'mixed') return base;
    const groups = itemPractice(bp, item.id, options);
    let attempts = 0, firstTry = 0, untracked = 0, last = null;
    for (const g of groups) {
      const rec = progress && progress.skills && progress.skills[g.skillId];
      for (const e of (rec && rec.detail) || []) {
        if (!e.t) { untracked++; continue; }
        if (!g.filter.templates.includes(e.t)) continue;
        if (item.kind === 'mixed' && !g.filter.levels.includes(e.l)) continue;
        attempts++;
        if (e.o === 'clean' || e.o === 'hinted') firstTry++;
        if (e.d && (!last || e.d > last)) last = e.d;
      }
    }
    const firstTryRate = attempts ? firstTry / attempts : null;
    let mismatch = null;
    if (rating !== null && attempts >= R.minEvidence) {
      if (rating >= R.overconfidentRating && firstTryRate < R.overconfidentBelow) mismatch = 'overconfident';
      else if (rating <= R.underconfidentRating && firstTryRate >= R.underconfidentFrom) mismatch = 'underconfident';
    }
    const parts = [];
    if (rating !== null) parts.push(rating / 3);
    if (attempts >= R.minEvidence) parts.push(firstTryRate);
    const weakness = parts.length ? 1 - parts.reduce((s, x) => s + x, 0) / parts.length : 1;
    const open = !(attempts >= R.minEvidence && 1 - weakness >= R.closedFrom);
    return { ...base, attempts, firstTry, firstTryRate, untracked, lastPractised: last, mismatch,
      mismatchNote: mismatch ? MISMATCH_NOTE_DE[mismatch](firstTry, attempts) : null, weakness, open, practice: groups };
  });
}

// ---------------------------------------------------------------- study plan
/**
 * Suggestion only. days[] = {date, kind:'practice'|'review'|'final', items:[itemId], mockRound?:1|2, minutes, note?}
 * Rules (KA_RULES): weakest open skill items first; about minutesPerDay per day; no new items in the last
 * noNewItemsLastDays days; the day before the KA is a mixed review + Runde 2; Runde 1 on the last practice day.
 * If there are not enough days, items are packed tighter (`overBudget`) or moved into the review days (`compressed`)
 * so that every open item is still scheduled before the date. Empty when the date is today or past.
 */
function buildStudyPlan(bp, status, today, examDate, params) {
  const P = { ...KA_RULES, ...(params || {}) };
  if (!DATE_RE.test(today) || !DATE_RE.test(examDate)) throw new RangeError('dates must be YYYY-MM-DD');
  const n = daysBetween(today, examDate);
  if (n <= 0) return [];
  const dates = Array.from({ length: n }, (_, i) => addDays(today, i));
  const skillItems = status.filter(s => s.kind === 'skill');
  const order = (a, b) => b.weakness - a.weakness || bp.items.findIndex(i => i.id === a.itemId) - bp.items.findIndex(i => i.id === b.itemId);
  const open = skillItems.filter(s => s.open).slice().sort(order).map(s => s.itemId);
  const weakestAll = skillItems.slice().sort(order).map(s => s.itemId);
  const perDay = Math.max(1, Math.floor(P.minutesPerDay / P.minutesPerItem));
  const reserved = Math.min(P.noNewItemsLastDays, n);
  const regular = dates.slice(0, n - reserved);
  const days = dates.map(date => ({ date, kind: 'practice', items: [], minutes: 0 }));
  const final = days[n - 1];
  final.kind = 'final'; final.mockRound = 2;
  for (let i = n - reserved; i < n - 1; i++) days[i].kind = 'review';
  if (regular.length) {
    const per = Math.max(perDay, Math.ceil(open.length / regular.length));
    open.forEach((id, i) => { days[Math.floor(i / per)].items.push(id); });
    if (per > perDay) for (const d of days.slice(0, regular.length)) if (d.items.length > perDay) d.overBudget = true;
    days[regular.length - 1].mockRound = 1;
  } else {
    // fewer days than the reserved window: everything goes into the remaining days (compressed)
    const targets = days;
    open.forEach((id, i) => { targets[i % targets.length].items.push(id); targets[i % targets.length].compressed = true; });
    if (n >= 2) days[0].mockRound = 1;
  }
  // free practice days: second round through the items, weakest first (rotating)
  const cycle = open.length ? open : weakestAll;
  let rot = 0;
  for (const d of days) {
    if (d.kind !== 'practice' || d.items.length || d.mockRound) continue;
    for (let k = 0; k < Math.min(perDay, cycle.length); k++) d.items.push(cycle[rot++ % cycle.length]);
    d.repeat = true;
  }
  // review days: repeat the weakest items; final day: mixed review of the two weakest
  for (const d of days) {
    if (d.kind === 'review') for (const id of open.slice(0, perDay)) if (!d.items.includes(id)) d.items.push(id);
    if (d.kind === 'final') for (const id of weakestAll.slice(0, perDay)) if (!d.items.includes(id)) d.items.push(id);
    d.minutes = d.items.length * P.minutesPerItem + (d.mockRound ? 45 : 0);
  }
  return days;
}

module.exports = {
  KA_RULES, RESULT_LABELS_DE, listExams, validateBlueprint, itemPractice, taskPool, buildMock, loadMock,
  scoreMock, scorePaper, mockPrintLayout, itemStatus, buildStudyPlan, daysUntil, addDaysKa: addDays,
};
