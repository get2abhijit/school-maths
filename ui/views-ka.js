  // ================================================================== KA vorbereiten (Session 11, docs/klassenarbeit-mode.md)
  // Blueprint data comes from exams.json (inlined as #exams-data). All rules (item status, mock tests, scoring, study plan)
  // live in the engine (src/exam.js); this view only renders them. Stored: progress.exams[examId] (date, self-ratings,
  // Zusatz, timer, ticked plan days, finished rounds) and the running round under KEYS.ka.
  var EXAMS = (function () {
    try { var f = JSON.parse(document.getElementById('exams-data').textContent); return f && Array.isArray(f.exams) ? f : { exams: [] }; }
    catch (e) { return { exams: [] }; }
  })();
  var KA_BP = EXAMS.exams[0] || null;  // one active blueprint for now (Chapter I); a new KA = new data, no UI change
  var kaUi = { tab: 'overview', message: null, reviewOpen: {} };
  var kaRun = (function () {
    var raw = sRead(KEYS.ka);
    if (raw && KA_BP && raw.record && raw.record.examId === KA_BP.id && (raw.mode === 'screen' || raw.mode === 'paper')) return raw;
    if (raw) sRemove(KEYS.ka);
    return null;
  })();
  if (kaRun) kaUi.tab = 'mock';  // a running round reopens where it was left
  function saveKaRun() { if (kaRun) sWrite(KEYS.ka, kaRun); else sRemove(KEYS.ka); }
  function resetKaState() { kaRun = null; kaUi = { tab: 'overview', message: null, reviewOpen: {} }; }

  function kaState() {
    var st = (progress.exams || {})[KA_BP.id] || {};
    return {
      date: st.date || KA_BP.defaultDate, ratings: st.ratings || {}, zusatz: st.zusatz || {}, timer: st.timer === undefined ? (KA_BP.mock.timerDefault || 0) : st.timer,
      planDone: st.planDone || [], mocks: st.mocks || [],
    };
  }
  function saveKaState(st) {
    if (!progress.exams) progress.exams = {};
    progress.exams[KA_BP.id] = st;
    saveProgress();
  }
  function kaOptions() { return { zusatz: kaState().zusatz }; }
  function itemById(id) { for (var i = 0; i < KA_BP.items.length; i++) if (KA_BP.items[i].id === id) return KA_BP.items[i]; return null; }
  function shortStatement(id) { var it = itemById(id); return it ? it.statement.replace(/^Ich (kann |wende |prüfe )?/, '').replace(/\.$/, '') : id; }
  function fmtPts(x) { return String(x).replace('.', ','); }
  function kaDaysText(n) { return n > 1 ? 'in ' + n + ' Tagen' : n === 1 ? 'morgen' : n === 0 ? 'heute' : 'vorbei'; }

  /** Dashboard card (hidden when no exam is active: no blueprint, or the date is more than a week past). */
  function kaDashboardCard() {
    if (!KA_BP) return null;
    var st = kaState();
    var n = E.daysUntil(today(), st.date);
    if (n < -7) return null;
    return h('div', { class: 'panel', id: 'ka-card' },
      h('div', { class: 'stat' }, n > 0 ? String(n) : (n === 0 ? 'Heute' : '✓')),
      h('p', { class: 'muted' }, 'Klassenarbeit ' + kaDaysText(n) + ' (' + fmtDate(st.date) + ')'),
      h('a', { class: 'btn', href: '#ka', id: 'ka-card-link' }, 'KA vorbereiten'));
  }

  VIEWS.ka = function () {
    if (!KA_BP) return h('div', { class: 'panel' }, h('h1', null, 'KA vorbereiten'), h('p', null, 'Zurzeit ist keine Klassenarbeit eingetragen.'));
    var st = kaState();
    var n = E.daysUntil(today(), st.date);
    var tabs = [['overview', 'Checkliste'], ['plan', 'Lernplan'], ['mock', 'Übungs-KA'], ['settings', 'Einstellungen']];
    var tab = kaUi.tab;
    var msg = kaUi.message; kaUi.message = null;
    var body = tab === 'plan' ? kaPlanView(st) : tab === 'mock' ? kaMockView(st) : tab === 'settings' ? kaSettingsView(st) : kaOverview(st);
    return h('div', null,
      h('h1', null, 'KA vorbereiten'),
      h('p', { class: 'lead', id: 'ka-title' }, KA_BP.title + ' · ' + fmtDate(st.date) + ' (' + kaDaysText(n) + ')'),
      msg ? h('p', { class: 'feedback ok', role: 'status' }, msg) : null,
      h('div', { class: 'row no-print', role: 'group', 'aria-label': 'Bereich' }, tabs.map(function (t) {
        return h('button', { type: 'button', class: 'btn ' + (tab === t[0] ? 'primary' : 'quiet'), 'aria-pressed': tab === t[0] ? 'true' : 'false', id: 'ka-tab-' + t[0],
          onclick: function () { kaUi.tab = t[0]; ui.focusId = 'ka-tab-' + t[0]; render(); } }, t[1]);
      })),
      body);
  };

  // ------------------------------------------------------------------ overview (checklist)
  function kaPractise(group) {
    maybeReplaceSession().then(function (ok) { if (ok) startSession(group.skillId, 'adaptive', 10, group.filter); });
  }
  function kaOverview(st) {
    var status = E.itemStatus(KA_BP, progress, st.ratings, kaOptions());
    var scale = KA_BP.selfRating.scale;
    var rows = KA_BP.items.map(function (item, idx) {
      var s = status[idx];
      var book = item.book ? [item.book.read ? 'Nachlesen ' + item.book.read : null, item.book.exercises && item.book.exercises.length ? 'Übung ' + item.book.exercises.join(', ') : null].filter(Boolean).join(' · ') : '';
      var ratingGroup = h('div', { class: 'seg rating', role: 'group', 'aria-label': 'Selbsteinschätzung: ' + item.statement }, scale.map(function (sc) {
        var on = s.rating === sc.value;
        return h('button', { type: 'button', class: 'btn small ' + (on ? 'primary' : 'quiet'), 'aria-pressed': on ? 'true' : 'false', 'data-rating': String(sc.value), 'data-item': item.id,
          onclick: function () {
            var cur = kaState();
            if (on) delete cur.ratings[item.id]; else cur.ratings[item.id] = sc.value;
            saveKaState(cur); ui.focusId = null; render();
          } }, h('span', { 'aria-hidden': 'true' }, sc.emoji + ' '), sc.label);
      }));
      var appRes = null, practise = null, extra = null;
      if (item.kind === 'skill' || item.kind === 'mixed') {
        appRes = h('p', { class: 'muted ka-app' }, s.attempts
          ? 'In der App: ' + s.firstTry + ' von ' + s.attempts + ' richtig beim ersten Versuch' + (s.lastPractised ? ' (zuletzt ' + fmtDate(s.lastPractised) + ')' : '') + '.'
          : 'In der App noch nicht geübt' + (s.untracked ? ' (ältere Antworten lassen sich keinem Punkt der Checkliste zuordnen)' : '') + '.');
        practise = h('div', { class: 'row' }, s.practice.map(function (g) {
          return h('button', { type: 'button', class: 'btn', 'data-ka-practise': item.id, 'data-skill': g.skillId, onclick: function () { kaPractise(g); } },
            s.practice.length > 1 ? 'Üben: ' + skillName(g.skillId) : 'Üben');
        }));
        if (s.mismatchNote) extra = h('p', { class: 'feedback info ka-mismatch' }, s.mismatchNote);
      } else if (item.kind === 'planner') {
        practise = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'ka-to-plan', onclick: function () { kaUi.tab = 'plan'; render(); } }, 'Zum Lernplan'));
      } else if (item.kind === 'mock') {
        var last = st.mocks.length ? st.mocks[st.mocks.length - 1] : null;
        appRes = h('p', { class: 'muted' }, last ? 'Letzte Übungs-KA: Runde ' + last.round + ', ' + fmtPts(last.total) + ' von ' + fmtPts(last.max) + ' Punkten (' + fmtDate(last.date) + ').' : 'Noch keine Übungs-Klassenarbeit bearbeitet.');
        practise = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', id: 'ka-to-mock', onclick: function () { kaUi.tab = 'mock'; render(); } }, 'Zur Übungs-KA'));
      }
      return h('li', { class: 'ka-item sheet plain', 'data-ka-item': item.id },
        h('h3', null, item.statement),
        book ? h('p', { class: 'muted ka-book' }, book + (item.book && item.book.readNote ? ' – ' + item.book.readNote : '')) : null,
        ratingGroup, appRes, extra, practise);
    });
    return h('div', null,
      h('p', null, 'Das ist die Checkliste deiner Lehrkraft. Schätze dich bei jedem Punkt ein und übe genau die passenden Aufgaben. Die Buchseiten helfen beim Nachlesen.'),
      h('ol', { class: 'ka-list' }, rows));
  }

  // ------------------------------------------------------------------ settings
  function kaSettingsView(st) {
    var date = h('input', { type: 'date', id: 'ka-date', value: st.date });
    var timer = h('select', { id: 'ka-timer' }, KA_BP.mock.timerMinutesOptions.map(function (m) { return h('option', { value: String(m), selected: m === st.timer }, m ? m + ' Minuten' : 'ohne Zeitvorgabe'); }));
    var zus = (KA_BP.zusatz || []).map(function (z) {
      var on = st.zusatz[z.id] === undefined ? z.defaultOn !== false : st.zusatz[z.id];
      return h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-zusatz': z.id, checked: on }), ' ' + z.label + ' – ' + z.note);
    });
    var status = h('p', { class: 'muted', 'aria-live': 'polite', id: 'ka-settings-status' });
    return h('section', { class: 'sheet plain form-grid', id: 'ka-settings' },
      h('div', null, h('label', { class: 'field-label', for: 'ka-date' }, 'Datum der Klassenarbeit'), date,
        h('p', { class: 'muted' }, 'Vorbelegt mit dem Datum von der Checkliste (' + fmtDate(KA_BP.defaultDate) + '). Ändere es, wenn sich der Termin verschiebt.')),
      h('fieldset', null, h('legend', null, 'Zusatzthemen'), zus),
      h('div', null, h('label', { class: 'field-label', for: 'ka-timer' }, 'Zeit für die Übungs-KA am Bildschirm'), timer),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'ka-save-settings', onclick: function () {
        var cur = kaState();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { status.textContent = 'Bitte ein gültiges Datum wählen.'; return; }
        cur.date = date.value; cur.timer = Number(timer.value);
        Array.prototype.forEach.call(document.querySelectorAll('[data-zusatz]'), function (cb) { cur.zusatz[cb.getAttribute('data-zusatz')] = cb.checked; });
        saveKaState(cur); kaUi.message = 'Einstellungen gespeichert.'; render();
      } }, 'Speichern')), status);
  }

  // ------------------------------------------------------------------ study plan
  function kaPlanView(st) {
    var status = E.itemStatus(KA_BP, progress, st.ratings, kaOptions());
    var plan = E.buildStudyPlan(KA_BP, status, today(), st.date);
    var intro = h('p', null, 'Ein Vorschlag, wie du die Zeit bis zur Klassenarbeit einteilen kannst: schwächere Punkte zuerst, etwa ' + E.KA_RULES.minutesPerDay +
      ' Minuten am Tag, in den letzten beiden Tagen nur Wiederholung. Was du dir selbst schlecht eingeschätzt hast oder in der App noch schwer fällt, kommt früher dran.');
    if (!plan.length) return h('div', { id: 'ka-plan' }, intro, h('div', { class: 'sheet plain', id: 'ka-plan-empty' }, h('p', null, 'Für einen Lernplan ist es zu spät: die Klassenarbeit ist heute oder schon vorbei. Viel Erfolg!')));
    var KIND = { practice: 'Üben', review: 'Wiederholen', final: 'Gemischte Wiederholung' };
    return h('div', { id: 'ka-plan' }, intro,
      h('ol', { class: 'ka-plan' }, plan.map(function (d) {
        var done = st.planDone.indexOf(d.date) >= 0;
        var cb = h('input', { type: 'checkbox', id: 'ka-day-' + d.date, checked: done, onchange: function () {
          var cur = kaState();
          cur.planDone = cb.checked ? cur.planDone.concat([d.date]) : cur.planDone.filter(function (x) { return x !== d.date; });
          saveKaState(cur);
        } });
        return h('li', { class: 'sheet plain ka-day', 'data-date': d.date },
          h('div', { class: 'row' }, cb, h('label', { for: 'ka-day-' + d.date }, h('strong', null, fmtDate(d.date) + (d.date === today() ? ' (heute)' : '')), ' · ' + KIND[d.kind] + ' · ca. ' + d.minutes + ' Min. · erledigt')),
          h('ul', null, d.items.map(function (id) { return h('li', null, shortStatement(id) + (d.repeat ? ' (noch einmal)' : '')); }),
            d.mockRound ? h('li', null, h('strong', null, 'Übungs-Klassenarbeit, Runde ' + d.mockRound)) : null),
          d.overBudget || d.compressed ? h('p', { class: 'muted' }, 'Heute ist etwas mehr dran, weil die Zeit knapp ist.') : null);
      })));
  }

  // ------------------------------------------------------------------ mock test
  function kaLoadRun() {
    if (!kaRun) return null;
    if (kaUi.loaded && kaUi.loaded.code === kaRun.record.code) return kaUi.loaded.result;
    var r = E.loadMock(KA_BP, kaRun.record);
    if (r.ok) r.mock.tasks.forEach(function (t) { t.questions.forEach(function (q) { qCache[q.id] = q; }); });
    kaUi.loaded = { code: kaRun.record.code, result: r };
    return r;
  }
  function kaStart(round, mode) {
    var st = kaState();
    var m;
    try { m = E.buildMock(KA_BP, round, newSeed(), { zusatz: st.zusatz }, E.ENGINE_VERSION); }
    catch (e) { kaUi.message = 'Die Übungs-Klassenarbeit konnte nicht erstellt werden.'; render(); return; }
    m.tasks.forEach(function (t) { t.questions.forEach(function (q) { qCache[q.id] = q; }); });
    kaRun = { record: m.record, mode: mode, answers: {}, marks: {}, pos: 0, startedAt: Date.now(), finished: false };
    kaUi.loaded = { code: m.record.code, result: { ok: true, mock: m } };
    kaUi.paperTab = 'student';
    saveKaRun(); kaUi.tab = 'mock'; ui.focusId = 'ka-mock-title'; render(true);
  }
  function disclaimer() { return h('p', { class: 'feedback info ka-disclaimer' }, KA_BP.disclaimer); }

  function kaMockView(st) {
    if (!kaRun) return kaMockSetup(st);
    var r = kaLoadRun();
    if (!r.ok) return h('div', { class: 'panel' }, h('h2', { id: 'ka-mock-title', tabindex: '-1' }, 'Runde nicht verfügbar'), h('p', null, r.message),
      h('button', { type: 'button', class: 'btn primary', onclick: function () { kaRun = null; saveKaRun(); render(); } }, 'Verwerfen'));
    if (kaRun.finished) return kaResultView(r.mock);
    return kaRun.mode === 'paper' ? kaPaperView(r.mock) : kaScreenView(r.mock);
  }
  function kaMockSetup(st) {
    var round = h('select', { id: 'ka-round' }, [1, 2].map(function (n) { return h('option', { value: String(n) }, 'Runde ' + n); }));
    var tasks = KA_BP.mock.tasks.filter(function (t) { return !t.optional || (st.zusatz[t.optional] === undefined ? true : st.zusatz[t.optional]); });
    var max = tasks.reduce(function (a, t) { return a + t.points; }, 0);
    var history = st.mocks.length ? h('div', null, h('h3', null, 'Bisherige Runden'), h('table', { class: 'data-table', id: 'ka-history' },
      h('thead', null, h('tr', null, h('th', null, 'Datum'), h('th', null, 'Runde'), h('th', null, 'Art'), h('th', null, 'Punkte'))),
      h('tbody', null, st.mocks.slice().reverse().map(function (m) {
        return h('tr', null, h('td', null, fmtDate(m.date)), h('td', null, String(m.round)), h('td', null, m.mode === 'paper' ? 'auf Papier' : 'am Bildschirm'), h('td', null, fmtPts(m.total) + ' von ' + fmtPts(m.max)));
      })))) : null;
    return h('section', { class: 'sheet plain', id: 'ka-mock-setup' },
      h('h2', { id: 'ka-mock-title', tabindex: '-1' }, 'Übungs-Klassenarbeit'),
      disclaimer(),
      h('p', null, tasks.length + ' Aufgaben mit zusammen ' + max + ' Punkten, wie im Buchtest auf S. 33 in zwei Runden. Jede neue Runde hat neue Zahlen.'),
      h('ul', null, tasks.map(function (t) { return h('li', null, 'Aufgabe ' + t.n + ': ' + t.title + ' (' + t.points + ' P.)'); })),
      h('label', { class: 'field-label', for: 'ka-round' }, 'Runde'), round,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', id: 'ka-start-screen', onclick: function () { kaStart(Number(round.value), 'screen'); } }, 'Am Bildschirm bearbeiten'),
        h('button', { type: 'button', class: 'btn', id: 'ka-start-paper', onclick: function () { kaStart(Number(round.value), 'paper'); } }, 'Auf Papier bearbeiten (drucken)')),
      h('p', { class: 'muted' }, 'Am Bildschirm gibt es während der Arbeit keine Tipps und keine Rückmeldung. Erst nach dem Abgeben siehst du Punkte, Tipps und Lösungswege. Auf Papier druckst du das Aufgabenblatt und kontrollierst danach selbst mit dem Lösungsblatt.'),
      history);
  }

  function flatParts(mock) {
    var out = [];
    mock.tasks.forEach(function (t) { t.questions.forEach(function (q, k) { out.push({ task: t, q: q, k: k, label: t.questions.length > 1 ? t.n + 'abcdefgh'.charAt(k) + ')' : t.n + '.' }); }); });
    return out;
  }
  function timerText() {
    var mins = kaState().timer;
    if (!mins || !kaRun.startedAt) return null;
    var left = Math.ceil((kaRun.startedAt + mins * 60000 - Date.now()) / 60000);
    return left > 0 ? 'Noch etwa ' + left + ' Minuten (von ' + mins + ').' : 'Die Zeit (' + mins + ' Minuten) ist um. Gib jetzt ab – du kannst aber auch noch fertig machen.';
  }
  // S12: the remaining time is refreshed every 20 s without re-rendering (focus and typed input stay untouched).
  // The interval exists only while a timed round is on screen and stops itself when the text element is gone.
  var kaTick = null;
  function ensureTimerTick() {
    if (kaTick || !timerText()) return;
    kaTick = setInterval(function () {
      var el = document.getElementById('ka-timer-text'), t = timerText();
      if (!el || !t) { clearInterval(kaTick); kaTick = null; return; }
      el.textContent = ' ' + t;
    }, 20000);
  }
  function kaScreenView(mock) {
    setTimeout(ensureTimerTick, 0);
    var parts = flatParts(mock);
    var pos = Math.min(Math.max(kaRun.pos || 0, 0), parts.length - 1);
    var p = parts[pos], q = p.q;
    var widget = makeWidget(q, kaRun.answers[q.id], false);
    var note = h('div', { 'aria-live': 'polite', id: 'ka-input-note' });
    function store() {
      var raw = widget.collect();
      kaRun.answers[q.id] = raw;
      saveKaRun();
      return raw;
    }
    function goTo(i) {
      var raw = store();
      // only a reading check (never right/wrong): unreadable input counts as „ungültige Eingabe“ when handed in
      var res = raw === '' || raw === null || raw === undefined ? null : E.evaluateQuestion(q, raw);
      if (res && res.status === 'invalid' && !kaUi.invalidAck) {
        kaUi.invalidAck = true;
        note.replaceChildren(h('p', { class: 'feedback info', id: 'ka-invalid' }, 'Diese Eingabe kann ich nicht lesen (' + res.message + '). Wenn du sie so abgibst, zählt sie als „ungültige Eingabe“. Tippe noch einmal, um trotzdem weiterzugehen.'));
        return;
      }
      kaUi.invalidAck = false;
      kaRun.pos = i; saveKaRun(); ui.focusId = 'ka-q-title'; render();
    }
    widget.onEnter(function () { if (pos < parts.length - 1) goTo(pos + 1); });
    var answered = parts.filter(function (x) { var a = kaRun.answers[x.q.id]; return !(a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)); }).length;
    var tt = timerText();
    return h('section', { class: 'sheet', id: 'ka-screen', 'data-qid': q.id },
      h('div', { class: 'q-head' },
        h('h2', { id: 'ka-q-title', tabindex: '-1', class: 'q-count' }, 'Aufgabe ' + p.label + ' ' + p.task.title),
        h('span', { class: 'pill' }, fmtPts(p.task.partPoints[p.k]) + ' P.')),
      h('p', { class: 'muted' }, 'Runde ' + mock.round + ' · ' + answered + ' von ' + parts.length + ' Teilaufgaben beantwortet.', h('span', { id: 'ka-timer-text' }, tt ? ' ' + tt : '')),
      h('p', { class: 'prompt' }, mathText(q.prompt)),
      q.promptLines ? h('div', { class: 'lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
      diagramBlock(q),
      q.promptTable ? promptTableBlock(q.promptTable) : null,
      q.instructions ? h('p', { class: 'instructions' }, mathText(q.instructions)) : null,
      widget.el, note,
      h('div', { class: 'row' },
        pos > 0 ? h('button', { type: 'button', class: 'btn', id: 'ka-prev', onclick: function () { goTo(pos - 1); } }, 'Zurück') : null,
        pos < parts.length - 1 ? h('button', { type: 'button', class: 'btn primary', id: 'ka-next', onclick: function () { goTo(pos + 1); } }, 'Weiter') : null,
        h('button', { type: 'button', class: 'btn' + (pos === parts.length - 1 ? ' primary' : ''), id: 'ka-submit', onclick: function () {
          store();
          var open = parts.length - parts.filter(function (x) { var a = kaRun.answers[x.q.id]; return !(a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)); }).length;
          confirmDialog('Abgeben?', open ? 'Noch ' + open + ' Teilaufgabe(n) ohne Antwort. Nach dem Abgeben kannst du nichts mehr ändern.' : 'Nach dem Abgeben kannst du nichts mehr ändern.', 'Abgeben').then(function (ok) {
            if (ok) kaFinish(mock, E.scoreMock(mock, kaRun.answers));
          });
        } }, 'Abgeben')),
      h('nav', { class: 'row ka-jump', 'aria-label': 'Teilaufgaben' }, parts.map(function (x, i) {
        var a = kaRun.answers[x.q.id];
        var has = !(a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length));
        return h('button', { type: 'button', class: 'btn small ' + (i === pos ? 'primary' : 'quiet'), 'aria-current': i === pos ? 'step' : null, 'aria-label': 'Teilaufgabe ' + x.label + (has ? ', beantwortet' : ', offen'),
          onclick: function () { goTo(i); } }, x.label + (has ? ' ✓' : ''));
      })),
      disclaimer(),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn quiet', id: 'ka-abort', onclick: function () {
        confirmDialog('Runde abbrechen?', 'Deine Antworten in dieser Runde werden gelöscht.', 'Abbrechen', true).then(function (ok) { if (ok) { kaRun = null; saveKaRun(); render(); } });
      } }, 'Runde abbrechen')));
  }

  function kaFinish(mock, score) {
    var st = kaState();
    var tasks = {};
    score.tasks.forEach(function (t) { tasks[t.n] = t.points; });
    st.mocks = st.mocks.concat([{ round: mock.round, seed: mock.record.seed, code: mock.record.code, mode: kaRun.mode, date: today(), total: score.total, max: score.max, tasks: tasks }]).slice(-20);
    saveKaState(st);
    kaRun.finished = true; kaRun.score = score;
    saveKaRun(); ui.focusId = 'ka-result-title'; render(true);
  }

  /** Mock test printed through the worksheet layout (same instances as the screen version). */
  function mockPaper(L, isKey) {
    var lines = SPACE_LINES[L.space] || 0;
    var head = h('header', { class: 'ws-head' },
      h('div', { class: 'ws-head-top' }, h('h2', { class: 'ws-title' }, isKey ? 'Lösungen: ' + L.title : L.title), h('span', { class: 'ws-code' }, L.code)),
      !isKey ? h('div', { class: 'ws-fields' }, h('span', { class: 'ws-fill' }, 'Name: ', h('span', { class: 'ws-blank wide', 'aria-label': 'Feld für den Namen' })),
        h('span', { class: 'ws-fill' }, 'Datum: ', h('span', { class: 'ws-blank', 'aria-label': 'Feld für das Datum' }))) : null,
      h('p', { class: 'ws-topics' }, L.disclaimer + ' Gesamtpunktzahl: ' + fmtPts(L.maxPoints) + '.'));
    return h('article', { class: 'paper', 'data-paper': isKey ? 'key' : 'student', 'aria-label': isKey ? 'Lösungsblatt' : 'Aufgabenblatt' }, head,
      L.tasks.map(function (t) {
        return h('section', { class: 'ka-task', 'data-task': String(t.n) },
          h('h3', { class: 'ka-task-head' }, 'Aufgabe ' + t.n + ': ' + t.title + ' (' + fmtPts(t.points) + ' P.)'),
          h('ol', { class: 'ws-list' + (isKey && L.keyMode !== 'worked' ? ' compact' : '') }, t.parts.map(function (i) {
            var q = L.student[i], k = L.key[i];
            if (isKey) return h('li', { class: 'ws-q', 'data-qid': k.qid }, h('div', { class: 'ws-qhead' }, h('span', { class: 'ws-num' }, k.label), h('span', { class: 'ws-level' }, fmtPts(t.partPoints[t.parts.indexOf(i)]) + ' P.')),
              h('p', { class: 'ws-prompt small' }, mathText(q.prompt)),
              k.cells ? h('div', { class: 'ws-table-wrap' }, h('table', { class: 'ws-table' }, h('tbody', null, k.cells.map(function (c) { return h('tr', null, h('th', { scope: 'row' }, mathText(c.label)), h('td', null, mathText(c.value))); })))) :
                h('p', { class: 'ws-result' }, h('b', null, 'Lösung: '), mathText(k.result)),
              k.steps ? h('ol', { class: 'ws-steps' }, k.steps.map(function (s) { return h('li', null, mathText(s)); })) : null);
            return h('li', { class: 'ws-q', 'data-qid': q.qid },
              h('div', { class: 'ws-qhead' }, h('span', { class: 'ws-num' }, q.label), h('span', { class: 'ws-level' }, fmtPts(t.partPoints[t.parts.indexOf(i)]) + ' P.')),
              h('p', { class: 'ws-prompt' }, mathText(q.prompt)),
              q.promptLines ? h('div', { class: 'ws-lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
              diagramBlock(q),
              q.promptTable ? h('div', { class: 'ws-table-wrap ws-given' }, h('table', { class: 'ws-table ws-grid' },
                h('thead', null, h('tr', null, q.promptTable.columns.map(function (c) { return h('th', { scope: 'col' }, mathText(c)); }))),
                h('tbody', null, q.promptTable.rows.map(function (row) { return h('tr', null, row.map(function (e) { return h('td', null, mathText(e)); })); })))) : null,
              q.instructions ? h('p', { class: 'ws-instr' }, mathText(q.instructions)) : null,
              q.paperInstruction ? h('p', { class: 'ws-instr' }, q.paperInstruction) : null,
              responseBlock(q.response), lines ? gridSpace(lines) : null);
          })));
      }),
      h('p', { class: 'ws-foot' }, 'Mathe 7 · ' + L.code + (isKey ? ' · Lösungsblatt' : ' · Die Lösungen stehen auf dem Lösungsblatt mit demselben Code.')));
  }
  function kaPrint(kind) {
    kaUi.paperTab = kind; render();
    var stEl = document.getElementById('ka-print-status');
    try { if (typeof window.print !== 'function') throw new Error('no print'); window.print(); if (stEl) stEl.textContent = 'Der Druckdialog wurde geöffnet. Wähle dort „Als PDF speichern“ oder deinen Drucker.'; }
    catch (e) { if (stEl) stEl.textContent = 'Drucken ist in dieser Ansicht nicht möglich. Speichere das Blatt als HTML-Datei, öffne sie im Browser und drucke von dort.'; }
  }
  function kaPaperView(mock) {
    var L = E.mockPrintLayout(mock, { keyMode: 'worked', space: 'medium' });
    var tab = kaUi.paperTab === 'key' ? 'key' : 'student';
    var student = mockPaper(L, false), key = mockPaper(L, true);
    if (tab === 'key') student.setAttribute('hidden', ''); else key.setAttribute('hidden', '');
    var inputs = mock.tasks.map(function (t) {
      return h('div', { class: 'ka-mark' }, h('label', { for: 'ka-mark-' + t.n }, 'Aufgabe ' + t.n + ' (' + fmtPts(t.points) + ' P.)'),
        h('input', { type: 'number', id: 'ka-mark-' + t.n, min: '0', max: String(t.points), step: '0.5', inputmode: 'decimal', value: kaRun.marks[t.n] === undefined ? '' : String(kaRun.marks[t.n]),
          onchange: function (e) { kaRun.marks[t.n] = e.target.value === '' ? '' : Number(String(e.target.value).replace(',', '.')); saveKaRun(); } }));
    });
    var msg = h('p', { class: 'muted', 'aria-live': 'polite', id: 'ka-mark-status' });
    return h('div', null,
      h('section', { class: 'panel no-print' },
        h('h2', { id: 'ka-mock-title', tabindex: '-1' }, 'Übungs-KA Runde ' + mock.round + ' auf Papier (' + L.code + ')'),
        disclaimer(),
        h('p', null, '1. Drucke das Aufgabenblatt und bearbeite es ohne Hilfe. 2. Kontrolliere danach mit dem Lösungsblatt. 3. Trage unten deine Punkte je Aufgabe ein.'),
        h('div', { class: 'row', role: 'group', 'aria-label': 'Ansicht' },
          h('button', { type: 'button', class: 'btn ' + (tab === 'student' ? 'primary' : 'quiet'), 'aria-pressed': tab === 'student' ? 'true' : 'false', id: 'ka-paper-student', onclick: function () { kaUi.paperTab = 'student'; render(); } }, 'Aufgabenblatt'),
          h('button', { type: 'button', class: 'btn ' + (tab === 'key' ? 'primary' : 'quiet'), 'aria-pressed': tab === 'key' ? 'true' : 'false', id: 'ka-paper-key', onclick: function () { kaUi.paperTab = 'key'; render(); } }, 'Lösungsblatt')),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'ka-print-student', onclick: function () { kaPrint('student'); } }, 'Aufgabenblatt drucken'),
          h('button', { type: 'button', class: 'btn', id: 'ka-print-key', onclick: function () { kaPrint('key'); } }, 'Lösungsblatt drucken')),
        h('p', { class: 'muted', id: 'ka-print-status', 'aria-live': 'polite' }, 'Das ist der Druck des Browsers (Drucken → Als PDF speichern), keine fertige PDF-Datei.'),
        h('h3', null, 'Punkte eintragen'), h('div', { class: 'ka-marks' }, inputs), msg,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'ka-mark-done', onclick: function () {
            var s = E.scorePaper(mock, kaRun.marks);
            if (s.errors.length) { msg.textContent = 'Bitte prüfe die Punkte bei Aufgabe ' + s.errors.join(', ') + ' (0 bis Höchstpunktzahl, in halben Punkten).'; return; }
            kaFinish(mock, s);
          } }, 'Auswerten'),
          h('button', { type: 'button', class: 'btn quiet', id: 'ka-abort', onclick: function () {
            confirmDialog('Runde abbrechen?', 'Die eingetragenen Punkte werden gelöscht.', 'Abbrechen', true).then(function (ok) { if (ok) { kaRun = null; saveKaRun(); render(); } });
          } }, 'Runde abbrechen'))),
      h('div', { class: 'ws-preview' }, student, key));
  }

  function kaResultView(mock) {
    var s = kaRun.score || (kaRun.mode === 'paper' ? E.scorePaper(mock, kaRun.marks) : E.scoreMock(mock, kaRun.answers));
    var status = E.itemStatus(KA_BP, progress, kaState().ratings, kaOptions());
    var practiceOf = {};
    status.forEach(function (x) { practiceOf[x.itemId] = x.practice || []; });
    var itemIds = Object.keys(s.items);
    var parts = flatParts(mock);
    var byQid = {};
    if (s.mode === 'screen') s.tasks.forEach(function (t) { t.parts.forEach(function (p) { byQid[p.qid] = p; }); });
    return h('div', { id: 'ka-result' },
      h('section', { class: 'sheet plain' },
        h('h2', { id: 'ka-result-title', tabindex: '-1' }, 'Ergebnis Runde ' + mock.round + ': ' + fmtPts(s.total) + ' von ' + fmtPts(s.max) + ' Punkten'),
        disclaimer(),
        h('table', { class: 'data-table', id: 'ka-result-table' },
          h('thead', null, h('tr', null, h('th', null, 'Aufgabe'), h('th', null, 'Punkte'), s.mode === 'screen' ? h('th', null, 'Teilaufgaben') : null)),
          h('tbody', null, s.tasks.map(function (t) {
            return h('tr', { 'data-task': String(t.n) }, h('td', null, t.n + '. ' + t.title), h('td', null, fmtPts(t.points) + ' von ' + fmtPts(t.max)),
              s.mode === 'screen' ? h('td', null, t.parts.map(function (p) { return (p.status === 'correct' ? '✓ ' : p.status === 'wrong' ? '✗ ' : '– ') + p.label; }).join(' · ')) : null);
          }))),
        h('h3', null, 'Nach Punkten der Checkliste'),
        h('ul', { class: 'ka-by-item' }, itemIds.map(function (id) {
          var e = s.items[id];
          var weak = e.points < 0.75 * e.max;
          return h('li', { 'data-item': id }, shortStatement(id) + ': ' + fmtPts(e.points) + ' von ' + fmtPts(e.max) + ' Punkten' + (weak ? ' – das solltest du noch üben.' : '.'),
            weak ? h('span', null, ' ', (practiceOf[id] || []).slice(0, 3).map(function (g) {
              return h('button', { type: 'button', class: 'btn small', 'data-ka-practise': id, onclick: function () { kaPractise(g); } }, (practiceOf[id].length > 1 ? 'Üben: ' + skillName(g.skillId) : 'Üben'));
            })) : null);
        })),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'ka-new-round', onclick: function () { kaRun = null; saveKaRun(); render(); } }, 'Fertig – neue Runde oder zurück'))),
      s.mode === 'screen' ? h('section', { class: 'sheet plain', id: 'ka-review' }, h('h3', null, 'Aufgaben ansehen, mit Tipps und Lösungswegen'),
        parts.map(function (x) {
          var p = byQid[x.q.id];
          return h('details', { class: 'ka-review-item', 'data-qid': x.q.id },
            h('summary', null, 'Aufgabe ' + x.label + ': ' + (p ? p.label : '')),
            h('p', { class: 'prompt' }, mathText(x.q.prompt)),
            x.q.promptLines ? h('div', { class: 'lines' }, x.q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
            diagramBlock(x.q),
            x.q.promptTable ? promptTableBlock(x.q.promptTable) : null,
            h('ol', { class: 'hints' }, x.q.hints.filter(function (hh) { return hh.kind !== 'solution'; }).map(function (hh) { return h('li', null, h('strong', null, E.HINT_LABELS_DE[hh.kind] + ': '), mathText(hh.text)); })),
            solutionBlock(x.q));
        })) : null);
  }
