# Deployment (Session 12)

The app is ONE self-contained file: `dist/mathe7.html` (≈ 1 MB). Any static web space can host it.
It stores progress only in the visitor's browser (localStorage) and sends nothing; the only external request is
KaTeX (formula typesetting) from cdnjs.cloudflare.com.

## Option A — GitHub Pages with automatic tests (recommended if you use GitHub)
1. Create a repository (it may be **private** only with a paid GitHub plan for Pages; otherwise public).
   Note: a public repository makes the code public — it contains no personal data.
2. Push the content of the `mathe7` folder (including `.github/workflows/pages.yml`) to the branch `main`.
3. Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. Every push to `main` now runs `npm test`; only if all tests pass it publishes `index.html`.
   The address is `https://<user>.github.io/<repository>/`. The Actions tab shows the run and any failure.
5. Manual re-run: Actions → „Deploy to GitHub Pages“ → Run workflow.

## Option B — GitHub Pages without Actions
1. `npm run site` → folder `site/` with `index.html` and `.nojekyll`.
2. Put these two files into a repository (root or `/docs`), Settings → Pages → Source: „Deploy from a branch“, choose
   the branch and folder. Run `npm test` yourself before every upload.

## Option C — alternatives
- **Codeberg Pages** (Codeberg e.V., Berlin — EU hosting): repository named `pages`, upload `site/index.html`;
  address `https://<user>.codeberg.page/`.
- **Netlify Drop**: drag the `site/` folder onto app.netlify.com/drop (account needed to keep it).
- **School or private web space / NAS**: copy `site/index.html` to any folder served over https.
- **No hosting at all**: copy `dist/mathe7.html` onto the device and open it in the browser (see the note on file://
  in `testing-locally.md`). Works offline except formula typesetting (readable text fallback).
- **claude.ai Artifact**: the link published in each session; requires opening claude.ai.

## Updating
Build a new version (`npm test`), deploy the same way. Progress survives updates because it lives in the visitor's
browser under the same address and the stored data contains only question ids, which stay valid (golden tests).
Changing the address (e.g. another host) starts with empty progress → move it with Sicherung speichern / laden.

## Privacy checklist (DSGVO, user is a minor)
- The host and cdnjs see IP addresses and user agents in their logs (see `privacy.md`). Prefer an EU host.
- Do not publish the link next to the child's name; no analytics or trackers may be added to the page
  (`test/build.test.js` fails if a second external resource appears).
- https only (all options above provide it).
