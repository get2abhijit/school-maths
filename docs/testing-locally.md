# Testing the complete app locally (Session 12)

Everything runs on your own computer; nothing needs an account or a server.

## 1. One-time setup
1. Install Node.js 22 LTS (or newer) from nodejs.org.
2. Unzip `mathe7-session12.zip` and open a terminal in the folder `mathe7`.
3. Optional, but needed for the full suite (browser simulation + KaTeX check):
   `npm run test:dev-deps` (installs jsdom 24.1.3 and KaTeX 0.16.22 without saving them; needs internet once).

## 2. Automated tests (every time before you use or publish a new version)
- `npm test` builds `dist/mathe7.html` and runs all tests (about 3 minutes).
  The last lines must read `# fail 0`. Without the optional dependencies the browser tests are *skipped*, not failed.
- `npm run golden` only after a deliberate content change (then review the diff).

## 3. Run the app in a real browser
- `npm run serve` → open **http://localhost:8080/** in Chrome, Firefox, Edge or Safari. Stop with Ctrl+C.
- Phone or tablet in the same Wi-Fi: `npm run serve:lan` and open the `http://192.168.…:8080/` address it prints.
  (Windows may ask whether Node may use the network: allow it for private networks only.)
- Why a server instead of double-clicking the file? On `file://` some browsers keep separate storage per file or
  block storage, so progress may seem lost. Over `http://localhost` it behaves like the published page.
- Each browser/device has its own progress. Move it with Fortschritt → Deine Daten → Sicherung speichern / laden.

## 4. Manual test protocol (what the automated tests cannot see)
Tick each line; note the browser/device. Report problems with „Problem melden“ (copies question id + seed).

| # | Check | Expected |
|---|---|---|
| 1 | Start page in light and dark mode (system setting) | Readable, no white boxes in dark mode, diagrams visible in both |
| 2 | Üben → Winkel an sich schneidenden Geraden → Stufe 2 | Drawing with g, h, t, arrows on g and h, asked angle shaded and bold; „117“ and „117°“ both accepted |
| 3 | Üben → Winkelsumme im Dreieck → Stufe 4 | Proof steps can be moved with the buttons (also by keyboard: Tab + Enter) |
| 4 | Formulas | Greek letters and degrees render (α′, 63°); with network off, the text fallback is readable |
| 5 | KA vorbereiten → rate one statement → Üben → back | Rating stays after reload (F5) |
| 6 | Übungs-KA on screen with 30-minute timer | „Noch etwa … Minuten“ counts down without reloading (every ~20 s); no right/wrong before „Abgeben“ |
| 7 | Übungs-KA „Auf Papier bearbeiten“ → print preview (Ctrl+P) of Aufgabenblatt and Lösungsblatt | A4, no task split across pages, page numbers, black and white readable |
| 8 | Arbeitsblätter → topics incl. Winkel → print preview | Diagrams ≤ 9 cm wide, not cut at a page break, kariert space below |
| 9 | Phone (serve:lan): practise 5 questions | Large touch targets, keyboard does not hide the input, diagram fits the width |
| 10 | Fortschritt → Sicherung speichern, Alle Daten löschen, Sicherung laden | Data gone after delete, back after import |
| 11 | Reload in the middle of a practice session | Session continues at the same question |

KA thresholds (`KA_RULES` in `src/exam.js`) are reasoned defaults. If the self-rating notes feel wrong after real use,
write down the situation (rating, answers, what the app said) — that is the evidence needed to change them.

## 5. What has never been verified by the developer (Claude)
No real browser, phone or printer was available in the development chats. All UI checks ran in jsdom (a simulated
DOM without layout, printing or KaTeX fonts). Rows 1, 4, 6–9 of the protocol are therefore the important ones.
