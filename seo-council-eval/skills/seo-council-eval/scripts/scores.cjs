#!/usr/bin/env node
/**
 * scores.cjs - append to, validate and summarise the council's score history.
 *
 * Why this exists: ten runs produced ten prose reports and nothing that could be
 * compared. Dimension scores existed only as sentences, so nobody could trend a
 * client, spot scoring drift, or check that a run had used the right weights.
 * Building this file immediately surfaced a weights defect nobody had noticed
 * (see `validate`), which is the argument for it in one line.
 *
 * Usage:
 *   node scores.cjs validate            # recompute every index, check weights
 *   node scores.cjs summary             # history, by client and by vertical
 *   node scores.cjs trend <client>      # one client over time
 *   node scores.cjs append '<json>'     # add a run (validates before writing)
 *
 * Exit codes: 0 ok, 1 validation failures, 2 bad usage.
 */

const fs = require('fs');
const path = require('path');

const DIMS = ['entity', 'geo', 'intent', 'eeat', 'onpage', 'fit'];
const DIM_LABEL = { entity: 'Entity', geo: 'GEO/AEO', intent: 'Intent', eeat: 'E-E-A-T', onpage: 'On-page', fit: 'Fit' };
const SKILL_DIR = path.resolve(__dirname, '..');

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

const isAgencyBrain = d => fs.existsSync(path.join(d, 'CLAUDE.md')) && fs.existsSync(path.join(d, 'clients'));
const isGitRoot = d => fs.existsSync(path.join(d, '.git'));

// Where the scores store lives. In an Agency Brain it is the shared, synced
// location. Outside one, this skill still has to record and read runs, because
// scores.jsonl is the backbone of calibration-method.md: without it a standalone
// user cannot build their own anchors. So fall back to the project's git root,
// then the working directory. The store is always resolvable; there is no
// "cannot locate a root" failure any more.
const STORE_ROOT = findUp(process.cwd(), isAgencyBrain)
  || findUp(__dirname, isAgencyBrain)
  || findUp(process.cwd(), isGitRoot)
  || process.cwd();
const STORE = path.join(STORE_ROOT, 'data', 'councils', 'seo-council-eval', 'scores.jsonl');

/** Canonical weights, parsed from the overlay files so they cannot drift apart. */
function canonicalWeights() {
  const map = {};
  const rowKey = label => {
    const l = label.toLowerCase();
    if (l.includes('entity')) return 'entity';
    if (l.includes('geo') || l.includes('aeo')) return 'geo';
    if (l.includes('intent')) return 'intent';
    if (l.includes('e-a-t') || l.includes('eeat')) return 'eeat';
    if (l.includes('on-page') || l.includes('onpage')) return 'onpage';
    if (l.includes('fit')) return 'fit';
    return null;
  };
  for (const v of ['lead-gen', 'b2b', 'local', 'ecommerce']) {
    const f = path.join(SKILL_DIR, 'references', `overlay-${v}.md`);
    if (!fs.existsSync(f)) continue;
    const w = {}, core = {};
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!/^\|/.test(line)) continue;
      const cells = line.split('|').map(s => s.trim()).filter(Boolean);
      if (cells.length < 3) continue;
      const key = rowKey(cells[0]);
      if (!key) continue;
      const nums = cells.slice(1).map(c => (c.match(/(\d+)\s*%/) || [])[1]).filter(Boolean);
      if (nums.length >= 2) { core[key] = +nums[0] / 100; w[key] = +nums[1] / 100; }
    }
    if (Object.keys(w).length === 6) map[v] = w;
    if (Object.keys(core).length === 6 && !map.core) map.core = core;
  }
  return map;
}

function load() {
  if (!STORE || !fs.existsSync(STORE)) return [];
  return fs.readFileSync(STORE, 'utf8').split('\n').filter(l => l.trim()).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`Line ${i + 1} is not valid JSON: ${e.message}`); }
  });
}

const round2 = n => Math.round(n * 100) / 100;

function computeIndex(rec) {
  return round2(DIMS.reduce((s, d) => s + (rec.dimensions[d] ?? 0) * (rec.weights[d] ?? 0), 0));
}

function validateRec(rec, canon) {
  const errs = [], warns = [], infos = [];
  for (const f of ['run_id', 'date', 'vertical', 'dimensions', 'weights', 'index']) {
    if (rec[f] === undefined) errs.push(`missing field: ${f}`);
  }
  if (errs.length) return { errs, warns, infos };

  for (const d of DIMS) {
    if (typeof rec.dimensions[d] !== 'number') errs.push(`dimension ${d} is not a number`);
    if (typeof rec.weights[d] !== 'number') errs.push(`weight ${d} is not a number`);
  }
  if (errs.length) return { errs, warns, infos };

  const wsum = round2(DIMS.reduce((s, d) => s + rec.weights[d], 0));
  if (wsum !== 1) errs.push(`weights sum to ${wsum}, not 1.0`);

  const computed = computeIndex(rec);
  const stated = rec.index;
  const inRange = rec.index_range && computed >= rec.index_range[0] - 0.01 && computed <= rec.index_range[1] + 0.01;
  if (Math.abs(computed - stated) > 0.011 && !inRange) {
    errs.push(`stated index ${stated} but dimensions x weights give ${computed}`);
  }

  // The check that found a real defect: does the weighting match the vertical?
  const expect = canon[rec.vertical];
  if (expect) {
    const off = DIMS.filter(d => Math.abs(rec.weights[d] - expect[d]) > 0.001);
    if (off.length) {
      const detail = off.map(d => `${DIM_LABEL[d]} ${(rec.weights[d] * 100)}% vs overlay ${(expect[d] * 100)}%`).join(', ');
      const corrected = round2(DIMS.reduce((s, d) => s + rec.dimensions[d] * expect[d], 0));
      // A weighting slip that does not move the index is a process note, not a
      // defect in the number. Separating the two keeps `validate` quiet enough
      // that a real warning still reads as one.
      if (Math.abs(corrected - rec.index) > 0.011) {
        warns.push(`weights do not match the ${rec.vertical} overlay (${detail}); correct weighting gives ${corrected}, so the published index is wrong`);
      } else {
        infos.push(`used core weights rather than the ${rec.vertical} overlay (${detail}), but the index is unaffected at ${corrected}`);
      }
    }
  }
  return { errs, warns, infos };
}

function cmdValidate() {
  const recs = load(), canon = canonicalWeights();
  if (!recs.length) { console.log('No scores recorded yet.'); return; }
  let bad = 0, warned = 0, noted = 0;
  for (const r of recs) {
    const { errs, warns, infos } = validateRec(r, canon);
    if (errs.length) {
      bad++; console.log(`FAIL  ${r.run_id}`);
      errs.forEach(e => console.log(`        ${e}`));
    } else if (warns.length) {
      warned++; console.log(`WARN  ${r.run_id}`);
      warns.forEach(w => console.log(`        ${w}`));
    } else if (infos.length) {
      noted++; console.log(`note  ${r.run_id}`);
      infos.forEach(i => console.log(`        ${i}`));
    }
  }
  // Referential integrity on supersedes links.
  const ids = new Set(recs.map(r => r.run_id));
  for (const r of recs) {
    for (const k of ['supersedes', 'superseded_by']) {
      if (r[k] && !ids.has(r[k])) { bad++; console.log(`FAIL  ${r.run_id}\n        ${k} points at unknown run ${r[k]}`); }
    }
  }
  console.log(`\n${recs.length - bad} of ${recs.length} records valid, ${warned} warning(s), ${noted} note(s).`);
  if (bad) process.exit(1);
}

function live(recs) { return recs.filter(r => !r.superseded_by); }

function cmdSummary() {
  const recs = load(), canon = canonicalWeights();
  if (!recs.length) { console.log('No scores recorded yet.'); return; }
  const active = live(recs);

  console.log(`# Council score history\n`);
  console.log(`${recs.length} records, ${active.length} current, ${recs.length - active.length} superseded.\n`);

  console.log('## Runs, newest first\n');
  const rows = [...active].sort((a, b) => (b.date + b.run_id).localeCompare(a.date + a.run_id));
  console.log('  date        index  vert       mode         client / label');
  for (const r of rows) {
    const who = r.standalone ? `(prospect) ${r.label}` : `${r.client} / ${r.label}`;
    const panel = r.panel ? ` [${r.panel}]` : '';
    console.log(`  ${r.date}  ${String(r.index).padStart(5)}  ${(r.vertical || '?').padEnd(9)}  ${(r.mode || '?').padEnd(11)}  ${who}${panel}`);
  }

  console.log('\n## Dimension means across current runs\n');
  console.log('  dimension   mean   min   max   n');
  for (const d of DIMS) {
    const v = active.map(r => r.dimensions[d]).filter(n => typeof n === 'number');
    if (!v.length) continue;
    const mean = round2(v.reduce((a, b) => a + b, 0) / v.length);
    console.log(`  ${DIM_LABEL[d].padEnd(10)}  ${String(mean).padStart(4)}  ${String(Math.min(...v)).padStart(4)}  ${String(Math.max(...v)).padStart(4)}  ${v.length}`);
  }

  console.log('\n## By vertical\n');
  const byV = {};
  for (const r of active) (byV[r.vertical] ||= []).push(r.index);
  for (const [v, xs] of Object.entries(byV)) {
    console.log(`  ${v.padEnd(10)}  n=${xs.length}  mean ${round2(xs.reduce((a, b) => a + b, 0) / xs.length)}  range ${Math.min(...xs)} to ${Math.max(...xs)}`);
  }

  const modes = {};
  for (const r of active) (modes[r.mode] ||= []).push(r.index);
  console.log('\n## By mode\n');
  for (const [m, xs] of Object.entries(modes)) {
    console.log(`  ${String(m).padEnd(12)}  n=${xs.length}  mean ${round2(xs.reduce((a, b) => a + b, 0) / xs.length)}`);
  }

  // The gap that matters most for the skill's stated purpose.
  const urls = {};
  for (const r of recs) if (r.url) (urls[r.url] ||= []).push(r);
  const remeasured = Object.entries(urls).filter(([, rs]) => {
    const dates = new Set(rs.map(r => r.date));
    return dates.size > 1;
  });
  // A repeat only evidences sensitivity if the PAGE changed between runs. A
  // corrected re-run on the same page state evidences the opposite: that the
  // instrument holds still. Records carry page_changed_since_prior so the two
  // can never be conflated, because conflating them would let the skill claim
  // its central promise on evidence that does not support it.
  const real = remeasured.filter(([, rs]) => rs.some(r => r.page_changed_since_prior === true));
  console.log('\n## Sensitivity evidence\n');
  if (!real.length) {
    console.log('  NONE. No page has been scored, changed, and scored again.');
    if (remeasured.length) {
      console.log(`\n  ${remeasured.length} page(s) were scored on more than one date, but in every case`);
      console.log('  the page itself was unchanged between runs:');
      for (const [u, rs] of remeasured) {
        const s = rs.sort((a, b) => a.date.localeCompare(b.date));
        console.log(`\n    ${u}`);
        s.forEach(r => console.log(`      ${r.date}  index ${r.index}${r.page_changed_since_prior === false ? '  (page unchanged)' : ''}`));
      }
    }
    console.log('\n  Repeatability is well evidenced and sensitivity is not evidenced at all.');
    console.log('  The instrument reads the same twice on the same page. Nothing yet shows');
    console.log('  it moves when the page improves. Until one page is scored, fixed, and');
    console.log('  scored again, treat the index as a consistent ranking, not a measure of');
    console.log('  change, and do not report a delta as progress.');
  } else {
    for (const [u, rs] of real) {
      const s = rs.sort((a, b) => a.date.localeCompare(b.date));
      console.log(`  ${u}`);
      s.forEach(r => console.log(`    ${r.date}  ${r.index}${r.page_changed_since_prior ? '  (page changed since prior run)' : ''}`));
    }
  }

  const canonMissing = active.filter(r => {
    const e = canon[r.vertical];
    return e && DIMS.some(d => Math.abs(r.weights[d] - e[d]) > 0.001);
  });
  if (canonMissing.length) {
    console.log(`\n## Weighting warnings\n\n  ${canonMissing.length} current run(s) used weights that do not match their declared`);
    console.log('  vertical overlay. Run `validate` for detail.');
  }
}

function cmdTrend(client) {
  const recs = load().filter(r => r.client === client);
  if (!recs.length) { console.log(`No runs recorded for client "${client}".`); return; }
  console.log(`# ${client}\n`);
  const byUrl = {};
  for (const r of recs) (byUrl[r.url || r.label] ||= []).push(r);
  for (const [u, rs] of Object.entries(byUrl)) {
    console.log(`${u}`);
    const s = rs.sort((a, b) => a.date.localeCompare(b.date));
    console.log('  date        index  ' + DIMS.map(d => DIM_LABEL[d].padStart(8)).join(''));
    for (const r of s) {
      const flag = r.superseded_by ? ' (superseded)' : '';
      console.log(`  ${r.date}  ${String(r.index).padStart(5)}  ` +
        DIMS.map(d => String(r.dimensions[d]).padStart(8)).join('') + flag);
    }
    console.log('');
  }
}

function cmdAppend(json) {
  if (!json) { console.error('append needs a JSON object as its argument'); process.exit(2); }
  let rec;
  try { rec = JSON.parse(json); } catch (e) { console.error(`Not valid JSON: ${e.message}`); process.exit(2); }
  const canon = canonicalWeights();
  if (rec.index === undefined && rec.dimensions && rec.weights) rec.index = computeIndex(rec);
  const { errs, warns } = validateRec(rec, canon);
  if (errs.length) {
    console.error(`Refusing to append ${rec.run_id || '(no run_id)'}:`);
    errs.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
  const existing = load();
  if (existing.some(r => r.run_id === rec.run_id)) {
    console.error(`A record with run_id "${rec.run_id}" already exists. Use a distinct id.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.appendFileSync(STORE, JSON.stringify(rec) + '\n');
  console.log(`Appended ${rec.run_id} (index ${rec.index}). Store: ${STORE}`);
  warns.forEach(w => console.log(`  warning: ${w}`));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'validate') cmdValidate();
else if (cmd === 'summary') cmdSummary();
else if (cmd === 'trend') cmdTrend(rest[0]);
else if (cmd === 'append') cmdAppend(rest[0]);
else { console.error('usage: node scores.cjs validate | summary | trend <client> | append \'<json>\''); process.exit(2); }
