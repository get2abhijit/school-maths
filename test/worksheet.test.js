'use strict';
/**
 * Worksheet engine tests (src/worksheet.js via the built engine.js).
 * Core guarantees: every question has an answer; the answer key matches the instances (checked by
 * regenerating each question from its stored id and validating the PRINTED key text with the engine's
 * own validators); no duplicate signatures; reproducible from seed + settings; outdated sheets refused.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');
const { worksheetSnapshot } = require('../tools/golden');

const SKILLS = E.skillsWithTemplates();
const CH1_SKILLS = SKILLS.filter(id => id.startsWith('ch1.'));
const CH4_SKILLS = SKILLS.filter(id => id.startsWith('ch4.'));
const base = over => ({ skills: SKILLS, levels: [1, 2, 3, 4], count: 10, baseSeed: 1, ...over });

/**
 * Test-side converter: printed key TeX → what a student would type. Deliberately independent of the engine's
 * printers, so a wrong key text (not just a wrong canonical) is caught.
 */
function texToInput(t) {
  let s = t.replace(/^\s*[a-z]\s*=\s*/, '');                    // "x = 3" → "3"
  for (let i = 0; i < 6; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => (/^\w+$/.test(a) && /^\d+$/.test(b) ? `${a}/${b}` : `((${a})/(${b}))`));
  return s.replace(/\\left\(|\\right\)/g, m => (m === '\\left(' ? '(' : ')'))
.replace(/\\%/g, '%').replace(/\\,/g, ' ')
    .replace(/\\cdot/g, '*').replace(/\{,\}/g, ',').replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\\ /g, '').replace(/[{}]/g, '').trim();
}
const mathSegments = text => text.split('$').filter((_, i) => i % 2 === 1);
const ALLOWED_STUDENT_KEYS = ['number', 'qid', 'skillId', 'level', 'prompt', 'promptLines', 'instructions', 'paperInstruction', 'response'].sort();

/** Check one key entry against a freshly regenerated question; returns nothing, asserts. */
function checkKeyMatches(entry, studentEntry, q, ctx) {
  assert.equal(entry.qid, q.id, ctx);
  assert.equal(studentEntry.qid, q.id, ctx);
  assert.ok(typeof entry.result === 'string' && entry.result.length > 0, `${ctx}: empty key`);
  const a = q.answer;
  if (a.type === 'choice' || a.type === 'multiselect') {
    // printed letter → option text on the STUDENT sheet → option id → engine says correct
    const chosen = entry.letters.map(L => {
      const idx = studentEntry.response.options.findIndex(o => o.letter === L);
      assert.ok(idx >= 0, `${ctx}: letter ${L} not on student sheet`);
      const opt = a.options.find(o => o.text === studentEntry.response.options[idx].text);
      return opt.id;
    });
    const raw = a.type === 'choice' ? chosen[0] : chosen;
    assert.equal(E.evaluateQuestion(q, raw).status, 'correct', `${ctx}: key letters ${entry.letters} wrong`);
    for (const L of entry.letters) assert.ok(entry.result.includes(`${L}: `), ctx);
  } else if (a.type === 'ordering') {
    // printed letter sequence → item texts on the STUDENT sheet → item ids → engine says correct
    assert.equal(studentEntry.response.kind, 'ordering', ctx);
    const raw = entry.letters.map(L => {
      const it = studentEntry.response.items.find(o => o.letter === L);
      assert.ok(it, `${ctx}: letter ${L} not on student sheet`);
      return a.items.find(o => o.text === it.text).id;
    });
    assert.equal(entry.result, entry.letters.join(' – '), ctx);
    assert.equal(E.evaluateQuestion(q, raw).status, 'correct', `${ctx}: key order ${entry.result} wrong`);
  } else if (a.type === 'solution_set') {
    // printed words → kind; for "genau eine" the last math segment is the value (test-side reading of the key text)
    assert.equal(studentEntry.response.kind, 'solution_set', ctx);
    assert.deepEqual(studentEntry.response.choices.map(c => c.kind), ['one', 'none', 'all'], ctx);
    let raw;
    if (/^Keine Lösung/.test(entry.result)) raw = { kind: 'none' };
    else if (/^Unendlich viele Lösungen/.test(entry.result)) raw = { kind: 'all' };
    else if (/^Genau eine Lösung/.test(entry.result)) { const segs = mathSegments(entry.result); raw = { kind: 'one', value: texToInput(segs[segs.length - 1]) }; }
    assert.ok(raw, `${ctx}: unreadable key ${entry.result}`);
    assert.equal(raw.kind, entry.solutionKind, ctx);
    assert.equal(E.evaluateQuestion(q, raw).status, 'correct', `${ctx}: key ${entry.result}`);
  } else if (a.type === 'table' && a.grid) {
    // 2-D grid: the key grid has a value exactly where the student grid has a blank; read the values back by position
    const r = studentEntry.response;
    assert.equal(r.kind, 'grid', ctx);
    assert.deepEqual(entry.grid.columns, r.columns, ctx);
    assert.equal(entry.grid.rows.length, r.rows.length, ctx);
    const raw = {};
    a.grid.rows.forEach((row, i) => row.forEach((e, j) => {
      const k = entry.grid.rows[i][j], st = r.rows[i][j];
      if (e.cell) {
        assert.ok(st.blank && k.answer, `${ctx}: cell ${e.cell} not blank on the sheet / not filled in the key`);
        raw[e.cell] = texToInput(mathSegments(k.text)[0]);
      } else {
        assert.equal(st.text, e.text, ctx);
        assert.equal(k.text, e.text, ctx);
      }
    }));
    assert.equal(E.evaluateQuestion(q, raw).status, 'correct', `${ctx}: key grid ${JSON.stringify(raw)}`);
  } else if (a.type === 'table') {
    assert.equal(entry.cells.length, a.cells.length, ctx);
    const raw = {};
    a.cells.forEach((c, i) => {
      assert.equal(entry.cells[i].label, studentEntry.response.cells[i].label, ctx);
      raw[c.id] = texToInput(mathSegments(entry.cells[i].value)[0]);
    });
    assert.equal(E.evaluateQuestion(q, raw).status, 'correct', `${ctx}: key table ${JSON.stringify(raw)}`);
  } else {
    // integer / fraction / decimal / expression: the last math segment of the printed result is the answer
    const segs = mathSegments(entry.result);
    assert.ok(segs.length >= 1, `${ctx}: no math in key ${entry.result}`);
    const raw = texToInput(segs[segs.length - 1]);
    const r = E.evaluateQuestion(q, raw);
    assert.equal(r.status, 'correct', `${ctx}: printed key "${entry.result}" → "${raw}" judged ${r.status} ${r.code || ''}`);
  }
}

function checkWorksheet(worksheet, questions, ctx) {
  const spec = worksheet.spec;
  assert.equal(worksheet.items.length, spec.count, ctx);
  assert.equal(questions.length, spec.count, ctx);
  const sigs = new Set(worksheet.items.map(i => i.signature));
  assert.equal(sigs.size, spec.count, `${ctx}: duplicate signature`);
  const layout = E.worksheetLayout(worksheet, questions);
  assert.equal(layout.student.length, spec.count, ctx);
  assert.equal(layout.key.length, spec.count, ctx);
  let prevLevel = 0;
  worksheet.items.forEach((it, i) => {
    const c = `${ctx} #${i + 1} ${it.qid}`;
    assert.ok(spec.skills.includes(it.skillId), c);
    if (!it.levelAdjusted) {
      assert.ok(spec.levels.includes(it.level), `${c}: level outside mix`);
      assert.ok(it.level >= prevLevel, `${c}: levels not ascending`);
      prevLevel = it.level;
    } else {
      // only allowed when no selected skill has the planned level
      const planned = E.planWorksheet(spec)[i].level;
      assert.ok(!spec.skills.some(s => E.levelsForSkill(s).includes(planned)), `${c}: needless level adjustment`);
    }
    // regenerate independently from the stored id: same content, validated, key matches
    const fresh = E.regenerateQuestion(it.qid);
    assert.deepEqual(fresh, questions[i], c);
    assert.equal(fresh.signature, it.signature, c);
    assert.ok(E.validateQuestion(fresh).ok, c);
    // promptTable (D63) is present exactly when the question has one, and is a copy of the given table only
    const keys = Object.keys(layout.student[i]).filter(k => k !== 'promptTable' && k !== 'diagram').sort();
    assert.equal(keys.join(), ALLOWED_STUDENT_KEYS.join(), `${c}: student entry leaks fields`);
    assert.deepEqual(layout.student[i].promptTable, fresh.promptTable, `${c}: promptTable copied unchanged`);
    // diagram (S12, D96): present exactly when the question has one; labels name angles, never give the answer
    assert.deepEqual(layout.student[i].diagram, fresh.diagram, `${c}: diagram copied unchanged`);
    if (fresh.diagram) for (const e of fresh.diagram.elements) assert.ok(!e.label || !/\d/.test(e.label), `${c}: number in a diagram label`);
    assert.ok(!/"(correct|canonical|value|distractors|solution|id)"/.test(JSON.stringify(layout.student[i].response)), `${c}: answer data on student sheet`);
    assert.equal(layout.key[i].number, i + 1, c);
    if (spec.keyMode === 'worked') assert.ok(layout.key[i].steps.length > 0, c); else assert.equal(layout.key[i].steps, null, c);
    checkKeyMatches(layout.key[i], layout.student[i], fresh, c);
  });
  return layout;
}

test('spec: invalid settings are rejected with German messages; defaults are applied', () => {
  const bad = [
    [{ ...base(), skills: [] }, /mindestens ein Thema/],
    [{ ...base(), skills: [SKILLS[0], SKILLS[0]] }, /doppelt/],
    [{ ...base(), skills: ['ch9.nope'] }, /noch keine Aufgaben/],
    [{ ...base(), levels: [] }, /mindestens eine Stufe/],
    [{ ...base(), levels: [5] }, /Ungültige Stufe/],
    [{ ...base(), count: 0 }, /zwischen 1 und 30/],
    [{ ...base(), count: 31 }, /zwischen 1 und 30/],
    [{ ...base(), count: 2.5 }, /zwischen/],
    [{ ...base(), baseSeed: -1 }, /uint32/],
    [{ ...base(), keyMode: 'all' }, /Lösungsblatts/],
    [{ ...base(), space: 'huge' }, /Rechenplatz/],
    [null, /Thema/],
  ];
  for (const [spec, re] of bad) {
    const r = E.normalizeWorksheetSpec(spec);
    assert.equal(r.ok, false, JSON.stringify(spec));
    assert.match(r.errors.join(' '), re);
    assert.throws(() => E.createWorksheet(spec), err => err instanceof RangeError && Array.isArray(err.errors));
  }
  const ok = E.normalizeWorksheetSpec({ ...base(), title: '   ', levels: [3, 1, 3] });
  assert.equal(ok.value.title, E.DEFAULT_TITLE_DE);
  assert.deepEqual(ok.value.levels, [1, 3]);
  assert.equal(ok.value.keyMode, 'answers');
  assert.equal(ok.value.space, 'small');
  assert.equal(ok.value.nameField, true);
  assert.equal(E.normalizeWorksheetSpec({ ...base(), title: 'x'.repeat(200) }).value.title.length, 80);
});

test('ramp: selected levels are spread ascending over the sheet', () => {
  assert.deepEqual(E.rampLevels([1, 2, 3, 4], 10), [1, 1, 1, 2, 2, 3, 3, 3, 4, 4]);
  assert.deepEqual(E.rampLevels([1, 3], 5), [1, 1, 1, 3, 3]);
  assert.deepEqual(E.rampLevels([2], 3), [2, 2, 2]);
});

test('deterministic and reproducible: same settings → identical sheet; JSON round trip reloads exactly', () => {
  const a = E.createWorksheet(base({ baseSeed: 99, title: 'Probe' }));
  const b = E.createWorksheet(base({ baseSeed: 99, title: 'Probe' }));
  assert.deepEqual(a, b);
  const stored = JSON.parse(JSON.stringify(a.worksheet));
  const r = E.loadWorksheet(stored);
  assert.equal(r.ok, true);
  assert.deepEqual(r.questions, a.questions);
  assert.deepEqual(E.worksheetLayout(r.worksheet, r.questions), E.worksheetLayout(a.worksheet, a.questions));
  assert.match(a.worksheet.code, /^AB-[0-9A-F]{6}$/);
  const c = E.createWorksheet(base({ baseSeed: 100, title: 'Probe' }));
  assert.notEqual(c.worksheet.code, a.worksheet.code);
  assert.notDeepEqual(c.worksheet.items.map(i => i.signature), a.worksheet.items.map(i => i.signature));
});

test('every skill × every single level × both key modes: valid sheet, key matches instances', () => {
  let sheets = 0, questions = 0;
  for (const skillId of SKILLS) for (const level of E.levelsForSkill(skillId)) for (const keyMode of ['answers', 'worked']) {
    for (const baseSeed of [1, 2, 3, 4, 5]) {
      const created = E.createWorksheet({ skills: [skillId], levels: [level], count: 8, baseSeed, keyMode });
      checkWorksheet(created.worksheet, created.questions, `${skillId} L${level} ${keyMode} s${baseSeed}`);
      sheets++; questions += 8;
    }
  }
  assert.ok(sheets >= 200, `${sheets} sheets`);
  assert.ok(questions >= 1600);
});

test('property: 300 random worksheets (skill subsets, level mixes, counts 1–30) are valid and their keys match', () => {
  const rng = new E.Rng(20261027);
  const levelSets = [[1], [2], [3], [4], [1, 2], [2, 3], [3, 4], [1, 4], [1, 2, 3], [1, 2, 3, 4]];
  for (let i = 0; i < 300; i++) {
    const skills = rng.shuffle(SKILLS).slice(0, rng.int(1, SKILLS.length));
    const spec = { skills, levels: rng.pick(levelSets), count: rng.int(1, 30), baseSeed: rng.int(0, 2 ** 31 - 1), keyMode: rng.pick(['answers', 'worked']), space: rng.pick(E.SPACE_OPTIONS) };
    const { worksheet, questions } = E.createWorksheet(spec);
    checkWorksheet(worksheet, questions, `random #${i}`);
  }
});

test('level fallback: a slot takes the next skill that has the level; nearest level only if none has it', () => {
  const levels = { a: [1, 2, 3], b: [2, 3, 4], c: [3] };
  const spec = E.normalizeWorksheetSpec({ skills: SKILLS.slice(0, 1), levels: [1, 4], count: 6, baseSeed: 5 }).value;
  const plan = E.planWorksheet({ ...spec, skills: ['a', 'b', 'c'] }, id => levels[id]);
  assert.deepEqual(plan.map(p => p.level), [1, 1, 1, 4, 4, 4]);
  for (const p of plan) {
    if (p.level === 1) { assert.equal(p.skillId, 'a'); assert.equal(p.levelAdjusted, false); }
    if (p.level === 4) { assert.equal(p.skillId, 'b'); assert.equal(p.levelAdjusted, false); }
  }
  const only = E.planWorksheet({ ...spec, skills: ['c'] }, id => levels[id]);
  assert.ok(only.every(p => p.skillId === 'c' && p.level === 3 && p.levelAdjusted));
  const near = E.planWorksheet({ ...spec, skills: ['a'], levels: [4] }, id => levels[id]);
  assert.ok(near.every(p => p.level === 3 && p.levelAdjusted));
  // with the real catalogue nothing is adjusted today (every Ch1 skill has L1–L4)
  assert.ok(E.planWorksheet({ ...spec, skills: SKILLS, levels: [1, 2, 3, 4], count: 30 }).every(p => !p.levelAdjusted));
});

test('layout: paper instructions, lettered options, table labels, header fields', () => {
  const { worksheet, questions } = E.createWorksheet(base({ skills: CH1_SKILLS, count: 30, baseSeed: 7, title: 'Klasse 7 – Terme', nameField: false, dateField: true, space: 'large' }));
  const L = E.worksheetLayout(worksheet, questions);
  assert.equal(L.title, 'Klasse 7 – Terme');
  assert.equal(L.nameField, false);
  assert.equal(L.dateField, true);
  assert.equal(L.space, 'large');
  assert.equal(L.code, worksheet.code);
  const kinds = new Set(L.student.map(s => s.response.kind));
  for (const k of ['line', 'choice', 'table']) assert.ok(kinds.has(k), `kind ${k} missing in a 30-question mixed sheet`);
  for (const s of L.student) {
    if (s.response.kind === 'choice') {
      assert.deepEqual(s.response.options.map(o => o.letter), 'ABCDEFGH'.slice(0, s.response.options.length).split(''));
      assert.equal(s.paperInstruction, s.response.multiple ? E.PAPER_INSTRUCTIONS_DE.multiselect : E.PAPER_INSTRUCTIONS_DE.choice);
    }
    if (s.response.kind === 'table') assert.ok(s.response.cells.every(c => c.label.length > 0));
    if (s.response.kind === 'line') assert.equal(s.paperInstruction, null);
  }
  assert.throws(() => E.worksheetLayout(worksheet, questions.slice(1)), /do not match/);
  // Chapter 4: solution sets and "x = ____" lines appear on paper, never with the answer
  const ch4 = E.createWorksheet(base({ skills: CH4_SKILLS, count: 30, baseSeed: 11 }));
  const L4 = E.worksheetLayout(ch4.worksheet, ch4.questions);
  const ss = L4.student.filter(s => s.response.kind === 'solution_set');
  assert.ok(ss.length > 0, 'no solution_set item');
  for (const s of ss) {
    assert.equal(s.paperInstruction, E.PAPER_INSTRUCTIONS_DE.solution_set);
    assert.deepEqual(s.response.choices.map(c => c.kind), ['one', 'none', 'all']);
    assert.ok(!JSON.stringify(s).includes('Genau eine Lösung: $x'), 'answer leaked');
  }
  assert.ok(L4.student.some(s => s.response.kind === 'line' && s.response.variable === 'x'), 'no x = line');
  assert.throws(() => E.worksheetLayout(worksheet, questions.slice().reverse()), /does not match/);
});

test('reload safety: outdated template versions, changed signatures, wrong code and garbage are refused, never thrown', () => {
  const { worksheet } = E.createWorksheet(base({ count: 5, baseSeed: 3 }));
  const clone = () => JSON.parse(JSON.stringify(worksheet));
  const v = clone(); v.items[2].qid = v.items[2].qid.replace(/@(\d+)\//, (_, n) => `@${Number(n) + 1}/`);
  assert.deepEqual([E.loadWorksheet(v).ok, E.loadWorksheet(v).reason], [false, 'outdated']);
  const s = clone(); s.items[0].signature = '00000000';
  assert.equal(E.loadWorksheet(s).reason, 'outdated');
  const c = clone(); c.code = 'AB-000000';
  assert.equal(E.loadWorksheet(c).reason, 'invalid');
  const n = clone(); n.spec.count = 6;
  assert.equal(E.loadWorksheet(n).reason, 'invalid');
  for (const g of [null, 42, 'x', {}, { schema: 'mathe7-worksheet', version: 1 }, { ...clone(), items: 'no' }, { ...clone(), version: 2 }]) {
    const r = E.loadWorksheet(g);
    assert.equal(r.ok, false);
    assert.equal(typeof r.message, 'string');
  }
});

test('golden: fixed worksheets (student sheet + answer key) render exactly as recorded', () => {
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'worksheet.golden.json'), 'utf8'));
  const now = JSON.parse(JSON.stringify(worksheetSnapshot(E)));
  assert.equal(now.length, golden.worksheets.length);
  now.forEach((w, i) => assert.deepEqual(w, golden.worksheets[i], `golden worksheet ${i}`));
  for (const w of golden.worksheets) assert.equal(E.loadWorksheet(w.worksheet).ok, true);
});
