'use strict';
/**
 * worksheet.js — printable worksheets and answer keys (pure, JSON-serialisable, no DOM).
 *
 * One canonical Question object powers practice AND print: a worksheet is just a list of question ids
 * produced by the same generate → independently solve → validate pipeline. Nothing is re-implemented here;
 * this module only chooses (skill, level, seed) per slot and turns Question objects into print layout data.
 *
 * WorksheetSpec (settings; everything needed to reproduce the sheet):
 *   { skills:[skillId…] (1–12, unique, practicable), levels:[1..4] (non-empty subset), count:1–30,
 *     baseSeed:uint32, title:string(≤80), keyMode:'answers'|'worked', space:'none'|'small'|'medium'|'large',
 *     nameField:bool, dateField:bool }
 *   Name and date are printed as EMPTY lines to fill in by hand; they are never typed in or stored.
 *
 * Worksheet record (what the UI stores):
 *   { schema:'mathe7-worksheet', version:1, code, spec, items:[{number, qid, signature, skillId, level}] }
 *   `qid` contains template id + template version + level + seed, so the key is regenerated exactly; if a
 *   template version changed, loadWorksheet() refuses instead of silently printing a different sheet.
 *
 * Level mix: the selected levels are spread as an ascending ramp over the sheet (easy first). Each slot takes
 * the next skill (round-robin) that HAS that level; if no selected skill has it, the nearest level of the next
 * skill is used and the item is flagged `levelAdjusted` (see docs/decisions.md D39).
 */
const { Rng, deriveSeed, hashHex, Fraction } = require('./core');
const Q = require('./question');
const T = require('./templates');
const U = require('./templates/util');
const X = require('./expr');

const WORKSHEET_LIMITS = Object.freeze({ minCount: 1, maxCount: 30, maxSkills: 40, maxTitle: 80 });
const WORKSHEET_COUNTS = Object.freeze([4, 6, 8, 10, 12, 16, 20]);
const SPACE_OPTIONS = Object.freeze(['none', 'small', 'medium', 'large']);
const KEY_MODES = Object.freeze(['answers', 'worked']);
const SPACE_LABELS_DE = Object.freeze({ none: 'Kein Rechenplatz', small: 'Kariert, klein (3 Kästchen hoch)', medium: 'Kariert, mittel (6 Kästchen hoch)', large: 'Kariert, groß (10 Kästchen hoch)' });
const KEY_MODE_LABELS_DE = Object.freeze({ answers: 'Nur Ergebnisse', worked: 'Mit Lösungsweg' });
const DEFAULT_TITLE_DE = 'Arbeitsblatt Mathematik';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_TRIES_PER_SLOT = 60;

const PAPER_INSTRUCTIONS_DE = Object.freeze({
  choice: 'Kreuze genau eine Antwort an.',
  multiselect: 'Kreuze alle passenden Antworten an.',
  ordering: 'Schreibe die Buchstaben in der richtigen Reihenfolge auf.',
  table: 'Fülle die leeren Felder aus.',
  solution_set: 'Kreuze an. Bei genau einer Lösung trage sie auch ein.',
});
/** Paper labels for the three solution-set choices (student sheet). */
const SOLUTION_SET_CHOICES_DE = Object.freeze([
  { kind: 'one', text: 'genau eine Lösung:' },
  { kind: 'none', text: 'keine Lösung' },
  { kind: 'all', text: 'unendlich viele Lösungen (jede Zahl ist eine Lösung)' },
]);

// ---------------------------------------------------------------- spec
/** Validate and normalise user settings. Returns {ok, value, errors}. Never throws. */
function normalizeWorksheetSpec(input) {
  const errors = [];
  const s = input && typeof input === 'object' ? input : {};
  const practicable = new Set(T.skillsWithTemplates());
  const skills = Array.isArray(s.skills) ? s.skills.filter(x => typeof x === 'string') : [];
  if (!skills.length) errors.push('Wähle mindestens ein Thema.');
  if (new Set(skills).size !== skills.length) errors.push('Ein Thema ist doppelt gewählt.');
  if (skills.length > WORKSHEET_LIMITS.maxSkills) errors.push(`Höchstens ${WORKSHEET_LIMITS.maxSkills} Themen.`);
  for (const id of skills) if (!practicable.has(id)) errors.push(`Für das Thema ${id} gibt es noch keine Aufgaben.`);
  const levels = Array.isArray(s.levels) ? [...new Set(s.levels)].sort((a, b) => a - b) : [];
  if (!levels.length) errors.push('Wähle mindestens eine Stufe.');
  if (levels.some(l => ![1, 2, 3, 4].includes(l))) errors.push('Ungültige Stufe.');
  const count = s.count;
  if (!Number.isInteger(count) || count < WORKSHEET_LIMITS.minCount || count > WORKSHEET_LIMITS.maxCount) errors.push(`Anzahl muss zwischen ${WORKSHEET_LIMITS.minCount} und ${WORKSHEET_LIMITS.maxCount} liegen.`);
  if (!Number.isInteger(s.baseSeed) || s.baseSeed < 0 || s.baseSeed > 0xffffffff) errors.push('baseSeed must be a uint32');
  const title = (typeof s.title === 'string' ? s.title : '').replace(/\s+/g, ' ').trim().slice(0, WORKSHEET_LIMITS.maxTitle) || DEFAULT_TITLE_DE;
  const keyMode = s.keyMode === undefined ? 'answers' : s.keyMode;
  if (!KEY_MODES.includes(keyMode)) errors.push('Ungültige Art des Lösungsblatts.');
  const space = s.space === undefined ? 'small' : s.space;
  if (!SPACE_OPTIONS.includes(space)) errors.push('Ungültiger Rechenplatz.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], value: { skills: skills.slice(), levels, count, baseSeed: s.baseSeed >>> 0, title, keyMode, space, nameField: s.nameField !== false, dateField: s.dateField !== false } };
}

/** Short code printed on both sheets so student sheet and key can be matched ("AB-1A2B3C"). */
function worksheetCode(spec, items) {
  return 'AB-' + hashHex(Q.canonicalJSON({ spec, q: items.map(i => i.qid) })).slice(0, 6).toUpperCase();
}

// ---------------------------------------------------------------- planning
/** Ascending ramp over the chosen levels, e.g. levels [1,3], count 5 → 1,1,1,3,3. */
function rampLevels(levels, count) {
  return Array.from({ length: count }, (_, i) => levels[Math.floor(i * levels.length / count)]);
}
function nearestLevel(available, want) {
  return available.slice().sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b)[0];
}
/**
 * Slot plan: [{skillId, level, levelAdjusted}] — deterministic from the spec.
 * `levelsOf` is injectable for tests (all Ch1 skills currently cover L1–L4, so the fallback needs a stub).
 */
function planWorksheet(spec, levelsOf = T.levelsForSkill) {
  const rng = new Rng(deriveSeed(spec.baseSeed, 7));
  const order = rng.shuffle(spec.skills.slice());
  let rot = 0;
  return rampLevels(spec.levels, spec.count).map(level => {
    for (let k = 0; k < order.length; k++) {
      const skillId = order[(rot + k) % order.length];
      if (levelsOf(skillId).includes(level)) { rot = (rot + k + 1) % order.length; return { skillId, level, levelAdjusted: false }; }
    }
    const skillId = order[rot % order.length];
    rot = (rot + 1) % order.length;
    return { skillId, level: nearestLevel(levelsOf(skillId), level), levelAdjusted: true };
  });
}

// ---------------------------------------------------------------- create / load
function pickFor(skillId, level, baseSeed, cursor, seen) {
  const pool = T.templatesForSkill(skillId, level);
  if (!pool.length) throw new Q.GenerationError(`no template for ${skillId} L${level}`);
  for (let k = 0; k < MAX_TRIES_PER_SLOT; k++) {
    const seed = deriveSeed(baseSeed, cursor + k);
    const t = pool[new Rng(seed).int(0, pool.length - 1)];
    const q = Q.generate(t, seed, level);
    if (!seen.has(q.signature)) return { q, used: k + 1 };
  }
  throw new Q.GenerationError(`worksheet: no unseen question for ${skillId} L${level}`);
}

/**
 * Create a worksheet from settings. Throws RangeError (with .errors) for invalid settings.
 * Returns {worksheet, questions}; questions are in sheet order (questions[i] ↔ items[i]).
 */
function createWorksheet(specInput) {
  const n = normalizeWorksheetSpec(specInput);
  if (!n.ok) { const e = new RangeError(n.errors.join(' ')); e.errors = n.errors; throw e; }
  const spec = n.value;
  const seen = new Set();
  const items = [], questions = [];
  let cursor = 2000;
  planWorksheet(spec).forEach((slot, i) => {
    const { q, used } = pickFor(slot.skillId, slot.level, spec.baseSeed, cursor, seen);
    cursor += used;
    seen.add(q.signature);
    items.push({ number: i + 1, qid: q.id, signature: q.signature, skillId: q.skillId, level: q.level, levelAdjusted: slot.levelAdjusted });
    questions.push(q);
  });
  const worksheet = { schema: 'mathe7-worksheet', version: 1, code: worksheetCode(spec, items), spec, items };
  return { worksheet, questions };
}

/** Structural check of a stored record. */
function isValidWorksheet(w) {
  if (!w || w.schema !== 'mathe7-worksheet' || w.version !== 1 || typeof w.code !== 'string') return false;
  if (!normalizeWorksheetSpec(w.spec).ok || !Array.isArray(w.items) || w.items.length !== w.spec.count) return false;
  return w.items.every((it, i) => it && it.number === i + 1 && typeof it.qid === 'string' && T.parseQuestionId(it.qid) && typeof it.signature === 'string');
}

/**
 * Rebuild the questions of a stored worksheet. Returns {ok:true, worksheet, questions} or
 * {ok:false, reason:'invalid'|'outdated', message}. Never throws.
 */
function loadWorksheet(record) {
  if (!isValidWorksheet(record)) return { ok: false, reason: 'invalid', message: 'Das gespeicherte Arbeitsblatt ist unvollständig oder beschädigt.' };
  const questions = [];
  for (const it of record.items) {
    let q;
    try { q = T.regenerateQuestion(it.qid); }
    catch (e) { return { ok: false, reason: 'outdated', message: 'Dieses Arbeitsblatt wurde mit einer älteren Version der Aufgaben erstellt und kann nicht genau so wiederhergestellt werden. Erstelle es neu.' }; }
    if (q.signature !== it.signature) return { ok: false, reason: 'outdated', message: 'Eine Aufgabe dieses Arbeitsblatts hat sich geändert. Erstelle das Blatt neu.' };
    questions.push(q);
  }
  if (worksheetCode(record.spec, record.items) !== record.code) return { ok: false, reason: 'invalid', message: 'Der Code des Arbeitsblatts passt nicht zum Inhalt.' };
  return { ok: true, worksheet: record, questions };
}

// ---------------------------------------------------------------- print layout
function numberSpecTex(spec) {
  if (spec.type === 'expression') return X.toLatex(X.parse(spec.value, { variables: spec.variables }));
  if (spec.places !== undefined) return Fraction.of(spec.value).toDecimalString(spec.places, '{,}');
  return U.numTex(spec.value, { dec: spec.type === 'decimal' });
}
/** Unit after a number on paper: "€", "%" … (plain text, outside the formula). */
const unitSuffix = spec => (spec.unit ? ` ${spec.unit}` : '');
const lettered = list => list.map((o, i) => ({ letter: LETTERS[i], id: o.id, text: o.text }));

/** What the student sees on paper for one answer spec (no correct answer in here). */
function responseLayout(spec) {
  switch (spec.type) {
    case 'choice':
    case 'multiselect':
      return { kind: 'choice', multiple: spec.type === 'multiselect', options: lettered(spec.options).map(({ letter, text }) => ({ letter, text })) };
    case 'ordering':
      return { kind: 'ordering', items: lettered(spec.items).map(({ letter, text }) => ({ letter, text })), slots: spec.items.length };
    case 'table':
      if (spec.grid) {
        return { kind: 'grid', columns: spec.grid.columns.slice(), rows: spec.grid.rows.map(row => row.map(e => (e.cell ? { blank: true } : { text: e.text }))) };
      }
      return { kind: 'table', cells: spec.cells.map((c, i) => ({ label: c.label || `Feld ${i + 1}` })) };
    case 'solution_set':
      return { kind: 'solution_set', variable: spec.variable || 'x', choices: SOLUTION_SET_CHOICES_DE.map(c => ({ ...c })) };
    default: {
      const line = spec.variable ? { kind: 'line', variable: spec.variable } : { kind: 'line' };
      if (spec.unit) line.unit = spec.unit;
      return line;
    }
  }
}

/** Answer-key entry for one question, derived from the same Question object. */
function keyEntry(q, number, worked) {
  const a = q.answer;
  const entry = { number, qid: q.id, level: q.level, result: q.solution.result, steps: worked ? q.solution.steps.slice() : null };
  if (a.type === 'choice') {
    const opts = lettered(a.options);
    const c = opts.find(o => o.id === a.correct);
    entry.letters = [c.letter];
    entry.result = `${c.letter}: ${c.text}`;
  } else if (a.type === 'multiselect') {
    const opts = lettered(a.options).filter(o => a.correct.includes(o.id));
    entry.letters = opts.map(o => o.letter);
    entry.result = opts.map(o => `${o.letter}: ${o.text}`).join(' · ');
  } else if (a.type === 'ordering') {
    const opts = lettered(a.items);
    entry.letters = a.correct.map(id => opts.find(o => o.id === id).letter);
    entry.result = entry.letters.join(' – ');
  } else if (a.type === 'solution_set') {
    entry.solutionKind = a.kind;
  } else if (a.type === 'table') {
    entry.cells = a.cells.map((c, i) => ({ label: c.label || `Feld ${i + 1}`, value: `$${numberSpecTex(c.spec)}$${unitSuffix(c.spec)}` }));
    if (a.grid) {
      const byId = Object.fromEntries(a.cells.map(c => [c.id, c.spec]));
      entry.grid = { columns: a.grid.columns.slice(), rows: a.grid.rows.map(row => row.map(e => (e.cell ? { text: `$${numberSpecTex(byId[e.cell])}$`, answer: true } : { text: e.text }))) };
    }
  }
  return entry;
}

/**
 * Turn a worksheet and its questions into print data:
 *   { code, title, nameField, dateField, space, keyMode, count, skills,
 *     student:[{number, qid, skillId, level, prompt, promptLines, promptTable?, instructions, paperInstruction, response}],
 *     key:[{number, qid, level, result, steps|null, letters?, cells?, grid?, solutionKind?}] }
 * Student response kinds: line (optional `variable` → printed as "x = ____", optional `unit` → "____ €"), choice,
 *   ordering, table, grid (2-D table: given entries as text, blanks to fill; D57),
 *   solution_set (three boxes: genau eine Lösung: x = ____ / keine Lösung / unendlich viele Lösungen).
 * The student part contains no correct answers; the key part is generated from the same instances.
 */
function worksheetLayout(worksheet, questions) {
  if (!Array.isArray(questions) || questions.length !== worksheet.items.length) throw new Error('questions do not match worksheet');
  const spec = worksheet.spec;
  questions.forEach((q, i) => { if (q.id !== worksheet.items[i].qid) throw new Error(`question ${i + 1} does not match worksheet`); });
  const student = questions.map((q, i) => ({
    number: i + 1, qid: q.id, skillId: q.skillId, level: q.level,
    prompt: q.prompt, promptLines: q.promptLines ? q.promptLines.slice() : null,
    // only when present, so sheets without tables keep their exact earlier layout (golden files)
    ...(q.promptTable ? { promptTable: { columns: q.promptTable.columns.slice(), rows: q.promptTable.rows.map(r => r.slice()) } } : {}),
    ...(q.diagram ? { diagram: q.diagram } : {}),
    instructions: q.instructions || null,
    paperInstruction: PAPER_INSTRUCTIONS_DE[q.answer.type] || null,
    response: responseLayout(q.answer),
  }));
  const key = questions.map((q, i) => keyEntry(q, i + 1, spec.keyMode === 'worked'));
  return {
    code: worksheet.code, title: spec.title, nameField: spec.nameField, dateField: spec.dateField,
    space: spec.space, keyMode: spec.keyMode, count: spec.count, skills: spec.skills.slice(), student, key,
  };
}

module.exports = {
  WORKSHEET_LIMITS, WORKSHEET_COUNTS, SPACE_OPTIONS, KEY_MODES, SPACE_LABELS_DE, KEY_MODE_LABELS_DE, DEFAULT_TITLE_DE,
  PAPER_INSTRUCTIONS_DE, SOLUTION_SET_CHOICES_DE, normalizeWorksheetSpec, rampLevels, planWorksheet, createWorksheet, isValidWorksheet,
  loadWorksheet, worksheetLayout, worksheetCode,
};
