# Privacy (DSGVO)

The user is a minor. The app is built so that no personal data leaves the device. Status: implemented in Sessions 3–4 (`ui/*.js`), extended in Session 9 (coverage settings), guarded by `test/build.test.js` (privacy test), `test/ui.dom.test.js`, `test/ui.worksheet.dom.test.js` and `test/ui.coverage.dom.test.js`.

## Commitments
- No accounts, no login, no telemetry, no analytics, no trackers, no ads, no AI/LLM calls at runtime.
- No network calls from app code. `test/build.test.js` fails if the UI contains `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `importScripts`, `eval(`, `new Function`, `.innerHTML` or `document.write`.
- **The only external resource** is KaTeX 0.16.22 (`https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.22/katex.min.js`), loaded with `referrerpolicy="no-referrer"` and `crossorigin="anonymous"` (no cookies, no referrer). Like any web request, cdnjs/Cloudflare sees the IP address and user agent. This is stated in the app (Fortschritt → Datenschutz). Without network the app works fully; formulas appear as plain text.
- **No web fonts.** Google Fonts are deliberately not used (loading them from Google servers transmits the IP address; this has been ruled a DSGVO violation in Germany, LG München I, 20.01.2022). System fonts only.
- No KaTeX stylesheet/fonts are loaded: KaTeX renders MathML, which browsers display natively (D28).

## What is stored, where
Only in the browser's `localStorage` on this device. Every access is wrapped in `try/catch`; if storage is blocked (private mode) the app still works and says that progress will be lost on close.

| Key | Content | Personal data? |
|---|---|---|
| `mathe7.progress.v1` | Per skill: counts (questions, attempts, correct, first-attempt correct, hints, solutions shown, skipped), error-category counts, last 10 first-try results (0/1), last 24 first-try results with level, outcome (clean / hinted / miss) and date, review box, last practised / next review dates (Session 10). Latest chapter diagnostic result per chapter: date and, per skill, verdict, level and counts — no questions, no answers (Session 10). Settings: current chapter, colour scheme, „Im Unterricht behandelt“ (switch on/off + list of textbook section ids such as `ch6.s2`; since Session 9). Saved problem reports. **Since Session 11:** each of the last 24 answers also stores the template id (which kind of exercise, e.g. `ch1.terms.simplify_products.quotient`); and per Klassenarbeit (`exams.ka1`): the KA date, the self-ratings (0–3 per checklist statement), Zusatz switches, timer setting, ticked plan days and up to 20 finished practice rounds (round, seed, code, mode, date, points per task) — no typed answers. | No — covered sections describe the class's progress in the book, not the person; report notes could contain personal data only if the student types it in (the dialog asks not to). |
| `mathe7.session.v1` | The open/last practice session: question ids (template, version, level, seed), signatures, attempt statuses, hints opened. | No |
| `mathe7.diagnostic.v1` | The running or just finished chapter diagnostic: question ids, signatures, answered flags and right/wrong/unknown per item (no typed answers). Kept until the student closes the result or starts a new one. | No |
| `mathe7.ka.v1` | Session 11: the running practice Klassenarbeit (round record with question ids, the typed answers or self-marked points, start time for the optional timer). Deleted when the round is closed or aborted. | No |
| `mathe7.draft.v1` | The unsent input of the current question (one entry). | No |
| `mathe7.worksheet.v1` | The current worksheet and up to 8 recent ones: settings (topics, levels, count, title, key type, calculation space, whether name/date lines are printed), seed, question ids + signatures, code, creation date; last used settings. | No — name and date are never entered (empty lines on paper, D45). The title field asks not to enter a name. |

Question content is never stored; it is regenerated from the id.

## User controls (Fortschritt → Deine Daten)
- **Sicherung speichern**: JSON export. Inside claude.ai the platform's `downloads` capability shows a save confirmation; in a locally opened file a normal browser download is used. **Als Text anzeigen** always works (copy/paste).
- **Sicherung laden / Text einfügen**: import, validated by `validateProgress` (schema, version, numbers, dates, ids); invalid files are rejected with a message, a valid one replaces the data after confirmation.
- **Alle Daten löschen**: removes all six keys (incl. `mathe7.ka.v1`) after confirmation — including the „Im Unterricht behandelt“ marks (they live in `mathe7.progress.v1`).
- **Kapitel → Im Unterricht behandelt**: the student marks sections; nothing is pre-filled or guessed, the switch is off by default. The marks are part of the export and are validated on import (`validateCoverage`: boolean switch, ≤ 200 ids of the form `chN.sM`; anything else rejects the import). Older exports without the field import with the filter off.
- **Arbeitsblätter → Als HTML-Datei speichern**: a standalone file containing only the printed paper (no scripts, no external references). Saved only where the user confirms.
- **Problem melden**: builds a report (question id, template version, seed, level, signature, engine/catalog version, date, the given answer, optional note ≤ 1000 chars). It is only stored locally and copied by the user; nothing is sent.

## Hosting note
See also `docs/deployment.md` (S12). Whoever hosts the file (GitHub Pages, Codeberg Pages, Netlify, a school server) receives the IP address and browser data of every visitor in its server logs; cdnjs.cloudflare.com receives the same when KaTeX is loaded. The app itself still sends nothing. For a minor's use, prefer a host in the EU (e.g. Codeberg e.V., Berlin) or the local file, and do not put the link on a public page with the child's name.

When published as a claude.ai Artifact, the page runs inside Anthropic's viewer; whoever opens the link uses claude.ai under its terms. For use without any account, save the HTML file and open it locally (everything except formula typesetting works offline).
