  // ================================================================== Standortbestimmung (chapter diagnostic)
  // Rules live in the engine (src/diagnostic.js). The UI shows the questions, hides right/wrong until the result page
  // and renders the engine's verdicts. "Keine Klassenarbeit, keine Note – nur eine Einschätzung."
  var diagUi = { chapterId: null, setup: false };

  /** Button that opens the diagnostic setup for a chapter; null when no skill of the chapter is offered. */
  function diagnosticButton(chapterId) {
    var n = E.diagnosticSkills(CATALOG, coverage(), chapterId).available.length;
    if (!n) return null;
    return h('div', { class: 'row', style: 'margin:.4rem 0' }, h('button', { type: 'button', class: 'btn', id: 'diag-btn-' + chapterId, 'data-diagnostic': chapterId,
      onclick: function () { diagUi.chapterId = chapterId; diagUi.setup = true; go('standort'); } }, 'Standortbestimmung für dieses Kapitel'),
      h('span', { class: 'muted' }, 'etwa ' + n * E.ADAPTIVE_RULES.diagQuestionsPerSkill + ' Aufgaben, keine Note'));
  }

  function startDiagnostic(chapterId) {
    var created = E.createDiagnostic({ catalog: CATALOG, coverage: coverage(), chapterId: chapterId, baseSeed: newSeed() });
    qCache[created.question.id] = created.question;
    diag = { d: created.diagnostic, saved: false };
    saveDiag(); diagUi.setup = false; ui.result = null; ui.focusId = null;
    go('standort');
  }
  function finishDiagnostic() {
    if (diag && diag.d.finished && !diag.saved) {
      progress = E.diagnosticToProgress(progress, diag.d, today());
      diag.saved = true; saveProgress(); saveDiag();
    }
  }

  VIEWS.standort = function () {
    if (diag && !diagUi.setup) return diag.d.finished ? diagnosticResult() : diagnosticQuestion();
    return diagnosticSetup();
  };

  function diagnosticSetup() {
    var withSkills = CATALOG.chapters.filter(function (ch) { return E.diagnosticSkills(CATALOG, coverage(), ch.id).available.length; });
    var root = h('div', null, h('h1', null, 'Standortbestimmung'), h('p', { class: 'feedback info', id: 'diag-note' }, E.DIAGNOSTIC_NOTE_DE));
    if (diag && !diag.d.finished) {
      root.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Angefangene Standortbestimmung'),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'diag-resume', onclick: function () { diagUi.setup = false; go('standort'); } }, 'Weitermachen'))));
    }
    if (!withSkills.length) {
      root.appendChild(h('div', { class: 'sheet plain', id: 'diag-empty' }, h('h2', null, 'Noch kein Kapitel verfügbar'),
        h('p', null, 'Für die Standortbestimmung braucht es übbare Themen, die ihr im Unterricht schon behandelt habt.'),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#kapitel' }, 'Abschnitte anhaken'))));
      return root;
    }
    var pick = diagUi.chapterId && withSkills.some(function (c) { return c.id === diagUi.chapterId; }) ? diagUi.chapterId
      : (progress.settings.currentChapter && withSkills.some(function (c) { return c.id === progress.settings.currentChapter; }) ? progress.settings.currentChapter : withSkills[0].id);
    var sel = h('select', { id: 'diag-chapter' }, withSkills.map(function (ch) { return h('option', { value: ch.id, selected: ch.id === pick }, ch.number + ' ' + ch.name); }));
    var info = h('div', { id: 'diag-info', 'aria-live': 'polite' });
    function drawInfo() {
      var part = E.diagnosticSkills(CATALOG, coverage(), sel.value);
      info.replaceChildren(
        h('p', null, 'Du bekommst ' + E.ADAPTIVE_RULES.diagQuestionsPerSkill + ' Aufgaben pro Thema, zusammen ' + part.available.length * E.ADAPTIVE_RULES.diagQuestionsPerSkill + ' Aufgaben. Die Aufgaben passen sich deinen Antworten an.'),
        h('ul', null, part.available.map(function (id) { return h('li', null, skillName(id)); })),
        hiddenNote(part.hidden.length));
    }
    sel.addEventListener('change', function () { diagUi.chapterId = sel.value; drawInfo(); });
    drawInfo();
    root.appendChild(h('section', { class: 'sheet plain' },
      h('label', { class: 'field-label', for: 'diag-chapter' }, 'Kapitel'), sel, info,
      h('p', { class: 'muted' }, 'Es gibt keine Tipps, und jede Aufgabe hat nur einen Versuch. Ob eine Antwort richtig war, siehst du erst am Ende. Wenn du etwas nicht weißt, wähle „Weiß ich nicht“. Das zählt nur als nicht gelöst, nicht als Fehler in einer Note.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'diag-start', onclick: function () {
        function go2() { startDiagnostic(sel.value); }
        if (diag && !diag.d.finished) confirmDialog('Angefangene Standortbestimmung verwerfen?', 'Die bisherigen Antworten bleiben im Fortschritt gespeichert.', 'Neu starten').then(function (ok) { if (ok) go2(); });
        else go2();
      } }, 'Standortbestimmung starten'))));
    return root;
  }

  function diagnosticQuestion() {
    var d = diag.d;
    var item = E.currentDiagnosticItem(d);
    var q = questionById(item.qid);
    if (!q) {
      return h('div', { class: 'panel' }, h('h1', null, 'Standortbestimmung kann nicht fortgesetzt werden'),
        h('p', null, 'Sie stammt aus einer älteren Version der App.'),
        h('button', { type: 'button', class: 'btn primary', onclick: function () { diag = null; saveDiag(); render(true); } }, 'Verwerfen'));
    }
    var pos = E.diagnosticPosition(d);
    var widget = makeWidget(q, drafts[q.id], false);
    function next(r) {
      diag.d = E.advanceDiagnostic(r.diagnostic);
      saveDiag();
      (r.events || []).forEach(function (ev) { progress = E.applyEvent(progress, ev, today()); });
      if (r.events && r.events.length) saveProgress();
      ui.result = null;
      finishDiagnostic();
      ui.focusId = null;
      render(true);
    }
    function submit() {
      var r = E.submitDiagnosticAnswer(diag.d, q, widget.collect());
      if (r.result.status === 'invalid') { ui.result = r.result; ui.focusId = 'feedback'; render(); return; }  // not an answer, can be corrected
      next(r);
    }
    widget.onEnter(submit);
    var sheet = h('section', { class: 'sheet', 'aria-labelledby': 'q-title', 'data-qid': q.id },
      h('div', { class: 'q-head' },
        h('h1', { id: 'q-title', class: 'q-count' }, 'Aufgabe ' + pos.number + ' von ' + pos.total),
        h('span', null, h('span', { class: 'pill' }, 'Thema ' + pos.skill + ' von ' + pos.skills), ' ', h('span', { class: 'muted' }, skillName(item.skillId)))),
      h('p', { class: 'muted', id: 'diag-note' }, E.DIAGNOSTIC_NOTE_DE),
      h('p', { class: 'prompt' }, mathText(q.prompt)),
      q.promptLines ? h('div', { class: 'lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
      diagramBlock(q),
      q.promptTable ? promptTableBlock(q.promptTable) : null,
      q.instructions ? h('p', { class: 'instructions' }, mathText(q.instructions)) : null,
      widget.el,
      h('div', { 'aria-live': 'polite', id: 'feedback-region' }, ui.result && ui.result.status === 'invalid' ? feedbackBlock(ui.result, item) : null),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', id: 'diag-submit', onclick: submit }, pos.number === pos.total ? 'Abgeben und Ergebnis ansehen' : 'Antwort abgeben'),
        h('button', { type: 'button', class: 'btn', id: 'diag-unknown', onclick: function () { next(E.dontKnow(diag.d)); } }, 'Weiß ich nicht')),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'linkish', id: 'diag-quit', onclick: function () {
        confirmDialog('Standortbestimmung beenden?', 'Die Themen, zu denen du schon geantwortet hast, werden ausgewertet.', 'Beenden').then(function (ok) {
          if (!ok) return;
          diag.d = E.endDiagnostic(diag.d); saveDiag(); finishDiagnostic(); ui.result = null; render(true);
        });
      } }, 'Standortbestimmung beenden')));
    return sheet;
  }

  var VERDICT_SYMBOL = { secure: '✓', partial: '◐', gap: '!' };
  function diagnosticResult() {
    finishDiagnostic();
    var d = diag.d;
    var rows = E.summarizeDiagnostic(d);
    var ch = chapterById(d.chapterId);
    var wrong = d.items.filter(function (it) { return it.answered && it.status !== 'correct'; });
    var body = rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table', id: 'diag-table' },
      h('thead', null, h('tr', null, ['Thema', 'Richtig', 'Einschätzung', 'Empfehlung', ''].map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', { 'data-skill-row': r.skillId, 'data-verdict': r.verdict },
          h('th', { scope: 'row', style: 'font-weight:600;color:inherit' }, skillName(r.skillId)),
          h('td', null, r.correct + ' von ' + r.n),
          h('td', null, h('span', { class: 'mastery diag-' + r.verdict }, VERDICT_SYMBOL[r.verdict] + ' ' + E.DIAG_VERDICT_LABELS_DE[r.verdict])),
          h('td', null, r.verdict === 'secure' ? 'Weiter mit Stufe ' + r.level + ' oder höher' : 'Starte bei Stufe ' + r.level),
          h('td', null, isOffered(r.skillId) ? practiseButton(r.skillId) : null));
      })))) : h('p', null, 'Es wurde noch keine Aufgabe beantwortet, deshalb gibt es keine Einschätzung.');
    return h('div', null, h('h1', null, 'Ergebnis der Standortbestimmung'),
      h('p', { class: 'feedback info', id: 'diag-note' }, E.DIAGNOSTIC_NOTE_DE),
      h('section', { class: 'sheet plain' }, h('h2', null, ch ? 'Kapitel ' + ch.number + ' ' + ch.name : 'Kapitel'), body,
        h('p', { class: 'muted' }, 'Bei nur ' + E.ADAPTIVE_RULES.diagQuestionsPerSkill + ' Aufgaben pro Thema ist das eine grobe Einschätzung. Die Antworten zählen wie normale Übungsaufgaben für deinen Fortschritt; „Sicher“ wird ein Thema dadurch nicht.'),
        wrong.length ? h('div', { id: 'diag-review' }, h('h3', null, 'Das kannst du dir noch ansehen'),
          wrong.map(function (it) {
            var q = questionById(it.qid);
            if (!q) return null;
            return h('details', { class: 'chapter' }, h('summary', null, skillName(it.skillId) + ' (Stufe ' + it.level + ')'),
              h('div', { class: 'chapter-body' }, h('p', { class: 'prompt' }, mathText(q.prompt)),
                q.promptLines ? h('div', { class: 'lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
                diagramBlock(q),
                q.promptTable ? promptTableBlock(q.promptTable) : null, solutionBlock(q)));
          })) : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', id: 'diag-again', onclick: function () { diagUi.chapterId = d.chapterId; diagUi.setup = true; render(true); } }, 'Neue Standortbestimmung'),
          h('button', { type: 'button', class: 'btn quiet', id: 'diag-close', onclick: function () { diag = null; saveDiag(); diagUi.setup = false; go('fortschritt'); } }, 'Schließen und zum Fortschritt'))));
  }

  /** Latest stored results per chapter, for the Fortschritt page. */
  function diagnosticsSummary() {
    var all = progress.diagnostics || {};
    var ids = Object.keys(all).sort();
    if (!ids.length) return null;
    return h('div', { id: 'diag-summary' }, h('h3', null, 'Letzte Standortbestimmungen'),
      h('ul', null, ids.map(function (chId) {
        var ch = chapterById(chId);
        var parts = Object.keys(all[chId].skills).map(function (sid) { var s = all[chId].skills[sid]; return skillName(sid) + ': ' + E.DIAG_VERDICT_LABELS_DE[s.verdict] + ' (' + s.correct + ' von ' + s.n + ')'; });
        return h('li', null, (ch ? 'Kapitel ' + ch.number : chId) + ', ' + fmtDate(all[chId].date) + ' – ' + parts.join('; '));
      })), h('p', { class: 'muted' }, 'Nur eine Einschätzung, keine Note.'));
  }
