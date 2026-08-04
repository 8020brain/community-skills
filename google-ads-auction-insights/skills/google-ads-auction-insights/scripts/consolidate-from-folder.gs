/**
 * Consolidate Auction Insights from a Drive folder into clean tabs, ONE PER REPORT.
 *
 * Why this exists: a Google Ads scheduled report drops a NEW Google Sheet into the
 * Drive folder every day (or every week) rather than updating one file. Each file
 * holds the full weekly history for its lookback window. Several different reports
 * for the same client can live in the same folder (for example "Client account
 * shopping" and "Client brand search"). This script groups the files by report
 * name, dedupes on (week + competitor) keeping the value from the most recent file,
 * and writes ONE TAB PER REPORT, ready for the dashboard or a published CSV.
 *
 * Alongside the data tabs it writes a "Manifest" tab, moved to FIRST position, with
 * Tab | Gid | Type | Report | Rows | Updated. build-dashboard.cjs reads the
 * Manifest from the sheet's published CSV (no gid returns the first sheet) and
 * discovers every other tab from it, so the client's live.json needs ONE URL only.
 *
 * Setup (once per client):
 *   1. Open the "hub" sheet (any empty Sheet in your Drive).
 *   2. Extensions -> Apps Script, paste this file.
 *   3. Set FOLDER_ID below (or use a named range called "driveID").
 *   4. Run "firstRun" once and authorise it.
 *   5. Menu "Auction Insights" -> "Turn on daily refresh".
 *   6. File -> Share -> Publish to web -> ENTIRE DOCUMENT.
 *
 * Reusable for every client: only FOLDER_ID changes.
 *
 * TWO THINGS THIS FORK FIXES over the original:
 *   - Numbers are read from the cells' DISPLAY values and parsed without assuming
 *     a locale, so "46.75%" in a UK account and "46,75%" in an Italian one both
 *     become 46.75. The original stripped dots as thousands separators, which
 *     turned UK values into numbers 100x too large with no error.
 *   - Columns are found by reading the header row rather than by position, so the
 *     report language and column order do not matter.
 *
 * Based on the original by Andrea Lombardi (Ads2AI), itself based on an idea by
 * Mike Rhodes. This fork is English-language and locale-safe.
 */

const CONFIG = {
  // Drive folder where Google Ads drops the reports. Several different reports
  // can share one folder: they are grouped by file name.
  FOLDER_ID: 'PASTE_DRIVE_FOLDER_ID_HERE',
  // Index tab read by the dashboard. Always moved to first position.
  MANIFEST_TAB: 'Manifest',
  // "< 10%" is written through as text to stay faithful to the report; the
  // dashboard renders it as a low value. Set true to write it as a number.
  WRITE_LT10_AS_NUMBER: false,
  LT10_VALUE: 5,
  // Hour of the daily trigger (0-23).
  DAILY_HOUR: 9,
};

// Service tabs: a report may not use these names (it would be prefixed).
const RESERVED_TABS = ['Manifest', 'File List', 'Log'];

// The "you" row of the report, across report languages.
const YOU_LABELS = ['you', 'tu', 'tú', 'sie', 'vous', 'você', 'voce', 'du', 'usted'];
const YOU = 'You';

/**
 * Canonical fields and the header wording that identifies them.
 * ORDER MATTERS: first match wins, so the more specific field comes first.
 * "Abs. Top of page rate" also contains "top of page"; "Outranking share" also
 * contains "share". Keep this list in step with scripts/lib/ai-parse.cjs.
 */
const FIELD_MATCHERS = [
  { field: 'week', any: ['week', 'settimana', 'semana', 'woche', 'semaine', 'date', 'data', 'day', 'giorno'] },
  { field: 'entity', any: ['display url domain', 'domain', 'dominio', 'display name', 'store name', 'store', 'negozio', 'advertiser', 'inserzionista'] },
  { field: 'abs', any: ['abs top', 'absolute top', 'abs impr top', 'in cima alla pagina', 'cima pagina'] },
  { field: 'top', any: ['top of page', 'top page', 'in alto nella pagina', 'alto pagina'] },
  { field: 'pos', any: ['position above', 'above rate', 'posizionamento superiore', 'posizione superiore'] },
  { field: 'ot', any: ['outranking', 'outrank', 'superamento target', 'superamento'] },
  { field: 'ov', any: ['overlap', 'sovrapposizione'] },
  { field: 'imp', all: [['impr', 'impression', 'impressioni'], ['share', 'quota']] },
];

// Headers written on the consolidated tabs. English on purpose: the dashboard
// maps these back through the same matchers, whatever language the source was in.
const HEADER_SHOP = ['Week', 'Store name', 'Impr. share', 'Overlap rate', 'Outranking share'];
const FIELDS_SHOP = ['w', 's', 'imp', 'ov', 'ot'];
const HEADER_SEARCH = ['Week', 'Display URL domain', 'Impr. share', 'Overlap rate', 'Position above rate', 'Top of page rate', 'Abs. Top of page rate', 'Outranking share'];
const FIELDS_SEARCH = ['w', 's', 'imp', 'ov', 'pos', 'top', 'abs', 'ot'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Auction Insights')
    .addItem('Import and consolidate now', 'importAndConsolidate')
    .addItem('Turn on daily refresh', 'setupDailyTrigger')
    .addItem('Turn off daily refresh', 'removeDailyTrigger')
    .addToUi();
}

/** Run this the first time, to authorise the permissions and create the menu. */
function firstRun() {
  onOpen();
  importAndConsolidate();
}

function setupDailyTrigger() {
  removeDailyTrigger();
  ScriptApp.newTrigger('importAndConsolidate')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.DAILY_HOUR)
    .create();
  safeAlert('Done', 'Daily refresh turned on (around ' + CONFIG.DAILY_HOUR + ':00).');
}

function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'importAndConsolidate') ScriptApp.deleteTrigger(t);
  });
}

/**
 * Read-only check of what the script can actually see. Writes to the execution
 * log only, touches nothing. Run this first when a run "completes" but the hub
 * sheet does not change, rather than reasoning backwards from an empty sheet.
 */
function diagnose() {
  const out = [];
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { out.push('getActiveSpreadsheet threw: ' + e.message); }

  if (!ss) {
    out.push('BOUND TO A SHEET: no. This script is standalone, so it has no hub sheet to write to.');
    out.push('Fix: open the hub sheet, Extensions -> Apps Script, and paste the code into THAT project.');
  } else {
    out.push('BOUND TO A SHEET: yes');
    out.push('  name: ' + ss.getName());
    out.push('  id:   ' + ss.getId());
    out.push('  url:  ' + ss.getUrl());
    out.push('  tabs now: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  }

  const folderId = ss ? getFolderId(ss) : CONFIG.FOLDER_ID;
  out.push('RESOLVED FOLDER_ID: ' + folderId);
  if (!folderIdIsSet(folderId)) {
    out.push('  -> does not look like a Drive folder id, so importAndConsolidate would stop here and write nothing.');
  } else {
    try {
      const folder = DriveApp.getFolderById(folderId);
      out.push('  folder name: ' + folder.getName());
      const iter = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
      const names = [];
      while (iter.hasNext()) names.push(iter.next().getName());
      out.push('  Google Sheets files visible: ' + names.length);
      names.forEach(function (n) { out.push('    - ' + n); });
      if (!names.length) out.push('  -> nothing to import: check the folder id and that Google Ads has delivered a file.');
    } catch (e) {
      out.push('  DriveApp could not open that folder: ' + e.message);
    }
  }

  const msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

function importAndConsolidate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folderId = getFolderId(ss);
  if (!folderIdIsSet(folderId)) {
    safeAlert('Error', 'FOLDER_ID does not look like a Drive folder id (got: ' + folderId + '). Put the folder id in CONFIG.FOLDER_ID.');
    return;
  }

  const folder = DriveApp.getFolderById(folderId);
  const iter = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  const files = [];
  while (iter.hasNext()) {
    const f = iter.next();
    files.push({ file: f, name: f.getName().trim(), created: f.getDateCreated() });
  }
  // oldest first, so the most recent file wins during dedupe
  files.sort(function (a, b) { return a.created - b.created; });

  const groups = {};  // normalised report name -> { name, type, map: {"week||entity": row} }
  const fileLog = [];
  const tz = getTimeZone(ss);

  files.forEach(function (info) {
    try {
      const sheet = SpreadsheetApp.openById(info.file.getId()).getSheets()[0];
      const range = sheet.getDataRange();
      const values = range.getValues();          // real values, used for the week dates
      const display = range.getDisplayValues();  // what the user sees, used for metrics

      const headerRow = findHeaderRow(display);
      if (headerRow === -1) {
        fileLog.push([info.name, formatDate(info.created, tz), '', 'SKIPPED', 'no recognisable header row']);
        return;
      }
      const map = mapColumns(display[headerRow]);
      const type = typeFromMap(map);
      const gname = reportBaseName(info.name);
      const gkey = gname.toLowerCase();
      const g = groups[gkey] || (groups[gkey] = { name: gname, type: type, map: {} });
      g.type = type; // the most recent file decides the type; normally it never changes

      const fields = type === 'search' ? FIELDS_SEARCH : FIELDS_SHOP;
      let count = 0;

      for (let i = headerRow + 1; i < display.length; i++) {
        const week = normaliseWeek(values[i][map.week], display[i][map.week], tz);
        if (!week) continue;
        const entity = canonicalEntity(display[i][map.entity]);
        if (!entity) continue;

        const row = { w: week, s: entity };
        for (let k = 2; k < fields.length; k++) {
          const f = fields[k];
          row[f] = map[f] === undefined ? '' : parseMetric(display[i][map[f]]);
        }
        g.map[week + '||' + entity] = row;
        count++;
      }
      fileLog.push([info.name, formatDate(info.created, tz), type, 'OK -> ' + gname, count]);
    } catch (e) {
      fileLog.push([info.name, '', '', 'ERROR', e.message]);
    }
  });

  const manifest = [];
  const summary = [];
  const now = formatDate(new Date(), tz);
  Object.keys(groups).sort().forEach(function (gkey) {
    const g = groups[gkey];
    const rows = Object.keys(g.map).length;
    if (!rows) return;
    const tabName = sanitizeTabName(g.name);
    const header = g.type === 'search' ? HEADER_SEARCH : HEADER_SHOP;
    const fields = g.type === 'search' ? FIELDS_SEARCH : FIELDS_SHOP;
    const sheet = writeDataTab(ss, tabName, header, g.map, fields);
    manifest.push([tabName, sheet.getSheetId(), g.type, g.name, rows, now]);
    summary.push(tabName + ' (' + g.type + ', ' + rows + ' rows)');
  });

  writeManifest(ss, manifest);
  writeFileList(ss, fileLog);
  logEvent(ss, 'Consolidation', files.length + ' files, ' + manifest.length + ' reports: ' + summary.join('; '));

  safeAlert('Import finished',
    files.length + ' files read, ' + manifest.length + ' reports consolidated.\n' + summary.join('\n'));
}

// ---- header mapping (kept in step with scripts/lib/ai-parse.cjs) ------------

function normHeader(h) {
  return String(h == null ? '' : h)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function headerMatches(matcher, norm) {
  if (matcher.any) {
    return matcher.any.some(function (frag) { return norm.indexOf(frag) !== -1; });
  }
  return matcher.all.every(function (group) {
    return group.some(function (frag) { return norm.indexOf(frag) !== -1; });
  });
}

function mapColumns(headerCells) {
  const map = {};
  headerCells.forEach(function (h, i) {
    const norm = normHeader(h);
    if (!norm) return;
    for (let k = 0; k < FIELD_MATCHERS.length; k++) {
      const m = FIELD_MATCHERS[k];
      if (map[m.field] === undefined && headerMatches(m, norm)) { map[m.field] = i; return; }
    }
  });
  return map;
}

function typeFromMap(map) {
  let n = 0;
  ['pos', 'top', 'abs'].forEach(function (f) { if (map[f] !== undefined) n++; });
  return n >= 2 ? 'search' : 'shopping';
}

/** First row that maps to both a week column and a competitor column. */
function findHeaderRow(display) {
  for (let i = 0; i < Math.min(display.length, 8); i++) {
    const map = mapColumns(display[i]);
    if (map.week !== undefined && map.entity !== undefined) return i;
  }
  return -1;
}

// ---- values ----------------------------------------------------------------

/**
 * Parse a metric cell from its DISPLAY text into a number of percentage points
 * (46.75), or '< 10%' / '' for suppressed and not-applicable values.
 *
 * The decimal separator is decided from the value, never assumed: when both a dot
 * and a comma appear, the rightmost one is the decimal separator; a lone separator
 * is always a decimal point, because these metrics are percentages between 0 and
 * 100 and can never carry thousands grouping.
 */
function parseMetric(v) {
  let s = String(v == null ? '' : v).replace(/\\/g, '').replace(/"/g, '').replace(/\u00a0/g, ' ').trim();
  if (s === '' || s === '--' || s === '-') return '';
  const low = s.toLowerCase();
  if (low === 'n/a' || low === 'na') return '';
  if (/^<\s*10\s*%?$/.test(s)) {
    return CONFIG.WRITE_LT10_AS_NUMBER ? CONFIG.LT10_VALUE : '< 10%';
  }

  s = s.replace(/%/g, '').replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(s)) return '';

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let norm;
  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const tho = dec === '.' ? ',' : '.';
    norm = s.split(tho).join('').replace(dec, '.');
  } else {
    const sep = lastDot !== -1 ? '.' : (lastComma !== -1 ? ',' : null);
    if (sep === null) norm = s;
    else if (s.split(sep).length - 1 > 1) norm = s.split(sep).join('');
    else norm = s.replace(sep, '.');
  }

  const n = parseFloat(norm);
  return isNaN(n) ? '' : Math.round(n * 100) / 100;
}

/** Week as YYYY-MM-DD, from the real cell value when it is a date, else the text. */
function normaliseWeek(rawValue, displayValue, tz) {
  if (rawValue instanceof Date) return Utilities.formatDate(rawValue, tz, 'yyyy-MM-dd');
  const s = String(displayValue == null ? '' : displayValue).trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) return dmy[3] + '-' + pad2(dmy[2]) + '-' + pad2(dmy[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function pad2(x) { return String(x).length < 2 ? '0' + x : String(x); }

function canonicalEntity(name) {
  const s = String(name == null ? '' : name).trim();
  return YOU_LABELS.indexOf(s.toLowerCase()) !== -1 ? YOU : s;
}

/**
 * Base name of a report: strips a trailing date from the file name, so files
 * generated on different days land in the same group.
 * "Client account shopping 2026-07-06" -> "Client account shopping"
 */
function reportBaseName(name) {
  let s = String(name).trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/[\s_.\-]*\(?\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\)?$/, '');
    s = s.replace(/[\s_.\-]*\(?\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}\)?$/, '');
  } while (s !== prev && s);
  s = s.replace(/\s+/g, ' ').trim();
  return s || String(name).trim();
}

/** A tab name Sheets will accept: no forbidden characters, max 90, not reserved. */
function sanitizeTabName(name) {
  let s = String(name).replace(/[\[\]\*\?\/\\:]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  const clash = RESERVED_TABS.some(function (r) { return r.toLowerCase() === s.toLowerCase(); });
  if (clash) s = 'Report ' + s;
  return s || 'Report';
}

// ---- writing ---------------------------------------------------------------

function writeDataTab(ss, tabName, header, map, fields) {
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) sheet = ss.insertSheet(tabName);
  sheet.clearContents();

  const rows = Object.keys(map).map(function (k) {
    const r = map[k];
    return fields.map(function (f) { return r[f] === undefined ? '' : r[f]; });
  }).sort(function (a, b) {
    if (a[0] === b[0]) return String(a[1]).localeCompare(String(b[1]));
    return a[0] < b[0] ? -1 : 1;
  });

  const out = [header].concat(rows);
  sheet.getRange(1, 1, out.length, header.length).setValues(out);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  return sheet;
}

/**
 * Manifest tab in FIRST position: it is the one the published CSV returns without
 * a gid, so the dashboard uses it as the index to every other tab.
 */
function writeManifest(ss, rows) {
  let sheet = ss.getSheetByName(CONFIG.MANIFEST_TAB);
  if (!sheet) sheet = ss.insertSheet(CONFIG.MANIFEST_TAB, 0);
  sheet.clearContents();
  const header = ['Tab', 'Gid', 'Type', 'Report', 'Rows', 'Updated'];
  const out = [header].concat(rows.length ? rows : []);
  sheet.getRange(1, 1, out.length, header.length).setValues(out);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
}

function writeFileList(ss, fileLog) {
  let sheet = ss.getSheetByName('File List');
  if (!sheet) sheet = ss.insertSheet('File List');
  sheet.clearContents();
  const header = ['File name', 'Created', 'Type', 'Status', 'Rows / detail'];
  const out = [header].concat(fileLog.length ? fileLog : []);
  sheet.getRange(1, 1, out.length, header.length).setValues(out);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
}

/** Event log in the same sheet (tab "Log"). No external ids. */
function logEvent(ss, action, details) {
  let sheet = ss.getSheetByName('Log');
  if (!sheet) {
    sheet = ss.insertSheet('Log');
    sheet.appendRow(['Timestamp', 'Action', 'Detail']);
  }
  sheet.appendRow([new Date(), action, details || '']);
}

/**
 * The spreadsheet's timezone, with fallbacks.
 *
 * getSpreadsheetTimeZone() does not always return a usable string. A sheet
 * created through the Sheets API rather than in the interface defaults to
 * "Etc/GMT", which Apps Script fails to map, so this returns a non-string and
 * every Utilities.formatDate call downstream dies with "Invalid argument:
 * timeZone". Hit on 29 Jul 2026 with an API-created hub sheet. Falling back to
 * the script's own timezone keeps the consolidation working whatever state the
 * hub sheet is in; the dates involved are week-start dates and file timestamps,
 * so an hour either way changes nothing.
 */
function getTimeZone(ss) {
  let tz = null;
  try { tz = ss && ss.getSpreadsheetTimeZone(); } catch (e) { /* fall through */ }
  if (typeof tz === 'string' && tz) return tz;
  try { tz = Session.getScriptTimeZone(); } catch (e) { /* fall through */ }
  if (typeof tz === 'string' && tz) return tz;
  return 'Etc/UTC';
}

function formatDate(d, tz) {
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd HH:mm');
}

/**
 * True when FOLDER_ID actually holds a Drive folder id.
 *
 * This checks the SHAPE of the value rather than comparing it to the placeholder
 * string. Comparing to the placeholder looks obvious and is a trap: setting
 * FOLDER_ID with a find-and-replace across the whole file also rewrites the
 * comparison, so the guard ends up asking "is the id equal to the id?", answers
 * yes, and every run exits early reporting the id as unset while line 42 looks
 * perfectly correct. Cost an hour on 29 Jul 2026. A shape check cannot be
 * corrupted that way.
 *
 * Drive folder ids are long opaque strings of letters, digits, hyphens and
 * underscores. The placeholder contains no lowercase letters, so it fails.
 */
function folderIdIsSet(id) {
  if (typeof id !== 'string') return false;
  const s = id.trim();
  if (s.length < 20) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return false;
  return /[a-z]/.test(s);
}

function getFolderId(ss) {
  // priority: a named range called "driveID" if present, else CONFIG.FOLDER_ID
  try {
    const r = ss.getRangeByName('driveID');
    if (r && String(r.getValue()).trim()) return String(r.getValue()).trim();
  } catch (e) { /* no named range */ }
  return CONFIG.FOLDER_ID;
}

/**
 * Report the outcome without ever blocking the run.
 *
 * This deliberately does NOT use SpreadsheetApp.getUi().alert(). A modal alert
 * stops execution until somebody clicks OK **in the spreadsheet tab**, and when
 * you run the script from the Apps Script editor you are not looking at the
 * spreadsheet. The work finishes, the dialog opens unseen behind the editor, and
 * the editor appears to hang forever on a run that has actually already done its
 * job. Hit on the first real setup, 29 Jul 2026.
 *
 * A toast is non-blocking, needs no click, and is still visible if the sheet is
 * open. The message also goes to the execution log, which is where you look when
 * the daily trigger runs unattended and there is no UI at all.
 */
function safeAlert(title, msg) {
  Logger.log(title + ': ' + msg);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) ss.toast(msg, title, 10);
  } catch (e) { /* no spreadsheet context: the log above is the record */ }
}
