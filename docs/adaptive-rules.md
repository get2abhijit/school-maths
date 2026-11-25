# Adaptive rules (Session 10; KA mode Session 11)

Implemented in `src/adaptive.js` (levels, mastery, review, prerequisite advice) and `src/diagnostic.js` (chapter diagnostic); in-session level changes run inside `src/practice.js` (`levelMode: 'adaptive'`). Every parameter is in the frozen object `ADAPTIVE_RULES`; to tune, change it there and re-run `npm test` (tests read the values from the object, a few use the documented defaults).

**Nothing here is a formal assessment.** The app shows recommendations and indicators, never grades. Everything is deterministic: the same history gives the same recommendation, the same session seed plus the same answers give the same session. No clock, no randomness, no network, no model at runtime.

## 1. Evidence
Per skill the progress record keeps the last `detailWindow` = 24 first-try results as `{l: level, o: outcome, d: date}`:

| Outcome | When | Score |
|---|---|---|
| `clean` | right on the first attempt, no hint opened | 1 |
| `hinted` | right on the first attempt after opening hint 1–3 | `hintCredit` = 0.5 |
| `miss` | wrong first attempt, "Lösung zeigen" without an attempt, or right after the worked solution was opened | 0 |

Only the first attempt of a question counts; invalid input is never evidence. Records written before Session 10 (only `recent` 0/1) are read as level-less evidence: they keep the old accuracy rule for "Sicher" and give no level information.

## 2. Mastery indicator („Sicher“) — never from one answer
`secure` needs **all** of:
- ≥ `masteryMinQuestions` = 10 questions in the last `masteryWindow` = 12,
- mean score ≥ `masteryAccuracy` = 0.8 over that window,
- (level-aware evidence only) a **proven level** ≥ min(`masteryProofLevel` = 3, the skill's top level): a level L is proven when ≥ `masteryProofMin` = 3 questions at levels ≥ L have mean score ≥ `masteryProofAccuracy` = 0.75.

So twelve clean answers at level 1 are "In Arbeit", not "Sicher". Labels stay „Noch nicht geübt / In Arbeit / Sicher“ (always with text). The flag `needsHelp` (not a label) is true when the last `helpWindow` = 8 questions (≥ `helpMinQuestions` = 5) have mean score < `helpBelow` = 0.5; it only triggers the prerequisite advice.

## 3. Start level for a session („Automatisch (passt sich an)“)
`recommendLevel` looks at the last `levelWindow` = 12 level-tagged questions:
1. Level L is **supported** when ≥ `supportMin` = 2 questions at levels ≥ L have mean score ≥ `supportAccuracy` = 0.6 (the lowest available level always is).
2. base = highest supported level.
3. One level higher when ≥ `upMin` = 4 questions at levels ≥ base have mean score ≥ `upAccuracy` = 0.8.
No evidence → lowest available level. A single miss never lowers the level (support needs two questions). The recommendation is shown in Üben before starting and in the summary („Nächstes Mal starten wir bei Stufe …“) and on Fortschritt („Empfohlene Stufe“).

## 4. Level inside a session
`replayLevel`: start at the recommended level; after each closed question look at the run since the last change: `sessionUpStreak` = 2 `clean` in a row → one level up; `sessionDownStreak` = 2 `miss` in a row → one level down; `hinted` answers neither raise nor lower and break a clean streak. Clamped to the skill's levels. Items are generated one at a time (`advance`), with no duplicate signature in the session; "Neue Zahlen" keeps the level of the replaced item and does not count as a question. The old ramp „Gemischt, steigend“ (`auto`) remains selectable (D31).

## 5. Spaced revision (replaces the fixed 1/3/7–28 days of `progress-rules.md`)
Leitner-style boxes, set once when a session ends (`scheduleReviewAdaptive`); interval = `reviewLadder`[box] = 1, 2, 4, 7, 14, 28 days.
- mean score of the last `reviewWindow` = 8 questions < `reviewLapseBelow` = 0.5 → box = floor(box / 2);
- ≥ `reviewGrowFrom` = 0.8 with ≥ `reviewGrowMin` = 6 questions **and the topic was due** (today ≥ nextReview, or never scheduled) → box + 1. Practising twice on one day does not climb the ladder;
- otherwise the box stays;
- without mastery („Sicher“) the box is capped at `maxBoxUnsecure` = 3 (7 days).
Wiederholen lists skills with `nextReview ≤ today`, most overdue first, filtered by „Im Unterricht behandelt“ (unchanged).

## 6. Prerequisite fallback
When `needsHelp` is true for a skill, `prerequisiteAdvice` walks the catalog's `prerequisites` up to `prereqDepth` = 2 steps back and recommends **one** earlier skill that is not secure and is *offered* (practicable and allowed by „Im Unterricht behandelt“ — the filter is never bypassed). Order: weak (needs help) → never practised → not yet secure; ties → deeper in the chain first, then catalog order. Klasse-5/6 foundations (`kl6.*`) are only named, not practised. It is advice with a „Dort üben“ button in Üben (setup + summary), never a lock.

## 7. Chapter diagnostic („Standortbestimmung“)
Label everywhere: „Das ist keine Klassenarbeit, keine Note – nur eine Einschätzung, wo du gerade stehst.“
- One diagnostic per chapter; skills = practicable skills of the chapter that `partitionSkills` offers (filter respected). Nothing offered → no diagnostic.
- `diagQuestionsPerSkill` = 3 questions per skill, skill by skill. First question at `diagStartLevel` = 2 (nearest available level), then one level up after a right answer, one down after a wrong one.
- No hints, one attempt, no right/wrong feedback until the result page; „Weiß ich nicht“ counts as wrong; invalid input is not an answer and can be corrected; ending early rates only the skills with answers.
- Per skill verdict from right/answered: `gap` („Hier gibt es noch Lücken“) < `diagGapBelow` = 0.4; `secure` („Sieht sicher aus“) ≥ `diagSecureAccuracy` = 0.8 **and** a level ≥ min(2, top) answered right; otherwise `partial` („Teilweise sicher“). Recommendation = the highest level answered right (lowest level if none).
- The answers are normal first-try evidence (same events as practice) but three answers can never make a skill „Sicher“ and the diagnostic sets **no** review dates. Only the latest result per chapter is stored (verdict, level, counts — no questions, no answers).
- The result page lists wrong/unknown questions with their worked solutions.

## 8. Klassenarbeit mode (Session 11, `KA_RULES` in src/exam.js)
- **Item result** („8 von 10 richtig beim ersten Versuch“): only answers whose template belongs to the checklist item (detail field `t`, D89), within the last 24 answers per skill. Right after a hint counts as right at the first try here (it is the KA-preparation view, not the mastery rule).
- **Mismatch note** (neutral, never a grade): with at least `minEvidence` (5) answers — rating ≥ 2 („klappt meistens/sicher“) and first-try rate < 0,5 → „Du schätzt dich sicher ein, in der App waren es zuletzt r von n. Noch eine Runde üben?“; rating ≤ 1 and rate ≥ 0,8 → an encouraging note.
- **Open item / weakness**: weakness = 1 − mean(rating/3, first-try rate if ≥ 5 answers); 1 when neither exists. An item is closed only with ≥ 5 answers and a combined score ≥ `closedFrom` (0,8).
- **Study plan**: see D92. Parameters `minutesPerDay` 20, `minutesPerItem` 10, `noNewItemsLastDays` 2.
- **Mock scoring**: points of a task split evenly over its sub-parts (half points allowed); a sub-part scores when `evaluate` says correct; invalid input = 0 with the label „ungültige Eingabe“; no input = „keine Antwort“. Paper mode: self-marked points per task, 0…max in half points.

## Parameter table
| Group | Parameters (default) |
|---|---|
| Evidence | `hintCredit` 0.5; `detailWindow` 24 (in `PROGRESS_RULES`) |
| Mastery | `masteryWindow` 12, `masteryMinQuestions` 10, `masteryAccuracy` 0.8, `masteryProofLevel` 3, `masteryProofMin` 3, `masteryProofAccuracy` 0.75 |
| Help flag | `helpWindow` 8, `helpMinQuestions` 5, `helpBelow` 0.5 |
| Start level | `levelWindow` 12, `supportMin` 2, `supportAccuracy` 0.6, `upMin` 4, `upAccuracy` 0.8 |
| In session | `sessionUpStreak` 2, `sessionDownStreak` 2 |
| Review | `reviewLadder` [1,2,4,7,14,28], `reviewWindow` 8, `reviewGrowMin` 6, `reviewGrowFrom` 0.8, `reviewLapseBelow` 0.5, `maxBoxUnsecure` 3 |
| Prerequisites | `prereqDepth` 2 |
| Diagnostic | `diagQuestionsPerSkill` 3, `diagStartLevel` 2, `diagSecureAccuracy` 0.8, `diagGapBelow` 0.4 |

## What these rules do not claim
The thresholds are reasoned defaults, not validated against real students: they have not been calibrated on data, and a few questions per level are a small sample. The first real use should tell whether the climb is too fast or too slow; tune `upMin`, `sessionUpStreak` and the review ladder first.
