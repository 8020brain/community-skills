#!/usr/bin/env node
/**
 * refresh-dashboards.cjs — rebuilds every configured client's Auction Insights
 * dashboard so the embedded data is current, then reports what changed.
 *
 * Why this exists: the hub sheet refreshes itself (Google Ads writes a new file
 * into Drive, the Apps Script daily trigger consolidates it), but the dashboard
 * HTML only holds the data embedded at its LAST BUILD. Opened by double-click
 * (file://) the browser cannot fetch the hub, so without a rebuild the page goes
 * quietly stale. This closes that last gap.
 *
 * Scans clients/<client>/auction-insights/ (relative to the folder you run it
 * from, normally your brain root; override with --clients) and runs
 * build-dashboard.cjs for each one. The page title is read back from the
 * existing HTML so a hand-set title survives every rebuild.
 *
 * Never blocks the calling routine: a per-client failure is reported and the
 * scan carries on. Always exits 0.
 *
 * Usage: node refresh-dashboards.cjs [--clients <path>] [--quiet]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function argValue(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const QUIET = process.argv.includes('--quiet');
const CLIENTS = path.resolve(argValue('--clients', 'clients'));
const BUILD = path.join(__dirname, 'build-dashboard.cjs');

function findClients() {
  if (!fs.existsSync(CLIENTS)) return [];
  return fs.readdirSync(CLIENTS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({ name: d.name, dir: path.join(CLIENTS, d.name, 'auction-insights') }))
    .filter(c => fs.existsSync(c.dir));
}

/**
 * Newest data week embedded in a built dashboard.
 *
 * Why this exists: a frozen scheduled report is INVISIBLE from every other
 * signal. Google Ads keeps writing a file every morning, the Apps Script keeps
 * consolidating it, the hub's manifest timestamp keeps saying today — and the
 * data never advances. Observed on the pilot account 29 Jul - 4 Aug 2026: a scheduled report
 * created with a CUSTOM date range froze at its end date and nothing noticed for
 * six days. The only reliable tell is the newest week in the data itself.
 *
 * Reads the `"weeks":[...]` arrays the build embeds, so it deliberately ignores
 * the build timestamp — mistaking that for a data week is exactly how the freeze
 * was missed twice by eye.
 */
function newestWeek(htmlPath) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    let newest = null;
    for (const m of html.matchAll(/"weeks":\s*\[([^\]]*)\]/g)) {
      for (const d of m[1].matchAll(/"(\d{4}-\d{2}-\d{2})"/g)) {
        if (!newest || d[1] > newest) newest = d[1];
      }
    }
    return newest;
  } catch (e) {
    return null;
  }
}

/** Whole days between a YYYY-MM-DD week start and today, UTC. */
function daysOld(week) {
  const then = Date.parse(`${week}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - then) / 86400000);
}

/**
 * Weeks start Monday. Google does report the in-progress week (the pilot
 * account's 29 Jul file already carried w/c 27 Jul), so on a healthy account the newest week is
 * usually 0-6 days old, allowing a day or two of reporting lag on top.
 *
 * 12 leaves several days of slack over that while still catching a freeze inside
 * a fortnight. TUNE THIS once a healthy account has been watched across a full
 * week — the exact reporting lag has not been measured, only inferred.
 */
const STALE_DAYS = 12;

/** Prettify a folder slug only as a last resort: "acme-widgets-london". */
function slugToTitle(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Reuse the title already on the page. build-dashboard.cjs takes the title as an
 * argument, so without this every rebuild would flatten a hand-set title back to
 * the slug.
 */
function existingTitle(htmlPath, slug) {
  try {
    if (fs.existsSync(htmlPath)) {
      const m = fs.readFileSync(htmlPath, 'utf8').match(/<title>([^<]+)<\/title>/i);
      if (m && m[1].trim()) return m[1].trim();
    }
  } catch (e) { /* fall through to the slug */ }
  return `${slugToTitle(slug)}: Auction Insights`;
}

const clients = findClients();
if (!clients.length) {
  console.log(`Auction Insights: no dashboard configured (looked for */auction-insights/ under ${CLIENTS}).`);
  process.exit(0);
}

let rebuilt = 0;
let failed = 0;
const lines = [];
const stale = [];

clients.forEach(c => {
  const out = path.join(c.dir, 'auction-insights.html');
  const shop = path.join(c.dir, '_snapshot.psv');
  const srch = path.join(c.dir, '_snapshot-search.psv');
  const live = fs.existsSync(path.join(c.dir, 'live.json'));
  const before = fs.existsSync(out) ? fs.statSync(out).size : 0;

  try {
    execFileSync('node', [BUILD, shop, srch, out, existingTitle(out, c.name)], {
      encoding: 'utf8',
      timeout: 120000,
    });
    const after = fs.existsSync(out) ? fs.statSync(out).size : 0;
    rebuilt++;
    const mode = live ? 'live hub' : 'snapshot only';
    const week = newestWeek(out);
    const age = week ? daysOld(week) : null;
    if (age !== null && age > STALE_DAYS) {
      stale.push({ name: c.name, week, age });
    }
    const freshness = week
      ? ` — newest week ${week}${age !== null && age > STALE_DAYS ? ` (${age}d old, STALE)` : ''}`
      : ' — no data weeks found';
    lines.push(`  ${c.name}: rebuilt (${mode})${before && after !== before ? ' — data changed' : ''}${freshness}`);
  } catch (e) {
    failed++;
    // stderr carries the real reason; the message alone is usually just the exit code
    const why = (e.stderr || e.message || '').toString().trim().split('\n').pop();
    lines.push(`  ${c.name}: REBUILD FAILED — ${why}`);
  }
});

if (!QUIET || failed || stale.length) {
  console.log('Auction Insights dashboards:');
  lines.forEach(l => console.log(l));
}
console.log(
  `Auction Insights: ${rebuilt} dashboard${rebuilt === 1 ? '' : 's'} rebuilt` +
  (failed ? `, ${failed} FAILED` : '') +
  (stale.length ? `, ${stale.length} STALE` : '') + '.'
);

// Loud on purpose: a frozen report looks healthy from every other angle.
if (stale.length) {
  console.log('');
  console.log('⚠️  AUCTION INSIGHTS DATA HAS STOPPED MOVING:');
  stale.forEach(s => {
    console.log(`  ${s.name}: newest week is ${s.week}, ${s.age} days old.`);
  });
  console.log('');
  console.log('  Files still arriving daily does NOT mean the data is current.');
  console.log('  Most likely cause: the Google Ads scheduled report was created with a');
  console.log('  CUSTOM date range, which freezes at its end date. Open the campaign\'s');
  console.log('  Auction insights view, set the date picker to a PRESET ("Last 30 days" —');
  console.log('  the label must NOT read "Custom"), then Download > Schedule a replacement');
  console.log('  with the same file name and folder. See SKILL.md > Setup gotchas.');
}

process.exit(0);
