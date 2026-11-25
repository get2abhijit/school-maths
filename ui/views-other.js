  // ================================================================== shared bits
  function practiseButton(skillId, label, opts) {
    return h('button', { type: 'button', class: 'btn' + (opts && opts.primary ? ' primary' : ''), 'data-skill': skillId,
      onclick: function () {
        if (opts && opts.direct) { maybeReplaceSession().then(function (ok) { if (ok) startSession(skillId, 'adaptive', opts.count || 5); }); return; }
        ui.preselect = { skillId: skillId }; ui.forceSetup = true; go('ueben');
      } }, label || 'Üben');
  }
  /** Starting directly would discard an unfinished session: ask first. */
  function maybeReplaceSession() {
    if (!stored || stored.session.finished) return Promise.resolve(true);
    return confirmDialog('Angefangene Übung verwerfen?', 'Du hast noch eine Übung zu „' + skillName(stored.session.skillId) + '“ offen. Bisherige Ergebnisse bleiben gespeichert.', 'Neue Übung starten');
  }
  function adaptiveInfo(skillId) { return E.adaptiveStats(progress, skillId, E.levelsForSkill); }
  function masteryLabel(skillId) {
    var st = adaptiveInfo(skillId);
    return h('span', { class: 'mastery ' + st.mastery }, E.MASTERY_LABELS_DE[st.mastery]);
  }
  /** Prerequisite fallback (engine rule): a hint, never a lock. null when the student is not struggling or nothing helps. */
  var ADVICE_WHY = { weak: 'Dort lief es zuletzt auch nicht gut.', untested: 'Das hast du noch nicht geübt.', unsure: 'Dort bist du noch nicht ganz sicher.' };
  function adviceBlock(skillId) {
    var adv = E.prerequisiteAdvice(CATALOG, progress, skillId, isOffered, E.ADAPTIVE_RULES, E.levelsForSkill);
    if (adv.action !== 'fallback' && !(adv.external && adv.external.length && E.needsHelp(progress.skills[skillId]))) return null;
    var kids = [h('strong', null, 'Tipp: Die letzten Aufgaben waren schwierig.')];
    if (adv.action === 'fallback') {
      kids.push(h('p', null, 'Übe zuerst „' + skillName(adv.skillId) + '“. Das ist eine Grundlage für dieses Thema. ' + ADVICE_WHY[adv.reason]));
      kids.push(h('div', { class: 'row' }, practiseButton(adv.skillId, 'Dort üben')));
    }
    if (adv.external && adv.external.length) kids.push(h('p', { class: 'muted' }, 'Auch hilfreich: ' + adv.external.join('; ') + '.'));
    return h('div', { class: 'feedback info', id: 'prereq-advice' }, kids);
  }
  function openSessionPanel() {
    if (!stored || stored.session.finished) return null;
    var pos = E.position(stored.session);
    return h('div', { class: 'panel' }, h('h2', null, 'Angefangene Übung'),
      h('p', null, skillName(stored.session.skillId) + ': Aufgabe ' + pos.number + ' von ' + pos.total + '.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'resume-btn', onclick: function () { ui.forceSetup = false; go('ueben'); } }, 'Weiter üben'),
        h('button', { type: 'button', class: 'btn quiet', onclick: function () {
          confirmDialog('Übung verwerfen?', 'Die offenen Aufgaben werden gelöscht. Bisherige Ergebnisse bleiben im Fortschritt.', 'Verwerfen', true).then(function (ok) {
            if (ok) { stored = null; saveSession(); ui.forceSetup = false; render(); }
          });
        } }, 'Verwerfen')));
  }

  // ================================================================== Start (dashboard)
  VIEWS.start = function () {
    var chSel = h('select', { id: 'chapter-select', onchange: function () { progress.settings.currentChapter = chSel.value || null; saveProgress(); render(); } },
      h('option', { value: '' }, 'Noch nicht festgelegt'),
      CATALOG.chapters.map(function (ch) { return h('option', { value: ch.id, selected: progress.settings.currentChapter === ch.id }, ch.number + ' ' + ch.name); }));
    var ch = chapterById(progress.settings.currentChapter);
    var due = E.dueSkills(progress, today()).filter(function (d) { return isOffered(d.skillId); });
    var totals = Object.keys(progress.skills).reduce(function (a, id) { var r = progress.skills[id]; a.q += r.questions; a.f += r.firstAttemptCorrect; return a; }, { q: 0, f: 0 });

    var chapterPanel;
    if (!ch) chapterPanel = h('p', { class: 'muted' }, 'Wähle oben, welches Kapitel ihr gerade im Unterricht habt. Dann zeigt dir die Startseite die passenden Themen.');
    else {
      var skills = chapterSkills(ch);
      chapterPanel = h('div', null, h('h2', null, 'Themen in Kapitel ' + ch.number), diagnosticButton(ch.id),
        h('table', { class: 'data-table' }, h('thead', null, h('tr', null, h('th', null, 'Thema'), h('th', null, 'Stand'), h('th', null, h('span', { class: 'sr' }, '')))),
          h('tbody', null, skills.map(function (s) {
            var ready = isPracticable(s.id);
            var offered = ready && isOffered(s.id);
            return h('tr', null, h('td', null, s.name), h('td', null, !ready ? h('span', { class: 'muted' }, 'folgt') : offered ? masteryLabel(s.id) : h('span', { class: 'muted' }, 'noch nicht behandelt')),
              h('td', null, offered ? practiseButton(s.id) : null));
          }))));
    }

    return h('div', null,
      h('h1', null, 'Mathe üben, Klasse 7'),
      openSessionPanel(),
      h('div', { class: 'grid2' },
        kaDashboardCard(),
        h('div', { class: 'panel' }, h('label', { class: 'field-label', for: 'chapter-select' }, 'Aktuelles Kapitel im Unterricht'), chSel,
          h('p', { class: 'muted', style: 'margin-top:.5rem' }, 'Das stellst du selbst ein. Die App kennt den Stoffplan deiner Klasse nicht.')),
        h('div', { class: 'panel' }, h('div', { class: 'stat' }, String(totals.q)), h('p', { class: 'muted' }, 'Aufgaben bisher bearbeitet'),
          totals.q ? h('p', null, pct(totals.f / totals.q) + ' beim ersten Versuch richtig') : h('p', null, 'Noch keine Aufgaben. Leg los!')),
        h('div', { class: 'panel' }, h('div', { class: 'stat' }, String(due.length)), h('p', { class: 'muted' }, due.length === 1 ? 'Thema zum Wiederholen fällig' : 'Themen zum Wiederholen fällig'),
          due.length ? h('a', { class: 'btn', href: '#wiederholen' }, 'Wiederholen') : null)),
      h('section', { class: 'sheet plain' }, chapterPanel));
  };

  // ================================================================== Kapitel (+ "Im Unterricht behandelt")
  var kapUi = { open: {} };
  VIEWS.kapitel = function () {
    var cur = progress.settings.currentChapter;
    var cov = coverage();
    var summary = {};
    E.coverageSummary(CATALOG, cov).forEach(function (x) { summary[x.chapterId] = x; });
    var practicable = E.skillsWithTemplates();
    var part = E.partitionSkills(CATALOG, cov, practicable);
    var readyChapters = CATALOG.chapters.filter(function (ch) { return chapterSkills(ch).some(function (s) { return isPracticable(s.id); }); })
      .map(function (ch) { return ch.roman; });

    function keepOpen(chId, focusId) { kapUi.open[chId] = true; ui.focusId = focusId; render(); }
    var enabledCb = h('input', { type: 'checkbox', id: 'cov-enabled', checked: cov.enabled, 'aria-describedby': 'cov-help', onchange: function () {
      setCoverage(E.setCoverageEnabled(coverage(), enabledCb.checked)); ui.focusId = 'cov-enabled'; render();
    } });
    var filterPanel = h('section', { class: 'panel', 'aria-labelledby': 'cov-title' },
      h('h2', { id: 'cov-title' }, 'Im Unterricht behandelt'),
      h('label', { class: 'check-line', for: 'cov-enabled' }, enabledCb, 'Nur Themen anbieten, die wir im Unterricht schon behandelt haben'),
      h('p', { class: 'muted', id: 'cov-help' }, 'Hake unten bei jedem Kapitel die Schulbuch-Abschnitte an, die ihr schon gemacht habt. Ein Thema wird angeboten, wenn alle seine Abschnitte angehakt sind. Das gilt für Üben, Wiederholen und Arbeitsblätter. Die App kennt den Stoffplan deiner Klasse nicht – du stellst das selbst ein.'),
      h('p', { id: 'cov-status', 'aria-live': 'polite' }, cov.enabled
        ? (part.available.length ? part.available.length + ' von ' + practicable.length + ' übbaren Themen werden angeboten.' : 'Noch kein Thema freigegeben: Hake unten die behandelten Abschnitte an.')
        : 'Ausgeschaltet: Alle ' + practicable.length + ' übbaren Themen werden angeboten.'));

    return h('div', null, h('h1', null, 'Kapitel'),
      h('p', { class: 'muted' }, 'Die Kapitel folgen dem Schulbuch Lambacher Schweizer 7 (Baden-Württemberg, G9). Übbar sind bisher die Themen der Kapitel ' + readyChapters.join(', ') + '; die anderen folgen.'),
      filterPanel,
      CATALOG.chapters.map(function (ch) {
        var skills = chapterSkills(ch);
        var ready = skills.filter(function (s) { return isPracticable(s.id); }).length;
        var sum = summary[ch.id];
        var covText = sum.sectionsMarked ? sum.sectionsMarked + ' von ' + sum.sectionsTotal + ' Abschnitten behandelt' : null;
        var open = kapUi.open[ch.id] || (cur ? cur === ch.id : ch.roman === 'I');
        var details = h('details', { class: 'chapter', 'data-chapter': ch.id, open: open, ontoggle: function () { kapUi.open[ch.id] = details.open; } },
          h('summary', null, h('span', { class: 'chapter-num' }, ch.roman || String(ch.number)), h('span', null, h('strong', null, ch.name), ' ',
            h('span', { class: 'muted' }, (ready ? '(' + ready + ' von ' + skills.length + ' Themen übbar' : '(folgt') + (covText ? '; ' + covText : '') + ')'))),
          h('div', { class: 'chapter-body' },
            h('fieldset', { class: 'cov-sections' }, h('legend', null, 'Im Unterricht behandelt (Kapitel ' + ch.roman + ')'),
              h('div', { class: 'seg' }, ch.sections.map(function (sec) {
                var id = 'cov-' + sec.id.replace('.', '-');
                var cb = h('input', { type: 'checkbox', id: id, 'data-section': sec.id, checked: cov.sections.indexOf(sec.id) >= 0, onchange: function () {
                  setCoverage(E.setSectionCovered(CATALOG, coverage(), sec.id, cb.checked)); keepOpen(ch.id, id);
                } });
                return h('label', { for: id }, cb, ch.roman + '.' + sec.number + ' ' + sec.title, h('span', { class: 'muted' }, ' (S. ' + sec.page + ')'));
              })),
              h('div', { class: 'row', style: 'margin:.4rem 0 0' },
                h('button', { type: 'button', class: 'btn quiet', id: 'cov-all-' + ch.id, disabled: sum.state === 'covered', onclick: function () { setCoverage(E.setChapterCovered(CATALOG, coverage(), ch.id, true)); keepOpen(ch.id, 'cov-none-' + ch.id); } }, 'Alle Abschnitte anhaken'),
                h('button', { type: 'button', class: 'btn quiet', id: 'cov-none-' + ch.id, disabled: sum.state === 'open', onclick: function () { setCoverage(E.setChapterCovered(CATALOG, coverage(), ch.id, false)); keepOpen(ch.id, 'cov-all-' + ch.id); } }, 'Keinen anhaken'))),
            diagnosticButton(ch.id),
            ch.topics.map(function (t) {
              return h('div', null, h('h3', { style: 'margin-top:.8rem' }, t.name), t.skills.map(function (s) {
                var ok = isPracticable(s.id);
                var offered = ok && E.isSkillAvailable(CATALOG, cov, s.id);
                var state = E.skillCoverage(CATALOG, cov, s.id);
                var provisional = (s.curriculum || []).some(function (c) { return c.status !== 'verified'; }) || (s.textbookRef && s.textbookRef.status !== 'verified');
                return h('div', { class: 'skill', 'data-skill-row': s.id },
                  h('div', { class: 'skill-head' }, h('strong', null, s.name),
                    h('span', null, h('span', { class: 'tag' + (ok ? ' ready' : '') }, ok ? 'übbar' : 'folgt'),
                      cov.enabled && ok ? [' ', h('span', { class: 'tag cov-' + state, 'data-coverage': state }, E.COVERAGE_LABELS_DE[state])] : null,
                      provisional ? [' ', h('span', { class: 'tag', title: 'Die Zuordnung zum Bildungsplan ist noch nicht vollständig überprüft.' }, 'Zuordnung vorläufig')] : null)),
                  h('p', { class: 'muted', style: 'margin:0' }, 'Schulbuch ' + E.skillSectionLabel(CATALOG, s.id) + ', ab S. ' + s.textbookRef.page),
                  s.description ? h('p', { style: 'margin:0' }, mathText(s.description)) : null,
                  ok && s.levels ? h('ul', { class: 'levels-list' }, [1, 2, 3, 4].filter(function (l) { return s.levels['L' + l] && E.levelsForSkill(s.id).indexOf(l) >= 0; })
                    .map(function (l) { return h('li', null, 'Stufe ' + l + ' (' + E.LEVELS[l] + '): ', mathText(s.levels['L' + l])); })) : null,
                  offered ? h('div', { class: 'row', style: 'margin:.3rem 0 0' }, practiseButton(s.id), masteryLabel(s.id))
                    : ok ? h('p', { class: 'muted', style: 'margin:.3rem 0 0' }, E.skillSectionIds(CATALOG, s.id).length > 1
                      ? 'Wird angeboten, sobald alle Abschnitte ' + E.skillSectionLabel(CATALOG, s.id) + ' angehakt sind.'
                      : 'Wird angeboten, sobald Abschnitt ' + E.skillSectionLabel(CATALOG, s.id) + ' angehakt ist.') : null);
              }));
            })));
        return details;
      }));
  };

  // ================================================================== Wiederholen
  VIEWS.wiederholen = function () {
    var t = today();
    var dueAll = E.dueSkills(progress, t).filter(function (d) { return isPracticable(d.skillId); });
    var duePart = E.partitionSkills(CATALOG, coverage(), dueAll.map(function (d) { return d.skillId; }));
    var due = dueAll.filter(function (d) { return duePart.available.indexOf(d.skillId) >= 0; });
    var ch = chapterById(progress.settings.currentChapter);
    var untouched = ch ? chapterSkills(ch).filter(function (s) { return isOffered(s.id) && !progress.skills[s.id]; }) : [];
    return h('div', null, h('h1', null, 'Wiederholen'),
      h('p', { class: 'muted' }, 'Ein Thema ist wieder dran, wenn sein Termin erreicht ist. Wer die letzten Aufgaben gut gelöst hat, bekommt längere Pausen (' + E.ADAPTIVE_RULES.reviewLadder.join(', ') + ' Tage); bei vielen Fehlern rückt das Thema wieder näher. Üben am selben Tag verlängert die Pause nicht.'),
      h('section', { class: 'sheet plain' }, h('h2', null, 'Heute fällig'),
        due.length ? h('table', { class: 'data-table' }, h('thead', null, h('tr', null, h('th', null, 'Thema'), h('th', null, 'Fällig seit'), h('th', null, ''))),
          h('tbody', null, due.map(function (d) {
            return h('tr', null, h('td', null, skillName(d.skillId)), h('td', null, fmtDate(d.nextReview)), h('td', null, practiseButton(d.skillId, '5 Aufgaben', { direct: true, count: 5 })));
          })))
          : h('p', null, Object.keys(progress.skills).length ? 'Heute ist nichts fällig. Gut gemacht!' : 'Sobald du geübt hast, erscheinen hier die Themen zum Wiederholen.'),
        hiddenNote(duePart.hidden.length)),
      untouched.length ? h('section', { class: 'sheet plain' }, h('h2', null, 'Noch nicht geübt in Kapitel ' + ch.number),
        h('ul', null, untouched.map(function (s) { return h('li', { style: 'margin:.4rem 0' }, s.name, ' ', practiseButton(s.id, '5 Aufgaben', { direct: true, count: 5 })); }))) : null);
  };

  // ================================================================== Fortschritt + data management
  VIEWS.fortschritt = function () {
    var ids = Object.keys(progress.skills).sort();
    var table = ids.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', null, h('tr', null, ['Thema', 'Stand', 'Empfohlene Stufe', 'Aufgaben', 'Beim 1. Versuch richtig', 'Tipps', 'Häufigster Fehler', 'Zuletzt', 'Nächste Wiederholung'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null, ids.map(function (id) {
        var st = E.skillStats(progress, id);
        return h('tr', null, h('th', { scope: 'row', style: 'font-weight:600;color:inherit' }, skillName(id)), h('td', null, masteryLabel(id)), h('td', null, adaptiveInfo(id).recommendedLevel ? 'Stufe ' + adaptiveInfo(id).recommendedLevel : '–'), h('td', null, String(st.questions)),
          h('td', null, pct(st.firstAttemptRate), h('div', { class: 'bar-meter', 'aria-hidden': 'true' }, h('span', { style: 'width:' + Math.round((st.firstAttemptRate || 0) * 100) + '%' }))),
          h('td', null, String(st.hintsUsed)), h('td', null, st.topError ? E.ERROR_LABELS_DE[st.topError] : '–'),
          h('td', null, fmtDate(st.lastPractised)), h('td', null, fmtDate(st.nextReview)));
      }))))
      : h('p', null, 'Noch keine Ergebnisse. Starte eine Übung unter ', h('a', { href: '#ueben' }, 'Üben'), '.');

    var status = h('p', { class: 'muted', 'aria-live': 'polite', id: 'data-status' }, ui.notice || '');
    ui.notice = null;
    function exportText() { return JSON.stringify(progress, null, 2); }
    var A = E.ADAPTIVE_RULES;

    var fileIn = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'sr-file', onchange: function () {
      var f = fileIn.files && fileIn.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { doImport(String(reader.result)); };
      reader.onerror = function () { status.textContent = 'Die Datei konnte nicht gelesen werden.'; };
      reader.readAsText(f);
    } });
    function doImport(text) {
      var obj;
      try { obj = JSON.parse(text); } catch (e) { status.textContent = 'Das ist kein gültiges JSON.'; return; }
      var r = E.validateProgress(obj);
      if (!r.ok) { status.textContent = 'Import abgelehnt: ' + r.errors.slice(0, 3).join(' '); return; }
      confirmDialog('Fortschritt ersetzen?', 'Der aktuelle Fortschritt auf diesem Gerät wird durch die Datei ersetzt.', 'Ersetzen', true).then(function (ok) {
        if (!ok) return;
        progress = r.value; saveProgress(); applyTheme(); ui.notice = 'Fortschritt importiert.'; render();
      });
    }

    var reports = progress.reports.length ? h('div', null, h('h3', null, 'Gemeldete Probleme (' + progress.reports.length + ')'),
      h('ul', null, progress.reports.slice().reverse().map(function (r) { return h('li', null, fmtDate(r.createdAt) + ': ' + r.questionId + (r.note ? ' – ' + r.note : '')); })),
      h('button', { type: 'button', class: 'btn quiet', onclick: function () {
        var txt = JSON.stringify(progress.reports, null, 2);
        var ta = h('textarea', { readonly: true, 'aria-label': 'Alle Berichte' }); ta.value = txt;
        var st = h('p', { class: 'muted', 'aria-live': 'polite' });
        openDialog({ title: 'Gemeldete Probleme', body: [h('p', null, 'Kopiere den Text und schicke ihn an die Person, die die App betreut.'), ta, st],
          actions: [{ label: 'Kopieren', value: 'c', onclick: function () { copyText(txt, ta).then(function (m) { st.textContent = m; }); return false; } }, { label: 'Schließen', value: null, primary: true }] });
      } }, 'Berichte anzeigen')) : null;

    return h('div', null, h('h1', null, 'Fortschritt'),
      h('section', { class: 'sheet plain' }, table,
        h('p', { class: 'muted', style: 'margin-top:.8rem' }, '„Sicher“ heißt: von den letzten ' + A.masteryWindow + ' Aufgaben sind mindestens ' + Math.round(A.masteryAccuracy * 100) +
          ' % beim ersten Versuch gelungen (mit Tipp zählt eine Aufgabe halb, mit geöffnetem Lösungsweg gar nicht), und die Stufe ' + A.masteryProofLevel + ' (bei Themen mit weniger Stufen die höchste) hast du bewiesen. Mit weniger als ' + A.masteryMinQuestions +
          ' Aufgaben gibt es diesen Stand nicht. Die empfohlene Stufe ist ein Vorschlag aus deinen letzten Aufgaben, keine Note.'),
        diagnosticsSummary()),
      h('section', { class: 'panel' }, h('h2', null, 'Deine Daten'),
        h('p', null, 'Alles wird nur in diesem Browser auf diesem Gerät gespeichert. Mit einer Sicherungsdatei kannst du den Fortschritt auf ein anderes Gerät mitnehmen. Die Sicherung enthält auch deine Einstellungen, zum Beispiel welche Abschnitte im Unterricht behandelt wurden.'),
        !storageOk ? h('p', { class: 'feedback info' }, 'Dieser Browser erlaubt hier keine Speicherung. Sichere deinen Fortschritt vor dem Schließen.') : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn', id: 'export-btn', onclick: function () { saveFile('mathe7-fortschritt-' + today() + '.json', exportText()).then(function (m) { status.textContent = m; }); } }, 'Sicherung speichern'),
          h('button', { type: 'button', class: 'btn quiet', id: 'export-text-btn', onclick: function () {
            var ta = h('textarea', { readonly: true, 'aria-label': 'Sicherung als Text' }); ta.value = exportText();
            var st = h('p', { class: 'muted', 'aria-live': 'polite' });
            openDialog({ title: 'Sicherung als Text', body: [h('p', null, 'Kopiere diesen Text und speichere ihn, z. B. in einer Notiz.'), ta, st],
              actions: [{ label: 'Kopieren', value: 'c', onclick: function () { copyText(ta.value, ta).then(function (m) { st.textContent = m; }); return false; } }, { label: 'Schließen', value: null, primary: true }] });
          } }, 'Als Text anzeigen')),
        h('div', { class: 'row' },
          h('label', { class: 'btn', for: 'import-file', tabindex: '0', role: 'button', onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Sicherung laden'), fileIn,
          h('button', { type: 'button', class: 'btn quiet', id: 'import-text-btn', onclick: function () {
            var ta = h('textarea', { 'aria-label': 'Sicherung hier einfügen', id: 'import-text' });
            openDialog({ title: 'Sicherung einfügen', body: [h('p', null, 'Füge den Text einer Sicherung ein.'), ta],
              actions: [{ label: 'Abbrechen', value: null }, { label: 'Laden', value: 'load', primary: true }] }).then(function (v) { if (v === 'load') doImport(ta.value); });
          } }, 'Text einfügen')),
        status,
        reports,
        h('h3', null, 'Alles löschen'),
        h('p', null, 'Löscht Fortschritt, angefangene Übung und Standortbestimmung, Klassenarbeits-Vorbereitung (Datum, Selbsteinschätzung, Übungsrunden), Einstellungen (auch „Im Unterricht behandelt“), gespeicherte Arbeitsblätter und gemeldete Probleme auf diesem Gerät.'),
        h('button', { type: 'button', class: 'btn danger', id: 'delete-all-btn', onclick: function () {
          confirmDialog('Alle Daten löschen?', 'Das kann nicht rückgängig gemacht werden. Speichere vorher eine Sicherung, wenn du den Fortschritt behalten willst.', 'Alles löschen', true).then(function (ok) {
            if (!ok) return;
            [KEYS.progress, KEYS.session, KEYS.draft, KEYS.worksheet, KEYS.diagnostic, KEYS.ka].forEach(sRemove);
            progress = E.emptyProgress(); stored = null; diag = null; drafts = {}; qCache = {}; resetWorksheetState(); resetKaState();
            applyTheme(); ui.notice = 'Alle Daten wurden gelöscht.'; render();
          });
        } }, 'Alle Daten löschen')),
      h('section', { class: 'panel' }, h('h2', null, 'Datenschutz'),
        h('p', null, 'Diese App hat keine Konten und sendet keine Daten an einen Server. Für die Darstellung von Formeln wird beim Öffnen einmal die Bibliothek KaTeX von cdnjs.cloudflare.com geladen; dabei sieht dieser Anbieter wie bei jeder Webseite die IP-Adresse. Ohne Internet werden Formeln als einfacher Text angezeigt.')));
  };
