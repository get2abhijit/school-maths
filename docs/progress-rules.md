# Progress, mastery and review rules (pre-adaptive, Session 3) — SUPERSEDED by `docs/adaptive-rules.md` (Session 10)

> Since Session 10 the app uses the adaptive rules for the mastery label, the review date, the start level and the prerequisite advice. `masteryOf` and `scheduleReview` described below still exist in `src/progress.js` (tested, used by nothing in the UI); the event table and the `recent` window are unchanged.

Implemented in `src/progress.js`; all parameters are in `PROGRESS_RULES` and covered by `test/progress.test.js`.
These are deliberately simple placeholders until the adaptive engine session (`docs/adaptive-rules.md`, later) replaces them. Nothing here is a formal assessment.

## Events (from `src/practice.js`)
| Event | When | Effect |
|---|---|---|
| `attempt` | a checked, *valid* answer (invalid input never counts) | attempts+1; correct+1 or error category+1; on the first attempt of a question: questions+1, firstAttemptCorrect+1 if correct, push 1/0 to `recent` |
| `hint` | a hint is opened the first time for that question | hintsUsed+1 |
| `reveal` | "Lösung zeigen" | solutionsShown+1; if there was no attempt: questions+1 and push 0 |
| `skip` | "Neue Zahlen" before any attempt | skipped+1 |

`recent` = first-try results of the last `recentWindow` = 10 questions. A first-try-correct answer pushes **0** if the worked solution (hint 4, "Lösungsweg") was opened before it.

## Mastery indicator (shown as ○ / ◐ / ●, always with text)
- `new` (Noch nicht geübt): no question.
- `secure` (Sicher): at least `masteryMinQuestions` = 10 questions in the window **and** window accuracy ≥ `masteryAccuracy` = 0.8. So never from one answer.
- `learning` (In Arbeit): otherwise.

## Review date (set once when a session ends)
- window accuracy < 0.6 → 1 day
- < 0.8, or fewer than 10 questions → 3 days
- otherwise double the previous interval, clamped to 7…28 days.
`dueSkills(progress, today)` lists skills with `nextReview ≤ today`, most overdue first.

## Session levels
"Gemischt, steigend" (`levelMode: 'auto'`) is a fixed ramp through the skill's available levels (e.g. 10 questions over L1–L4 → 1,1,1,2,2,3,3,3,4,4). It does not react to answers (D31).
