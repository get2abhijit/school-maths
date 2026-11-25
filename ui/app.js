/* Mathe 7 — UI layer. Renders engine output and passes raw input to the engine.
   No curriculum data, no answer logic here: questions, checking, hints, progress rules all come from MathEngine. */
(function () {
  'use strict';
  var E = window.MathEngine;
  var view = document.getElementById('view');
  if (!E) { view.textContent = 'Die Rechen-Engine konnte nicht geladen werden. Bitte lade die Seite neu.'; return; }
  var CATALOG;
  try { CATALOG = JSON.parse(document.getElementById('catalog-data').textContent); }
  catch (e) { view.textContent = 'Der Aufgabenkatalog ist beschädigt. Bitte lade die Seite neu.'; return; }

  var KEYS = { progress: 'mathe7.progress.v1', session: 'mathe7.session.v1', draft: 'mathe7.draft.v1', worksheet: 'mathe7.worksheet.v1', diagnostic: 'mathe7.diagnostic.v1', ka: 'mathe7.ka.v1' };
  var ROUTES = ['start', 'kapitel', 'ueben', 'arbeitsblaetter', 'wiederholen', 'fortschritt', 'standort', 'ka'];

  // ------------------------------------------------------------------ storage (always try/catch)
  var storageOk = true;
  function sRead(key) {
    try { var v = window.localStorage.getItem(key); return v === null ? null : JSON.parse(v); }
    catch (e) { return null; }
  }
  function sWrite(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { storageOk = false; return false; }
  }
  function sRemove(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  (function probe() {
    try { window.localStorage.setItem('mathe7.probe', '1'); window.localStorage.removeItem('mathe7.probe'); }
    catch (e) { storageOk = false; }
  })();

  // ------------------------------------------------------------------ dates
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(iso) { if (!iso) return '–'; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function pct(x) { return x === null || x === undefined ? '–' : Math.round(x * 100) + ' %'; }

  // ------------------------------------------------------------------ DOM helper
  /** h('div', {class:'x', onclick: fn, 'aria-label': '…'}, child, …) — children: Node | string | array | null */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  // ------------------------------------------------------------------ math rendering (KaTeX → MathML, plain-text fallback)
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', 'n': 'ⁿ' };
  function sup(s) { return s.split('').map(function (c) { return SUP[c] || c; }).join(''); }
  /** Readable plain text for the LaTeX subset the engine emits (used only when KaTeX is unavailable). */
  function texToText(t) {
    var s = t.replace(/\{,\}/g, ','); // decimal commas first, so \frac{102{,}4}{100} is still found
    // set braces \{ \} survive as ⦃ ⦄ until plain braces are stripped; \text{rot} → rot
    s = s.replace(/\\\{\\,\\\}/g, '⦃ ⦄').replace(/\\\{/g, '⦃').replace(/\\\}/g, '⦄').replace(/\\text\{([^{}]*)\}/g, '$1');
    for (var i = 0; i < 5; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, function (_, a, b) { return (a.length > 1 ? '(' + a + ')' : a) + '/' + (b.length > 1 ? '(' + b + ')' : b); });
    // S12 geometry: degrees and the Greek angle names (α′ written as \\alpha')
    var GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', varphi: 'φ' };
    s = s.replace(/\^\{?\\circ\}?/g, '°').replace(/\\(alpha|beta|gamma|delta|varepsilon|varphi)\b\s*/g, function (_, g) { return GREEK[g]; }).replace(/'/g, '′');
    return s.replace(/\\qquad\s*\\big\|/g, '   |').replace(/\\big\|/g, '|').replace(/\\q?quad/g, '  ').replace(/\\left|\\right/g, '').replace(/\\cdot/g, '·').replace(/\\approx/g, '≈').replace(/\\mid/g, '|').replace(/\\%/g, '%').replace(/\\times/g, '×').replace(/\\ldots/g, '…').replace(/\\square\s?/g, '□')
      .replace(/\{,\}/g, ',').replace(/\\[ ;,]/g, ' ').replace(/\^\{([^{}]*)\}/g, function (_, e) { return sup(e); })
      .replace(/\^(\w)/g, function (_, e) { return sup(e); }).replace(/-/g, '−').replace(/[{}]/g, '').replace(/⦃/g, '{').replace(/⦄/g, '}');
  }
  function renderTexInto(span) {
    var tex = span.getAttribute('data-tex');
    if (window.katex && typeof window.katex.render === 'function') {
      try { window.katex.render(tex, span, { output: 'mathml', throwOnError: false, strict: 'ignore' }); span.setAttribute('data-r', 'k'); return; }
      catch (e) { /* fall through */ }
    }
    span.textContent = texToText(tex);
    span.className = 'tex-fallback';
    span.setAttribute('data-r', 'f');
  }
  /** Text with $…$ segments → fragment of text nodes and math spans. Never uses innerHTML. */
  function mathText(text) {
    var frag = document.createDocumentFragment();
    String(text || '').split('$').forEach(function (part, i) {
      if (i % 2 === 0) { if (part) frag.appendChild(document.createTextNode(part)); return; }
      var span = h('span', { 'data-tex': part });
      renderTexInto(span);
      frag.appendChild(span);
    });
    return frag;
  }
  function upgradeMath(root) {
    if (!window.katex) return;
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-r="f"]'), renderTexInto);
  }
  var katexEl = document.getElementById('katex-js');
  if (katexEl) katexEl.addEventListener('load', function () { upgradeMath(document); });

  // ------------------------------------------------------------------ catalog index (read-only data)
  var skillIndex = {};
  var chapterOfSkill = {};
  CATALOG.chapters.forEach(function (ch) {
    ch.topics.forEach(function (t) { t.skills.forEach(function (s) { skillIndex[s.id] = s; chapterOfSkill[s.id] = ch; }); });
  });
  function skillName(id) { return skillIndex[id] ? skillIndex[id].name : id; }
  function isPracticable(id) { return E.levelsForSkill(id).length > 0; }
  function chapterSkills(ch) { var out = []; ch.topics.forEach(function (t) { t.skills.forEach(function (s) { out.push(s); }); }); return out; }
  function chapterById(id) { for (var i = 0; i < CATALOG.chapters.length; i++) if (CATALOG.chapters[i].id === id) return CATALOG.chapters[i]; return null; }

  // ------------------------------------------------------------------ "Im Unterricht behandelt" — rules live in the engine (src/coverage.js)
  function coverage() { return progress.settings.coverage || E.emptyCoverage(); }
  function filterOn() { return !!coverage().enabled; }
  /** Practicable AND allowed by the covered-at-school filter. */
  function isOffered(id) { return isPracticable(id) && E.isSkillAvailable(CATALOG, coverage(), id); }
  function setCoverage(c) { progress.settings.coverage = c; saveProgress(); }
  function hiddenNote(n) {
    if (!n) return null;
    return h('p', { class: 'muted cov-note' }, (n === 1 ? '1 Thema ist ausgeblendet, weil es' : n + ' Themen sind ausgeblendet, weil sie') + ' im Unterricht noch nicht behandelt ' + (n === 1 ? 'wurde. ' : 'wurden. '),
      h('a', { href: '#kapitel' }, 'Ändern unter Kapitel'), '.');
  }

  // ------------------------------------------------------------------ persistent state
  function loadProgress() {
    var raw = sRead(KEYS.progress);
    if (!raw) return E.emptyProgress();
    var r = E.validateProgress(raw);
    return r.ok ? r.value : E.emptyProgress();
  }
  var progress = loadProgress();
  function saveProgress() { sWrite(KEYS.progress, progress); }
  function applyEvents(events) {
    var d = today();
    events.forEach(function (ev) { progress = E.applyEvent(progress, ev, d); });
    if (events.length) saveProgress();
  }

  /** stored = {session, scheduled}; `scheduled` = review date already set for this finished session. */
  var stored = (function () {
    var raw = sRead(KEYS.session);
    if (raw && E.isValidSession(raw.session)) return { session: raw.session, scheduled: !!raw.scheduled };
    if (raw) sRemove(KEYS.session);
    return null;
  })();
  function saveSession() { if (stored) sWrite(KEYS.session, stored); else sRemove(KEYS.session); }

  /** diag = {d: diagnostic, saved: result already written to the progress record}; null when none is running. */
  var diag = (function () {
    var raw = sRead(KEYS.diagnostic);
    if (raw && E.isValidDiagnostic(raw.d)) return { d: raw.d, saved: !!raw.saved };
    if (raw) sRemove(KEYS.diagnostic);
    return null;
  })();
  function saveDiag() { if (diag) sWrite(KEYS.diagnostic, diag); else sRemove(KEYS.diagnostic); }

  var drafts = (function () { var d = sRead(KEYS.draft); return d && typeof d === 'object' ? d : {}; })();
  function saveDraft(qid, raw) { drafts = {}; drafts[qid] = raw; sWrite(KEYS.draft, drafts); }

  var qCache = {};
  /** Regenerate a question from its id; returns null and records the error if impossible. */
  function questionById(qid) {
    if (qCache[qid]) return qCache[qid];
    try { qCache[qid] = E.regenerateQuestion(qid); return qCache[qid]; }
    catch (e) { return null; }
  }

  function newSeed() {
    try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0] >>> 1; }
    catch (e) { return (Date.now() % 2147483647) >>> 0; }
  }

  // ------------------------------------------------------------------ theme
  var THEME_LABEL = { system: 'System', light: 'Heft', dark: 'Tafel' };
  function applyTheme() {
    var t = progress.settings.theme || 'system';
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    var lab = document.getElementById('theme-label');
    if (lab) lab.textContent = THEME_LABEL[t];
    var btn = document.getElementById('theme-btn');
    if (btn) btn.setAttribute('aria-label', 'Farbschema wechseln, aktuell: ' + THEME_LABEL[t]);
  }
  document.getElementById('theme-btn').addEventListener('click', function () {
    var order = ['system', 'light', 'dark'];
    progress.settings.theme = order[(order.indexOf(progress.settings.theme || 'system') + 1) % 3];
    saveProgress(); applyTheme();
  });

  // ------------------------------------------------------------------ dialog
  var dlg = document.getElementById('dlg');
  /** Opens a modal; resolves with the chosen action value (or null when closed). */
  function openDialog(opts) {
    return new Promise(function (resolve) {
      document.getElementById('dlg-title').textContent = opts.title;
      var body = document.getElementById('dlg-body');
      body.replaceChildren();
      append(body, opts.body);
      var actions = document.getElementById('dlg-actions');
      actions.replaceChildren();
      var lastFocus = document.activeElement;
      function close(v) {
        if (dlg.close) { try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } } else dlg.removeAttribute('open');
        dlg.removeEventListener('cancel', onCancel);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        resolve(v);
      }
      function onCancel(e) { e.preventDefault(); close(null); }
      dlg.addEventListener('cancel', onCancel);
      (opts.actions || [{ label: 'Schließen', value: null }]).forEach(function (a) {
        actions.appendChild(h('button', { type: 'button', class: 'btn ' + (a.primary ? 'primary' : a.danger ? 'danger' : 'quiet'), 'data-action': a.value === null ? 'close' : String(a.value),
          onclick: function () { if (a.onclick && a.onclick() === false) return; close(a.value); } }, a.label));
      });
      if (dlg.showModal) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); } } else dlg.setAttribute('open', '');
      var first = body.querySelector('textarea, input, select') || actions.querySelector('button');
      if (first) first.focus();
    });
  }
  function confirmDialog(title, text, okLabel, danger) {
    return openDialog({ title: title, body: h('p', null, text), actions: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, primary: !danger, danger: !!danger }] });
  }

  // ------------------------------------------------------------------ file save / copy helpers
  var downloads = null;
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (d) { downloads = d; }).catch(function () { downloads = null; });
  }
  /** Offer a file. In the Artifact viewer the MIME type follows the extension; `mime` is only for the Blob fallback. */
  function saveFile(filename, text, mime) {
    if (downloads) {
      return downloads.save({ filename: filename, data: text }).then(function () { return 'Datei angeboten: ' + filename; },
        function (err) { return err && err.code === 'declined' ? 'Speichern abgebrochen.' : 'Speichern ist hier nicht möglich. Nutze „Als Text anzeigen“.'; });
    }
    try {
      var url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
      var a = h('a', { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      return Promise.resolve('Falls kein Download startet, nutze „Als Text anzeigen“ und kopiere den Text.');
    } catch (e) { return Promise.resolve('Speichern ist hier nicht möglich. Nutze „Als Text anzeigen“.'); }
  }
  function copyText(text, textarea) {
    function legacy() {
      if (!textarea) return 'Markiere den Text und kopiere ihn.';
      textarea.focus(); textarea.select();
      try { return document.execCommand && document.execCommand('copy') ? 'Kopiert.' : 'Markiere den Text und kopiere ihn.'; }
      catch (e) { return 'Markiere den Text und kopiere ihn.'; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return 'Kopiert.'; }, function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  }

  // ------------------------------------------------------------------ router
  var ui = { route: null, preselect: null, result: null, openHint: null, focusId: null, notice: null, forceSetup: false };
  function currentRoute() { var r = (location.hash || '').replace(/^#/, ''); return ROUTES.indexOf(r) >= 0 ? r : 'start'; }
  function go(route) { if (location.hash === '#' + route) render(true); else location.hash = route; }
  function render(routeChanged) {
    var route = currentRoute();
    var changed = routeChanged || route !== ui.route;
    ui.route = route;
    Array.prototype.forEach.call(document.querySelectorAll('[data-route]'), function (a) {
      if (a.getAttribute('data-route') === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var content;
    try { content = VIEWS[route](); }
    catch (e) {
      content = h('div', { class: 'panel' }, h('h1', { tabindex: '-1' }, 'Etwas ist schiefgelaufen'),
        h('p', null, 'Diese Ansicht konnte nicht angezeigt werden. Deine gespeicherten Daten sind davon nicht betroffen.'),
        h('p', { class: 'muted' }, String(e && e.message || e)),
        h('button', { type: 'button', class: 'btn', onclick: function () { go('start'); } }, 'Zur Startseite'));
    }
    view.replaceChildren(content);
    var navLink = document.querySelector('[data-route="' + route + '"]');
    document.title = route === 'start' ? 'Mathe 7' : ((navLink ? navLink.textContent : 'Standortbestimmung') + ' – Mathe 7');
    var target = ui.focusId && document.getElementById(ui.focusId);
    ui.focusId = null;
    if (target) target.focus();
    else if (changed) { var h1 = view.querySelector('h1'); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  }
  window.addEventListener('hashchange', function () { render(true); });
  document.querySelector('[data-skip]').addEventListener('click', function (e) { e.preventDefault(); document.getElementById('main').focus(); });

  var VIEWS = {};
  /*@VIEWS*/

  document.getElementById('build-info').textContent = 'Engine ' + E.ENGINE_VERSION + ', Katalog ' + CATALOG.catalogVersion + '.';
  applyTheme();
  render(true);
  window.MathApp = { render: render, upgradeMath: upgradeMath, texToText: texToText };
})();
