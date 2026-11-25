'use strict';
/**
 * S12 (D93): new families enter the KA blueprint, so a NEW Übungs-KA with the same seed may pick other questions.
 * Mock rounds stored in Session 11 keep their question ids and must still reload with identical questions.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

const bp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'exams.json'), 'utf8')).exams.find(e => e.id === 'ka1');
const s11 = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'mock.s11.golden.json'), 'utf8'));

test('Session-11 mock rounds reload with the same questions', () => {
  assert.equal(s11.mocks.length, 3);
  for (const { record, qids } of s11.mocks) {
    const r = E.loadMock(bp, record);
    assert.ok(r.ok, `${record.code}: ${r.message}`);
    assert.deepEqual(r.mock.tasks.map(t => t.questions.map(q => q.id)), qids, record.code);
    for (const t of r.mock.tasks) for (const q of t.questions) assert.ok(E.validateQuestion(q).ok, q.id);
  }
});
