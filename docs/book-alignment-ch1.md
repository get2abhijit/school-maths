# Book alignment – Chapter I (Terme mit einer Variable)

Source: a licensed e-book copy of Lambacher Schweizer 7 BW (screenshots of the Klett viewer, 121 PDF pages = double-page spreads), accessed 2026-10-31. Copyright: only headings, page numbers and the *kind* of content were extracted. No exercises, solutions or figures were copied.

Also used: a teacher's checklist for the first Klassenarbeit (dated 16.11.2026). No personal data from it was recorded; the blueprint in `exams.json` contains paraphrased statements and page numbers only.

## 1. Chapter structure (TOC p. 2–3 of the book)

The book TOC is identical to the Klett TOC already recorded in `docs/curriculum-sources.md`. The chapter/section structure of `catalog.json` was therefore already correct. No chapter renumbering is needed.

| Book | Title | Page | App skill(s) |
|---|---|---|---|
| I.1 | Zahlterme mit rationalen Zahlen berechnen | 8 | ch1.numterms.evaluate |
| I.2 | Terme mit einer Variable | 12 | ch1.terms.translate, ch1.terms.evaluate |
| F&F | Fördern und Fordern | 16 | – |
| I.3 | Summen mit einer Variable vereinfachen | 17 | ch1.terms.collect_like |
| I.4 | Produkte mit einer Variable vereinfachen | 21 | ch1.terms.simplify_products |
| I.5 | Ausmultiplizieren und Ausklammern | 24 | ch1.terms.expand_factor |
| F&F / Vernetzen / Rückblick / Training / Test | | 28 / 29 / 30 / 31 / 33 | – |

## 2. What the book sections teach (paraphrased, observed from the pages)

- **I.1:** the set ℚ, the order of operations as a four-step rule (brackets, powers, Punkt vor Strich, left to right) with a mnemonic, converting between decimal and fraction notation within one term, and the laws KG+, KG·, AG+, AG· and DG, each named and abbreviated. Ausmultiplizieren/Ausklammern and the Plus-/Minusklammerregel are applied to number terms. Also "möglichst geschickt" calculation, and a "Begriffstraining" in which a named rule is matched to a given transformation.
- **I.2:** terms from situations, figures and dot/match patterns; substituting values; value tables; sequences → term.
- **I.3:** equivalence (same value for every substitution), "umformen/vereinfachen", sorting summands and collecting like terms.
- **I.4:** products of numbers and **one** variable factor, and **quotients** such as (3x):2 and 20x:8, which are rewritten as products. Includes classifying a term as product, sum, etc. by its last operation. Products of the form x·x appear **not** in the info box.
- **I.5:** Ausmultiplizieren and Ausklammern with variables, Plus- and Minusklammerregel, fill-in-the-missing-number transformations, justifying equivalence, and a sum in the numerator of a fraction split via DG (with the warning that this does not work for a sum in the denominator).

## 3. Gaps between book/checklist and the app (Session 10 state)

| # | Gap | Book / checklist | Action |
|---|---|---|---|
| G1 | **Naming laws**: no exercise asks for KG+/KG·/AG+/AG·/DG/Plusklammer-/Minusklammerregel | I.1 Begriffstraining; checklist 1.1 "…kann diese auch benennen" | New family `ch1.numterms.evaluate/name_law` (match transformation → law, multiple choice), L1–L3 |
| G2 | **Calculate cleverly**: only plain evaluation exists | I.1 example 3; checklist 1.1 | New family `compute_cleverly`: original terms built so that reordering/DG produces whole numbers; answer = value + law used (two-part) |
| G3 | **Quotients** (3x):2, 20x:8, (6x+8):2 | I.4 info text, I.5 note | New family `ch1.terms.simplify_products/quotient`; sum-in-numerator case in `expand_factor/divide_sum` |
| G4 | `term_times_term` (x·x) and `sum_times_sum` go beyond I.4/I.5 info boxes | not in the Merkkasten | Keep in the app, but mark `inBookScope: false`, exclude from the KA mode and from automatic level selection for Ch I. Status stays as-is |
| G5 | **Fill in the missing number** (●·(2x+7)=6x+21 type) | I.5 exercises; checklist 1.5 | New family `expand_factor/fill_missing` |
| G6 | **Term type by last operation** | I.4 Begriffstraining | New family `simplify_products/term_type` (multiple select), L1 only |
| G7 | "Denke dir eine Zahl" chains → term → simplify | Training / Test type | Covered by `translate/phrase_to_term` L2–L3; add an L4 variant "describe the relation between start and end number" |

Proposed level notes for the new families (to be put in the template docstrings):

- `name_law`: L1 one law with whole numbers; L2 fractions/decimals, laws including Plus-/Minusklammerregel; L3 two-step transformation, name both steps in order.
- `compute_cleverly`: L2 reorder (KG/AG) to whole numbers; L3 DG backwards (Ausklammern) with fractions; L4 decide which of two routes is cleverer and why (multiple choice).
- `quotient`: L1 (ax):b with b | a; L2 fractions as result, negative divisor; L3 sum in the numerator.
- `fill_missing`: L1 missing factor before the bracket; L2 missing term inside the bracket; L3 negative factor / Minusklammer.

Misconceptions to cover: dividing only the first summand ((6x+8):2 → 3x+8); splitting a sum in the denominator; Minusklammer changing only the first sign; confusing KG with AG; calling the Plusklammerregel the Distributivgesetz.

## 3a. Status after Session 11
G1 `name_law`, G2 `compute_cleverly`, G3 `quotient` (incl. sum in the numerator at L3, instead of a separate `divide_sum` family), G5 `fill_missing`, G6 `term_type` (single choice per term) are implemented and validated; G4 flags set (`inBookScope: false`). G7 (L4 „describe the relation“) is implemented in Session 12 as `translate/think_of_number` (family `phrase_to_term`, L4), together with the planned families `match_term_situation` and `equivalence_check` (D94). All G-items are now done.

## 4. Uncertainties (provisional)

- The checklist gives "Nachlesen S.15" for products. In the book, I.4 starts on p. 21, and p. 15 holds I.2 exercises. The exercise references on the checklist (S.21/1, S.23/18) point to I.4. Most likely a slip on the checklist. The app shows **S.21** and notes the checklist's S.15.
- The checklist item 1.5 lists Ausmultiplizieren, Minusklammer and Plusklammer, but **not Ausklammern**. The book's chapter test (p. 33), which the checklist names as the final self-check, does contain Ausklammern. The KA mode therefore includes it as an optional "Zusatz" that is **on by default** and can be switched off.
- Only Chapter I was checked page by page. Chapters II–VII were checked against the TOC only (already done in earlier sessions).
