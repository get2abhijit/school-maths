'use strict';
/**
 * tools/make-site.js — copies the built app into site/ for manual hosting (S12, D99):
 *   site/index.html   (= dist/mathe7.html)
 *   site/.nojekyll    (GitHub Pages: serve files as they are)
 * Upload the contents of site/ to GitHub Pages (branch), Codeberg Pages, Netlify Drop or any static web space.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'dist', 'mathe7.html');
if (!fs.existsSync(src)) { console.error('dist/mathe7.html fehlt – erst "node build.js" ausführen.'); process.exit(1); }
const out = path.join(root, 'site');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(src, path.join(out, 'index.html'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`site/index.html written (${(fs.statSync(src).size / 1024).toFixed(1)} KiB) — upload the folder site/`);
