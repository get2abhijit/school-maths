# Klassenarbeit mode ("KA vorbereiten") – specification

Status: specified 2026-10-31; implemented in Session 11 (engine `src/exam.js`, UI `ui/views-ka.js`, route `#ka`). Deviations from this text: D84 (compute_cleverly answers the value), D87 (exams.json fixes), D91 (one sub-part per page, timer never submits), D92 (plan details). Session 12: G7 (`think_of_number`), `match_term_situation` and `equivalence_check` implemented and added to the blueprint (D94); KA_RULES unchanged, timer text refreshes every 20 s (D95). The data lives in `exams.json`, which `build.js` inlines next to `catalog.json`.

## Why

The first Klassenarbeit (Chapter I) was scheduled for 16.11.2026 according to the teacher's checklist this mode is based on (the date is editable in the app). The checklist is a list of "Ich kann…" statements, each with a reading page, practice exercises in the book, and a 4-step self-rating. The app turns that into a mode where the student can do four things: rate themselves, practise exactly the families behind each statement, plan the remaining days, and sit a two-round practice test.

## Principles (consistent with the existing architecture)

1. An exam is **data** (`exams.json`). A new KA = a new blueprint, with no UI change.
2. The engine module `src/exam.js` is pure: no DOM, no storage. It builds plans, mock tests and the item status. The UI only renders.
3. Every mock-test question is an ordinary canonical Question from the existing templates (same validation, hints and worked solutions). Mock tests are reproducible from `(examId, round, seed, engineVersion)` and print through the existing worksheet path (student sheet + answer key).
4. No grade prediction. Points are shown per task, and the item status uses words. The disclaimer from the blueprint is shown on every mock-test screen and printout.
5. Privacy: stored are the KA date, self-ratings, mock seeds and results, nothing else. They are part of the existing export/import/delete-all flow and `docs/privacy.md`.

## Screens (German UI)

**Dashboard card:** "Klassenarbeit in N Tagen" (or "heute"/"vorbei") with a link. It is hidden when no exam is active.

**KA vorbereiten (overview):** one row per checklist statement, with these columns:
- the statement;
- the book reference ("Nachlesen S. 21 · Übung S. 21/1 …"), showing the checklist note if there is one;
- the self-rating (4 buttons, label + emoji, never emoji or colour alone);
- the app result ("8 von 10 richtig beim ersten Versuch", from the existing progress data restricted to the item's families);
- an "Üben" button that opens Üben with the item's skill/family/level filter.

If the self-rating and the app result disagree strongly, a neutral note is shown, e.g. "Du schätzt dich sicher ein, in der App waren es zuletzt 2 von 5. Noch eine Runde üben?".

**Settings:** KA date (prefilled from `defaultDate`, changeable), Zusatz switches (Ausklammern), and the timer for the practice test.

**Lernplan:** distributes the open items over the days until the date, as a suggestion only. Rules: weakest items first (self-rating and app accuracy combined); about 20 minutes per day (tunable); the day before the KA is a mixed review plus Runde 2; and no new items in the last 2 days. Each day can be ticked off. This is the app's counterpart to checklist row 1, "Vorbereitungszeit einteilen".

**Übungs-Klassenarbeit:** Runde 1 and Runde 2, each with 7–8 tasks (from `mock.tasks`), 30 points, and two sub-parts per task. The student can choose between:
- *am Bildschirm*: answer everything first, check at the end (no hints during the test; hints and worked solutions come in the review);
- *auf Papier*: print the student sheet, then use the answer key to self-mark per task, entering points 0..max.

The result screen shows points per task mapped back to the checklist items, with an "Üben" button for each weak item. A new seed gives a fresh Runde; earlier rounds stay reproducible.

**Herausfordernde Aufgaben (ka1.challenge):** the same practice flow with L3–L4 drawn from all items.

## Engine API (src/exam.js)

- `listExams(blueprints)`
- `buildMock(blueprint, round, seed, options) → { id, tasks: [{ n, title, points, questions: Question[] }] }`: deterministic, with no duplicate signatures within one mock test, and optional tasks dropped when they are switched off.
- `scoreMock(mock, answers) → per-task points + per-item summary`. Partial credit: points are split evenly over the sub-parts. A sub-part counts as correct when `evaluate` says correct. Invalid input counts as 0 and is labelled "ungültige Eingabe", not "falsch".
- `itemStatus(blueprint, progress, ratings) → per item { rating, attempts, firstTryRate, mismatch }`
- `buildStudyPlan(blueprint, status, today, examDate, params) → days[]`, with the tunable parameters in `docs/adaptive-rules.md`.

## Tests (Session 11)

- `exams.json` schema test: every referenced skill/family exists, and nothing excluded appears in a target.
- Mock reproducibility across 200 seeds × 2 rounds: same seed → same signatures; no duplicates within a mock test; every question validated and with a solution; the answer key matches the instances.
- Scoring oracle tests (hand-computed point totals, including partial credit and invalid input).
- Study-plan property tests: every open item is scheduled before the date, nothing is scheduled after the date, the plan is empty-state safe when the date is past, and it is deterministic.
- New families G1–G7 (see `book-alignment-ch1.md`): property tests over ≥500 seeds per level, golden-file additions, and oracle tests. The existing Chapter I golden files must stay byte-identical (new families get new golden entries).
- jsdom: overview renders, rating persists across reload, Üben filter applied, mock test flow end to end, print views contain every task.

## Session 11 scope (in order, stop when the budget runs out; the KA comes first)

1. New Chapter I families G1, G2, G3, G5 (G6, G7 if time allows), with catalog updates and `inBookScope` flags for x·x and sum×sum.
2. `src/exam.js` + `exams.json` + build inlining + tests.
3. UI: KA overview, self-rating, Üben filter, mock test (screen + print), dashboard card.
4. Study plan (if time allows; otherwise Session 12).
5. Rebuild, full test run, republish to the existing Artifact URL.

Deferred: geometry Chapters III/V move to after the KA, as Session 12+.
