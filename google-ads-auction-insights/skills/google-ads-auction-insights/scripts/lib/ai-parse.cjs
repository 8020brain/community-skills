/**
 * ai-parse.cjs — shared parsing for the Auction Insights skill.
 *
 * Every script in this skill parses report data through this one module, so the
 * number handling and the column mapping can never drift apart between the
 * dashboard and the alerts.
 *
 * Two jobs:
 *
 * 1. LOCALE-SAFE PERCENTAGES. Google Ads writes the same metric as "46.75%" in a
 *    UK account and "46,75%" in an Italian one. A parser that assumes one locale
 *    silently corrupts the other (stripping the dot from "46.75%" gives 4675).
 *    parsePercent() decides the decimal separator from the value itself.
 *
 * 2. HEADER-DRIVEN COLUMNS. Column order in the Auction Insights report is not
 *    guaranteed across report types or account settings, and the header text is
 *    localised. mapColumns() reads the header row and maps each canonical field
 *    to whichever column actually holds it, in whatever language.
 */

'use strict';

// Google Ads suppresses a share it will not quantify and prints "< 10%".
// We plot it as the midpoint of the 0-10% band so lines do not break. Anything
// derived from it is an approximation, and the dashboard says so.
const LT10_VALUE = 5;

// The "you" row of the report, across the report languages we have seen.
const YOU_LABELS = new Set(['you', 'tu', 'tú', 'sie', 'vous', 'você', 'voce', 'du', 'usted']);
const YOU = 'You';

const round2 = n => Math.round(n * 100) / 100;

/**
 * Parse one Auction Insights metric cell into a percentage number (46.75), or:
 *   - LT10_VALUE for a suppressed "< 10%"
 *   - null for "--", "n/a" or empty (not applicable, e.g. overlap on your own row)
 *
 * Accepts a string in any locale, or a raw number.
 */
function parsePercent(raw) {
  if (raw === null || raw === undefined) return null;

  // A Sheets cell formatted as a percentage arrives as a fraction (0.4675).
  // Values strictly below 1 are treated as fractions; 1 and above are already
  // percentage points. A true 100% stored as the number 1 is indistinguishable
  // from a true 1%, which is why the Apps Script reads DISPLAY values instead of
  // raw ones and this branch is a fallback, not the main path.
  if (typeof raw === 'number') {
    if (!isFinite(raw)) return null;
    return round2(raw > 0 && raw < 1 ? raw * 100 : raw);
  }

  let s = String(raw)
    .replace(/\\/g, '')
    .replace(/"/g, '')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (s === '' || s === '--' || s === '-' || s === '—') return null;

  const low = s.toLowerCase();
  if (low === 'n/a' || low === 'na' || low === 'not applicable' || low === 'non applicabile') return null;

  // "< 10%", "<10%", "< 10 %"
  if (/^<\s*10\s*%?$/.test(s)) return LT10_VALUE;

  s = s.replace(/%/g, '').replace(/\s/g, '');
  if (s === '') return null;

  const neg = /^-/.test(s);
  s = s.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalised;

  if (lastDot !== -1 && lastComma !== -1) {
    // Both separators present: the RIGHTMOST one is the decimal separator and
    // the other is the thousands separator. "1,234.56" and "1.234,56" both work.
    const decimalChar = lastDot > lastComma ? '.' : ',';
    const thousandsChar = decimalChar === '.' ? ',' : '.';
    normalised = s.split(thousandsChar).join('').replace(decimalChar, '.');
  } else {
    const sep = lastDot !== -1 ? '.' : (lastComma !== -1 ? ',' : null);
    if (sep === null) {
      normalised = s;
    } else {
      const occurrences = s.split(sep).length - 1;
      if (occurrences > 1) {
        // "1.234.567" — can only be thousands grouping.
        normalised = s.split(sep).join('');
      } else {
        // Exactly one separator. Auction Insights metrics are percentages in the
        // 0-100 range with at most two decimals, so a lone separator is always a
        // decimal point, never thousands grouping. This is the case that broke
        // the original Italian-only parser on UK data.
        normalised = s.replace(sep, '.');
      }
    }
  }

  const n = parseFloat(normalised);
  if (Number.isNaN(n)) return null;
  return round2(neg ? -n : n);
}

/** Normalise a header cell for matching: lowercase, no accents, no punctuation. */
function normHeader(h) {
  return String(h == null ? '' : h)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Canonical fields and the header fragments that identify them.
 *
 * ORDER MATTERS: the list is scanned top to bottom and the first field whose
 * matcher accepts a header wins, so the more specific field must come first.
 * "Abs. Top of page rate" also contains "top of page", so `abs` is tested before
 * `top`; "Outranking share" also contains "share", so `ot` is tested before `imp`.
 *
 * English fragments are Google Ads' own column names; Italian fragments come from
 * Andrea Lombardi's original report. Both are matched as substrings, so casing
 * and small wording differences do not break the mapping. To support another
 * language, add a fragment here and nothing else changes.
 */
const FIELD_MATCHERS = [
  { field: 'week',   any: ['week', 'settimana', 'semana', 'woche', 'semaine', 'date', 'data', 'day', 'giorno'] },
  { field: 'entity', any: ['display url domain', 'domain', 'dominio', 'display name', 'store name', 'store', 'negozio', 'advertiser', 'inserzionista'] },
  { field: 'abs',    any: ['abs top', 'absolute top', 'abs impr top', 'in cima alla pagina', 'cima pagina'] },
  { field: 'top',    any: ['top of page', 'top page', 'in alto nella pagina', 'alto pagina'] },
  { field: 'pos',    any: ['position above', 'above rate', 'posizionamento superiore', 'posizione superiore'] },
  { field: 'ot',     any: ['outranking', 'outrank', 'superamento target', 'superamento'] },
  { field: 'ov',     any: ['overlap', 'sovrapposizione'] },
  { field: 'imp',    all: [['impr', 'impression', 'impressioni'], ['share', 'quota']] },
];

const METRIC_FIELDS = ['imp', 'ov', 'pos', 'top', 'abs', 'ot'];

function headerMatches(matcher, norm) {
  if (matcher.any) return matcher.any.some(frag => norm.includes(frag));
  // `all` is a list of alternative-groups; every group must be satisfied.
  return matcher.all.every(group => group.some(frag => norm.includes(frag)));
}

/**
 * Map a header row to canonical field -> column index.
 *
 * Returns { map, unmapped, headers }. `map.week` and `map.entity` are required
 * for the data to be usable; callers must check and refuse to parse without them
 * rather than falling back to column positions, because a silent positional
 * fallback is exactly how wrong numbers reach a client report.
 */
function mapColumns(headerCells) {
  const headers = headerCells.map(h => String(h == null ? '' : h).trim());
  const map = {};
  const unmapped = [];

  headers.forEach((h, i) => {
    const norm = normHeader(h);
    if (!norm) return;
    const hit = FIELD_MATCHERS.find(m => map[m.field] === undefined && headerMatches(m, norm));
    if (hit) map[hit.field] = i;
    else unmapped.push({ index: i, header: h });
  });

  return { map, unmapped, headers };
}

/** True when the header row carries the search-network-only columns. */
function typeFromMap(map) {
  const searchOnly = ['pos', 'top', 'abs'].filter(f => map[f] !== undefined).length;
  return searchOnly >= 2 ? 'srch' : 'shop';
}

/** Split a delimited line, honouring double quotes around fields. */
function splitLine(line, delim) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === delim && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Guess the delimiter of a data file: pipe for the .psv snapshots, else comma.
 *
 * Scans several lines rather than only the first, because Google Ads puts the
 * report name and the date range above the header and neither of those rows
 * carries a delimiter at all. Looking at the first line alone read a pipe-
 * delimited export as comma-delimited and then failed to find its header row.
 *
 * Accepts a single line or an array of lines.
 */
function detectDelimiter(lines, maxScan = 8) {
  const rows = Array.isArray(lines) ? lines : [lines];
  let pipes = 0;
  let commas = 0;
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const line = String(rows[i] == null ? '' : rows[i]);
    pipes += (line.match(/\|/g) || []).length;
    commas += (line.match(/,/g) || []).length;
  }
  return pipes > commas ? '|' : ',';
}

/**
 * Find the header row. Google Ads puts the report name and date range above the
 * real header, so we scan the first few rows for one that maps to both a week
 * column and an entity column.
 */
function findHeaderRow(lines, delim, maxScan = 8) {
  for (let i = 0; i < Math.min(lines.length, maxScan); i++) {
    const cells = splitLine(lines[i], delim).map(c => c.trim());
    if (cells.length < 3) continue;
    const { map } = mapColumns(cells);
    if (map.week !== undefined && map.entity !== undefined) return i;
  }
  return -1;
}

/** Normalise a week cell to YYYY-MM-DD, or '' when it is not a date. */
function normaliseWeek(v) {
  const s = String(v == null ? '' : v).trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  // Day-first formats (UK: 06/07/2026). Month-first cannot be told apart from
  // day-first for days 1-12, so anything ambiguous is left to the ISO branch
  // above; the scheduled report writes ISO dates.
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

function canonicalEntity(name) {
  const s = String(name == null ? '' : name).trim();
  return YOU_LABELS.has(s.toLowerCase()) ? YOU : s;
}

/**
 * Parse a full report (CSV or PSV) into rows keyed by canonical field.
 *
 * Returns { rows, type, map, headers, warnings }. Throws when the header row
 * cannot be found or the required columns are missing, so a malformed file fails
 * loudly instead of producing plausible-looking wrong numbers.
 */
function parseReport(text, opts = {}) {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) throw new Error('empty file');

  const delim = detectDelimiter(lines);
  const headerRow = findHeaderRow(lines, delim);
  if (headerRow === -1) {
    // Distinguish the common case from the genuinely broken one. A manual
    // download from the Auction Insights view in the Google Ads interface has
    // every metric column but NO week column: it is a single snapshot of the
    // whole date range, not a weekly history. That file is fine for checking
    // column names but cannot drive a time series.
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const cells = splitLine(lines[i], delim).map(c => c.trim());
      const { map } = mapColumns(cells);
      if (map.entity !== undefined && map.week === undefined) {
        throw new Error(
          'this file has competitor and metric columns but no week column, so it looks like a ' +
          'manual download from the Auction Insights view rather than a scheduled report. ' +
          'The dashboard needs the weekly history that a scheduled report produces. ' +
          'See the setup steps in SKILL.md.'
        );
      }
    }
    throw new Error(
      'could not find a header row with a recognisable week column and domain/store column. ' +
      'Run with --inspect to see the headers that were read, and add the missing wording to ' +
      'FIELD_MATCHERS in scripts/lib/ai-parse.cjs.'
    );
  }

  const headerCells = splitLine(lines[headerRow], delim).map(c => c.trim());
  const { map, unmapped, headers } = mapColumns(headerCells);
  const type = opts.type || typeFromMap(map);
  const warnings = [];

  if (unmapped.length) {
    warnings.push(
      'unrecognised column(s): ' + unmapped.map(u => `"${u.header}"`).join(', ') +
      ' (ignored; add the wording to FIELD_MATCHERS if it holds a metric)'
    );
  }
  const missing = (type === 'srch' ? METRIC_FIELDS : ['imp', 'ov', 'ot']).filter(f => map[f] === undefined);
  if (missing.length) {
    warnings.push(`no column found for: ${missing.join(', ')} (those charts will be empty)`);
  }

  const rows = [];
  for (let i = headerRow + 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim).map(c => c.trim());
    if (cells.length <= map.entity) continue;
    const week = normaliseWeek(cells[map.week]);
    if (!week) continue;
    const entity = canonicalEntity(cells[map.entity]);
    if (!entity) continue;

    const row = { w: week, s: entity };
    for (const f of METRIC_FIELDS) {
      row[f] = map[f] === undefined ? null : parsePercent(cells[map[f]]);
    }
    rows.push(row);
  }

  return { rows, type, map, headers, warnings, headerRow };
}

/** Keep one row per (week, entity); later rows win, which is what consolidation wants. */
function dedupe(rows) {
  const m = new Map();
  for (const r of rows) m.set(r.w + '||' + r.s, r);
  return [...m.values()];
}

/** Human-readable report of what the header mapping did — used by --inspect. */
function describeMapping(parsed) {
  const lines = [];
  lines.push(`Header row: line ${parsed.headerRow + 1}`);
  lines.push(`Detected report type: ${parsed.type === 'srch' ? 'search network' : 'shopping'}`);
  lines.push('Column mapping:');
  const labels = {
    week: 'week', entity: 'competitor (domain/store)', imp: 'impression share',
    ov: 'overlap rate', pos: 'position above rate', top: 'top of page rate',
    abs: 'absolute top of page rate', ot: 'outranking share',
  };
  for (const f of ['week', 'entity', ...METRIC_FIELDS]) {
    const i = parsed.map[f];
    lines.push(`  ${labels[f].padEnd(28)} ${i === undefined ? '(not found)' : `col ${i + 1}  "${parsed.headers[i]}"`}`);
  }
  if (parsed.warnings.length) {
    lines.push('Warnings:');
    parsed.warnings.forEach(w => lines.push(`  ! ${w}`));
  }
  return lines.join('\n');
}

module.exports = {
  LT10_VALUE, YOU, YOU_LABELS, METRIC_FIELDS, FIELD_MATCHERS,
  parsePercent, normHeader, mapColumns, typeFromMap, splitLine, detectDelimiter,
  findHeaderRow, normaliseWeek, canonicalEntity, parseReport, dedupe, describeMapping,
};
