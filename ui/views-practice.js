  // ================================================================== answer widgets
  // Each widget: {el, collect() → raw input for E.submitAnswer, focus(), showResult(result)}.
  // Widgets only know the answer TYPE and display data (options, cell labels, variables); never the solution.

  var KEYS_FOR = ['(', ')', '·', ':', '²'];
  function textWidget(q, draft, disabled) {
    var spec = q.answer;
    var isExpr = spec.type === 'expression';
    var input = h('input', { id: 'answer-input', class: 'text-in', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      inputmode: 'text', 'aria-describedby': ui.result ? 'feedback answer-preview' : 'answer-preview', value: typeof draft === 'string' ? draft : '', disabled: disabled,
      'data-answer': 'text' });
    var preview = h('div', { id: 'answer-preview', class: 'preview', 'aria-live': 'polite' });
    function updatePreview() {
      preview.replaceChildren();
      var v = input.value.trim();
      input.removeAttribute('aria-invalid');
      if (!v) { preview.textContent = isExpr ? 'Schreibe z. B. 3x+2 oder 2(x−1). Mal: * oder ·, geteilt: : oder /, hoch: ^' : 'Dezimalzahlen mit Komma, Brüche wie 3/4.'; return; }
      if (isExpr) {
        var r = E.tryParse(v, { variables: spec.variables });
        if (r.ok) { preview.appendChild(document.createTextNode('So lese ich deine Eingabe: ')); preview.appendChild(mathText('$' + E.toLatex(r.ast) + '$')); }
        else preview.textContent = r.message;
      }
    }
    input.addEventListener('input', function () { updatePreview(); saveDraft(q.id, input.value); });
    updatePreview();
    var keys = null;
    if (isExpr && !disabled) {
      var labels = (spec.variables || []).concat(KEYS_FOR);
      keys = h('div', { class: 'keys', role: 'group', 'aria-label': 'Zeichen einfügen' }, labels.map(function (k) {
        return h('button', { type: 'button', class: 'key', 'aria-label': k === '²' ? 'hoch zwei' : k === '·' ? 'mal' : k === ':' ? 'geteilt' : k + ' einfügen',
          onclick: function () {
            var ins = k === '²' ? '^2' : k;
            var s = input.selectionStart === null ? input.value.length : input.selectionStart;
            var e = input.selectionEnd === null ? s : input.selectionEnd;
            input.value = input.value.slice(0, s) + ins + input.value.slice(e);
            input.focus();
            try { input.setSelectionRange(s + ins.length, s + ins.length); } catch (err) { /* ignore */ }
            input.dispatchEvent(new Event('input'));
          } }, k);
      }));
    }
    var unit = !isExpr && spec.unit ? spec.unit : null;
    var field = spec.variable || unit ? h('div', { class: 'prefixed' },
      spec.variable ? h('span', { class: 'prefix', 'aria-hidden': 'true' }, mathText('$' + spec.variable + ' =$')) : null, input,
      unit ? h('span', { class: 'prefix suffix', 'aria-hidden': 'true' }, unit) : null) : input;
    var labelText = isExpr ? 'Dein Term' : (spec.variable ? 'Deine Antwort: ' + spec.variable + ' =' : 'Deine Antwort') + (unit ? ' (in ' + unit + ')' : '');
    var el = h('div', { class: 'answer-area' }, h('label', { class: 'field-label', for: 'answer-input' }, labelText), field, preview, keys);
    return {
      el: el, collect: function () { return input.value; }, focus: function () { input.focus(); },
      onEnter: function (fn) { input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); },
      showResult: function (res) { if (res.status === 'invalid') input.setAttribute('aria-invalid', 'true'); },
    };
  }

  function choiceWidget(q, draft, disabled, multi) {
    var spec = q.answer;
    var name = 'opt-' + q.signature;
    var chosen = multi ? (Array.isArray(draft) ? draft : []) : (typeof draft === 'string' ? draft : null);
    var rows = spec.options.map(function (o, i) {
      var inp = h('input', { type: multi ? 'checkbox' : 'radio', name: name, value: o.id, id: name + '-' + i, disabled: disabled,
        checked: multi ? chosen.indexOf(o.id) >= 0 : chosen === o.id, 'data-answer': 'option' });
      inp.addEventListener('change', function () { saveDraft(q.id, collect()); });
      return h('li', null, h('label', { class: 'option', for: name + '-' + i }, inp, h('span', null, mathText(o.text))));
    });
    function collect() {
      var sel = rows.map(function (li) { return li.querySelector('input'); }).filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      return multi ? sel : (sel[0] || '');
    }
    var fs = h('fieldset', { class: 'answer-area' }, h('legend', { class: 'field-label' }, multi ? 'Wähle alle passenden Antworten' : 'Wähle eine Antwort'), h('ul', { class: 'options' }, rows));
    return { el: fs, collect: collect, focus: function () { var f = fs.querySelector('input'); if (f) f.focus(); }, onEnter: function () {}, showResult: function () {} };
  }

  function tableWidget(q, draft, disabled) {
    var cells = q.answer.cells;
    var d = draft && typeof draft === 'object' ? draft : {};
    var inputs = {}, marks = {};
    var first = true;
    function cellInput(c, labelled) {
      var attrs = { class: 'text-in', type: 'text', id: first ? 'answer-input' : 'cell-' + c.id, autocomplete: 'off', spellcheck: 'false',
        value: typeof d[c.id] === 'string' ? d[c.id] : '', disabled: disabled, 'data-cell': c.id };
      if (labelled) attrs['aria-labelledby'] = 'th-' + c.id; else attrs['aria-label'] = plainLabel(c.label || c.id);
      first = false;
      var inp = h('input', attrs);
      inp.addEventListener('input', function () { saveDraft(q.id, collect()); });
      inputs[c.id] = inp;
      marks[c.id] = h('span', { class: 'cell-res', 'aria-live': 'polite' });
      return h('td', null, inp, marks[c.id]);
    }
    function plainLabel(t) { return String(t).replace(/\$/g, '').replace(/\{,\}/g, ',').replace(/\\[a-z]+/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim(); }
    var table;
    if (q.answer.grid) {
      // 2-D layout (D57): given entries as text, input cells where the grid names a cell.
      var byId = {}; cells.forEach(function (c) { byId[c.id] = c; });
      var g = q.answer.grid;
      table = h('table', { class: 'vt grid' },
        h('thead', null, h('tr', null, g.columns.map(function (col) { return h('th', { scope: 'col' }, mathText(col)); }))),
        h('tbody', null, g.rows.map(function (row) {
          return h('tr', null, row.map(function (e, j) {
            if (e.cell) return cellInput(byId[e.cell], false);
            return j === 0 ? h('th', { scope: 'row' }, mathText(e.text)) : h('td', { class: 'given' }, mathText(e.text));
          }));
        })));
    } else {
      var headRow = h('tr', null, h('th', { scope: 'row' }, 'Eingabe'), cells.map(function (c) { return h('th', { scope: 'col', id: 'th-' + c.id }, mathText(c.label || c.id)); }));
      var inRow = h('tr', null, h('th', { scope: 'row' }, 'Wert'), cells.map(function (c) { return cellInput(c, true); }));
      table = h('table', { class: 'vt' }, h('tbody', null, headRow, inRow));
    }
    function collect() { var o = {}; cells.forEach(function (c) { o[c.id] = inputs[c.id].value; }); return o; }
    var el = h('div', { class: 'answer-area table-wrap' }, table);
    return {
      el: el, collect: collect, focus: function () { inputs[cells[0].id].focus(); },
      onEnter: function (fn) { Object.keys(inputs).forEach(function (k) { inputs[k].addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); }); },
      showResult: function (res) {
        if (!res.cells) return;
        cells.forEach(function (c) {
          var r = res.cells[c.id]; var m = marks[c.id];
          if (!r) return;
          if (r.status === 'correct') { m.className = 'cell-res ok'; m.textContent = '✓ richtig'; inputs[c.id].removeAttribute('aria-invalid'); }
          else if (r.status === 'invalid') { m.className = 'cell-res bad'; m.textContent = '? ' + (r.message || 'ungültig'); inputs[c.id].setAttribute('aria-invalid', 'true'); }
          else { m.className = 'cell-res bad'; m.textContent = '✗ falsch'; inputs[c.id].setAttribute('aria-invalid', 'true'); }
        });
      },
    };
  }

  function orderingWidget(q, draft, disabled) {
    var items = q.answer.items;
    var order = Array.isArray(draft) && draft.length === items.length ? draft.slice() : items.map(function (i) { return i.id; });
    var list = h('ol', { class: 'order-list' });
    function byId(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }
    function draw(focusIdx, dir) {
      list.replaceChildren();
      order.forEach(function (id, i) {
        var up = h('button', { type: 'button', class: 'key', 'aria-label': 'nach oben', disabled: disabled || i === 0, onclick: function () { move(i, -1); } }, '↑');
        var down = h('button', { type: 'button', class: 'key', 'aria-label': 'nach unten', disabled: disabled || i === order.length - 1, onclick: function () { move(i, 1); } }, '↓');
        list.appendChild(h('li', { 'data-item': id }, h('span', { class: 'grow' }, mathText(byId(id).text)), up, down));
      });
      if (focusIdx !== undefined) { var b = list.children[focusIdx].querySelectorAll('button')[dir < 0 ? 0 : 1]; if (b && !b.disabled) b.focus(); else list.children[focusIdx].querySelector('button:not([disabled])').focus(); }
    }
    function move(i, dir) { var j = i + dir; var t = order[i]; order[i] = order[j]; order[j] = t; saveDraft(q.id, order.slice()); draw(j, dir); }
    draw();
    return { el: h('div', { class: 'answer-area' }, h('p', { class: 'field-label' }, 'Bringe in die richtige Reihenfolge'), list),
      collect: function () { return order.slice(); }, focus: function () { var b = list.querySelector('button:not([disabled])'); if (b) b.focus(); }, onEnter: function () {}, showResult: function () {} };
  }

  // Solution set: three radio choices; the value field belongs to "genau eine Lösung" (D47).
  function solutionSetWidget(q, draft, disabled) {
    var spec = q.answer;
    var v = spec.variable || 'x';
    var d = draft && typeof draft === 'object' ? draft : {};
    var name = 'ss-' + q.signature;
    var radios = {};
    var valueIn = h('input', { id: 'answer-input', class: 'text-in short', type: 'text', autocomplete: 'off', spellcheck: 'false', inputmode: 'text',
      'aria-label': 'Lösung ' + v + ' =', value: typeof d.value === 'string' ? d.value : '', disabled: disabled, 'data-answer': 'solution-value' });
    function row(kind, label, extra) {
      var inp = h('input', { type: 'radio', name: name, value: kind, id: name + '-' + kind, disabled: disabled, checked: d.kind === kind, 'data-answer': 'solution-kind' });
      radios[kind] = inp;
      inp.addEventListener('change', function () { saveDraft(q.id, collect()); if (kind === 'one' && !disabled) valueIn.focus(); });
      return h('li', null, h('label', { class: 'option', for: name + '-' + kind }, inp, h('span', null, label)), extra || null);
    }
    valueIn.addEventListener('input', function () { if (valueIn.value.trim() && !radios.one.checked) radios.one.checked = true; saveDraft(q.id, collect()); });
    valueIn.addEventListener('focus', function () { if (!radios.none.checked && !radios.all.checked) radios.one.checked = true; });
    var oneExtra = h('div', { class: 'prefixed ss-value' }, h('span', { class: 'prefix', 'aria-hidden': 'true' }, mathText('$' + v + ' =$')), valueIn);
    var list = h('ul', { class: 'options' },
      row('one', 'genau eine Lösung', oneExtra),
      row('none', 'keine Lösung'),
      row('all', 'unendlich viele Lösungen (jede Zahl ist eine Lösung)'));
    function collect() {
      var k = Object.keys(radios).filter(function (key) { return radios[key].checked; })[0];
      if (!k) return valueIn.value.trim() ? { kind: 'one', value: valueIn.value } : {};
      return k === 'one' ? { kind: 'one', value: valueIn.value } : { kind: k };
    }
    var fs = h('fieldset', { class: 'answer-area' }, h('legend', { class: 'field-label' }, 'Wie viele Lösungen hat die Gleichung?'), list,
      h('p', { class: 'muted' }, 'Bei genau einer Lösung trage sie ein: ganze Zahl, Bruch wie 3/4 oder Dezimalzahl mit Komma.'));
    return {
      el: fs, collect: collect,
      focus: function () { var c = Object.keys(radios).filter(function (k) { return radios[k].checked; })[0]; (c === 'one' ? valueIn : radios[c || 'one']).focus(); },
      onEnter: function (fn) { valueIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); },
      showResult: function (res) { if (res.status === 'invalid') valueIn.setAttribute('aria-invalid', 'true'); else valueIn.removeAttribute('aria-invalid'); },
    };
  }

  function makeWidget(q, draft, disabled) {
    switch (q.answer.type) {
      case 'integer': case 'fraction': case 'decimal': case 'expression': return textWidget(q, draft, disabled);
      case 'choice': return choiceWidget(q, draft, disabled, false);
      case 'multiselect': return choiceWidget(q, draft, disabled, true);
      case 'table': return tableWidget(q, draft, disabled);
      case 'ordering': return orderingWidget(q, draft, disabled);
      case 'solution_set': return solutionSetWidget(q, draft, disabled);
      default: return { el: h('p', null, 'Dieser Aufgabentyp wird noch nicht unterstützt.'), collect: function () { return null; }, focus: function () {}, onEnter: function () {}, showResult: function () {} };
    }
  }

  // ================================================================== feedback text (from the engine's result only)
  function feedbackBlock(result, item) {
    if (!result) return null;
    var kind, title, body = [];
    if (result.status === 'correct') {
      kind = 'ok'; title = 'Richtig!';
      if (item && item.attempts.length > 1) body.push(h('p', null, 'Gut, dass du drangeblieben bist.'));
    } else if (result.status === 'invalid') {
      kind = 'info'; title = 'Das kann ich so nicht auswerten.';
      body.push(h('p', null, mathText(result.message || 'Bitte prüfe deine Eingabe.')));
      body.push(h('p', { class: 'muted' }, 'Das zählt nicht als Fehler.'));
    } else {
      kind = 'bad';
      if (result.equivalent) {
        title = 'Fast: richtig umgeformt, aber noch nicht fertig.';
        body.push(h('p', null, mathText(result.feedback || '')));
      } else {
        title = 'Noch nicht richtig.';
        if (result.feedback) body.push(h('p', null, mathText(result.feedback)));
        else if (result.errorCategory && result.errorCategory !== 'other') body.push(h('p', null, 'Mögliche Ursache: ' + E.ERROR_LABELS_DE[result.errorCategory] + '.'));
        if (typeof result.missing === 'number' && (result.missing || result.extra)) {
          var parts = [];
          if (result.missing) parts.push(result.missing === 1 ? 'eine richtige Antwort fehlt' : result.missing + ' richtige Antworten fehlen');
          if (result.extra) parts.push(result.extra === 1 ? 'eine Auswahl ist falsch' : result.extra + ' Auswahlen sind falsch');
          body.push(h('p', null, parts.join(', ') + '.'));
        }
        if (typeof result.firstWrongPosition === 'number') body.push(h('p', null, 'Ab Position ' + (result.firstWrongPosition + 1) + ' stimmt die Reihenfolge nicht.'));
        if (result.cells) body.push(h('p', null, 'Die falschen Felder sind in der Tabelle markiert.'));
      }
      body.push(h('p', { class: 'muted' }, 'Versuch es noch einmal, öffne einen Tipp oder lass dir neue Zahlen geben.'));
    }
    return h('div', { class: 'feedback ' + kind, id: 'feedback', tabindex: '-1' }, h('strong', null, title), body);
  }

  /** Geometry diagram of a question (S12, D96): SVG generated by the engine from geometry data, plus caption. */
  function diagramBlock(q) {
    if (!q || !q.diagram) return null;
    var box = h('div', { class: 'diagram-box' });
    function build(n) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', n.tag);
      Object.keys(n.attrs).forEach(function (k) { el.setAttribute(k, n.attrs[k]); });
      if (n.text !== undefined) el.textContent = n.text;
      (n.children || []).forEach(function (c) { el.appendChild(build(c)); });
      return el;
    }
    try { box.appendChild(build(E.diagramTree(q.diagram))); } catch (e) { box.textContent = q.diagram.alt || 'Zeichnung nicht verfügbar.'; }
    return h('figure', { class: 'diagram-wrap' }, box, h('figcaption', { class: 'diagram-caption' }, E.diagramCaption(q.diagram)));
  }
  /** Read-only table given with the task (D63): header row, first column as row headers. */
  function promptTableBlock(t) {
    return h('div', { class: 'table-wrap given-table' }, h('table', { class: 'vt grid' },
      h('thead', null, h('tr', null, t.columns.map(function (c) { return h('th', { scope: 'col' }, mathText(c)); }))),
      h('tbody', null, t.rows.map(function (row) {
        return h('tr', null, row.map(function (e, j) { return j === 0 ? h('th', { scope: 'row' }, mathText(e)) : h('td', null, mathText(e)); }));
      }))));
  }
  function solutionBlock(q) {
    return h('div', { class: 'solution' }, h('h3', null, 'Lösungsweg'),
      h('ol', null, q.solution.steps.map(function (s) { return h('li', null, mathText(s)); })),
      h('p', null, h('strong', null, 'Ergebnis: '), mathText(q.solution.result)));
  }

  // ================================================================== practice view
  function startSession(skillId, levelMode, count, filter) {
    var opts = { skillId: skillId, levelMode: levelMode, count: count, baseSeed: newSeed() };
    if (filter) opts.filter = filter;  // KA mode: only the families/levels of one checklist statement (engine filter)
    // 'adaptive': the engine recommends the start level from the stored history; later levels follow the answers
    if (levelMode === 'adaptive') opts.startLevel = E.recommendLevel(progress.skills[skillId], E.levelsForSkill(skillId));
    var created = E.createSession(opts);
    created.questions.forEach(function (q) { qCache[q.id] = q; });
    stored = { session: created.session, scheduled: false };
    saveSession();
    ui.result = null; ui.openHint = null; ui.forceSetup = false;
    go('ueben');
  }

  function finishIfNeeded() {
    if (stored && stored.session.finished && !stored.scheduled) {
      var lv = E.levelsForSkill(stored.session.skillId);
      progress = E.scheduleReviewAdaptive(progress, stored.session.skillId, today(), lv.length ? lv[lv.length - 1] : 4);
      stored.scheduled = true;
      saveProgress(); saveSession();
    }
  }

  VIEWS.ueben = function () {
    if (ui.forceSetup || !stored) return setupView();
    return stored.session.finished ? summaryView() : practiceQuestionView();
  };

  function setupView() {
    var root = h('div', null, h('h1', null, 'Üben'), openSessionPanel());
    if (!storageOk) root.appendChild(h('div', { class: 'feedback info' }, h('strong', null, 'Speichern nicht möglich'), h('p', null, 'Dein Browser erlaubt hier keine Speicherung. Du kannst üben, aber der Fortschritt geht beim Schließen verloren.')));
    var pre = ui.preselect || {};
    ui.preselect = null;
    var currentCh = progress.settings.currentChapter;
    var part = E.partitionSkills(CATALOG, coverage(), E.skillsWithTemplates());
    if (!part.available.length) {
      // filter on, nothing marked as covered yet: empty state instead of an empty form
      root.appendChild(h('div', { class: 'sheet plain', id: 'cov-empty' }, h('h2', null, 'Noch kein Thema freigegeben'),
        h('p', null, 'Du hast eingestellt, dass nur Themen angeboten werden, die ihr im Unterricht schon behandelt habt. Bisher ist dafür kein Abschnitt angehakt.'),
        h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#kapitel' }, 'Abschnitte anhaken'))));
      return root;
    }
    var firstReady = null;
    var select = h('select', { id: 'skill-select', 'data-field': 'skill' });
    CATALOG.chapters.forEach(function (ch) {
      var og = h('optgroup', { label: ch.number + ' ' + ch.name });
      chapterSkills(ch).forEach(function (s) {
        var ready = isPracticable(s.id);
        var offered = ready && part.available.indexOf(s.id) >= 0;
        if (offered && !firstReady && (!currentCh || currentCh === ch.id)) firstReady = s.id;
        og.appendChild(h('option', { value: s.id, disabled: !offered }, s.name + (!ready ? ' (folgt)' : offered ? '' : ' (noch nicht behandelt)')));
      });
      select.appendChild(og);
    });
    if (!firstReady) firstReady = part.available[0];
    select.value = pre.skillId && part.available.indexOf(pre.skillId) >= 0 ? pre.skillId : firstReady;

    var levelBox = h('div', { class: 'seg', id: 'level-seg' });
    var levelHelp = h('p', { class: 'muted', id: 'level-help' });
    var adviceBox = h('div', { id: 'advice-box', 'aria-live': 'polite' });
    function drawLevels() {
      var sid = select.value;
      var avail = E.levelsForSkill(sid);
      var keep = (levelBox.querySelector('input:checked') || {}).value || String(pre.levelMode || 'adaptive');
      if (keep !== 'auto' && keep !== 'adaptive' && avail.indexOf(Number(keep)) < 0) keep = 'adaptive';
      levelBox.replaceChildren();
      ['adaptive', 'auto'].concat(avail).forEach(function (m) {
        levelBox.appendChild(h('label', null, h('input', { type: 'radio', name: 'level', value: String(m), checked: String(m) === keep, onchange: drawHelp }),
          (m === 'auto' || m === 'adaptive' ? '' : 'Stufe ' + m + ': ') + E.LEVEL_MODE_LABELS_DE[m]));
      });
      drawHelp();
      adviceBox.replaceChildren();
      var adv = adviceBlock(sid);
      if (adv) adviceBox.appendChild(adv);
    }
    function drawHelp() {
      var m = (levelBox.querySelector('input:checked') || {}).value;
      var s = skillIndex[select.value];
      var A = E.ADAPTIVE_RULES;
      if (m === 'adaptive') {
        var rec = E.recommendLevel(progress.skills[select.value], E.levelsForSkill(select.value));
        levelHelp.textContent = 'Du startest bei Stufe ' + rec + (progress.skills[select.value] ? ' (nach deinen bisherigen Ergebnissen)' : '') + '. ' + A.sessionUpStreak + ' richtige Antworten hintereinander: schwerer. ' + A.sessionDownStreak + ' falsche hintereinander: leichter.';
      } else levelHelp.textContent = m === 'auto' ? 'Die Aufgaben werden im Lauf der Übung schwieriger, egal wie du antwortest.' : (s && s.levels && s.levels['L' + m]) || '';
    }
    select.addEventListener('change', drawLevels);
    drawLevels();

    var countBox = h('div', { class: 'seg' }, E.SESSION_COUNTS.map(function (n) {
      return h('label', null, h('input', { type: 'radio', name: 'count', value: String(n), checked: n === (pre.count || 10) }), n + ' Aufgaben');
    }));
    var form = h('div', { class: 'sheet plain form-grid' },
      h('div', null, h('label', { for: 'skill-select' }, 'Thema'), select, hiddenNote(part.hidden.length)),
      h('fieldset', null, h('legend', null, 'Schwierigkeit'), levelBox, levelHelp),
      adviceBox,
      h('fieldset', null, h('legend', null, 'Anzahl'), countBox),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'start-btn', onclick: function () {
        var m = levelBox.querySelector('input:checked').value;
        var count = Number(countBox.querySelector('input:checked').value);
        maybeReplaceSession().then(function (ok) { if (ok) startSession(select.value, m === 'auto' || m === 'adaptive' ? m : Number(m), count); });
      } }, 'Übung starten')));
    root.appendChild(form);
    return root;
  }

  function practiceQuestionView() {
    var s = stored.session;
    var item = E.currentItem(s);
    var q = questionById(item.qid);
    if (!q) {
      return h('div', { class: 'panel' }, h('h1', null, 'Übung kann nicht fortgesetzt werden'),
        h('p', null, 'Diese Übung stammt aus einer älteren Version der App. Die Aufgaben lassen sich nicht mehr genau gleich erzeugen.'),
        h('button', { type: 'button', class: 'btn primary', onclick: function () { stored = null; saveSession(); render(); } }, 'Neue Übung beginnen'));
    }
    var pos = E.position(s);
    var closed = item.solved || item.revealed;
    var lastAttempt = item.attempts[item.attempts.length - 1];
    var markSym = item.solved ? '✓' : item.revealed ? '?' : (lastAttempt && ui.result && ui.result.status === 'incorrect') ? '✗' : (ui.result && ui.result.status === 'invalid') ? '?' : '';
    var markCls = item.solved ? 'ok' : item.revealed ? 'info' : markSym === '✗' ? 'bad' : 'info';
    var widget = makeWidget(q, drafts[q.id], closed);

    function check() {
      var raw = widget.collect();
      var r = E.submitAnswer(stored.session, q, raw);
      ui.result = r.result;
      if (r.result.status !== 'invalid') { stored.session = r.session; saveSession(); applyEvents(r.events); }
      // Correct → "next" button (described by the feedback); wrong/invalid → back into the text field; else the feedback.
      ui.focusId = r.result.status === 'correct' ? 'next-btn' : (document.getElementById('answer-input') && document.getElementById('answer-input').tagName === 'INPUT' && q.answer.type !== 'table' && q.answer.type !== 'solution_set') ? 'answer-input' : 'feedback';
      ui.freshMark = true;
      render();
    }
    widget.onEnter(check);

    var actions;
    if (closed) {
      actions = h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'next-btn', 'aria-describedby': ui.result || item.revealed ? 'feedback' : null, onclick: function () {
        stored.session = E.advance(stored.session);
        ui.result = null; ui.openHint = null;
        finishIfNeeded(); saveSession();
        ui.focusId = stored.session.finished ? null : 'answer-input';
        render(true);
      } }, pos.number === pos.total ? 'Zur Auswertung' : 'Nächste Aufgabe'));
    } else {
      var hasWrong = item.attempts.length > 0;
      actions = h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', id: 'check-btn', onclick: check }, 'Prüfen'),
        hasWrong ? h('button', { type: 'button', class: 'btn', id: 'variant-btn', onclick: function () {
          var r = E.replaceWithVariant(stored.session);
          qCache[r.question.id] = r.question;
          stored.session = r.session; saveSession(); applyEvents(r.events);
          ui.result = null; ui.openHint = null; ui.focusId = 'answer-input';
          render();
        } }, 'Neue Zahlen') : null,
        hasWrong ? h('button', { type: 'button', class: 'btn quiet', id: 'reveal-btn', onclick: function () {
          var r = E.revealSolution(stored.session);
          stored.session = r.session; saveSession(); applyEvents(r.events);
          ui.result = null; ui.openHint = null; ui.focusId = 'next-btn';
          render();
        } }, 'Lösung zeigen') : null);
    }

    // Hints: any level directly accessible.
    var hintBody = null;
    var tabs = q.hints.map(function (hint, k) {
      var seen = item.hintsSeen.indexOf(k) >= 0;
      return h('button', { type: 'button', class: 'hint-tab', id: 'hint-tab-' + k, 'aria-expanded': ui.openHint === k ? 'true' : 'false', 'aria-controls': 'hint-body',
        onclick: function () {
          if (ui.openHint === k) { ui.openHint = null; }
          else {
            ui.openHint = k;
            var r = E.openHint(stored.session, k);
            stored.session = r.session; saveSession(); applyEvents(r.events);
          }
          ui.focusId = 'hint-tab-' + k;
          render();
        } }, E.HINT_LABELS_DE[hint.kind], seen ? h('span', { class: 'seen' }, ' (gesehen)') : null);
    });
    if (ui.openHint !== null && q.hints[ui.openHint]) {
      var hk = q.hints[ui.openHint];
      hintBody = h('div', { class: 'hint-body', id: 'hint-body', role: 'region', 'aria-label': E.HINT_LABELS_DE[hk.kind] },
        hk.kind === 'solution' ? solutionBlock(q) : mathText(hk.text));
    }

    var mark = h('span', { class: 'mark ' + markCls + (ui.freshMark ? ' fresh' : ''), 'aria-hidden': 'true', id: 'margin-mark' }, markSym);
    ui.freshMark = false;
    var level = q.level;
    var sheet = h('section', { class: 'sheet', 'aria-labelledby': 'q-title', 'data-qid': q.id },
      h('div', { class: 'q-head' },
        h('h1', { id: 'q-title', class: 'q-count' }, 'Aufgabe ' + pos.number + ' von ' + pos.total),
        h('span', null, h('span', { class: 'pill' }, 'Stufe ' + level + ': ' + E.LEVELS[level]), ' ', h('span', { class: 'muted' }, skillName(s.skillId)))),
      h('p', { class: 'prompt' }, mathText(q.prompt)),
      q.promptLines ? h('div', { class: 'lines' }, q.promptLines.map(function (l) { return h('p', null, mathText(l)); })) : null,
      diagramBlock(q),
      q.promptTable ? promptTableBlock(q.promptTable) : null,
      q.instructions ? h('p', { class: 'instructions' }, mathText(q.instructions)) : null,
      h('div', { style: 'position:relative' }, mark, widget.el),
      h('div', { 'aria-live': 'polite', id: 'feedback-region' }, feedbackBlock(ui.result, item)),
      item.revealed ? h('div', { class: 'feedback info', id: 'feedback', tabindex: '-1' }, h('strong', null, 'Hier ist der Lösungsweg.'), h('p', null, 'Die Aufgabe zählt als nicht gelöst. Mit der nächsten Aufgabe geht es weiter.')) : null,
      item.revealed ? solutionBlock(q) : null,
      actions,
      h('div', { class: 'hints' }, h('h2', { class: 'muted', style: 'font-size:1rem' }, 'Tipps'), h('div', { class: 'hint-tabs' }, tabs), hintBody),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'linkish', id: 'report-btn', onclick: function () { reportDialog(q, widget.collect()); } }, 'Problem mit dieser Aufgabe melden'),
        h('button', { type: 'button', class: 'linkish', id: 'quit-btn', onclick: function () {
          confirmDialog('Übung beenden?', 'Offene Aufgaben zählen dann als nicht bearbeitet. Bisherige Ergebnisse bleiben gespeichert.', 'Übung beenden').then(function (ok) {
            if (!ok) return;
            stored.session = E.endSession(stored.session);
            finishIfNeeded(); saveSession(); ui.result = null; render(true);
          });
        } }, 'Übung beenden')));
    if (ui.result) widget.showResult(ui.result);
    if (ui.focusId === 'answer-input' && closed) ui.focusId = 'next-btn';
    return sheet;
  }

  function summaryView() {
    var s = stored.session;
    var sum = E.summarize(s);
    var rec = E.skillStats(progress, s.skillId);
    var ad = adaptiveInfo(s.skillId);
    var advice = adviceBlock(s.skillId);
    var errs = Object.keys(sum.errors).sort(function (a, b) { return sum.errors[b] - sum.errors[a]; });
    function fig(n, label) { return h('div', null, h('div', { class: 'stat' }, String(n)), h('div', { class: 'muted' }, label)); }
    return h('div', null,
      h('h1', null, 'Auswertung'),
      h('section', { class: 'sheet plain' },
        h('h2', null, skillName(s.skillId)),
        h('div', { class: 'summary-figure' },
          fig(sum.solvedFirstTry + ' von ' + sum.questions, 'beim ersten Versuch richtig'),
          fig(sum.solvedLater, 'später richtig'),
          fig(sum.revealed, 'mit Lösungsweg'),
          fig(sum.hintsUsed, 'Tipps geöffnet')),
        sum.unsolved - sum.revealed > 0 ? h('p', null, (sum.unsolved - sum.revealed) + ' Aufgabe(n) nicht bearbeitet.') : null,
        errs.length ? h('div', null, h('h3', null, 'Häufigste Fehlerarten'), h('ul', null, errs.map(function (c) { return h('li', null, E.ERROR_LABELS_DE[c] + ': ' + sum.errors[c] + '×'); }))) : h('p', null, 'Keine falschen Versuche.'),
        h('p', null, 'Stand im Thema: ', h('span', { class: 'mastery ' + ad.mastery }, E.MASTERY_LABELS_DE[ad.mastery]),
          rec.nextReview ? '. Nächste Wiederholung am ' + fmtDate(rec.nextReview) + '.' : '.'),
        ad.recommendedLevel ? h('p', { id: 'next-level' }, 'Nächstes Mal starten wir bei Stufe ' + ad.recommendedLevel + ' (' + E.LEVELS[ad.recommendedLevel] + '). Das ist ein Vorschlag aus deinen letzten Aufgaben, keine Note.') : null,
        advice,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn primary', id: 'again-btn', onclick: function () { startSession(s.skillId, s.levelMode, s.count); } }, 'Noch eine Runde'),
          h('button', { type: 'button', class: 'btn', id: 'other-topic-btn', onclick: function () { ui.forceSetup = true; ui.preselect = { skillId: s.skillId, levelMode: s.levelMode, count: s.count }; render(true); } }, 'Anderes Thema wählen'),
          h('button', { type: 'button', class: 'btn quiet', onclick: function () { go('fortschritt'); } }, 'Fortschritt ansehen'))));
  }

  function reportDialog(q, answerGiven) {
    var note = h('textarea', { class: 'note-in', id: 'report-note', 'aria-describedby': 'report-help', maxlength: '1000' });
    var out = h('textarea', { readonly: true, id: 'report-json', 'aria-label': 'Fehlerbericht als Text' });
    var status = h('p', { class: 'muted', 'aria-live': 'polite' });
    function build() {
      return E.makeReport(q, { note: note.value, answerGiven: answerGiven, engineVersion: E.ENGINE_VERSION, catalogVersion: CATALOG.catalogVersion, createdAt: today() });
    }
    function refresh() { out.value = JSON.stringify(build(), null, 2); }
    note.addEventListener('input', refresh);
    refresh();
    return openDialog({
      title: 'Problem melden',
      body: [h('label', { class: 'field-label', for: 'report-note' }, 'Was stimmt nicht? (freiwillig)'), note,
        h('p', { class: 'muted', id: 'report-help' }, 'Bitte keine Namen oder anderen persönlichen Angaben eintragen. Der Bericht enthält nur die Aufgabennummer und deine Notiz. Er wird nur auf diesem Gerät gespeichert; zum Weitergeben kopierst du ihn.'),
        h('details', null, h('summary', null, 'Bericht ansehen'), out), status],
      actions: [
        { label: 'Abbrechen', value: null },
        { label: 'Kopieren', value: 'copy', onclick: function () { copyText(out.value, out).then(function (m) { status.textContent = m; }); return false; } },
        { label: 'Speichern', value: 'save', primary: true, onclick: function () { progress = E.addReport(progress, build()); saveProgress(); } },
      ],
    });
  }
