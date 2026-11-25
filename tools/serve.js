'use strict';
/**
 * tools/serve.js — zero-dependency local web server for testing the built app (S12, D98).
 *
 *   node tools/serve.js                 → http://localhost:8080/  (only this computer)
 *   node tools/serve.js --lan           → also reachable from a phone/tablet in the same Wi-Fi
 *   node tools/serve.js --port 9000
 *
 * Serves dist/ only (read-only, GET/HEAD, no directory listing, no path traversal). "/" answers with mathe7.html.
 * Why not just double-click the file? Browsers treat file:// pages differently (Firefox gives every file its own
 * storage; some mobile browsers block it), so localStorage behaviour is only realistic over http://.
 * The page itself still makes no network request except KaTeX from cdnjs.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const lan = args.includes('--lan');
const pi = args.indexOf('--port');
const port = pi >= 0 ? Number(args[pi + 1]) : 8080;
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Bad --port'); process.exit(1); }
const dist = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

if (!fs.existsSync(path.join(dist, 'mathe7.html'))) { console.error('dist/mathe7.html fehlt – erst "node build.js" ausführen.'); process.exit(1); }

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
  if (rel === '/' || rel === '/index.html') rel = '/mathe7.html';
  const file = path.normalize(path.join(dist, rel));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`Mathe 7 läuft: http://localhost:${port}/`);
  if (lan) {
    for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  im WLAN:   http://${i.address}:${port}/`);
    }
    console.log('  Hinweis: Jedes Gerät/jeder Browser hat einen eigenen Speicher (Export/Import zum Übertragen).');
  }
  console.log('Beenden mit Strg+C.');
});
module.exports = { server };
