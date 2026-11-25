# Curriculum sources

First accessed 2026-10-26; later checks below. Curriculum requirements (Bildungsplan) are kept separate from textbook order (Klett TOC). Wording of standards is paraphrased, never copied.

| # | Source | URL | Fetched | Extracted | Uncertainties |
|---|---|---|---|---|---|
| S1 | Klett TOC, Lambacher Schweizer Mathematik 7, BW (736371) | https://assets.klett.de/assets/9b4ce3d9dc52cd645a15726ef96c0448e33d249874d5b175891c10815d4f10b9/Inhaltsverzeichnis_LASC_BW_7_736371.pdf | yes | 7 chapter titles, 36 section headings, start pages, recurring page types (Check-in, Fördern und Fordern, Vernetzen und Vertiefen, Rückblick, Training, Test, GFS) | Roman/section numbering reconstructed from PDF text layer; counts match exactly (5/2/6/5/7/6/5) |
| S2 | Klett product page | https://www.klett.de/produkt/isbn/978-3-12-736371-5 | yes | ISBN 978-3-12-736371-5, G9 BW ab 2025, approved for revised Bildungsplan V3 | Marketing text |
| S3 | Bildungsplan Gymnasium Mathematik V3.0 (Fassung 21.05.2026) | https://www.bildungsplaene-bw.de/,Lde/DE_BW_BILDUNGSPLAENE_GEN2X_BPBW_ALLG_GYM_M(V3.0) | yes | Process competences 2.1–2.7; standards 3.1 (Kl. 5/6, prerequisites), 3.2 (Kl. 7/8), 3.3 (Kl. 9/10, used only as upper bound) | Standards grouped Kl. 7/8 — no per-grade split. Italics (binding terms) lost in extraction |
| S4 | Klett Stoffverteilungsplan LS7 G9 BW 736371 (Stand 03.06.2026) | listing: https://www.klett.de/lehrwerk/lambacher-schweizer-mathematik-ausgabe-baden-wuerttemberg-g9-ab-2025/stoffverteilungsplaene · PDF: https://assets.klett.de/assets/fa5cb96b64b14ad7bb6235dac148f96e1c70c006dd047bb91d4023361b63facb/Stoffverteilungsplan_Lambacher_Schweizer_7_Baden-Wuerttemberg_736371_260603.pdf | **yes (2026-10-29)** | Per chapter: emphasised process competences, content standards (Bildungsplan V3.0 numbering), list of sections | Chapter-level only (no section → standard table); columns „Zeitraum“ and „Klassenarbeit“ are empty (no time plan) |
| S5 | ZSL Beispielcurriculum Mathematik V3.0 Kl. 7/8 | https://www.bildungsplaene-bw.de/32756074 | no (2026-10-29: URL not fetchable without a search hit; search found only BP2016 Beispielcurricula) | — | **Not read.** No longer needed for the book's Grade 7 scope (S4 answers it for LS7) |
| S7 | Klett Rückblick p. 168, older LS7 BW edition (733371) | https://asset.klett.de/assets/d7a3fdf0/Lambacher_Schweizer_7_Schuelerbuch_Baden_Wuerttemberg_S168_733371.pdf | yes (2026-10-28) | Terminology of Zinsrechnung, Dreisatz layout | Older edition, not the 2025 book |
| S6 | School website of the first test user (a Gymnasium in Baden-Württemberg) | (not listed here) | yes | Eduplaces guide lists Klett digital books incl. Mathematik | No Schulcurriculum or maths sequence published; series/edition not stated |

### Session 5 check (2026-10-27)
- S1 re-fetched: Chapter IV „Lineare Gleichungen“ (p. 80) has five sections: 1 Gleichungen aufstellen und Lösungen finden (82), 2 Äquivalenzumformungen von Gleichungen (85), 3 Lineare Gleichungen vereinfachen und lösen (88), 4 Anzahl der Lösungen einer linearen Gleichung (92), 5 Lineare Gleichungen im Sachzusammenhang (94); GFS „Zahlenzauberei“ (102). Matches catalog.json; IV.2 and IV.3 stay one skill (D50).
- S4 searched again (web search “Lambacher Schweizer 7 Baden-Württemberg G9 Stoffverteilungsplan”): only plans for other states/editions (NI, RP, NRW, Thüringen, older BW) were found. **Not used** — different curricula. Ch IV curriculum mappings keep their previous status (3.2.1(20), (22) as recorded in S1; the rest provisional).
- Not verified: the book's notation for solution sets (L = {…}) and for transformations (│ −5) — see D47, D53. The GFS page is not modelled.

### Session 6 check (2026-10-28)
- S1 re-fetched: Chapter VI „Prozent- und Zinsrechnung“ (p. 138) has six sections: 1 Anteile vergleichen – Prozente (140), 2 Prozentsätze berechnen (143), 3 Prozentwerte berechnen (146), 4 Grundwerte berechnen (149), 5 Zins und Zinseszins (153), 6 Kredit und Tilgung (157); GFS „Prozente in Grafiken“ (167). Matches catalog.json; VI.2–4 stay one skill.
- S7 (new): Klett sample page „Rückblick“ p. 168 of the **older** edition (LS7 BW, ISBN …733371, 2016): https://asset.klett.de/assets/d7a3fdf0/Lambacher_Schweizer_7_Schuelerbuch_Baden_Wuerttemberg_S168_733371.pdf. Used **only for terminology and method names**: Prozentwert/Prozentsatz/Grundwert ↔ Zinsen/Zinssatz/Guthaben bzw. Kapital; Dreisatz table 100 % → 1 % → p %; Zinseszinsen are settled year by year. No exercises, numbers or text copied. Uncertain whether the 2025 edition (736371) uses the same terms; the older page also shows a power of the growth factor in one example, which the app does not use (D60).
- S4 (Stoffverteilungsplan) still not found → curriculum mappings for Ch VI unchanged (3.2.1(2) partly, (3) verified as recorded in S1; loan mapping 3.2.1(4) provisional).
- Not verified: whether VI.5 covers interest for parts of a year (Tages-/Monatszinsen) — not modelled; whether VI.6 uses fixed-rate (Annuität-like) or constant-Tilgung loans — the app models fixed yearly rates (D60); the GFS page is not modelled.

### Session 7 check (2026-10-28)
- S1 re-fetched: Chapter II „Proportionalität und Antiproportionalität“ (p. 36) has two sections: 1 Proportionale Zusammenhänge (38), 2 Antiproportionale Zusammenhänge (42); no „Vernetzen und Vertiefen“ and no GFS page in this chapter. Matches catalog.json.
- S3 re-fetched (Bildungsplan V3.0, section 3.2.4 Funktionaler Zusammenhang, Kl. 7/8). Standard (4) covers recognising proportionality and antiproportionality in different representations and using them for calculations, also in context → mapping **verified** for both Ch2 skills. Standards (1) (switching between tables, equations, graphs, text) and (3) (reading facts from representations) fit, but which parts LS7 II covers is not confirmed → **provisional**. Standards (6)–(9) (linear functions y = mx + c) belong to Kl. 7/8 but have no LS7 section → out of scope.
- S3, Kl. 5/6 section 3.1.4 standard (5): proportional and antiproportional relations in concrete situations, solved also as Dreisatz → Dreisatz itself is a prerequisite (`kl6.dreisatz`), Kl. 7 adds the representations. This is why L2 Dreisatz tasks are „Standard“, not new technique.
- Not verified (book pages not inspected): whether LS7 uses the words „Proportionalitätsfaktor“, „Quotientengleichheit“, „Produktgleichheit“ and „Hyperbel“ (the app uses the first three and describes the antiproportional graph in words without „Hyperbel“), and whether graphs are drawn in II.1/II.2 (D64). No exercises or text copied.

### Session 8 check (2026-10-28)
- S1 re-fetched: Chapter VII „Daten und Zufall“ (p. 168) has five sections: 1 Daten auswerten (170), 2 Zufallsexperimente (174), 3 Wahrscheinlichkeiten bestimmen (178), 4 Versuchsreihen ergeben Wahrscheinlichkeiten (182), 5 Laplace-Experimente (185); GFS „Simulation von Zufallsexperimenten“ (195). Matches catalog.json. No section on Baumdiagramme/Pfadregeln.
- S3 re-fetched, section 3.2.5 (Kl. 7/8), standards (1)–(12): (1) data from secondary sources, (2) formulate/judge statements based on data, (3) meaning of everyday probability statements, (4) Ergebnis/Ereignis, (5) events in set notation, (6) perform and evaluate experiments (also digitally), (7) relative frequencies as estimates, law of large numbers, (8) possible/favourable outcomes by combinatorial reasoning, (9) compare probabilities, Laplace, (10) Gegenereignis, (11) Baumdiagramme, (12) Pfadregeln.
- Mappings set where the standard wording matches the skill content directly: data.analyze (1), (2) verified; experiments (4), (5) verified, (6) provisional (performing experiments is not modelled); determine (10) verified, (3) and (8) provisional (which LS7 section treats everyday statements and counting is not confirmed); frequency (7) verified; laplace (8), (9) verified (unchanged). (11), (12) are out of scope for Kl. 7 (no LS7 section; possibly Kl. 8).
- Kl. 5/6 standard 3.1.5(4) lists the Kenngrößen Maximum, Minimum, Spannweite, Median, Mittelwert → prerequisite `kl6.statistics_basics`; Kl. 7 uses them, no new Kenngrößen.
- Not verified (book pages not inspected): LS7 notation for sets and the sample space (D67), whether VII.3 uses non-uniform probability tables (the app does, family outcome_sum), whether VII.3 or VII.5 contains the counting content. No exercises or text copied.

### Session 9 check (2026-10-29) — catalogue verification
- **S1 re-fetched.** All 7 chapters, 36 sections and start pages recorded in `catalog.json` (`chapter.sections`, ids `chN.sM`). Every skill now lists its sections (`textbookRef.sections`); every existing page reference matched the TOC (checked by script and by `test/coverage.test.js`). All 36 sections are used by at least one skill.
- **S4 read for the first time** (the PDF link appeared on the listing page). Content standards per chapter (paraphrased numbers only):
  - I: 3.2.1 (1), (5), (6), (7), (8), (9) · II: 3.2.4 (1), (4) · III: 3.2.3 (5), (6), (7), (8), (10) · IV: 3.2.1 (20), (22)
  - V: 3.2.3 (1), (2), (3), (4), (5), (8), (9), (10) · VI: 3.2.1 (2), (3), (4) · VII: 3.2.5 (1)–(10)
  - S4 lists (11) Baumdiagramme and (12) Pfadregeln for **no** LS7 chapter → confirms D68. It lists no 3.2.4 (6)–(9) (lineare Funktionen) → confirms the Ch II scope rule.
- **Mapping changes (rule D71, details D72):** verified 3.2.1(5), (6) (translate); 3.2.4(1) (both Ch II skills); 3.2.3(8) (distances; Ch V problems also (3)); 3.2.1(20) (setup_trial, word_problems); 3.2.1(2) (pct.compare); 3.2.1(4) (loan, note: no spreadsheet); 3.2.5(3), (8) (determine); 3.2.5(6) moved to frequency (note: only evaluating). Removed: 3.2.4(3) in Ch II, 3.2.1(5) in Ch IV (not listed there by S4).
- Still provisional: process competence „2.1“ on `ch5.proof.isosceles` (S4 names the area, not the number); `kl6.geometry_basics` → 3.1.3 (S4 covers Kl. 7 only).
- **Gaps** (S4 standard without a skill, D73): 3.2.3(10) Tangenten (Ch III and V), 3.2.3(5) in Ch V. For the geometry sessions.
- S6 (school) not re-checked this session; nothing new was needed. Use of LS7 at a particular school stays provisional.
- Not verified (book pages still not inspected): notation questions D47, D53, D67; sum × sum in I.5 and x² in I.4; whether III.5 names Kongruenzsätze; terminology in Ch II.

## Scope rules derived (applied in catalog.json)
- Grade 7 = the textbook's sections. Since Session 9 the in-scope 3.2 standards are exactly those S4 lists for LS7 (stored per chapter in `catalog.json`). Standards S4 does not list for LS7 (binomische Formeln, Gleichungssysteme, Ungleichungen, lineare Funktionen, Wurzeln, Strahlensätze, Baumdiagramme/Pfadregeln, Ähnlichkeit) are out of scope.
- Hard upper bounds (Kl. 9/10 per S3): Bruchgleichungen, closed compound-interest formula, conditional probability/Vierfeldertafel, Pythagoras, trigonometry.
- Ch7: no Baumdiagramme/Pfadregeln, no Quartile/Boxplots, no simulation at runtime; two dice only by counting ordered pairs (D68).
- Ch2: no y = mx + c, no Steigung, no drawn graphs yet (D64); graph shapes only described.
- Ch6: no closed compound-interest formula (year by year only), no Tages-/Monatszinsen, no constant-Tilgung loans (not verified as book content).
- Ch4: no quadratic solving, no Bruchgleichungen, no inequalities; x² only for checking given numbers (IV.1, L4); angle contexts deferred to Ch5 (D49).
- Ch1: sum × sum kept behind a `disabled_by_default` flag; x·x in I.4 provisional.

## Open items (keep `provisional`)
1. Process competence numbering („2.1“ on `ch5.proof.isosceles`) — check against the S3 section 2 headings.
2. ~~Kl. 7 vs Kl. 8 split (S5)~~ — resolved for the book by S4 (Session 9). S5 itself still unread.
3. Sum × sum in I.5, x² in I.4 (book pages not inspected).
4. Whether III.5 names Kongruenzsätze.
5. The school uses Lambacher Schweizer specifically (only "Klett, Mathematik" confirmed).
6. Exact standard wording (verify against official PDF before showing it in the UI; the app shows only numbers in data, not in the UI).
7. Gaps 3.2.3(10) (Ch III/V) and 3.2.3(5) (Ch V): which section teaches them — needed when geometry is built.

## Session 11 (2026-10-31)
- Chapter I compared page by page with a licensed e-book copy of LS7 BW and with a teacher's checklist for the first Klassenarbeit (16.11.2026): see `docs/book-alignment-ch1.md`. Only headings, page numbers and the kind of content were recorded; no exercises or text were copied. The chapter/section structure in catalog.json was already correct. Status of Chapter I textbook references stays `verified`; the KA blueprint (exams.json) records page/exercise numbers only.

## Session 12 (2026-11-03)
- No new fetch. Chapter V sections V.1 (S. 106) and V.2 (S. 110) and standards 3.2.3(1)–(3) were verified against the TOC and the Bildungsplan in earlier sessions (catalog status verified); the new templates use only those contents (angles at intersecting lines and parallels incl. Umkehrung, angle sum in the triangle, its proof).
- Uncertainty: the book's naming of the outer alternate pair and the co-interior pair was not checked, so the app never asks for these names (D97). Whether V.2 treats the Außenwinkel explicitly is not verified; the L3 task only uses Nebenwinkel + angle sum, both verified contents.
- GitHub Actions versions for the Pages workflow were checked via web search on 2026-11-03 (checkout v6, setup-node v6, configure-pages v6, upload-pages-artifact v5, deploy-pages v5).
