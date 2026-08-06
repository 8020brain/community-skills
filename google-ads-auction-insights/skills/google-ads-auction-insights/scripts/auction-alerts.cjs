#!/usr/bin/env node
/**
 * auction-alerts.cjs — wrapper that runs the Auction Insights key points for
 * every configured client, suitable for a morning routine.
 *
 * It scans clients/<client>/auction-insights/ (relative to the folder you run
 * it from, normally your brain root; override with --clients) and runs
 * analyze.cjs against whichever source each client has.
 *
 * Source per client, in order of preference:
 *   1. live.json  -> { "hub": "<published url>" }, uses the first Shopping tab of
 *                    the hub Manifest (normally the account-level report), or
 *                    { "shop": "<csv url>" }
 *   2. data.csv   -> a locally refreshed CSV
 *   3. _snapshot.psv -> the offline snapshot
 *
 * Never blocks the calling routine: a per-client failure is reported and the
 * scan carries on. Always exits 0.
 *
 * Usage: node auction-alerts.cjs [--clients <path>]
 *
 * Based on the original by Andrea Lombardi (Ads2AI).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function argValue(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const CLIENTS = path.resolve(argValue('--clients', 'clients'));
const ANALYZE = path.join(__dirname, 'analyze.cjs');

function findClients() {
  if (!fs.existsSync(CLIENTS)) return [];
  return fs.readdirSync(CLIENTS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => ({ name: d.name, dir: path.join(CLIENTS, d.name, 'auction-insights') }))
    .filter(c => fs.existsSync(c.dir));
}

/**
 * Normalise a published-sheet URL to its CSV-serving base.
 *
 * The Publish to web dialog hands you a URL ending in `/pubhtml`, not `/pub`, and
 * `/pubhtml?output=csv` serves HTML rather than CSV. SKILL.md tells people to
 * paste the dialog's URL as-is, so this normalisation is what makes that true.
 *
 * MUST match `hubBase` in build-dashboard.cjs. It did not, from 29 Jul to 5 Aug
 * 2026: the manifest fetch here got HTML, failed the header check, returned null,
 * and pickSource fell through to the offline `_snapshot*.psv`. The alerts then
 * printed a perfectly normal-looking report off a nine-day-old snapshot with no
 * error anywhere. Silent staleness, again — do not let these two drift apart.
 */
function hubBase(url) {
  return url.split('?')[0].replace(/\/+$/, '').replace(/\/pubhtml$/i, '/pub');
}

/** Split a CSV line honouring quotes: report names can contain commas. */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * From the hub Manifest, the CSV URL of the first usable report tab.
 * Prefers a Shopping tab, then falls back to a Search tab — a search-only
 * account (any lead-gen account) has no Shopping tab at all, and returning
 * null for those made the alerts pass report "no data source".
 */
function shopUrlFromHub(hub) {
  try {
    const manifest = execSync(`curl -sL "${hubBase(hub)}?output=csv"`, { encoding: 'utf8', timeout: 20000 });
    const lines = manifest.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return null;
    const hdr = splitCsvLine(lines[0]).map(x => x.trim().toLowerCase());
    if (hdr[0] !== 'tab' || hdr[1] !== 'gid') return null;

    let searchGid = null;
    for (let i = 1; i < lines.length; i++) {
      const c = splitCsvLine(lines[i]).map(x => x.trim());
      if (c.length < 3 || !/^\d+$/.test(c[1])) continue;
      const type = c[2].toLowerCase();
      if (type.startsWith('shop')) {
        return `${hubBase(hub)}?gid=${c[1]}&single=true&output=csv`;
      }
      if (!searchGid && type.startsWith('search')) searchGid = c[1];
    }
    if (searchGid) return `${hubBase(hub)}?gid=${searchGid}&single=true&output=csv`;
  } catch (e) { /* falls through */ }
  return null;
}

function liveUrl(dir) {
  const jsonFile = path.join(dir, 'live.json');
  if (!fs.existsSync(jsonFile)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    if (raw && typeof raw.hub === 'string' && raw.hub.trim()) {
      const url = shopUrlFromHub(raw.hub.trim());
      if (url) return url;
    }
    if (raw && typeof raw.shop === 'string' && raw.shop.trim()) return raw.shop.trim();
  } catch (e) { /* ignore a malformed live.json and fall back to files */ }
  return null;
}

function pickSource(dir) {
  const url = liveUrl(dir);
  if (url) {
    const tmp = path.join(dir, '.live-cache.csv');
    try {
      execSync(`curl -sL "${url}" -o "${tmp}"`, { timeout: 20000 });
      if (fs.existsSync(tmp) && fs.statSync(tmp).size > 50) return tmp;
    } catch (e) { /* falls through */ }
  }
  // '_snapshot-search.psv' is the search-account equivalent of '_snapshot.psv';
  // without it, a search-only client falls through to "no data source".
  for (const f of ['data.csv', '_snapshot.psv', '_snapshot-search.psv']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const clients = findClients();
if (!clients.length) {
  console.log(`Auction Insights: no client configured (looked for */auction-insights/ under ${CLIENTS}).`);
  process.exit(0);
}

let totalAlerts = 0;
clients.forEach(c => {
  const src = pickSource(c.dir);
  if (!src) { console.log(`\nAuction Insights — ${c.name}: no data source.`); return; }
  try {
    const out = execSync(`node "${ANALYZE}" "${src}" --label "${c.name}"`, { encoding: 'utf8' });
    process.stdout.write(out);
    totalAlerts += (out.match(/^\s+! /gm) || []).length;
  } catch (e) {
    console.log(`\nAuction Insights — ${c.name}: analysis failed (${e.message}).`);
  }
});

console.log(`\nAuction Insights overall: ${totalAlerts ? totalAlerts + ' thing' + (totalAlerts === 1 ? '' : 's') + ' worth a look' : 'nothing that needs attention'}.`);
