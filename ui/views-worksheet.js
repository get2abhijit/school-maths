  // ================================================================== Arbeitsblätter (Session 4)
  // Builder → engine.createWorksheet → engine.worksheetLayout → two paper views (student sheet, answer key).
  // Only the worksheet record (settings + seed + question ids) is stored; content is regenerated from it.
  // Name and date are printed as empty lines; they are never typed into the app.
  var WS_RECENT_MAX = 8;
  var wsState = (function () {
    var raw = sRead(KEYS.worksheet);
    var st = { current: null, recent: [], settings: null };
    if (raw && typeof raw === 'object') {
      if (raw.current && E.isValidWorksheet(raw.current.worksheet)) st.current = raw.current;
      if (Array.isArray(raw.recent)) st.recent = raw.recent.filter(function (r) { return r && E.isValidWorksheet(r.worksheet); }).slice(0, WS_RECENT_MAX);
      if (raw.settings && typeof raw.settings === 'object') st.settings = raw.settings;
    }
    return st;
  })();
  var wsUi = { tab: 'student', message: null, loaded: null };
  function saveWs() { sWrite(KEYS.worksheet, wsState); }
  function resetWorksheetState() { wsState = { current: null, recent: [], settings: null }; wsUi = { tab: 'student', message: null, loaded: null }; }

  /** Regenerate the current worksheet (cached per code). Returns {ok, layout} or {ok:false, message}. */
  function currentLayout() {
    var cur = wsState.current;
    if (!cur) return null;
    if (wsUi.loaded && wsUi.loaded.code === cur.worksheet.code) return wsUi.loaded.result;
    var r = E.loadWorksheet(cur.worksheet);
    var result = r.ok ? { ok: true, layout: E.worksheetLayout(r.worksheet, r.questions) } : { ok: false, message: r.message };
    wsUi.loaded = { code: cur.worksheet.code, result: result };
    return result;
  }

  function makeWorksheet(settings) {
    var spec = {
      skills: settings.skills, levels: settings.levels, count: settings.count, baseSeed: newSeed(), title: settings.title,
      keyMode: settings.keyMode, space: settings.space, nameField: settings.nameField, dateField: settings.dateField,
    };
    var created;
    try { created = E.createWorksheet(spec); }
    catch (e) { return { ok: false, message: (e && e.errors ? e.errors.join(' ') : 'Das Arbeitsblatt konnte nicht erstellt werden.') }; }
    var entry = { worksheet: created.worksheet, createdAt: today() };
    wsState.current = entry;
    wsState.settings = settings;
    wsState.recent = [entry].concat(wsState.recent.filter(function (r) { return r.worksheet.code !== entry.worksheet.code; })).slice(0, WS_RECENT_MAX);
    saveWs();
    wsUi.loaded = { code: created.worksheet.code, result: { ok: true, layout: E.worksheetLayout(created.worksheet, created.questions) } };
    return { ok: true };
  }

  // ------------------------------------------------------------------ builder form
  function builderForm() {
    var s = wsState.settings || {};
    var part = E.partitionSkills(CATALOG, coverage(), E.skillsWithTemplates());
    var practicable = part.available; // practicable AND allowed by "Im Unterricht behandelt"
    var currentCh = progress.settings.currentChapter;
    var defaultSkills = (s.skills || practicable.filter(function (id) { return !currentCh || chapterOfSkill[id] && chapterOfSkill[id].id === currentCh; }))
      .filter(function (id) { return practicable.indexOf(id) >= 0; });
    if (!defaultSkills.length) defaultSkills = practicable.slice(0, 1);
    var status = h('div', { 'aria-live': 'polite', id: 'ws-status' });

    var skillBoxes = [];
    var skillFields = CATALOG.chapters.map(function (ch) {
      var skills = chapterSkills(ch).filter(function (sk) { return practicable.indexOf(sk.id) >= 0; });
      if (!skills.length) return null;
      return h('fieldset', { class: 'ws-group' }, h('legend', null, ch.number + ' ' + ch.name),
        h('div', { class: 'seg' }, skills.map(function (sk) {
          var inp = h('input', { type: 'checkbox', name: 'ws-skill', value: sk.id, checked: defaultSkills.indexOf(sk.id) >= 0 });
          skillBoxes.push(inp);
          return h('label', null, inp, sk.name);
        })));
    });
    var notYet = CATALOG.chapters.filter(function (ch) { return !chapterSkills(ch).some(function (sk) { return isPracticable(sk.id); }); })
      .map(function (ch) { return ch.number + ' ' + ch.name; });

    var levels = s.levels || [1, 2, 3, 4];
    var levelBox = h('div', { class: 'seg', id: 'ws-levels' }, [1, 2, 3, 4].map(function (l) {
      return h('label', null, h('input', { type: 'checkbox', name: 'ws-level', value: String(l), checked: levels.indexOf(l) >= 0 }), 'Stufe ' + l + ': ' + E.LEVELS[l]);
    }));
    function radios(name, values, labels, checked) {
      return h('div', { class: 'seg' }, values.map(function (v) {
        return h('label', null, h('input', { type: 'radio', name: name, value: String(v), checked: String(v) === String(checked) }), labels(v));
      }));
    }
    var countBox = radios('ws-count', E.WORKSHEET_COUNTS, function (n) { return n + ' Aufgaben'; }, s.count || 8);
    var spaceBox = radios('ws-space', E.SPACE_OPTIONS, function (v) { return E.SPACE_LABELS_DE[v]; }, s.space || 'small');
    var keyBox = radios('ws-key', E.KEY_MODES, function (v) { return E.KEY_MODE_LABELS_DE[v]; }, s.keyMode || 'answers');
    var title = h('input', { type: 'text', id: 'ws-title', maxlength: String(E.WORKSHEET_LIMITS.maxTitle), value: s.title || E.DEFAULT_TITLE_DE, autocomplete: 'off', 'aria-describedby': 'ws-title-help' });
    var nameCb = h('input', { type: 'checkbox', id: 'ws-name', checked: s.nameField !== false });
    var dateCb = h('input', { type: 'checkbox', id: 'ws-date', checked: s.dateField !== false });

    function collect() {
      var picked = function (name) { return Array.prototype.filter.call(document.querySelectorAll('input[name="' + name + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }); };
      return {
        skills: picked('ws-skill'), levels: picked('ws-level').map(Number), count: Number(picked('ws-count')[0]),
        space: picked('ws-space')[0], keyMode: picked('ws-key')[0], title: title.value,
        nameField: nameCb.checked, dateField: dateCb.checked,
      };
    }
    function create() {
      var r = makeWorksheet(collect());
      if (!r.ok) {
        status.replaceChildren(h('div', { class: 'feedback bad', id: 'ws-error', tabindex: '-1' }, h('strong', null, 'Noch nicht möglich: '), r.message));
        var err = document.getElementById('ws-error'); if (err) err.focus();
        return;
      }
      wsUi.tab = 'student';
      wsUi.message = 'Arbeitsblatt ' + wsState.current.worksheet.code + ' erstellt.';
      ui.focusId = 'ws-preview-title';
      render();
    }

    return h('section', { class: 'sheet plain form-grid ws-builder no-print', 'aria-labelledby': 'ws-builder-title' },
      h('h2', { id: 'ws-builder-title' }, 'Neues Arbeitsblatt'),
      h('div', null, h('label', { for: 'ws-title' }, 'Überschrift'), title,
        h('p', { class: 'muted', id: 'ws-title-help' }, 'Bitte keinen Namen eintragen. Name und Datum schreibst du auf dem Ausdruck von Hand in die freien Zeilen.')),
      h('div', null, h('span', { class: 'field-label' }, 'Themen'), skillFields,
        practicable.length ? null : h('p', { class: 'feedback info', id: 'ws-cov-empty' }, 'Noch kein Thema freigegeben. Hake unter ', h('a', { href: '#kapitel' }, 'Kapitel'), ' die Abschnitte an, die ihr im Unterricht behandelt habt.'),
        hiddenNote(part.hidden.length),
        notYet.length ? h('p', { class: 'muted' }, 'Noch ohne Aufgaben: ' + notYet.join(', ') + '.') : null),
      h('fieldset', null, h('legend', null, 'Stufen (Mischung)'), levelBox,
        h('p', { class: 'muted' }, 'Die Aufgaben werden nach Stufen sortiert: leichte zuerst.')),
      h('fieldset', null, h('legend', null, 'Anzahl'), countBox),
      h('fieldset', null, h('legend', null, 'Rechenplatz unter jeder Aufgabe'), spaceBox),
      h('fieldset', null, h('legend', null, 'Lösungsblatt'), keyBox),
      h('fieldset', null, h('legend', null, 'Kopfzeile'),
        h('div', { class: 'seg' }, h('label', null, nameCb, 'Zeile für den Namen'), h('label', null, dateCb, 'Zeile für das Datum'))),
      status,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'ws-create-btn', onclick: create }, 'Arbeitsblatt erstellen')));
  }

  // ------------------------------------------------------------------ paper rendering (engine layout → DOM)
  var SPACE_LINES = { none: 0, small: 3, medium: 6, large: 10 };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) el.appendChild(arguments[i]);
    return el;
  }
  var GRID_MM = 190; // wider than the A4 text width (182 mm); the field clips the overflow
  /**
   * Karo-Rechenfeld: 5-mm squares like a "kariertes Heft". One <svg> whose user unit is exactly 1 mm
   * (width = viewBox width in mm) with a single <path> of plain lines. Deliberately NO <pattern>/url(#id)
   * reference (those fail in embedded pages) and NO CSS background (browsers drop backgrounds when printing).
   */
  function gridSpace(rows) {
    var h5 = rows * 5, d = [], i;
    for (i = 0; i <= rows; i++) d.push('M0 ' + (i * 5) + 'H' + GRID_MM);
    for (i = 0; i * 5 <= GRID_MM; i++) d.push('M' + (i * 5) + ' 0V' + h5);
    var svg = svgEl('svg', { class: 'ws-grid', width: GRID_MM + 'mm', height: h5 + 'mm', viewBox: '0 0 ' + GRID_MM + ' ' + h5, 'aria-hidden': 'true', focusable: 'false' },
      svgEl('path', { class: 'ws-grid-line', d: d.join(''), fill: 'none', stroke: '#9fadc0', 'stroke-width': '0.3' }));
    return h('div', { class: 'ws-space', style: 'height:' + h5 + 'mm', 'aria-hidden': 'true' }, svg);
  }

  function headerBlock(L, isKey) {
    var fields = [];
    if (L.nameField && !isKey) fields.push(h('span', { class: 'ws-fill' }, 'Name: ', h('span', { class: 'ws-blank wide', 'aria-label': 'Feld für den Namen' })));
    if (L.dateField && !isKey) fields.push(h('span', { class: 'ws-fill' }, 'Datum: ', h('span', { class: 'ws-blank', 'aria-label': 'Feld für das Datum' })));
    return h('header', { class: 'ws-head' },
      h('div', { class: 'ws-head-top' },
        h('h2', { class: 'ws-title' }, isKey ? 'Lösungen: ' + L.title : L.title),
        h('span', { class: 'ws-code' }, 'Blatt ' + L.code)),
      fields.length ? h('div', { class: 'ws-fields' }, fields) : null,
      h('p', { class: 'ws-topics' }, (isKey ? 'Gehört zum Arbeitsblatt ' + L.code + '. ' : '') + 'Themen: ' + L.skills.map(skillName).join(' · ')));
  }
  function responseBlock(r) {
    if (r.kind === 'choice') {
      return h('ul', { class: 'ws-options' }, r.options.map(function (o) {
        return h('li', null, h('span', { class: 'ws-box', 'aria-hidden': 'true' }, r.multiple ? '☐' : '○'), h('b', null, o.letter + ' '), mathText(o.text));
      }));
    }
    if (r.kind === 'ordering') {
      return h('div', null, h('ul', { class: 'ws-options' }, r.items.map(function (o) { return h('li', null, h('b', null, o.letter + ' '), mathText(o.text)); })),
        h('p', { class: 'ws-answer' }, 'Reihenfolge: ', Array.from({ length: r.slots }, function () { return h('span', { class: 'ws-blank short' }); })));
    }
    if (r.kind === 'table') {
      return h('div', { class: 'ws-table-wrap' }, h('table', { class: 'ws-table' },
        h('tbody', null, r.cells.map(function (c) { return h('tr', null, h('th', { scope: 'row' }, mathText(c.label)), h('td', { class: 'ws-cell' }, '')); }))));
    }
    if (r.kind === 'grid') {
      return h('div', { class: 'ws-table-wrap' }, h('table', { class: 'ws-table ws-grid' },
        h('thead', null, h('tr', null, r.columns.map(function (c) { return h('th', { scope: 'col' }, mathText(c)); }))),
        h('tbody', null, r.rows.map(function (row) {
          return h('tr', null, row.map(function (e) { return e.blank ? h('td', { class: 'ws-cell' }, '') : h('td', null, mathText(e.text)); }));
        }))));
    }
    if (r.kind === 'solution_set') {
      return h('ul', { class: 'ws-options' }, r.choices.map(function (c) {
        return h('li', null, h('span', { class: 'ws-box', 'aria-hidden': 'true' }, '○'), c.text,
          c.kind === 'one' ? h('span', null, ' ', mathText('$' + r.variable + ' =$'), ' ', h('span', { class: 'ws-blank' })) : null);
      }));
    }
    var unit = r.unit ? ' ' + r.unit : null;
    if (r.variable) return h('p', { class: 'ws-answer' }, 'Antwort: ', mathText('$' + r.variable + ' =$'), ' ', h('span', { class: 'ws-blank wide' }), unit);
    return h('p', { class: 'ws-answer' }, 'Antwort: ', h('span', { class: 'ws-blank wide' }), unit);
  }
  function studentPaper(L) {
    var lines = SPACE_LINES[L.space] || 0;
    return h('article', { class: 'paper', 'data-paper': 'student', 'aria-label': 'Schülerblatt' }, headerBlock(L, false),
      h('ol', { class: 'ws-list' }, L.student.map(function (q) {
        return h('li', { class: 'ws-q', 'data-qid': q.qid, 'data-number': String(q.number) },
          h('div', { class: 'ws-qhead' }, h('span', { class: 'ws-num' }, q.number + '.'), h('span', { class: 'ws-level' }, 'Stufe ' + q.level)),
          h('p', { class: 'ws-prompt' }, mathText(q.prompt)),
          q.promptLines ? h('div', { class: 'ws-lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
          diagramBlock(q),
          q.promptTable ? h('div', { class: 'ws-table-wrap ws-given' }, h('table', { class: 'ws-table ws-grid' },
            h('thead', null, h('tr', null, q.promptTable.columns.map(function (c) { return h('th', { scope: 'col' }, mathText(c)); }))),
            h('tbody', null, q.promptTable.rows.map(function (row) { return h('tr', null, row.map(function (e) { return h('td', null, mathText(e)); })); })))) : null,
          q.instructions ? h('p', { class: 'ws-instr' }, mathText(q.instructions)) : null,
          q.paperInstruction ? h('p', { class: 'ws-instr' }, q.paperInstruction) : null,
          responseBlock(q.response),
          lines ? gridSpace(lines) : null);
      })),
      h('p', { class: 'ws-foot' }, 'Mathe 7 · Blatt ' + L.code + ' · Die Lösungen stehen auf dem Lösungsblatt mit demselben Code.'));
  }
  function keyPaper(L) {
    var worked = L.keyMode === 'worked';
    return h('article', { class: 'paper', 'data-paper': 'key', 'aria-label': 'Lösungsblatt' }, headerBlock(L, true),
      h('ol', { class: 'ws-list' + (worked ? '' : ' compact') }, L.key.map(function (k, i) {
        var q = L.student[i];
        return h('li', { class: 'ws-q', 'data-qid': k.qid, 'data-number': String(k.number) },
          h('div', { class: 'ws-qhead' }, h('span', { class: 'ws-num' }, k.number + '.'), h('span', { class: 'ws-level' }, 'Stufe ' + k.level)),
          worked ? h('p', { class: 'ws-prompt small' }, mathText(q.prompt)) : null,
          k.grid ? h('div', { class: 'ws-table-wrap' }, h('table', { class: 'ws-table ws-grid' },
            h('thead', null, h('tr', null, k.grid.columns.map(function (c) { return h('th', { scope: 'col' }, mathText(c)); }))),
            h('tbody', null, k.grid.rows.map(function (row) {
              return h('tr', null, row.map(function (e) { return h('td', e.answer ? { class: 'ws-key-cell' } : null, e.answer ? h('b', null, mathText(e.text)) : mathText(e.text)); }));
            })))) :
          k.cells ? h('div', { class: 'ws-table-wrap' }, h('table', { class: 'ws-table' }, h('tbody', null, k.cells.map(function (c) {
            return h('tr', null, h('th', { scope: 'row' }, mathText(c.label)), h('td', null, mathText(c.value)));
          })))) : h('p', { class: 'ws-result' }, h('b', null, 'Lösung: '), mathText(k.result)),
          k.steps ? h('ol', { class: 'ws-steps' }, k.steps.map(function (s) { return h('li', null, mathText(s)); })) : null);
      })),
      h('p', { class: 'ws-foot' }, 'Mathe 7 · Lösungsblatt ' + L.code));
  }

  // ------------------------------------------------------------------ printing and file export
  function printPaper(kind) {
    wsUi.tab = kind;
    render();
    var st = document.getElementById('ws-print-status');
    try {
      if (typeof window.print !== 'function') throw new Error('no print');
      window.print();
      if (st) st.textContent = 'Der Druckdialog wurde geöffnet. Wähle dort „Als PDF speichern“ oder deinen Drucker.';
    } catch (e) {
      if (st) st.textContent = 'Drucken ist in dieser Ansicht nicht möglich. Speichere das Blatt als HTML-Datei, öffne sie im Browser und drucke von dort.';
    }
  }
  /** Standalone printable HTML of one paper: the rendered DOM plus the worksheet part of the stylesheet. */
  function paperHtml(kind) {
    var paper = document.querySelector('[data-paper="' + kind + '"]');
    var css = (document.querySelector('style') || {}).textContent || '';
    var pageCss = (document.getElementById('page-css') || {}).textContent || '';
    var a = css.indexOf('/* @worksheet-css-start */'), b = css.indexOf('/* @worksheet-css-end */');
    var wsCss = a >= 0 && b > a ? css.slice(a, b) : '';
    var title = document.querySelector('.ws-title');
    return '<!doctype html>\n<html lang="de" data-standalone="1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + (title ? title.textContent.replace(/[<>&]/g, '') : 'Arbeitsblatt') + '</title><style>' + wsCss +
      '\nbody{margin:0;background:#fff;color:#000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}</style>' +
      '<style>' + pageCss + '</style></head><body>' +
      (paper ? paper.outerHTML : '') + '</body></html>\n';
  }
  function saveHtml(kind) {
    var cur = wsState.current;
    var name = 'arbeitsblatt-' + cur.worksheet.code.toLowerCase() + (kind === 'key' ? '-loesungen' : '') + '.html';
    var st = document.getElementById('ws-print-status');
    saveFile(name, paperHtml(kind), 'text/html').then(function (m) { if (st) st.textContent = m; });
  }

  // ------------------------------------------------------------------ preview + recent
  function previewBlock() {
    var res = currentLayout();
    if (!res) return h('section', { class: 'panel no-print' }, h('h2', null, 'Noch kein Arbeitsblatt'),
      h('p', null, 'Wähle oben Themen, Stufen und Anzahl und tippe auf „Arbeitsblatt erstellen“. Danach siehst du hier das Schülerblatt und das Lösungsblatt.'));
    if (!res.ok) return h('section', { class: 'panel no-print', id: 'ws-outdated' }, h('h2', { id: 'ws-preview-title', tabindex: '-1' }, 'Arbeitsblatt nicht verfügbar'),
      h('p', null, res.message),
      h('button', { type: 'button', class: 'btn', onclick: function () { wsState.current = null; saveWs(); render(); } }, 'Ausblenden'));
    var L = res.layout;
    var tab = wsUi.tab === 'key' ? 'key' : 'student';
    function tabBtn(kind, label) {
      return h('button', { type: 'button', class: 'btn ' + (tab === kind ? 'primary' : 'quiet'), 'aria-pressed': tab === kind ? 'true' : 'false', id: 'ws-tab-' + kind,
        onclick: function () { wsUi.tab = kind; ui.focusId = 'ws-tab-' + kind; render(); } }, label);
    }
    var msg = wsUi.message; wsUi.message = null;
    var student = studentPaper(L), key = keyPaper(L);
    if (tab === 'key') student.setAttribute('hidden', ''); else key.setAttribute('hidden', '');
    return h('div', { class: 'ws-preview' },
      h('section', { class: 'panel no-print' },
        h('h2', { id: 'ws-preview-title', tabindex: '-1' }, 'Blatt ' + L.code + ': ' + L.title),
        msg ? h('p', { class: 'feedback ok', role: 'status' }, msg) : null,
        h('p', { class: 'muted' }, L.count + ' Aufgaben · ' + E.KEY_MODE_LABELS_DE[L.keyMode] + ' · ' + E.SPACE_LABELS_DE[L.space] + '.'),
        h('div', { class: 'row', role: 'group', 'aria-label': 'Ansicht' }, tabBtn('student', 'Schülerblatt'), tabBtn('key', 'Lösungsblatt')),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'ws-print-student', onclick: function () { printPaper('student'); } }, 'Schülerblatt drucken'),
          h('button', { type: 'button', class: 'btn', id: 'ws-print-key', onclick: function () { printPaper('key'); } }, 'Lösungsblatt drucken'),
          h('button', { type: 'button', class: 'btn quiet', id: 'ws-save-html', onclick: function () { saveHtml(tab); } }, 'Als HTML-Datei speichern'),
          h('button', { type: 'button', class: 'btn quiet', id: 'ws-reroll', onclick: function () {
            var r = makeWorksheet(wsState.settings || {});
            wsUi.message = r.ok ? 'Neue Aufgaben mit denselben Einstellungen: Blatt ' + wsState.current.worksheet.code + '.' : r.message;
            ui.focusId = 'ws-preview-title'; render();
          } }, 'Neue Aufgaben, gleiche Einstellungen')),
        h('details', { class: 'ws-help' }, h('summary', null, 'So druckst du oder speicherst als PDF'),
          h('p', null, '„Drucken“ öffnet den Druckdialog deines Browsers. Wähle dort als Ziel „Als PDF speichern“ oder deinen Drucker, Papierformat A4.'),
          h('p', null, 'Ehrlich gesagt: Das ist der normale Browser-Druck, kein fertig erzeugtes PDF. Wie die Seiten genau umbrechen, entscheidet dein Browser. Eine Aufgabe wird aber nie auf zwei Seiten geteilt.'),
          h('p', null, 'Tipps: Schalte „Kopf- und Fußzeilen“ aus. Der Rechenplatz ist kariert (5-mm-Kästchen wie im Heft) und wird immer mitgedruckt. Seitenzahlen zeigen nicht alle Browser an.'),
          h('p', null, 'Falls sich hier kein Druckdialog öffnet (zum Beispiel in einer eingebetteten Ansicht): Speichere das Blatt als HTML-Datei, öffne die Datei im Browser und drucke dort.')),
        h('p', { class: 'muted', 'aria-live': 'polite', id: 'ws-print-status' })),
      h('div', { class: 'paper-stage' }, student, key));
  }
  function recentBlock() {
    var cur = wsState.current && wsState.current.worksheet.code;
    var others = wsState.recent.filter(function (r) { return r.worksheet.code !== cur; });
    if (!others.length) return null;
    return h('section', { class: 'panel no-print' }, h('h2', null, 'Zuletzt erstellt'),
      h('p', { class: 'muted' }, 'Gespeichert sind nur Einstellungen und Startwerte. Das Blatt und das passende Lösungsblatt werden daraus genau gleich neu erzeugt.'),
      h('ul', { class: 'ws-recent' }, others.map(function (r) {
        return h('li', null, h('button', { type: 'button', class: 'linkish', 'data-code': r.worksheet.code, onclick: function () {
          wsState.current = r; saveWs(); wsUi.tab = 'student'; ui.focusId = 'ws-preview-title'; render();
        } }, r.worksheet.code + ': ' + r.worksheet.spec.title), ' (' + fmtDate(r.createdAt) + ', ' + r.worksheet.spec.count + ' Aufgaben)');
      })));
  }

  VIEWS.arbeitsblaetter = function () {
    return h('div', null, h('h1', { class: 'no-print' }, 'Arbeitsblätter'),
      h('p', { class: 'no-print' }, 'Erstelle ein Blatt zum Ausdrucken, mit eigenem Lösungsblatt. Beide Blätter entstehen aus denselben Aufgaben.'),
      !storageOk ? h('p', { class: 'feedback info no-print' }, 'Dieser Browser erlaubt hier keine Speicherung. Das Blatt geht beim Neuladen verloren; drucke es vorher.') : null,
      builderForm(), previewBlock(), recentBlock());
  };
