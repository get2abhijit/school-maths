# PROGRESS — Mathe 7 Übungsapp (G9 BW)

Last updated: 2026-11-03 · Session 12 (Kapitel I komplett, Diagramm-Modul, Kapitel V.1–V.2, lokales Testen, Deployment) complete · Engine 0.12.0 · Catalog 0.9.0 · exams.json schema 1

## How to resume
Attach `mathe7-session12.zip` (+ this file) to the next chat. Then:
- `npm test` = `node build.js && node --test test/*.test.js` (no dependencies; 471 tests: 427 run, 44 skip).
- Full suite: `npm run test:dev-deps` once (jsdom 24.1.3 + KaTeX 0.16.22, `--no-save`), then `npm test` (471 run).
- `npm run serve` → http://localhost:8080/ · `npm run serve:lan` → phone in the same Wi-Fi · `npm run site` → `site/` for hosting.
- Deployment: `docs/deployment.md` (GitHub Pages via `.github/workflows/pages.yml`, Codeberg, Netlify, file). Manual test protocol: `docs/testing-locally.md`.
- After a deliberate content change: `npm run golden`, review the diff, bump the template version if released.

Published app (Artifact): see the end of the Session-12 chat (updated in place).

## Files (changed or new in S12)
| Path | Purpose |
|---|---|
| `src/diagram.js` | **New.** Diagram data format, `validateDiagram`, `diagramTree` (node tree → DOM via createElementNS), `renderDiagram` (SVG string), `diagramCaption`, `pt`, `polar` (D96) |
| `src/templates/ch5/angles.js` | **New.** `angle_chase`, `name_relation` (ch5.angles.lines), `missing_angle`, `proof_order` (ch5.angles.triangle_sum) with diagrams; solvers measure the drawing (D97) |
| `src/templates/ch1/situations.js` | **New.** `match_term_situation` (L1–L3), `think_of_number` (G7, L4) |
| `src/templates/ch1/equivalence.js` | **New.** `equivalence_check` (L1–L4) |
| `src/templates/index.js` | Registers the new modules |
| `src/question.js` | Optional `diagram` validated in `validateQuestion`; unit `°` („57°“, „57 Grad“) |
| `src/worksheet.js` | Student entries carry `diagram` when the question has one |
| `src/index.js`, `package.json` | ENGINE_VERSION 0.12.0; scripts `serve`, `serve:lan`, `site` |
| `catalog.json` | 0.9.0: Ch1 families validated, 3 new misconceptions; ch5.angles.lines / triangle_sum validated (templates, levels, misconceptions) |
| `exams.json` | match_term_situation, equivalence_check in targets and mock tasks 3, 4, 8; phrase_to_term in task 8 (G7) (D94) |
| `ui/views-practice.js` | `diagramBlock` (figure + caption), used in practice, Standort, KA screen/paper/review, worksheets |
| `ui/views-ka.js` | Timer text refreshes every 20 s (D95) |
| `ui/app.js` | Text fallback: Greek letters, `^\circ` → °, prime |
| `ui/styles.css` | Diagram styles (max 9 cm in print, break-inside: avoid) |
| `tools/serve.js`, `tools/make-site.js` | **New.** Local server (dist/ only), site/ folder for hosting (D98, D99) |
| `tools/golden.js` | Golden chapter ch5 + worksheet „Golden: Winkel“; diagram alt/element count in snapshots |
| `.github/workflows/pages.yml`, `.gitignore` | **New.** Test → build → GitHub Pages |
| `test/diagram.test.js`, `test/templates.ch5.oracle.test.js`, `test/templates.ch1s12.oracle.test.js`, `test/serve.test.js` | **New** |
| `test/worksheet.stored.test.js` (+ `golden/worksheet.s11.golden.json`), `test/exam.stored.test.js` (+ `golden/mock.s11.golden.json`) | **New.** Stored S10/S11 sheets and S11 mock rounds reload exactly (D93); replaces worksheet.s10.test.js |
| `test/ui.dom.test.js`, `test/ui.worksheet.dom.test.js`, `test/ui.coverage.dom.test.js`, `test/catalog.test.js`, `test/worksheet.test.js` | Geometry DOM tests; counts 21 → 23 practicable skills; diagram in student entries |
| `test/golden/*` | ch1: 162 identical + 24 new; ch5 new; ch2/4/6/7 only `engineVersion`; worksheet golden: ch1 sheets changed (new pool), ch5 sheet added |
| `docs/testing-locally.md`, `docs/deployment.md` | **New** |
| `docs/decisions.md` (D93–D99), `privacy.md` (hosting), `klassenarbeit-mode.md`, `book-alignment-ch1.md`, `curriculum-sources.md` | Updated |

## Done (Session 12)
- **Kapitel I komplett (D94):** match_term_situation (situation ↔ term, 5 original settings), think_of_number (G7: „Denke dir eine Zahl“ → term or relation statement; distractor = forgotten bracket), equivalence_check (ja/nein, multiselect, judging „one equal value proves equivalence“). All book-alignment items G1–G7 are done; both families are back in the KA blueprint.
- **KA mode (D95):** no manual-test findings were reported, so KA_RULES are unchanged; timer refresh fixed; manual test protocol written.
- **Geometry foundation (D96):** diagram module; diagrams in practice, diagnostic, KA and worksheets; accessible (role="img", alt text, caption accurate/schematic), dark mode and b/w print via currentColor; no innerHTML.
- **Kapitel V.1–V.2 (D97):** angles at intersecting lines and parallels (incl. Umkehrung, terms in x, choosing a complete justification), angle sum (two given, terms in x, Außenwinkel) and the first structured proof (ordering, two variants).
- **Local testing and deployment (D98, D99).**

## Tests (run in this chat, Node 22.22.2)
```
npm test (with jsdom + KaTeX):   # tests 471  # pass 471  # fail 0  # skipped 0
npm test (without them):         # tests 471  # pass 427  # fail 0  # skipped 44
```
- New templates: property tests over 500 seeds per level (independent solver, canonical, distractors with category, lint), 20-question sessions without duplicate signatures, ≥ 30 signatures/200 seeds, golden entries.
- 10 Ch5 oracle tests and 9 Ch1 oracle tests (hand-computed), incl. KA blueprint pools (D94).
- Diagram: validation rejects 8 kinds of bad data; every Ch5 question (template × level × 200 seeds) renders without NaN, points inside the box, every label present; worksheet layout carries diagrams only where present; diagram labels never contain numbers (no answers on the sheet).
- jsdom: practice shows the diagram with alt text and caption, „…°“ accepted; worksheet student sheet has one diagram per geometry task; every skill × level through the real widgets (now 23 skills).
- Local server: app at /, 404, no path traversal, GET/HEAD only; site/ copy equals dist.
- Visual check: six sample diagrams rasterised (cairosvg) and inspected — labels readable, angles at the right places.

### What could NOT be tested here
No real browser, phone or printer; the GitHub workflow was not run (no GitHub access); the published Artifact was not opened. Not verified: real KaTeX rendering of `\alpha'` and `^\circ`, diagram size on phones and in print, timer refresh in a real tab. **First manual check:** `docs/testing-locally.md`, rows 1, 2, 4, 6–9.

## Next — Session 13
1. Feedback from the manual test protocol (KA mode, diagrams, print) → fix; KA_RULES only with evidence.
2. Chapter III with the diagram module: ch3.constr.triangle_feasibility (Dreiecksungleichung, Kongruenzsätze/Eindeutigkeit, Anzahl der Lösungen), ch3.constr.distances, ch3.constr.loci (Schritte ordnen, Ortslinie wählen), measure_by_drawing (Maßstab); constructions as ordering/choice tasks, never free drawing.
3. Then V.3–V.7 (Basiswinkelsatz + Kehrsatz with Voraussetzung/Behauptung, Thales, Umkreis/Inkreis, Probleme), structured proofs (spot-the-error), tangents gap 3.2.3(10).

## Known issues / limitations
- Ch V: outer alternate and co-interior angle pairs are never named (book naming unverified, D97); Außenwinkel used only as Nebenwinkel of γ.
- Diagram labels are plain Unicode, not KaTeX (SVG text). Diagrams are not shown in the answer key (only on the student sheet).
- Ch5 chapter status stays „planned“ in the catalog (only 2 of 6 skills done); the skills are validated.
- New worksheets/mocks with old seeds differ from earlier sessions (bigger pools); stored ones reload exactly (D93).
- Carried over: KA item results use the last 24 answers per skill; study plan ignores school days; adaptive thresholds uncalibrated; diagnostic is a rough probe; Ch II/VII without diagrams (now possible with the module).

## Coverage matrix (per skill)
Legend: ✓ done · – not yet. „Interactive“ = in practice UI; „Print“ = in worksheet/answer key. „Book“ = LS7 sections (what the covered-at-school filter checks). Standards marked * are provisional; all others verified (S4 + content, D71).

| Skill | Book | Standards | Planned | Modelled | Implemented | Validated | Interactive | Print |
|---|---|---|---|---|---|---|---|---|
| ch1.numterms.evaluate | I.1 | 3.2.1(1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch1.terms.translate | I.2 | 3.2.1(5), 3.2.1(6) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch1.terms.evaluate | I.2 | 3.2.1(7) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch1.terms.collect_like | I.3 | 3.2.1(8), 3.2.1(9) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch1.terms.simplify_products | I.4 | 3.2.1(9) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch1.terms.expand_factor | I.5 | 3.2.1(9) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch2.prop.recognize_compute | II.1 | 3.2.4(4), 3.2.4(1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch2.antiprop.recognize_compute | II.2 | 3.2.4(4), 3.2.4(1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch3.constr.distances | III.1 | 3.2.3(8) | ✓ | – | – | – | – | – |
| ch3.constr.loci | III.2–3 | 3.2.3(7), 3.2.3(8) | ✓ | – | – | – | – | – |
| ch3.constr.triangle_feasibility | III.4–5 | 3.2.3(5) | ✓ | – | – | – | – | – |
| ch3.constr.measure_by_drawing | III.6 | 3.2.3(6) | ✓ | – | – | – | – | – |
| ch4.eq.setup_trial | IV.1 | 3.2.1(20) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch4.eq.solve_equivalence | IV.2–3 | 3.2.1(20) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch4.eq.solution_count | IV.4 | 3.2.1(22) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch4.eq.word_problems | IV.5 | 3.2.1(20) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch5.angles.lines **(S12)** | V.1 | 3.2.3(1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch5.angles.triangle_sum **(S12)** | V.2 | 3.2.3(2), 3.2.3(3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch5.proof.isosceles | V.3 | 3.2.3(3), 2.1* | ✓ | – | – | – | – | – |
| ch5.thales | V.4 | 3.2.3(4) | ✓ | – | – | – | – | – |
| ch5.circles.circum_in | V.5–6 | 3.2.3(9) | ✓ | – | – | – | – | – |
| ch5.problems | V.7 | 3.2.3(8), 3.2.3(3) | ✓ | – | – | – | – | – |
| ch6.pct.compare | VI.1 | 3.2.1(2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch6.pct.basic_tasks | VI.2–4 | 3.2.1(2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch6.interest.simple_compound | VI.5 | 3.2.1(3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch6.interest.loan | VI.6 | 3.2.1(4) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch7.data.analyze | VII.1 | 3.2.5(1), 3.2.5(2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch7.prob.experiments | VII.2 | 3.2.5(4), 3.2.5(5) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch7.prob.determine | VII.3 | 3.2.5(3), 3.2.5(10), 3.2.5(8) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch7.prob.frequency | VII.4 | 3.2.5(7), 3.2.5(6) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ch7.prob.laplace | VII.5 | 3.2.5(9), 3.2.5(8) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Chapters 1, 2, 4, 6 and 7 meet the done gate; Chapter V meets it for V.1 and V.2 only (V.3–V.7 and Chapter III planned) for their implemented skills (generators, validation, explanations, practice UI, print support, tests), with the limitations above; „Interactive“ and „Print“ are verified in jsdom, not in a real browser. Every skill — including the planned Ch3/Ch5 skills — takes part in the covered-at-school data (sections), so marks set now keep working when geometry arrives.


### Adaptive coverage (Session 10, extended S12)
All 23 practicable skills (S12: + ch5.angles.lines, ch5.angles.triangle_sum; Ch5 now offers a Standortbestimmung for these two) (Ch1 ×6, Ch2 ×2, Ch4 ×4, Ch6 ×4, Ch7 ×5) take part in adaptive sessions (property test: 20 questions × 3 answer strategies per skill, no duplicate signature, levels inside the skill's levels, all-right climbs to the top level). Chapter diagnostics exist for Ch1, 2, 4, 6, 7 (Ch3 and Ch5 have no generators, so „Standortbestimmung“ is not offered there). Prerequisite advice works along the catalog `prerequisites` of the practicable skills; Klasse-6 foundations are named only.

### Template detail (Ch5, Session 12) — every question carries a diagram
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| angles.lines.angle_chase | 1–3 | angle_chase | 500 |
| angles.lines.name_relation | 1, 3, 4 | name_relation | 500 |
| angles.triangle_sum.missing_angle | 1–3 | missing_angle | 500 |
| angles.triangle_sum.proof_order | 4 | proof_order | 500 |

### Template detail (Ch7)
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| data.analyze.stats | 1–3 | statistics | 500 |
| data.analyze.judge | 4 | judge_statement | 500 |
| prob.experiments.events | 1–4 | outcome_event, set_notation | 500 |
| prob.determine.compute | 1–2 | outcome_sum, complement | 500 |
| prob.determine.counting | 3 | counting | 500 |
| prob.determine.claims | 4 | judge_claim | 500 |
| prob.frequency.series | 1–4 | relative_frequency, estimate, compare_series, stabilization | 500 |
| prob.laplace.compute | 1–3 | laplace_basic | 500 |
| prob.laplace.judge | 4 | is_laplace | 500 |

### Template detail (Ch2)
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| prop.recognize_compute.table | 1–3 | classify_table, fill_table | 500 |
| prop.recognize_compute.dreisatz | 2–4 | dreisatz_context, model_check | 500 |
| prop.recognize_compute.graph | 2–3 | graph_type | 500 |
| antiprop.recognize_compute.table | 1–3 | classify_table, fill_table | 500 |
| antiprop.recognize_compute.dreisatz | 2–4 | dreisatz_inverse, model_check | 500 |
| antiprop.recognize_compute.decide | 1, 3 | prop_or_antiprop | 500 |

### Template detail (Ch6)
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| pct.compare.convert | 1–2 | convert | 500 |
| pct.compare.shares | 1–4 | compare_shares | 500 |
| pct.basic_tasks.grundaufgaben | 1–3 | rate, value, base | 500 |
| pct.basic_tasks.change | 2–4 | increase_decrease | 500 |
| interest.simple_compound.yearly | 1–2 | yearly_interest | 500 |
| interest.simple_compound.compound | 3–4 | iterative_table, compare_offers | 500 |
| interest.loan.table | 1–2 | repayment_table | 500 |
| interest.loan.duration | 3–4 | loan_duration, loan_cost | 500 |

### Template detail (Ch4)
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| setup_trial.is_solution | 1, 2, 4 | is_solution | 500 |
| setup_trial.text_to_equation | 1–3 | text_to_equation | 500 |
| solve_equivalence.solve | 1–3 | one_step, two_step, both_sides, brackets | 500 |
| solve_equivalence.spot_error | 2–4 | spot_error | 500 |
| solution_count.classify | 1–2 | classify_count | 500 |
| solution_count.parameter | 3 | choose_parameter | 500 |
| solution_count.justify | 4 | justify_count | 500 |
| word_problems.contexts | 1–3 | age_number_problems, geometry_equations | 500 |
| word_problems.interpret | 4 | check_interpretation | 500 |

### Template detail (Ch1)
| Template | Levels | Families | Seeds tested per level |
|---|---|---|---|
| numterms.evaluate.order_ops | 1–3 | order_of_operations, sign_rules, mixed_representations | 500 |
| numterms.evaluate.insert_brackets | 2–4 | insert_brackets | 500 |
| terms.translate.phrase_to_term | 1–3 | phrase_to_term, figure_to_term | 500 |
| terms.translate.sequence_to_term | 1–4 | sequence_to_term | 500 |
| terms.evaluate.single_value | 1–3 | single_value | 500 |
| terms.evaluate.value_table | 1–3 | value_table | 500 |
| terms.evaluate.find_input | 2–4 | find_input, compare_terms_table | 500 |
| terms.collect_like.collect | 1–3 | collect | 500 |
| terms.collect_like.spot_error | 2–4 | spot_error | 500 |
| terms.simplify_products.number_times_term | 1–3 | number_times_term | 500 |
| terms.simplify_products.area_terms | 2–4 | area_terms | 500 |
| terms.expand_factor.expand | 1–4 | expand_positive, expand_negative, expand_collect | 500 |
| numterms.evaluate.name_law **(S11)** | 1–3 | name_law | 500 |
| numterms.evaluate.compute_cleverly **(S11)** | 2–4 | compute_cleverly | 500 |
| terms.simplify_products.quotient **(S11)** | 1–3 | quotient | 500 |
| terms.simplify_products.term_type **(S11)** | 1 | term_type | 500 |
| terms.expand_factor.fill_missing **(S11)** | 1–3 | fill_missing | 500 |
| terms.expand_factor.factor_out | 2–4 | factor_out | 500 |
| terms.translate.match_term_situation **(S12)** | 1–3 | match_term_situation | 500 |
| terms.translate.think_of_number **(S12, G7)** | 4 | phrase_to_term | 500 |
| terms.collect_like.equivalence_check **(S12)** | 1–4 | equivalence_check | 500 |
