#!/usr/bin/env node
/**
 * data-manifest.cjs - enumerate the evidence available for a client before
 * assembling a council context pack.
 *
 * Why this exists: three separate council runs have recorded query evidence as
 * "absent" while it sat in the client's data folder. Every one of those was a
 * human (or model) checking one plausibly-named file and generalising. The
 * defence is not a better warning, it is a lookup that reports row counts for
 * everything at once, so "which files have data" stops being a judgment call.
 *
 * Usage:
 *   node data-manifest.cjs <client-slug>
 *   node data-manifest.cjs example-client
 *   node data-manifest.cjs example-client --json
 *
 * Exit codes: 0 ok, 1 client not found, 2 bad usage.
 */

const fs = require('fs');
const path = require('path');

// Filename hints are a fast path, not the definition. The lesson that motivated
// this whole script is that a hardcoded filename becomes a blinder: `search80.csv`
// is the current gads-proxy export name, but a stranger exporting from the Google
// Ads UI gets "Search terms.csv", and an account on a different pipeline gets
// something else again. So a file is classified as a search-terms export if its
// filename hints at one OR its header actually carries a search-term column. The
// header check is the reliable one; the filename hints only widen the net.
const SEARCH_TERM_HINTS = ['search80', 'search_terms', 'searchterms', 'search-terms', 'search term'];
const QUERY_FILE_HINTS = ['keyword', 'query', 'pages', ...SEARCH_TERM_HINTS];

// A header column that means "the string the user actually typed". Google Ads
// writes "Search term"; some exports write "Search query" or "Query". Match a
// whole column, not a substring, so a "Keyword" file is not misread as one.
const SEARCH_TERM_COLUMN = /^"?\s*(search\s*term|search\s*query|query)\s*"?$/i;

/**
 * Read a CSV/TSV header row and report whether it carries a search-term column.
 * Reads only the first line, so it is cheap even on large exports. Returns null
 * for a file it cannot read or that has no header.
 */
function hasSearchTermColumn(file) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch { return null; }
  try {
    const buf = Buffer.alloc(8192);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    if (!read) return null;
    let text = buf.toString('utf8', 0, read);
    const nl = text.indexOf('\n');
    if (nl !== -1) text = text.slice(0, nl);
    text = text.replace(/\r$/, '');
    const delimiter = text.includes('\t') && !text.includes(',') ? '\t' : ',';
    return text.split(delimiter).some(cell => SEARCH_TERM_COLUMN.test(cell.trim()));
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/** Walk up from `start` looking for a directory that satisfies `test`. */
function findUp(start, test) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (test(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const hasClients = d => fs.existsSync(path.join(d, 'clients'));
const isGitRoot = d => fs.existsSync(path.join(d, '.git'));

/** Count data rows (excluding a header line) without slurping huge files into memory. */
function countRows(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return { rows: null, error: 'unreadable' };
  }
  try {
    const buf = Buffer.alloc(65536);
    let lines = 0;
    let bytes = 0;
    let lastByte = null;
    let read;
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      bytes += read;
      for (let i = 0; i < read; i++) {
        if (buf[i] === 10) lines++;
        lastByte = buf[i];
      }
    }
    // A final line with no trailing newline still counts.
    if (bytes > 0 && lastByte !== 10) lines++;
    return { rows: Math.max(0, lines - 1), bytes };
  } catch {
    return { rows: null, error: 'read failed' };
  } finally {
    fs.closeSync(fd);
  }
}

function human(n) {
  if (n === null || n === undefined) return '?';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return null;
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    const entry = { name, bytes: st.size, mtime: st.mtime.toISOString().slice(0, 10) };
    if (/\.(csv|tsv)$/i.test(name)) {
      Object.assign(entry, countRows(full));
      entry.searchTermColumn = hasSearchTermColumn(full) === true;
    }
    out.push(entry);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const slug = args.find(a => !a.startsWith('-'));
  if (!slug) {
    console.error('usage: node data-manifest.cjs <client-slug> [--json]');
    process.exit(2);
  }

  // Find a project that has a clients/ folder: an Agency Brain, or any project
  // laid out the same way, or the git root, or just the working directory.
  const root = findUp(process.cwd(), hasClients) || findUp(__dirname, hasClients)
    || findUp(process.cwd(), isGitRoot) || process.cwd();

  const clientsDir = path.join(root, 'clients');
  if (!fs.existsSync(clientsDir)) {
    console.error(`No clients/ folder found above ${process.cwd()}.`);
    console.error('This helper inventories platform-export data under clients/<slug>/data/,');
    console.error('which is the Agency Brain layout. It is optional: it only helps when you');
    console.error('have exports (Google Ads search terms, GSC CSVs) to check. If your exports');
    console.error('live elsewhere, list that folder yourself instead of running this.');
    process.exit(2);
  }

  const clientDir = path.join(clientsDir, slug);
  if (!fs.existsSync(clientDir)) {
    console.error(`No such client: clients/${slug}`);
    const available = fs.readdirSync(clientsDir).filter(d => !d.startsWith('.'));
    if (available.length) console.error(`Available: ${available.join(', ')}`);
    process.exit(1);
  }

  const dataFiles = scanDir(path.join(clientDir, 'data'));
  const reportFiles = scanDir(path.join(clientDir, 'reports'));

  let fetchStatus = null;
  const fsPath = path.join(clientDir, 'data', '_fetch-status.json');
  if (fs.existsSync(fsPath)) {
    try { fetchStatus = JSON.parse(fs.readFileSync(fsPath, 'utf8')); } catch { /* ignore */ }
  }

  const withData = (dataFiles || []).filter(f => f.rows > 0);
  const empty = (dataFiles || []).filter(f => f.rows === 0);
  const nameHints = (f, hints) => hints.some(h => f.name.toLowerCase().includes(h));
  const searchTerms = withData.filter(f => f.searchTermColumn || nameHints(f, SEARCH_TERM_HINTS));
  // Query evidence is the wider bucket: search-terms files plus keyword/query/page
  // files. A search-terms file detected only by its header still belongs here.
  const queryEvidence = withData.filter(f => searchTerms.includes(f) || nameHints(f, QUERY_FILE_HINTS));

  if (asJson) {
    console.log(JSON.stringify({ slug, dataFiles, reportFiles, fetchStatus, queryEvidence, searchTerms }, null, 2));
    return;
  }

  console.log(`# Evidence manifest: ${slug}\n`);

  if (!dataFiles) {
    console.log('## data/\n\nNo `data/` directory. There is genuinely no platform export for this client.\n');
  } else {
    console.log(`## data/  (${dataFiles.length} files, ${withData.length} with rows, ${empty.length} empty)\n`);
    if (fetchStatus) {
      console.log(`Last export run: ${fetchStatus.lastRun || 'unknown'} (${fetchStatus.days || '?'} days, source: ${fetchStatus.source || 'unknown'})`);
      const errs = fetchStatus.errors && Object.keys(fetchStatus.errors).length;
      if (errs) console.log(`WARNING: the export reported ${errs} error(s). Check _fetch-status.json.`);
      console.log('');
    }
    if (withData.length) {
      console.log('### Files WITH data\n');
      for (const f of withData) console.log(`  ${String(human(f.rows)).padStart(8)} rows  ${f.name}  (${f.mtime})`);
      console.log('');
    }
    if (empty.length) {
      console.log('### Files that are header-only or empty\n');
      console.log('  ' + empty.map(f => f.name).join(', ') + '\n');
      console.log('  These are NOT evidence of absence in general. Check the populated list above\n  before writing that any category of evidence is missing.\n');
    }
  }

  console.log('## Query evidence specifically\n');
  if (searchTerms.length) {
    console.log('SEARCH TERMS PRESENT. These are the strings people actually typed and they');
    console.log('outrank every other paid file. Read them before scoring intent:\n');
    for (const f of searchTerms) console.log(`  ${human(f.rows)} rows  clients/${slug}/data/${f.name}`);
  } else if (queryEvidence.length) {
    console.log('No search-terms export with rows, but related query files exist:\n');
    for (const f of queryEvidence) console.log(`  ${human(f.rows)} rows  clients/${slug}/data/${f.name}`);
  } else {
    console.log('No populated query files found locally. This may be a genuine absence.');
  }
  console.log('');

  console.log('## Organic search data: NOT covered by this script\n');
  console.log('This script only sees the filesystem. GSC is reached over MCP, so check it');
  console.log('yourself before writing "no GSC data" in the pack:\n');
  console.log('  1. management-projects                 -> find the project_id, confirm verified');
  console.log('  2. gsc-keywords project_id=<id> date_from=<90d ago>');
  console.log('  3. gsc-pages    project_id=<id> date_from=<90d ago>\n');
  console.log('The `gsc-*` endpoints are a passthrough to the client\'s own Search Console, not');
  console.log('Ahrefs proprietary data, and they have cost zero API units. The house rule against');
  console.log('Ahrefs for query data does not apply to them. A 2026-08-12 run scored a whole page');
  console.log('at moderate confidence reporting "no GSC export" while 90 days of data sat there.\n');

  // Blueprints and topical maps land in different folders depending on which
  // skill produced them and when: reports/ for most, data/ (sometimes a
  // per-domain subfolder) for topical-map outputs. Looking in only one place is
  // how a run wrongly concludes it is in fallback mode with no assignment, which
  // is the same class of error this whole script exists to prevent.
  const found = { blueprint: [], map: [] };
  const seen = new Set();
  (function walk(dir, depth) {
    if (depth > 3 || !fs.existsSync(dir) || seen.has(dir)) return;
    seen.add(dir);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      const rel = path.relative(clientDir, full);
      if (/blueprint/i.test(e.name)) found.blueprint.push(rel);
      else if (/topical[-_ ]?map|pillar-hub|spoke-articles/i.test(e.name)) found.map.push(rel);
    }
  })(clientDir, 0);

  console.log('## Blueprint and topical map\n');
  console.log(found.blueprint.length
    ? `Entity blueprint -> CONFORMANCE MODE\n  ${found.blueprint.join('\n  ')}`
    : 'No entity blueprint found anywhere under the client folder  -> FALLBACK MODE for the entity seat');
  console.log('');
  console.log(found.map.length
    ? `Topical map present\n  ${found.map.join('\n  ')}`
    : 'No topical map found anywhere under the client folder  -> the page has no recorded assignment');
  console.log('');
}

main();
