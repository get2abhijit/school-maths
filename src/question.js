'use strict';
/**
 * question.js — canonical Question object, answer validation, and the
 * generate → independently solve → validate → publish pipeline.
 *
 * Text fields are strings in which inline math is delimited by $…$ (LaTeX, rendered by KaTeX in the UI).
 *
 * Question = {
 *   id, templateId, templateVersion, seed, level, skillId, signature,
 *   prompt: string, instructions?: string,
 *   promptLines?: [string]   (block lines shown under the prompt, e.g. a worked calculation to check),
 *   diagram?: Diagram (src/diagram.js; geometry data rendered to SVG, S12/D96),
 *   promptTable?: {columns:[string], rows:[[string]]}  (read-only table shown under the prompt, e.g. a Wertetabelle
 *      to judge; every row as long as `columns`, every entry a non-empty string that may contain $…$; D63),
 *   answer: AnswerSpec,
 *   hints: [ {kind:'orientation'|'strategy'|'step'|'solution'|'alternative', text} ] (exactly 5, in this order),
 *   solution: { steps: [string], result: string },
 *   meta: { effectiveSeed, attempts, params }
 * }
 *
 * AnswerSpec types:
 *   {type:'integer', value:'-12'}
 *   {type:'fraction', value:'3/4', requireReduced?:bool}       — exact rational equivalence
 *   {type:'decimal', value:'2.5', tolerance:'0.01', places?:int} — |x−v| ≤ tolerance (exact)
 *   {type:'expression', value:'2x+6', variables:['x'], form:'any'|'expanded'|'product_with_sum'}
 *   {type:'choice', options:[{id,text}], correct:'b'}
 *   {type:'multiselect', options:[{id,text}], correct:['a','c']}
 *   {type:'ordering', items:[{id,text}], correct:['c','a','b']}
 *   {type:'table', cells:[{id, label?, spec:AnswerSpec(number|expression)}]}
 *   {type:'solution_set', variable:'x', kind:'one'|'none'|'all', value?:'3/2'}  — solution set of an equation
 *      in one variable over ℚ: exactly one solution (value), no solution (∅) or every number (ℚ).
 *      Raw input: {kind, value?} from the UI, or a string ("x = 3", "3", "keine", "L = {}", "alle", "unendlich viele").
 *   integer/fraction/decimal may carry `variable:'x'`: then an input like "x = 3" is accepted as "3".
 *   integer/fraction/decimal may carry `unit` (a key of UNITS, e.g. '€', '%', 'kg', 'Jahre'): the input may then
 *      carry that unit ("4,50 €", "€ 4,50", "42 %", "42 Prozent"); another known unit is graded as unit_confusion (D56).
 *      `places` (optional) = decimals shown in keys and solutions (e.g. 2 for money).
 *   table may carry `grid:{columns:[text], rows:[[{text}|{cell:id}]]}` — a 2-D layout (given entries + input cells);
 *      every cell id appears exactly once in the grid (D57). Grading is per cell as before.
 *   fraction/decimal may carry `probability:true` (D66): the input may also be a percentage ("37,5 %", "37,5 Prozent"
 *      = 0,375), and a value outside [0; 1] that is not a listed distractor gets range feedback (concept_confusion).
 *      Not combinable with `unit`.
 *   Any numeric/expression spec may carry distractors:[{value, category, feedback}] for targeted feedback.
 *   Every spec carries `canonical`: the raw input a student would type for the correct answer.
 */
const { Fraction, Rng, deriveSeed, hashHex, parseNumber, normalizeInput } = require('./core');
const X = require('./expr');
const D = require('./diagram');

const ERROR_CATEGORIES = Object.freeze(['sign_error', 'order_of_operations', 'unit_confusion', 'rounding', 'concept_confusion', 'other']);
const HINT_KINDS = Object.freeze(['orientation', 'strategy', 'step', 'solution', 'alternative']);
const LEVELS = Object.freeze({ 1: 'Grundlagen', 2: 'Standard', 3: 'Anspruchsvoll', 4: 'Transfer' });
const ANSWER_TYPES = Object.freeze(['integer', 'fraction', 'decimal', 'expression', 'choice', 'multiselect', 'ordering', 'table', 'solution_set']);
const SOLUTION_KINDS = Object.freeze(['one', 'none', 'all']);
/** Units a numeric answer may carry: key → accepted spellings (lower case) and German names for feedback (D56). */
const UNITS = Object.freeze({
  '€': { aliases: ['€', 'euro', 'eur'], name: 'Euro (€)' },
  '%': { aliases: ['%', 'prozent'], name: 'Prozent (%)' },
  'kg': { aliases: ['kg'], name: 'Kilogramm (kg)' },
  'g': { aliases: ['g'], name: 'Gramm (g)' },
  'km': { aliases: ['km'], name: 'Kilometer (km)' },
  'm': { aliases: ['m'], name: 'Meter (m)' },
  'l': { aliases: ['l', 'liter'], name: 'Liter (l)' },
  'ml': { aliases: ['ml'], name: 'Milliliter (ml)' },
  'Jahre': { aliases: ['jahre', 'jahr', 'j'], name: 'Jahren' },
  'Tage': { aliases: ['tage', 'tag'], name: 'Tagen' },
  'h': { aliases: ['h', 'std', 'stunde', 'stunden'], name: 'Stunden (h)' },
  'min': { aliases: ['min', 'minute', 'minuten'], name: 'Minuten (min)' },
  '°': { aliases: ['°', 'grad'], name: 'Grad (°)' },
});

const FORM_MESSAGES_DE = {
  brackets_remaining: 'Der Term ist gleichwertig, aber es stehen noch Klammern da. Löse sie auf.',
  like_terms_not_collected: 'Der Term ist gleichwertig, aber gleichartige Glieder sind noch nicht zusammengefasst.',
  unsimplified_product: 'Der Term ist gleichwertig, aber Produkte wie $x\\cdot x$ solltest du als Potenz schreiben.',
  unsimplified_coefficient: 'Der Term ist gleichwertig, aber die Zahlen in einem Glied sind noch nicht zusammengerechnet.',
  unreduced_fraction: 'Der Term ist gleichwertig, aber ein Bruch ist noch nicht gekürzt.',
  zero_term: 'Der Term ist gleichwertig, aber ein Glied ist null und kann wegfallen.',
  not_a_product: 'Der Term ist gleichwertig, aber gefragt ist ein Produkt (Faktor mal Klammer).',
  quotient_not_product: 'Der Term ist gleichwertig, aber es steht noch ein Quotient da. Schreibe ihn als Produkt, z. B. $\\frac{3}{2}x$ oder $1{,}5x$.',
  no_bracket_factor: 'Der Term ist gleichwertig, aber gefragt ist die Form Faktor mal Klammer.',
  not_reduced: 'Der Wert stimmt, aber der Bruch ist noch nicht vollständig gekürzt.',
  solution_kind_missing: 'Wähle aus, ob die Gleichung genau eine, keine oder unendlich viele Lösungen hat.',
  solution_value_missing: 'Gib die Lösung ein.',
  unit_value_ok: 'Die Zahl stimmt, aber die Einheit passt nicht.',
  unit_wrong: 'Achte auf die Einheit.',
  kind_all_not_none: 'Eine wahre Aussage wie $0 = 0$ gilt für jede Zahl. Dann ist jede Zahl eine Lösung – nicht keine.',
  kind_none_not_all: 'Am Ende steht eine falsche Aussage (z. B. $0 = 4$). Sie gilt für keine Zahl – die Gleichung hat keine Lösung.',
  kind_one_not_special: 'Hier fällt $x$ beim Umformen nicht weg. Forme weiter um: Die Gleichung hat genau eine Lösung.',
  kind_special_not_one: 'Mache die Probe mit deiner Zahl. Forme weiter um: Hier fällt $x$ weg – dann gibt es keine oder unendlich viele Lösungen.',
  incomplete_factoring: 'Der Term ist gleichwertig, aber du hast nicht den größten gemeinsamen Faktor ausgeklammert.',
  non_integer_inside: 'Der Term ist gleichwertig, aber in der Klammer sollten nur ganze Zahlen stehen.',
  inner_not_simplified: 'Der Term ist gleichwertig, aber die Klammer ist noch nicht vereinfacht.',
  prob_out_of_range: 'Eine Wahrscheinlichkeit liegt immer zwischen 0 und 1 (also zwischen 0 % und 100 %).',
};

// ---------------------------------------------------------------- canonical JSON
function canonicalJSON(v) {
  if (v instanceof Fraction) return JSON.stringify(v.toString());
  if (typeof v === 'bigint') return JSON.stringify(v.toString());
  if (Array.isArray(v)) return `[${v.map(canonicalJSON).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalJSON(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
function makeSignature(templateId, level, params) { return hashHex(`${templateId}|${level}|${canonicalJSON(params)}`); }
function makeId(templateId, templateVersion, level, seed) { return `${templateId}@${templateVersion}/L${level}/${seed >>> 0}`; }

// ---------------------------------------------------------------- result helpers
const invalid = (code, message) => ({ status: 'invalid', code, message: message || X.MESSAGES_DE[code] || code });
const correct = (extra = {}) => ({ status: 'correct', ...extra });
const incorrect = (extra = {}) => ({ status: 'incorrect', ...extra });

function matchDistractorNumber(spec, value) {
  for (const d of spec.distractors || []) {
    const r = parseNumber(d.value);
    if (r.ok && r.value.eq(value)) return d;
  }
  return null;
}
function matchDistractorExpr(spec, ast) {
  for (const d of spec.distractors || []) {
    const r = X.tryParse(d.value, { variables: spec.variables });
    if (r.ok && X.equivalent(ast, r.ast, spec.variables).equivalent) return d;
  }
  return null;
}
/** "x = 3" → "3" when the spec names a variable (numeric answers to equations). */
function stripVariable(spec, raw) {
  if (!spec.variable || typeof raw !== 'string') return raw;
  const m = new RegExp(`^\\s*${spec.variable}\\s*=\\s*(.*)$`).exec(raw);
  return m ? m[1] : raw;
}
/**
 * Split a known unit off a numeric input (only when the spec names a unit).
 * Returns {raw, unit: null | 'match' | 'mismatch', found?: unitKey}. A leading "€" is accepted ("€ 4,50").
 */
function splitUnit(spec, raw) {
  if (!spec.unit || typeof raw !== 'string') return { raw, unit: null };
  let s = normalizeInput(raw);
  let lead = null;
  if (s.startsWith('€')) { lead = '€'; s = s.slice(1).trim(); }
  const m = /^(.*?[0-9])\s*([%€°]|[A-Za-zÄÖÜäöü]+)\.?$/.exec(s);
  const token = m ? m[2].toLowerCase() : lead;
  if (m) s = m[1];
  if (!token) return { raw: s, unit: null };
  const found = Object.keys(UNITS).find(k => UNITS[k].aliases.includes(token));
  if (!found) return { raw, unit: null }; // unknown word: let the number parser report it
  if (lead && m && token !== '€') return { raw: s, unit: 'mismatch', found: token };
  return { raw: s, unit: found === spec.unit ? 'match' : 'mismatch', found };
}
/** Parse a numeric answer (variable prefix and unit removed). Returns parseNumber's result plus `unit`. */
function parseNumericInput(spec, raw) {
  if (spec.probability && typeof raw === 'string') {
    const m = /^(.*?[0-9])\s*(%|prozent)\.?$/i.exec(normalizeInput(raw));
    if (m) { const r = parseNumber(m[1]); return r.ok ? { ...r, value: r.value.div(100), unit: null, percent: true } : { ...r, unit: null }; }
  }
  const u = splitUnit(spec, stripVariable(spec, raw));
  return { ...parseNumber(u.raw), unit: u.unit, foundUnit: u.found };
}
function unitMismatch(spec, r, expected) {
  const name = UNITS[spec.unit].name;
  const ok = r.value.eq(expected);
  const feedback = ok ? `${FORM_MESSAGES_DE.unit_value_ok} Gefragt ist ein Wert in ${name}.` : `${FORM_MESSAGES_DE.unit_wrong} Gefragt ist ein Wert in ${name}.`;
  return incorrect({ errorCategory: 'unit_confusion', code: ok ? 'unit_value_ok' : 'unit_wrong', feedback });
}

/**
 * Parse a raw solution-set input. Returns {ok:true, kind, value?:Fraction} or {ok:false, code, message?}.
 * Strings: "keine", "keine Lösung", "L = {}", "{}", "∅" → none; "alle", "unendlich viele", "jede Zahl",
 * "L = Q", "ℚ" → all; "x = 3", "L = {3}", "{3}", "3" → one.
 */
function parseSolutionSetInput(spec, raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (!SOLUTION_KINDS.includes(raw.kind)) return { ok: false, code: 'solution_kind_missing' };
    if (raw.kind !== 'one') return { ok: true, kind: raw.kind };
    if (raw.value === undefined || raw.value === null || String(raw.value).trim() === '') return { ok: false, code: 'solution_value_missing' };
    const r = parseNumber(stripVariable({ variable: spec.variable || 'x' }, String(raw.value)));
    return r.ok ? { ok: true, kind: 'one', value: r.value } : { ok: false, code: r.code };
  }
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, code: 'solution_kind_missing' };
  const s = normalizeInput(raw).toLowerCase().replace(/\s+/g, ' ');
  if (/^(keine|kein|l ?= ?\{ ?\}|\{ ?\}|\u2205|l ?= ?\u2205|leere menge)/.test(s)) return { ok: true, kind: 'none' };
  if (/^(unendlich|alle|jede|l ?= ?(q|\u211a)$|\u211a$)/.test(s)) return { ok: true, kind: 'all' };
  const inner = s.replace(/^l ?= ?\{(.*)\}$/, '$1').replace(/^\{(.*)\}$/, '$1');
  const r = parseNumber(stripVariable({ variable: spec.variable || 'x' }, inner));
  return r.ok ? { ok: true, kind: 'one', value: r.value } : { ok: false, code: r.code };
}
function wrongWith(d) {
  return d ? incorrect({ errorCategory: d.category, feedback: d.feedback }) : incorrect({ errorCategory: 'other' });
}

const outOfUnitRange = v => v.sign() < 0 || v.cmp(1) > 0;
/** Distractor feedback first; for probabilities, a value outside [0; 1] gets range feedback (D66). */
function wrongOrRange(spec, value) {
  const d = matchDistractorNumber(spec, value);
  if (d) return wrongWith(d);
  if (spec.probability && outOfUnitRange(value)) return incorrect({ errorCategory: 'concept_confusion', code: 'prob_out_of_range', feedback: FORM_MESSAGES_DE.prob_out_of_range });
  return incorrect({ errorCategory: 'other' });
}

// ---------------------------------------------------------------- validators
const validators = {
  integer(spec, raw) {
    const r = parseNumericInput(spec, raw);
    if (!r.ok) return invalid(r.code);
    const expected = Fraction.of(spec.value);
    if (r.unit === 'mismatch') return unitMismatch(spec, r, expected);
    if (r.value.eq(expected)) return correct();
    return wrongWith(matchDistractorNumber(spec, r.value));
  },
  fraction(spec, raw) {
    const r = parseNumericInput(spec, raw);
    if (!r.ok) return invalid(r.code);
    const expected = Fraction.of(spec.value);
    if (r.unit === 'mismatch') return unitMismatch(spec, r, expected);
    if (r.value.eq(expected)) {
      if (spec.requireReduced && !r.reduced) return incorrect({ equivalent: true, code: 'not_reduced', feedback: FORM_MESSAGES_DE.not_reduced, errorCategory: 'other' });
      return correct();
    }
    return wrongOrRange(spec, r.value);
  },
  decimal(spec, raw) {
    const r = parseNumericInput(spec, raw);
    if (!r.ok) return invalid(r.code);
    const expected = Fraction.of(spec.value);
    const tol = Fraction.of(spec.tolerance || '0');
    if (r.unit === 'mismatch') return unitMismatch(spec, { value: r.value.sub(expected).abs().cmp(tol) <= 0 ? expected : r.value }, expected);
    if (r.value.sub(expected).abs().cmp(tol) <= 0) return correct();
    const d = matchDistractorNumber(spec, r.value);
    if (d) return wrongWith(d);
    if (spec.probability && outOfUnitRange(r.value)) return wrongOrRange(spec, r.value);
    // Near miss outside tolerance but within 10× → likely rounding.
    if (!tol.isZero() && r.value.sub(expected).abs().cmp(tol.mul(10)) <= 0) return incorrect({ errorCategory: 'rounding' });
    return incorrect({ errorCategory: 'other' });
  },
  expression(spec, raw) {
    const r = X.tryParse(raw, { variables: spec.variables });
    if (!r.ok) return invalid(r.code, r.message);
    const exp = X.parse(spec.value, { variables: spec.variables });
    const eq = X.equivalent(r.ast, exp, spec.variables);
    if (eq.equivalent) {
      const f = X.checkForm(r.ast, spec.form);
      if (f.ok) return correct();
      return incorrect({ equivalent: true, code: f.reason, feedback: FORM_MESSAGES_DE[f.reason] || f.reason, errorCategory: 'other' });
    }
    return wrongWith(matchDistractorExpr(spec, r.ast));
  },
  choice(spec, raw) {
    if (raw === null || raw === undefined || raw === '') return invalid('no_choice');
    if (!spec.options.some(o => o.id === raw)) return invalid('invalid_choice');
    if (raw === spec.correct) return correct();
    const opt = spec.options.find(o => o.id === raw);
    return incorrect({ errorCategory: opt.category || 'other', feedback: opt.feedback });
  },
  multiselect(spec, raw) {
    if (!Array.isArray(raw) || raw.length === 0) return invalid('no_choice');
    const ids = new Set(spec.options.map(o => o.id));
    if (raw.some(id => !ids.has(id))) return invalid('invalid_choice');
    const a = new Set(raw), b = new Set(spec.correct);
    const same = a.size === b.size && [...a].every(x => b.has(x));
    return same ? correct() : incorrect({ errorCategory: 'concept_confusion', missing: [...b].filter(x => !a.has(x)).length, extra: [...a].filter(x => !b.has(x)).length });
  },
  ordering(spec, raw) {
    const ids = spec.items.map(i => i.id);
    if (!Array.isArray(raw) || raw.length !== ids.length || new Set(raw).size !== ids.length || raw.some(id => !ids.includes(id))) return invalid('invalid_choice');
    const firstWrong = raw.findIndex((id, i) => id !== spec.correct[i]);
    return firstWrong === -1 ? correct() : incorrect({ errorCategory: 'concept_confusion', firstWrongPosition: firstWrong });
  },
  table(spec, raw) {
    raw = raw || {};
    const cells = {};
    let anyInvalid = false, allCorrect = true;
    for (const c of spec.cells) {
      const res = validateAnswer(c.spec, raw[c.id]);
      cells[c.id] = res;
      if (res.status === 'invalid') anyInvalid = true;
      if (res.status !== 'correct') allCorrect = false;
    }
    if (anyInvalid) return { status: 'invalid', code: 'table_incomplete', message: 'Mindestens ein Feld ist leer oder ungültig.', cells };
    return allCorrect ? correct({ cells }) : incorrect({ errorCategory: 'other', cells });
  },
  solution_set(spec, raw) {
    const r = parseSolutionSetInput(spec, raw);
    if (!r.ok) return invalid(r.code, FORM_MESSAGES_DE[r.code]);
    if (r.kind === spec.kind) {
      if (r.kind !== 'one' || r.value.eq(Fraction.of(spec.value))) return correct();
      for (const d of spec.distractors || []) {
        const dr = parseSolutionSetInput(spec, d.value);
        if (dr.ok && dr.kind === 'one' && dr.value.eq(r.value)) return wrongWith(d);
      }
      return incorrect({ errorCategory: 'other' });
    }
    for (const d of spec.distractors || []) {
      const dr = parseSolutionSetInput(spec, d.value);
      if (dr.ok && dr.kind === r.kind && (dr.kind !== 'one' || dr.value.eq(r.value))) return wrongWith(d);
    }
    const code = spec.kind === 'all' && r.kind === 'none' ? 'kind_all_not_none'
      : spec.kind === 'none' && r.kind === 'all' ? 'kind_none_not_all'
        : spec.kind === 'one' ? 'kind_one_not_special' : 'kind_special_not_one';
    return incorrect({ errorCategory: 'concept_confusion', code, feedback: FORM_MESSAGES_DE[code] });
  },
};

/** Validate a raw student input against an answer spec. Never throws for bad input. */
function validateAnswer(spec, raw) {
  const v = validators[spec.type];
  if (!v) throw new Error(`unknown answer type ${spec.type}`);
  return v(spec, raw);
}

/** Public entry point for the UI: evaluate(question, rawInput) → result. */
function evaluateQuestion(question, raw) {
  const res = validateAnswer(question.answer, raw);
  return { ...res, questionId: question.id, signature: question.signature };
}

// ---------------------------------------------------------------- schema validation
function checkSpec(spec, path, errors) {
  if (!spec || !ANSWER_TYPES.includes(spec.type)) { errors.push(`${path}: bad answer type`); return; }
  if (spec.type === 'table') {
    if (!Array.isArray(spec.cells) || !spec.cells.length) errors.push(`${path}: table without cells`);
    else spec.cells.forEach((c, i) => { if (!c.id) errors.push(`${path}.cells[${i}]: missing id`); checkSpec(c.spec, `${path}.cells[${i}]`, errors); });
    if (spec.grid !== undefined) checkGrid(spec, path, errors);
    return;
  }
  if (spec.canonical === undefined) errors.push(`${path}: missing canonical`);
  if (spec.type === 'solution_set') {
    if (!SOLUTION_KINDS.includes(spec.kind)) errors.push(`${path}: bad solution kind`);
    if (spec.kind === 'one' && typeof spec.value !== 'string') errors.push(`${path}: solution value must be a string`);
    if (spec.kind !== 'one' && spec.value !== undefined) errors.push(`${path}: value only for kind one`);
  }
  if (['integer', 'fraction', 'decimal', 'expression'].includes(spec.type)) {
    if (typeof spec.value !== 'string') errors.push(`${path}: value must be a string`);
    if (spec.type === 'integer' && typeof spec.value === 'string' && !Fraction.of(spec.value).isInteger()) errors.push(`${path}: integer value not integral`);
    if (spec.type === 'expression' && !Array.isArray(spec.variables)) errors.push(`${path}: variables missing`);
  }
  if (spec.unit !== undefined && !(['integer', 'fraction', 'decimal'].includes(spec.type) && Object.prototype.hasOwnProperty.call(UNITS, spec.unit))) errors.push(`${path}: bad unit ${spec.unit}`);
  if (spec.probability !== undefined && !(spec.probability === true && ['fraction', 'decimal'].includes(spec.type) && spec.unit === undefined)) errors.push(`${path}: probability flag only on fraction/decimal without unit`);
  if (spec.probability && typeof spec.value === 'string' && outOfUnitRange(Fraction.of(spec.value))) errors.push(`${path}: probability outside [0; 1]`);
  if (spec.places !== undefined && !(Number.isInteger(spec.places) && spec.places >= 0 && spec.places <= 6)) errors.push(`${path}: bad places`);
  if (spec.type === 'decimal' && typeof spec.value === 'string' && spec.places !== undefined && !Fraction.of(spec.value).round(spec.places).eq(Fraction.of(spec.value))) errors.push(`${path}: value has more decimals than places`);
  if (spec.type === 'choice' || spec.type === 'multiselect') {
    const ids = (spec.options || []).map(o => o.id);
    if (ids.length < 2 || new Set(ids).size !== ids.length) errors.push(`${path}: options need ≥2 unique ids`);
    const texts = (spec.options || []).map(o => o.text);
    if (new Set(texts).size !== texts.length) errors.push(`${path}: duplicate option texts`);
  }
  for (const d of spec.distractors || []) {
    if (!ERROR_CATEGORIES.includes(d.category)) errors.push(`${path}: distractor with bad category ${d.category}`);
  }
  for (const o of spec.options || []) {
    if (o.category && !ERROR_CATEGORIES.includes(o.category)) errors.push(`${path}: option with bad category`);
  }
}
/** Grid layout of a table: rectangular, every input cell placed exactly once (D57). */
function checkGrid(spec, path, errors) {
  const g = spec.grid;
  if (!g || !Array.isArray(g.columns) || !g.columns.length || !Array.isArray(g.rows) || !g.rows.length) { errors.push(`${path}: bad grid`); return; }
  const ids = new Set((spec.cells || []).map(c => c.id));
  const placed = [];
  g.rows.forEach((row, r) => {
    if (!Array.isArray(row) || row.length !== g.columns.length) { errors.push(`${path}: grid row ${r} has wrong length`); return; }
    for (const e of row) {
      if (e && typeof e.cell === 'string') { if (!ids.has(e.cell)) errors.push(`${path}: grid names unknown cell ${e.cell}`); placed.push(e.cell); }
      else if (!e || typeof e.text !== 'string') errors.push(`${path}: grid entry needs text or cell`);
    }
  });
  if (placed.length !== new Set(placed).size || placed.length !== ids.size) errors.push(`${path}: every cell must appear exactly once in the grid`);
}
/** Read-only prompt table (D63): rectangular, only non-empty strings. */
function checkPromptTable(t, errors) {
  const str = x => typeof x === 'string' && x.length > 0;
  if (!t || !Array.isArray(t.columns) || !t.columns.length || !t.columns.every(str) || !Array.isArray(t.rows) || !t.rows.length) { errors.push('bad promptTable'); return; }
  t.rows.forEach((row, r) => { if (!Array.isArray(row) || row.length !== t.columns.length || !row.every(str)) errors.push(`promptTable row ${r} malformed`); });
}
function canonicalInput(spec) {
  if (spec.type === 'table') { const o = {}; spec.cells.forEach(c => { o[c.id] = canonicalInput(c.spec); }); return o; }
  return spec.canonical;
}
/** Every distractor must be judged wrong — otherwise the question is ambiguous. */
function checkDistractors(spec, path, errors) {
  if (spec.type === 'table') { spec.cells.forEach((c, i) => checkDistractors(c.spec, `${path}.cells[${i}]`, errors)); return; }
  for (const d of spec.distractors || []) {
    const r = validateAnswer(spec, d.value);
    if (r.status === 'correct') errors.push(`${path}: distractor "${d.value}" is accepted as correct (ambiguous)`);
  }
}

/** Structural + semantic validation of a fully built question. */
function validateQuestion(q) {
  const errors = [];
  for (const f of ['id', 'templateId', 'templateVersion', 'skillId', 'signature', 'prompt']) if (!q[f] && q[f] !== 0) errors.push(`missing ${f}`);
  if (![1, 2, 3, 4].includes(q.level)) errors.push('bad level');
  if (!Array.isArray(q.hints) || q.hints.length !== 5) errors.push('need exactly 5 hints');
  else q.hints.forEach((h, i) => {
    if (h.kind !== HINT_KINDS[i]) errors.push(`hint ${i} kind must be ${HINT_KINDS[i]}`);
    if (!h.text || typeof h.text !== 'string') errors.push(`hint ${i} empty`);
  });
  if (q.promptLines !== undefined && (!Array.isArray(q.promptLines) || q.promptLines.some(l => typeof l !== 'string' || !l))) errors.push('bad promptLines');
  if (q.promptTable !== undefined) checkPromptTable(q.promptTable, errors);
  if (q.diagram !== undefined) { const dv = D.validateDiagram(q.diagram); if (!dv.ok) errors.push(...dv.errors.map(e => `diagram: ${e}`)); }
  if (!q.solution || !Array.isArray(q.solution.steps) || !q.solution.steps.length || !q.solution.result) errors.push('missing solution');
  checkSpec(q.answer, 'answer', errors);
  if (!errors.length) {
    const r = validateAnswer(q.answer, canonicalInput(q.answer));
    if (r.status !== 'correct') errors.push(`canonical answer not accepted (${r.status}/${r.code || ''})`);
    checkDistractors(q.answer, 'answer', errors);
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------- generation pipeline
class GenerationError extends Error {}
const MAX_ATTEMPTS = 100;

/**
 * Template interface:
 *   { id, version, skillId, levels:[1..4],
 *     sample(rng, level) → params,
 *     constraints(params, level) → true | 'reason',
 *     build(params, level) → {prompt, instructions?, answer, hints, solution},
 *     solve(params, level) → raw answer input computed INDEPENDENTLY of build (different code path),
 *     signatureParams?(params, level) → the mathematically relevant params (omit presentation-only
 *       randomness such as option order) so the signature detects effective duplicates }
 * The pipeline publishes a question only if: constraints pass, the independent solution
 * is accepted by the built answer spec, and validateQuestion() passes.
 */
function generate(template, seed, level) {
  if (!template.levels.includes(level)) throw new GenerationError(`${template.id}: level ${level} not supported`);
  seed = seed >>> 0;
  const rejections = [];
  for (let k = 0; k < MAX_ATTEMPTS; k++) {
    const effectiveSeed = k === 0 ? seed : deriveSeed(seed, k);
    const rng = new Rng(effectiveSeed);
    const params = template.sample(rng, level);
    const c = template.constraints(params, level);
    if (c !== true) { rejections.push(c); continue; }
    const body = template.build(params, level);
    const q = {
      id: makeId(template.id, template.version, level, seed),
      templateId: template.id, templateVersion: template.version,
      seed, level, skillId: template.skillId,
      signature: makeSignature(template.id, level, template.signatureParams ? template.signatureParams(params, level) : params),
      ...body,
      meta: { effectiveSeed, attempts: k + 1, params: JSON.parse(canonicalJSON(params)) },
    };
    const independent = template.solve(params, level);
    const check = validateAnswer(q.answer, independent);
    if (check.status !== 'correct') { rejections.push(`independent solution rejected (${check.status})`); continue; }
    const v = validateQuestion(q);
    if (!v.ok) { rejections.push(v.errors.join('; ')); continue; }
    return q;
  }
  throw new GenerationError(`${template.id}: no valid instance for seed ${seed} L${level}: ${rejections.slice(-3).join(' | ')}`);
}

/** Regenerate a question from its stored reference (id parts). */
function regenerate(registry, ref) {
  const t = registry[ref.templateId];
  if (!t) throw new GenerationError(`unknown template ${ref.templateId}`);
  if (t.version !== ref.templateVersion) throw new GenerationError(`template ${ref.templateId} is v${t.version}, stored v${ref.templateVersion}`);
  return generate(t, ref.seed, ref.level);
}

/**
 * Generate `count` questions without duplicate signatures.
 * templates: array (cycled in seeded random order); level: 1..4 or array of levels to cycle.
 */
function generateSession(templates, { baseSeed, count, level }) {
  const rng = new Rng(baseSeed >>> 0);
  const seen = new Set();
  const out = [];
  const levels = Array.isArray(level) ? level : [level];
  let i = 0;
  while (out.length < count) {
    if (i > count * 50) throw new GenerationError('generateSession: too many duplicates');
    const t = templates[rng.int(0, templates.length - 1)];
    const lv = levels[out.length % levels.length];
    const usable = t.levels.includes(lv) ? lv : t.levels[t.levels.length - 1];
    const q = generate(t, deriveSeed(baseSeed, 1000 + i), usable);
    i++;
    if (seen.has(q.signature)) continue;
    seen.add(q.signature);
    out.push(q);
  }
  return out;
}

module.exports = {
  ERROR_CATEGORIES, HINT_KINDS, LEVELS, ANSWER_TYPES, SOLUTION_KINDS, UNITS, FORM_MESSAGES_DE, parseSolutionSetInput, splitUnit,
  canonicalJSON, makeSignature, makeId,
  validateAnswer, evaluateQuestion, validateQuestion, canonicalInput,
  GenerationError, generate, regenerate, generateSession,
};
