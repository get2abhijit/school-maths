# Mathe 7 – Übungsapp

Offline practice app for Grade 7 mathematics (Gymnasium G9, Baden-Württemberg). UI language: German; code and docs: English.

- Generated exercises with hints, worked solutions and instant feedback, printable worksheets with answer keys, progress tracking.
- Everything runs in the browser. No accounts, no tracking, no server. Progress is stored only in the browser's localStorage (export/import and "delete all data" are built in).
- The only external resource is KaTeX (pinned version) from cdnjs.
- All exercises are original. The app is not affiliated with any publisher or school.

## Use

Live version (GitHub Pages): https://get2abhijit.github.io/school-maths/

Run locally (Node 22+, no dependencies needed):

```
npm run serve        # http://localhost:8080/
npm test             # build + full test suite
npm run site         # static site in site/
```

See `docs/testing-locally.md`, `docs/deployment.md`, `docs/privacy.md` and `PROGRESS.md`.
