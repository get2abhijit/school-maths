'use strict';
/**
 * Golden snapshots.
 *  snapshot(E): for every template, level and seed in SEEDS, the parts of a question that a student or an
 *    answer key sees. Any change is a deliberate content change and requires `npm run golden` plus a
 *    template version bump (stored seeds must keep meaning).
 *  worksheetSnapshot(E): the complete print layout (student sheet + answer key, worked) of fixed worksheets.
 */
const SEEDS = [1, 2, 3];
/** chapter: 'ch1' | 'ch4' | … — one golden file per chapter (D52), so a new chapter never rewrites an old file. */
function snapshot(E, chapter) {
  const out = {};
  for (const t of E.TEMPLATES.filter(tt => !chapter || tt.id.startsWith(`${chapter}.`))) for (const level of t.levels) for (const seed of SEEDS) {
    const q = E.generate(t, seed, level);
    out[q.id] = {
      signature: q.signature,
      prompt: q.prompt,
      ...(q.promptLines ? { promptLines: q.promptLines } : {}),
      ...(q.promptTable ? { promptTable: q.promptTable } : {}),
      ...(q.diagram ? { diagramAlt: q.diagram.alt, diagramElements: q.diagram.elements.length } : {}),
      answerType: q.answer.type,
      canonical: E.canonicalInput(q.answer),
      result: q.solution.result,
    };
  }
  return out;
}
// `chapter` pins the skill list, so adding skills to another chapter leaves these sheets unchanged.
const WORKSHEET_SPECS = [
  { chapter: 'ch1', title: 'Golden: alle Themen', levels: [1, 2, 3, 4], count: 12, baseSeed: 20261027, keyMode: 'worked', space: 'medium' },
  { chapter: 'ch1', title: 'Golden: Stufe 2', levels: [2], count: 6, baseSeed: 4, keyMode: 'answers', space: 'none', nameField: false },
  { chapter: 'ch4', title: 'Golden: Lineare Gleichungen', levels: [1, 2, 3, 4], count: 12, baseSeed: 20261028, keyMode: 'worked', space: 'small' },
  { chapter: 'ch6', title: 'Golden: Prozent- und Zinsrechnung', levels: [1, 2, 3, 4], count: 12, baseSeed: 20261029, keyMode: 'worked', space: 'small' },
  { chapter: 'ch2', title: 'Golden: Zuordnungen', levels: [1, 2, 3, 4], count: 12, baseSeed: 20261030, keyMode: 'worked', space: 'small' },
  { chapter: 'ch7', title: 'Golden: Daten und Zufall', levels: [1, 2, 3, 4], count: 12, baseSeed: 20261031, keyMode: 'worked', space: 'small' },
  { chapter: 'ch5', title: 'Golden: Winkel', levels: [1, 2, 3, 4], count: 8, baseSeed: 20261103, keyMode: 'worked', space: 'small' },
];
function worksheetSnapshot(E) {
  return WORKSHEET_SPECS.map(({ chapter, ...s }) => {
    const { worksheet, questions } = E.createWorksheet({ ...s, skills: E.skillsWithTemplates().filter(id => id.startsWith(`${chapter}.`)) });
    return { worksheet, layout: E.worksheetLayout(worksheet, questions) };
  });
}
const GOLDEN_CHAPTERS = ['ch1', 'ch2', 'ch4', 'ch5', 'ch6', 'ch7'];
module.exports = { SEEDS, GOLDEN_CHAPTERS, snapshot, WORKSHEET_SPECS, worksheetSnapshot };
