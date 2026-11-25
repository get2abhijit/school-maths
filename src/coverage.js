'use strict';
/**
 * coverage.js — "Im Unterricht behandelt" (covered at school) filter. Pure, JSON-serialisable, no DOM, no storage.
 *
 * The student marks textbook SECTIONS (catalog chapter.sections, e.g. 'ch6.s2' = VI.2) as covered in class.
 * Every skill lists the sections it draws on (skill.textbookRef.sections). Rules (docs/decisions.md D70):
 *   - a skill is 'covered' when ALL its sections are marked, 'partial' when some are, 'open' when none are;
 *   - with the filter enabled only 'covered' skills are offered in practice, Wiederholen and worksheet selection;
 *     a multi-section skill (e.g. VI.2–4) mixes content of all its sections, so 'partial' is NOT enough;
 *   - with the filter disabled (default) everything practicable is offered — the app never guesses the school plan.
 *
 * Coverage = { enabled: boolean, sections: [sectionId…] } is stored in progress.settings.coverage, so it is
 * included in export/import and removed by "Alle Daten löschen" (docs/privacy.md).
 * Section ids unknown to the current catalog are kept in storage (forward compatible) but have no effect.
 */

const SECTION_ID_RE = /^ch\d{1,2}\.s\d{1,2}$/;
const MAX_SECTIONS = 200;
const COVERAGE_LABELS_DE = Object.freeze({ covered: 'Im Unterricht behandelt', partial: 'Teilweise behandelt', open: 'Noch nicht behandelt' });

function emptyCoverage() { return { enabled: false, sections: [] }; }

/** Shape check for stored/imported data (no catalog needed). Returns {ok, value, errors}. */
function validateCoverage(obj) {
  if (obj === undefined || obj === null) return { ok: true, value: emptyCoverage(), errors: [] };
  if (typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, value: emptyCoverage(), errors: ['Die Angabe „Im Unterricht behandelt“ ist ungültig.'] };
  const errors = [];
  const value = emptyCoverage();
  if (obj.enabled !== undefined) {
    if (typeof obj.enabled !== 'boolean') errors.push('„Im Unterricht behandelt“: Schalter ist ungültig.');
    else value.enabled = obj.enabled;
  }
  if (obj.sections !== undefined) {
    if (!Array.isArray(obj.sections) || obj.sections.length > MAX_SECTIONS) errors.push('„Im Unterricht behandelt“: Abschnittsliste ist ungültig.');
    else {
      for (const id of obj.sections) {
        if (typeof id !== 'string' || !SECTION_ID_RE.test(id)) { errors.push(`„Im Unterricht behandelt“: unbekannter Abschnitt ${String(id).slice(0, 20)}.`); continue; }
        if (!value.sections.includes(id)) value.sections.push(id);
      }
      value.sections.sort(compareSectionIds);
    }
  }
  return { ok: errors.length === 0, value, errors };
}

function compareSectionIds(a, b) {
  const pa = a.match(/\d+/g).map(Number), pb = b.match(/\d+/g).map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
}

// ---------------------------------------------------------------- catalog helpers
/** All textbook sections in book order: [{id, chapterId, roman, number, title, page, label}] — label like 'VI.2'. */
function textbookSections(catalog) {
  const out = [];
  for (const ch of catalog.chapters) for (const s of ch.sections || []) {
    out.push({ id: s.id, chapterId: ch.id, roman: ch.roman, number: s.number, title: s.title, page: s.page, label: `${ch.roman}.${s.number}` });
  }
  return out;
}

function findSkill(catalog, skillId) {
  for (const ch of catalog.chapters) for (const t of ch.topics) for (const s of t.skills) if (s.id === skillId) return { chapter: ch, skill: s };
  return null;
}

/** Section ids a skill draws on, e.g. ['ch6.s2','ch6.s3','ch6.s4']. Throws for an unknown skill. */
function skillSectionIds(catalog, skillId) {
  const f = findSkill(catalog, skillId);
  if (!f) throw new RangeError(`unknown skill ${skillId}`);
  const nums = (f.skill.textbookRef && f.skill.textbookRef.sections) || [];
  return nums.map(n => `${f.chapter.id}.s${n}`);
}

// ---------------------------------------------------------------- state changes (return new objects)
function cleanCopy(coverage) { const r = validateCoverage(coverage); return r.value; }

function setCoverageEnabled(coverage, enabled) {
  const c = cleanCopy(coverage);
  c.enabled = !!enabled;
  return c;
}

/** Mark or unmark one section. Unknown section ids (for this catalog) are rejected. */
function setSectionCovered(catalog, coverage, sectionId, covered) {
  if (!textbookSections(catalog).some(s => s.id === sectionId)) throw new RangeError(`unknown section ${sectionId}`);
  const c = cleanCopy(coverage);
  const has = c.sections.includes(sectionId);
  if (covered && !has) c.sections.push(sectionId);
  if (!covered && has) c.sections = c.sections.filter(id => id !== sectionId);
  c.sections.sort(compareSectionIds);
  return c;
}

/** Mark or unmark all sections of a chapter. */
function setChapterCovered(catalog, coverage, chapterId, covered) {
  const ch = catalog.chapters.find(x => x.id === chapterId);
  if (!ch) throw new RangeError(`unknown chapter ${chapterId}`);
  let c = cleanCopy(coverage);
  for (const s of ch.sections || []) c = setSectionCovered(catalog, c, s.id, covered);
  return c;
}

// ---------------------------------------------------------------- queries
/** 'covered' | 'partial' | 'open' — independent of whether the filter is enabled. */
function skillCoverage(catalog, coverage, skillId) {
  const ids = skillSectionIds(catalog, skillId);
  const marked = new Set(cleanCopy(coverage).sections);
  const n = ids.filter(id => marked.has(id)).length;
  if (ids.length && n === ids.length) return 'covered';
  return n > 0 ? 'partial' : 'open';
}

/** Whether a skill may be offered. Filter disabled → always true. */
function isSkillAvailable(catalog, coverage, skillId) {
  const c = cleanCopy(coverage);
  return !c.enabled || skillCoverage(catalog, c, skillId) === 'covered';
}

/**
 * Split skill ids into those to offer and those hidden by the filter (order preserved).
 * Unknown skill ids are passed through to `hidden` only when the filter is on (they cannot be covered).
 */
function partitionSkills(catalog, coverage, skillIds) {
  const c = cleanCopy(coverage);
  const available = [], hidden = [];
  for (const id of skillIds) {
    const known = !!findSkill(catalog, id);
    if (!c.enabled || (known && skillCoverage(catalog, c, id) === 'covered')) available.push(id);
    else hidden.push(id);
  }
  return { available, hidden };
}

/** Per chapter: sections marked / total, and per-skill coverage. For the Kapitel view and summaries. */
function coverageSummary(catalog, coverage) {
  const c = cleanCopy(coverage);
  const marked = new Set(c.sections);
  return catalog.chapters.map(ch => {
    const secs = ch.sections || [];
    const skills = [];
    for (const t of ch.topics) for (const s of t.skills) skills.push({ skillId: s.id, coverage: skillCoverage(catalog, c, s.id), sections: skillSectionIds(catalog, s.id) });
    const n = secs.filter(s => marked.has(s.id)).length;
    return { chapterId: ch.id, sectionsMarked: n, sectionsTotal: secs.length, state: n === 0 ? 'open' : n === secs.length ? 'covered' : 'partial', skills };
  });
}

/** Human-readable section labels of a skill, e.g. 'VI.2–4' or 'I.2'. */
function skillSectionLabel(catalog, skillId) {
  const f = findSkill(catalog, skillId);
  if (!f) throw new RangeError(`unknown skill ${skillId}`);
  const nums = (f.skill.textbookRef && f.skill.textbookRef.sections) || [];
  if (!nums.length) return f.chapter.roman;
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  if (nums.length === 1) return `${f.chapter.roman}.${nums[0]}`;
  return contiguous ? `${f.chapter.roman}.${nums[0]}–${nums[nums.length - 1]}` : `${f.chapter.roman}.${nums.join(', ')}`;
}

module.exports = {
  COVERAGE_LABELS_DE, findSkill, emptyCoverage, validateCoverage, textbookSections, skillSectionIds, setCoverageEnabled,
  setSectionCovered, setChapterCovered, skillCoverage, isSkillAvailable, partitionSkills, coverageSummary, skillSectionLabel,
};
