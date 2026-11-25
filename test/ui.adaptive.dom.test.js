'use strict';
/**
 * Adaptive practice, review scheduling, prerequisite advice and the chapter diagnostic in the BUILT app under jsdom.
 * The UI renders; every rule (level, mastery, advice, verdict) comes from the engine. Right/wrong decisions in these tests are made
 * on the test side with the engine's canonical answers. No real browser: see PROGRESS.md for what that leaves untested.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { skip, open, tick, nav, click, main, currentQuestion, fill } = require('./helpers/dom');
const E = require('../src');

const PK = 'mathe7.progress.v1', DK = 'mathe7.diagnostic.v1', SK_ = 'mathe7.session.v1';
const catalog = require('../catalog.json');
const stored = (ctx, k = PK) => JSON.parse(ctx.w.localStorage.getItem(k));
const level = ctx => Number(/Stufe (\d)/.exec(ctx.d.querySelector('.q-head .pill').textContent)[1]);

function seeded(skillId, entries) {   // progress JSON with history for one skill, built through the engine
  let p = E.emptyProgress();
  for (const [l, o] of entries) p = E.applyEvent(p, { type: 'attempt', skillId, level: l, status: o === 'miss' ? 'incorrect' : 'correct', errorCategory: null, isFirst: true, hintsBefore: o === 'hinted' ? 1 : 0, sawSolution: false }, '2026-10-29');
  return p;
}
const rep = (n, l, o) => Array.from({ length: n }, () => [l, o]);

function answer(ctx, right) {
  const q = currentQuestion(ctx);
  if (right) fill(ctx, q, E.canonicalInput(q.answer));
  else if (['integer', 'fraction', 'decimal', 'expression'].includes(q.answer.type)) fill(ctx, q, '987654');
  return q;
}

test('Üben: "Automatisch (passt sich an)" is the default; the start level comes from the stored history', { skip }, async () => {
  const fresh = open(null, 'ueben');
  const radio = fresh.d.querySelector('input[name="level"]:checked');
  assert.equal(radio.value, 'adaptive');
  assert.match(radio.parentElement.textContent, /Automatisch \(passt sich an\)/);
  assert.match(fresh.d.getElementById('level-help').textContent, /Du startest bei Stufe 1\./);
  assert.ok(fresh.d.querySelector('input[name="level"][value="auto"]'), '"Gemischt, steigend" stays available');

  const sid = 'ch4.eq.solve_equivalence';
  const prog = seeded(sid, [...rep(5, 1, 'clean'), ...rep(5, 2, 'clean')]);
  const want = E.recommendLevel(prog.skills[sid], E.levelsForSkill(sid));
  assert.ok(want >= 2);
  const ctx = open({ [PK]: JSON.stringify(prog) }, 'ueben');
  const sel = ctx.d.getElementById('skill-select');
  sel.value = sid; sel.dispatchEvent(new ctx.w.Event('change'));
  assert.match(ctx.d.getElementById('level-help').textContent, new RegExp(`Du startest bei Stufe ${want} \\(nach deinen bisherigen Ergebnissen\\)`));
  ctx.d.querySelector('input[name="count"][value="5"]').checked = true;
  click(ctx, '#start-btn'); await tick();
  assert.equal(level(ctx), want, 'first question at the recommended level');
  assert.equal(stored(ctx, SK_).session.startLevel, want);
  assert.deepEqual(ctx.errors, []);
});

test('adaptive session through the real widgets: levels follow the answers, summary names the next level, review is scheduled', { skip }, async () => {
  const sid = 'ch1.terms.collect_like';
  const ctx = open(null, 'ueben');
  const sel = ctx.d.getElementById('skill-select'); sel.value = sid; sel.dispatchEvent(new ctx.w.Event('change'));
  ctx.d.querySelector('input[name="count"][value="10"]').checked = true;
  click(ctx, '#start-btn'); await tick();
  const seen = [];
  for (let i = 1; i <= 10; i++) {
    assert.match(ctx.d.getElementById('q-title').textContent, new RegExp(`Aufgabe ${i} von 10`));
    seen.push(level(ctx));
    answer(ctx, true);
    click(ctx, '#check-btn');
    assert.match(ctx.d.getElementById('feedback').textContent, /Richtig!/);
    click(ctx, '#next-btn'); await tick();
  }
  assert.deepEqual(seen, [1, 1, 2, 2, 3, 3, 4, 4, 4, 4], 'two right answers in a row → one level up (engine rule)');
  assert.match(ctx.d.querySelector('h1').textContent, /Auswertung/);
  assert.match(main(ctx), /10 von 10\s*beim ersten Versuch richtig/);
  assert.match(ctx.d.getElementById('next-level').textContent, /Nächstes Mal starten wir bei Stufe \d/);
  assert.match(ctx.d.getElementById('next-level').textContent, /keine Note/);
  const rec = stored(ctx).skills[sid];
  assert.equal(rec.detail.length, 10);
  assert.deepEqual(rec.detail.map(d => d.l), seen);
  assert.equal(rec.box, 1); assert.equal(rec.intervalDays, 2);
  assert.equal(rec.nextReview, E.addDays(rec.lastPractised, 2));
  // practising again the same day must not climb the ladder
  click(ctx, '#again-btn'); await tick();
  for (let i = 1; i <= 10; i++) { answer(ctx, true); click(ctx, '#check-btn'); click(ctx, '#next-btn'); await tick(); }
  assert.equal(stored(ctx).skills[sid].box, 1, 'second session on the same day');
  assert.deepEqual(ctx.errors, []);
});

test('wrong answers lower the level; all-wrong sessions never leave the level range', { skip }, async () => {
  const sid = 'ch1.terms.collect_like';
  const ctx = open({ [PK]: JSON.stringify(seeded(sid, [...rep(4, 1, 'clean'), ...rep(4, 2, 'clean'), ...rep(4, 3, 'clean')])) }, 'ueben');
  const sel = ctx.d.getElementById('skill-select'); sel.value = sid; sel.dispatchEvent(new ctx.w.Event('change'));
  ctx.d.querySelector('input[name="count"][value="5"]').checked = true;
  click(ctx, '#start-btn'); await tick();
  const seen = [];
  for (let i = 1; i <= 5; i++) {
    seen.push(level(ctx));
    answer(ctx, false);
    click(ctx, '#check-btn');                       // wrong (or invalid for non-text widgets: then reveal)
    if (!ctx.d.getElementById('reveal-btn')) { /* invalid input: reveal is only offered after a real attempt */ }
    const reveal = ctx.d.getElementById('reveal-btn');
    if (reveal) reveal.click(); else { fill(ctx, currentQuestion(ctx), E.canonicalInput(currentQuestion(ctx).answer)); click(ctx, '#check-btn'); }
    click(ctx, '#next-btn'); await tick();
  }
  assert.ok(seen[0] >= 3);
  assert.ok(seen.every(l => l >= 1 && l <= 4));
  assert.ok(seen[seen.length - 1] <= seen[0], 'levels do not rise while answers are wrong');
  assert.deepEqual(ctx.errors, []);
});

test('prerequisite advice: shown for a struggling skill, links to the prerequisite, hidden when the filter hides it', { skip }, async () => {
  const S = 'ch1.terms.expand_factor';
  const prog = seeded(S, rep(6, 2, 'miss'));
  const ctx = open({ [PK]: JSON.stringify(prog) }, 'ueben');
  const sel = ctx.d.getElementById('skill-select'); sel.value = S; sel.dispatchEvent(new ctx.w.Event('change'));
  const adv = ctx.d.getElementById('prereq-advice');
  assert.ok(adv, 'advice block');
  const expected = E.prerequisiteAdvice(catalog, prog, S, id => E.levelsForSkill(id).length > 0, E.ADAPTIVE_RULES, E.levelsForSkill);
  assert.equal(expected.action, 'fallback');
  const name = catalog.chapters.flatMap(c => c.topics).flatMap(t => t.skills).find(s => s.id === expected.skillId).name;
  assert.ok(adv.textContent.includes(`„${name}“`), adv.textContent);
  assert.match(adv.textContent, /Tipp: Die letzten Aufgaben waren schwierig/);
  click(ctx, '#prereq-advice [data-skill]'); await tick();
  assert.equal(ctx.d.getElementById('skill-select').value, expected.skillId, 'button preselects the prerequisite in Üben');
  assert.equal(ctx.d.getElementById('prereq-advice'), null, 'no advice for a skill without trouble');
  // a skill that goes fine gets no advice
  const fine = open({ [PK]: JSON.stringify(seeded(S, rep(6, 2, 'clean'))) }, 'ueben');
  const s2 = fine.d.getElementById('skill-select'); s2.value = S; s2.dispatchEvent(new fine.w.Event('change'));
  assert.equal(fine.d.getElementById('prereq-advice'), null);
  // the filter on and nothing in Ch1 covered → the prerequisite is not offered, so no advice (the skill itself is hidden too)
  const cov = JSON.parse(JSON.stringify(prog)); cov.settings.coverage = { enabled: true, sections: ['ch1.s5', 'ch1.s3', 'ch1.s4'] };
  const c3 = open({ [PK]: JSON.stringify(cov) }, 'ueben');
  const s3 = c3.d.getElementById('skill-select'); s3.value = S; s3.dispatchEvent(new c3.w.Event('change'));
  const a3 = c3.d.getElementById('prereq-advice');
  const exp3 = E.prerequisiteAdvice(catalog, cov, S, id => E.isSkillAvailable(catalog, cov.settings.coverage, id) && E.levelsForSkill(id).length > 0, E.ADAPTIVE_RULES, E.levelsForSkill);
  if (exp3.action === 'fallback') assert.ok(a3 && a3.textContent.includes('Übe zuerst')); else assert.equal(a3 && a3.textContent.includes('Übe zuerst'), false);
  assert.deepEqual(ctx.errors.concat(fine.errors, c3.errors), []);
});

// ------------------------------------------------------------------ diagnostic
async function runDiagnostic(ctx, plan) {
  const total = ctx.d.getElementById('q-title').textContent.match(/von (\d+)/)[1] | 0;
  for (let i = 1; i <= total; i++) {
    assert.match(ctx.d.getElementById('q-title').textContent, new RegExp(`Aufgabe ${i} von ${total}`));
    const how = plan(i);
    if (how === 'unknown') click(ctx, '#diag-unknown');
    else { const q = currentQuestion(ctx); fill(ctx, q, how === 'right' ? E.canonicalInput(q.answer) : '987654'); click(ctx, '#diag-submit'); }
    await tick();
    assert.ok(!/Richtig|Noch nicht richtig|✓|✗/.test(main(ctx).replace(/Ergebnis der Standortbestimmung[\s\S]*/, '')) || ctx.d.querySelector('h1').textContent.includes('Ergebnis'), 'no right/wrong feedback during the diagnostic');
  }
  return total;
}

test('diagnostic: entry from Kapitel, no feedback while answering, result page, stored verdicts, progress page', { skip }, async () => {
  const ctx = open(null, 'kapitel');
  click(ctx, '#diag-btn-ch4'); await tick();
  assert.match(ctx.d.querySelector('h1').textContent, /Standortbestimmung/);
  assert.match(ctx.d.getElementById('diag-note').textContent, /keine Klassenarbeit, keine Note/);
  assert.equal(ctx.d.getElementById('diag-chapter').value, 'ch4');
  assert.match(main(ctx), /12 Aufgaben/);
  click(ctx, '#diag-start'); await tick();
  assert.match(ctx.d.getElementById('diag-note').textContent, /keine Note/);
  assert.equal(ctx.d.getElementById('hint-tab-0'), null, 'no hints in a diagnostic');
  assert.equal(ctx.d.getElementById('reveal-btn'), null);
  // an invalid answer is not an answer
  const q0 = currentQuestion(ctx);
  if (['integer', 'fraction', 'decimal', 'expression'].includes(q0.answer.type)) {
    fill(ctx, q0, '3x+('); click(ctx, '#diag-submit'); await tick();
    assert.match(ctx.d.getElementById('feedback').textContent, /nicht auswerten/);
    assert.match(ctx.d.getElementById('q-title').textContent, /Aufgabe 1 von 12/);
  }
  const total = await runDiagnostic(ctx, i => (i % 3 === 0 ? 'unknown' : 'right'));
  assert.equal(total, 12);
  assert.match(ctx.d.querySelector('h1').textContent, /Ergebnis der Standortbestimmung/);
  const rows = [...ctx.d.querySelectorAll('#diag-table tbody tr')];
  assert.equal(rows.length, 4);
  for (const r of rows) {
    assert.equal(r.getAttribute('data-verdict'), 'partial', '2 of 3 right');
    assert.match(r.textContent, /2 von 3/);
    assert.match(r.textContent, /◐ Teilweise sicher/, 'verdict in words and symbol, never colour only');
  }
  assert.ok(ctx.d.querySelectorAll('#diag-review details').length === 4, 'wrong answers can be reviewed with the worked solution');
  const prog = stored(ctx);
  assert.deepEqual(Object.keys(prog.diagnostics), ['ch4']);
  assert.equal(Object.keys(prog.diagnostics.ch4.skills).length, 4);
  assert.ok(Object.values(prog.skills).every(r => r.questions === 3 && r.nextReview === null), 'evidence yes, review dates no');
  assert.ok(E.validateProgress(prog).ok);
  await nav(ctx, 'fortschritt');
  assert.match(ctx.d.getElementById('diag-summary').textContent, /Letzte Standortbestimmungen[\s\S]*Kapitel 4/);
  assert.match(ctx.d.getElementById('diag-summary').textContent, /keine Note/);
  assert.deepEqual(ctx.errors, []);
});

test('diagnostic: survives reload, can be ended early, respects "Im Unterricht behandelt", is removed by "Alle Daten löschen"', { skip }, async () => {
  const ctx = open(null, 'standort');
  ctx.d.getElementById('diag-chapter').value = 'ch6'; ctx.d.getElementById('diag-chapter').dispatchEvent(new ctx.w.Event('change'));
  click(ctx, '#diag-start'); await tick();
  const q = currentQuestion(ctx); fill(ctx, q, E.canonicalInput(q.answer)); click(ctx, '#diag-submit'); await tick();
  assert.match(ctx.d.getElementById('q-title').textContent, /Aufgabe 2 von/);
  const saved = Object.fromEntries([PK, DK].map(k => [k, ctx.w.localStorage.getItem(k)]));
  const re = open(saved, 'standort');
  assert.match(re.d.getElementById('q-title').textContent, /Aufgabe 2 von/, 'reload resumes where the student was');
  click(re, '#diag-quit'); await tick();
  click(re, '[data-action="true"]'); await tick();
  assert.match(re.d.querySelector('h1').textContent, /Ergebnis/);
  assert.equal(re.d.querySelectorAll('#diag-table tbody tr').length, 1, 'only the answered skill is rated');
  assert.ok(stored(re).diagnostics.ch6);
  // export → data contains verdicts but no answers
  assert.ok(!JSON.stringify(stored(re).diagnostics).includes('qid'));
  // delete all
  await nav(re, 'fortschritt');
  click(re, '#delete-all-btn'); await tick();
  click(re, '[data-action="true"]'); await tick();
  assert.equal(re.w.localStorage.getItem(DK), null);
  assert.equal(re.w.localStorage.getItem(PK), null, 'progress (with the diagnostic results) is gone as well');
  assert.deepEqual(ctx.errors.concat(re.errors), []);
});

test('diagnostic with the "Im Unterricht behandelt" filter: only offered skills; nothing offered → empty state and no entry button', { skip }, async () => {
  const none = E.emptyProgress(); none.settings.coverage = { enabled: true, sections: [] };
  const ctx = open({ [PK]: JSON.stringify(none) }, 'kapitel');
  assert.equal(ctx.d.querySelectorAll('[data-diagnostic]').length, 0);
  await nav(ctx, 'standort');
  assert.ok(ctx.d.getElementById('diag-empty'));
  const some = E.emptyProgress(); some.settings.coverage = { enabled: true, sections: ['ch6.s1'] };
  const c2 = open({ [PK]: JSON.stringify(some) }, 'standort');
  assert.match(c2.d.getElementById('diag-info').textContent, /3 Aufgaben/);
  assert.equal(c2.d.querySelectorAll('#diag-info li').length, 1);
  assert.match(c2.d.getElementById('diag-info').textContent, /3 Themen sind ausgeblendet/);
  assert.deepEqual(ctx.errors.concat(c2.errors), []);
});

test('export and import keep the adaptive data (detail, box, diagnostics); a manipulated file is refused', { skip }, async () => {
  const sid = 'ch1.terms.collect_like';
  let prog = seeded(sid, [...rep(6, 2, 'clean'), [3, 'hinted']]);
  prog = E.scheduleReviewAdaptive(prog, sid, '2026-10-29', 4);
  const ctx = open({ [PK]: JSON.stringify(prog) }, 'fortschritt');
  click(ctx, '#export-text-btn'); await tick();
  const text = ctx.d.querySelector('#dlg-body textarea').value;
  const exported = JSON.parse(text);
  assert.deepEqual(exported.skills[sid].detail.map(d => d.o), prog.skills[sid].detail.map(d => d.o));
  assert.equal(exported.skills[sid].box, prog.skills[sid].box);
  assert.match(ctx.d.querySelector('table.data-table').textContent, /Empfohlene Stufe/);
  assert.ok(E.validateProgress(exported).ok);
  const bad = JSON.parse(text); bad.skills[sid].detail[0].o = 'genius';
  assert.equal(E.validateProgress(bad).ok, false);
  assert.deepEqual(ctx.errors, []);
});
