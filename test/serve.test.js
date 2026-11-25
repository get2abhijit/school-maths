'use strict';
/** S12 (D98/D99): local server serves only dist/, "/" is the app; site/ copy for hosting. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

function get(port, p, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method }, res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: b })); });
    req.on('error', reject); req.end();
  });
}

test('tools/serve.js: app at /, 404 for unknown files, no path traversal, GET/HEAD only', async () => {
  require(path.join(root, 'build.js')).build();
  const port = 18000 + (process.pid % 1000);
  const child = spawn(process.execPath, [path.join(root, 'tools', 'serve.js'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((res, rej) => { child.stdout.on('data', d => { if (String(d).includes('läuft')) res(); }); child.on('exit', c => rej(new Error(`exit ${c}`))); });
    const home = await get(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.type, /text\/html/);
    assert.equal(home.body, fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8'));
    assert.equal((await get(port, '/nope.html')).status, 404);
    assert.notEqual((await get(port, '/../package.json')).status, 200);
    assert.notEqual((await get(port, '/%2e%2e/package.json')).status, 200);
    assert.equal((await get(port, '/', 'POST')).status, 405);
  } finally { child.kill(); }
});

test('tools/make-site.js: site/index.html is the built app', () => {
  execFileSync(process.execPath, [path.join(root, 'tools', 'make-site.js')]);
  assert.equal(fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'dist', 'mathe7.html'), 'utf8'));
  assert.ok(fs.existsSync(path.join(root, 'site', '.nojekyll')));
});
