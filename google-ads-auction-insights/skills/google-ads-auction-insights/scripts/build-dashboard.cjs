#!/usr/bin/env node
/**
 * build-dashboard.cjs
 * Builds the interactive Auction Insights dashboard, with ONE TAB PER REPORT,
 * from the hub sheet (live mode) or from local snapshot files.
 *
 * Usage:
 *   node build-dashboard.cjs [--inspect] [shopping.psv] [search.psv] [output.html] [title]
 *
 * Defaults:
 *   shopping = _snapshot.psv          (same folder as the script)
 *   search   = _snapshot-search.psv   (if missing, no search tab is built)
 *   output   = auction-insights.html
 *   title    = "Auction Insights"
 *
 * --inspect prints the column mapping the parser derived from each source's
 * header row and exits without writing anything. Run it once against a new
 * account's real report before trusting any number on the dashboard.
 *
 * Data sources, in order of preference (live.json sits next to the output file):
 *   1. HUB MANIFEST:  { "hub": "https://docs.google.com/.../pub" }
 *      consolidate-from-folder.gs keeps a "Manifest" tab in first position
 *      listing Tab|Gid|Type|Report. The dashboard downloads the manifest (the
 *      published CSV with no gid returns the first tab), then builds one tab per
 *      listed sheet. The whole document must be published to the web.
 *   2. LEGACY:        { "shop": "<csv url>", "srch": "<csv url>" }
 *   3. SNAPSHOT:      the psv/csv files passed as arguments (no live.json).
 *
 * Column layout is NOT assumed: every source is mapped from its own header row
 * by scripts/lib/ai-parse.cjs, which also handles UK and Italian number formats.
 *
 * Based on the original by Andrea Lombardi (Ads2AI), which was itself based on an
 * idea by Mike Rhodes. This fork is English-language and locale-safe.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const P = require('./lib/ai-parse.cjs');

const argv = process.argv.slice(2);
const INSPECT = argv.includes('--inspect');
const positional = argv.filter(a => !a.startsWith('--'));

const shoppingPath = positional[0] || path.join(__dirname, '_snapshot.psv');
const searchPath = positional[1] || path.join(__dirname, '_snapshot-search.psv');
const outputPath = positional[2] || path.join(__dirname, 'auction-insights.html');
const title = positional[3] || 'Auction Insights';

const LT10_VALUE = P.LT10_VALUE;

// live.json next to the output: { hub } (manifest) or { shop, srch } (legacy).
function loadLiveConfig() {
  const cfg = { hub: '', csvUrl: { shop: '', srch: '' } };
  const livePath = path.join(path.dirname(outputPath), 'live.json');
  try {
    if (fs.existsSync(livePath)) {
      const raw = JSON.parse(fs.readFileSync(livePath, 'utf8'));
      if (raw && typeof raw.hub === 'string') cfg.hub = raw.hub.trim();
      if (raw && typeof raw.shop === 'string') cfg.csvUrl.shop = raw.shop.trim();
      if (raw && typeof raw.srch === 'string') cfg.csvUrl.srch = raw.srch.trim();
      const mode = cfg.hub ? 'hub manifest' : [raw && raw.shop && 'Shopping', raw && raw.srch && 'Search'].filter(Boolean).join(' + ');
      if (mode) console.log(`Live mode active (${mode}) from ${livePath}`);
    }
  } catch (e) {
    console.warn(`live.json found but could not be read (${livePath}): ${e.message}. Using snapshots only.`);
  }
  return cfg;
}
const LIVE = loadLiveConfig();

/** Download a published CSV with curl, from Node, so there is no CORS problem. */
function fetchCsv(url) {
  try {
    const csv = execSync(`curl -sL "${url}"`, { encoding: 'utf8', timeout: 20000 });
    if (csv && csv.split(/\r?\n/).filter(l => l.trim()).length > 1) return csv;
  } catch (e) { /* handled by the caller */ }
  return null;
}

/**
 * Reduce a published-sheet URL to the base the CSV endpoints hang off.
 *
 * The Publish to web dialog hands you a URL ending in `/pubhtml`, not `/pub`,
 * and `/pubhtml?output=csv` serves HTML rather than CSV, so pasting the dialog's
 * URL verbatim into live.json silently yields an unparseable manifest. Everyone
 * setting this up copies from that dialog, so normalise it here rather than
 * telling people to hand-edit the URL. Hit on the first live setup, 29 Jul 2026.
 */
function hubBase(url) {
  return url.split('?')[0].replace(/\/+$/, '').replace(/\/pubhtml$/i, '/pub');
}
function hubTabUrl(hub, gid) { return `${hubBase(hub)}?gid=${gid}&single=true&output=csv`; }
function hubManifestUrl(hub) { return `${hubBase(hub)}?output=csv`; }

/** The hub Manifest tab: Tab | Gid | Type | Report | Rows | Updated. */
function parseManifest(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return null;
  const hdr = P.splitLine(lines[0], ',').map(c => c.trim().toLowerCase());
  if (hdr[0] !== 'tab' || hdr[1] !== 'gid') return null; // not a manifest
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const c = P.splitLine(lines[i], ',').map(x => x.trim());
    if (c.length < 3 || !c[0] || !/^\d+$/.test(c[1])) continue;
    entries.push({ tab: c[0], gid: c[1], type: (c[2] || '').toLowerCase() });
  }
  return entries.length ? entries : null;
}

// ---- metric definitions per report type ------------------------------------
// kind: 'self' = the metric means something for your own row too
//       'outrank' | 'overlap' | 'above' = competitor-relative only
const METRIC_IMP = {
  key: 'imp', emoji: '📈', title: 'Impression share', includeYou: true, kind: 'self',
  def: 'The impressions you received divided by the estimated impressions you were eligible to receive. It shows how much of your potential presence in the auction you are actually taking. Updated once a day.',
};
const METRIC_OT = {
  key: 'ot', emoji: '🎯', title: 'Outranking share', includeYou: false, kind: 'outrank',
  def: 'How often your ad ranked higher in the auction than another advertiser\'s, or showed when theirs did not. A high figure against a competitor means you usually come out ahead of them.',
};
const METRIC_OV = {
  key: 'ov', emoji: '🔁', title: 'Overlap rate', includeYou: false, kind: 'overlap',
  def: 'How often another advertiser received an impression in the same auction as you. A high figure against a competitor means you are bidding against them a lot.',
};

const TYPE_META = {
  shop: {
    unit: 'stores',
    lead: 'How the competitors bidding in the same <b>Shopping auctions</b> as your products are moving, week by week.',
    metrics: [METRIC_IMP, METRIC_OT, METRIC_OV],
  },
  srch: {
    unit: 'domains',
    lead: 'How competitors are moving in the <b>search network auctions</b> (Search campaigns), week by week. Here the comparison is by website domain.',
    metrics: [
      METRIC_IMP,
      {
        key: 'top', emoji: '⬆️', title: 'Top of page rate', includeYou: true, kind: 'self',
        def: 'The share of impressions that showed at the top of the page, above the free search results. It applies to you and to competitors, so it shows who is managing to hold the top block.',
      },
      {
        key: 'abs', emoji: '🥇', title: 'Absolute top of page rate', includeYou: true, kind: 'self',
        def: 'The share of impressions that showed as the very first ad above the free search results. It is the most visible position available.',
      },
      METRIC_OT,
      {
        key: 'pos', emoji: '⚔️', title: 'Position above rate', includeYou: false, kind: 'above',
        def: 'When you and another advertiser both received an impression in the same auction, how often their ad appeared above yours. A high figure against a competitor means they usually sit above you.',
      },
      METRIC_OV,
    ],
  },
};

function makeView(id, name, type) {
  const meta = TYPE_META[type];
  return { id, name, type, unit: meta.unit, lead: meta.lead, metrics: meta.metrics };
}

function makeDataset(rows) {
  const weeks = [...new Set(rows.map(r => r.w))].sort();
  const stores = [...new Set(rows.map(r => r.s))].sort((a, b) => {
    if (a === P.YOU) return -1;
    if (b === P.YOU) return 1;
    return a.localeCompare(b);
  });
  return { weeks, stores, rows };
}

/** Unique id safe to use inside HTML element ids. */
function slugify(name, used) {
  let base = 't-' + String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (base === 't-') base = 't-report';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

// ---- load data: hub manifest -> legacy live -> snapshot ---------------------
const VIEW_DEFS = [];   // views, in tab order
const DATASETS = {};    // view id -> { weeks, stores, rows }
const CSV_URLS = {};    // view id -> URL for the client-side refresh (over http)
const INSPECTIONS = []; // { label, parsed } for --inspect

function addView(view, dataset, url) {
  VIEW_DEFS.push(view);
  DATASETS[view.id] = dataset;
  if (url) CSV_URLS[view.id] = url;
  console.log(`  Tab "${view.name}" [${view.type}]: ${dataset.rows.length} rows | ${dataset.weeks.length} weeks (${dataset.weeks[0]} -> ${dataset.weeks[dataset.weeks.length - 1]}) | ${dataset.stores.length} ${view.unit}`);
}

/** Parse one source, record its mapping for --inspect, surface any warnings. */
function parseSource(label, text, forcedType) {
  let parsed;
  try {
    parsed = P.parseReport(text, forcedType ? { type: forcedType } : {});
  } catch (e) {
    console.error(`  ${label}: ${e.message}`);
    return null;
  }
  INSPECTIONS.push({ label, parsed });
  parsed.warnings.forEach(w => console.warn(`  ${label}: ${w}`));
  return parsed;
}

if (LIVE.hub) {
  const mtext = fetchCsv(hubManifestUrl(LIVE.hub));
  const entries = mtext ? parseManifest(mtext) : null;
  if (!entries) {
    console.warn('Hub manifest could not be read (is the whole document published to the web, and is the Manifest tab first?). Falling back to legacy/snapshot.');
  } else {
    const used = new Set();
    for (const e of entries) {
      const url = hubTabUrl(LIVE.hub, e.gid);
      const text = fetchCsv(url);
      if (!text) { console.warn(`  Tab "${e.tab}" (gid ${e.gid}): download failed, tab skipped.`); continue; }
      const forced = e.type.startsWith('search') ? 'srch' : (e.type.startsWith('shop') ? 'shop' : null);
      const parsed = parseSource(`Tab "${e.tab}"`, text, forced);
      if (!parsed) continue;
      const rows = P.dedupe(parsed.rows);
      if (!rows.length) { console.warn(`  Tab "${e.tab}": no data rows, tab skipped.`); continue; }
      addView(makeView(slugify(e.tab, used), e.tab, parsed.type), makeDataset(rows), url);
    }
  }
}

if (!VIEW_DEFS.length) {
  // legacy (live.json {shop,srch}) or snapshot: two fixed tabs
  const readSource = (viewId, filePath) => {
    const url = LIVE.csvUrl[viewId];
    if (url) {
      const csv = fetchCsv(url);
      if (csv) { console.log(`  (${viewId}: live data downloaded from the hub)`); return csv; }
      console.warn(`  (${viewId}: live download failed or empty, using the snapshot)`);
    }
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  };

  const shopText = readSource('shop', shoppingPath);
  if (shopText) {
    const parsed = parseSource('Shopping', shopText, 'shop');
    if (parsed) {
      const rows = P.dedupe(parsed.rows);
      if (rows.length) addView(makeView('shop', 'Shopping', 'shop'), makeDataset(rows), LIVE.csvUrl.shop);
    }
  } else {
    console.log(`  Shopping: no source (neither live nor ${shoppingPath})`);
  }

  const srchText = readSource('srch', searchPath);
  if (srchText) {
    const parsed = parseSource('Search network', srchText, 'srch');
    if (parsed) {
      const rows = P.dedupe(parsed.rows);
      if (rows.length) addView(makeView('srch', 'Search network', 'srch'), makeDataset(rows), LIVE.csvUrl.srch);
    }
  } else {
    console.log(`  Search network: no source (neither live nor ${searchPath}), tab not built`);
  }
}

if (INSPECT) {
  if (!INSPECTIONS.length) {
    console.error('Nothing to inspect: no readable source was found.');
    process.exit(1);
  }
  for (const ins of INSPECTIONS) {
    console.log(`\n=== ${ins.label} ===`);
    console.log(P.describeMapping(ins.parsed));
    const sample = ins.parsed.rows.slice(0, 3);
    if (sample.length) {
      console.log('First parsed rows (check these against the report in the Google Ads interface):');
      sample.forEach(r => console.log('  ' + JSON.stringify(r)));
    }
  }
  console.log('\n--inspect only: no dashboard written.');
  process.exit(0);
}

if (!VIEW_DEFS.length) { console.error('No view has data: dashboard not built.'); process.exit(1); }

const payload = { generatedAt: new Date().toISOString() };
for (const v of VIEW_DEFS) payload[v.id] = DATASETS[v.id];

// one independent control bar per chart (sfx = view-metric)
function controlsHtml(sfx) {
  return `<div class="controls">
      <div class="ctrl"><label>From week</label><select id="from-${sfx}"></select></div>
      <div class="ctrl"><label>To week</label><select id="to-${sfx}"></select></div>
      <div class="ctrl"><label>Show</label><select id="topn-${sfx}">
        <option value="5">Top 5</option><option value="10" selected>Top 10</option>
        <option value="15">Top 15</option><option value="999">All</option></select></div>
      <div class="ctrl"><label>Isolate competitor</label><select id="isolate-${sfx}"><option value="">none</option></select></div>
      <div class="ctrl"><label>&nbsp;</label><div class="btns">
        <button id="showAll-${sfx}">Show all</button><button id="hideAll-${sfx}">Hide all</button></div></div>
    </div>`;
}

function metricSectionHtml(v, m) {
  const sfx = `${v.id}-${m.key}`;
  return `  <div class="metric-section card-base">
    <h2>${m.emoji} ${m.title}</h2>
    <p class="metric-def">${m.def}</p>
    ${controlsHtml(sfx)}
    <div class="chart-box"><canvas id="chart-${sfx}"></canvas></div>
    <ul class="keypoints" id="kp-${sfx}"></ul>
  </div>`;
}

function viewHtml(v, isFirst) {
  return `<div class="view${isFirst ? ' active' : ''}" id="view-${v.id}">
  <p class="view-lead">${v.lead}</p>
  <div class="panel-card card-base">
    <h2>📌 Where things stand (last 2 weeks)</h2>
    <p class="sit-intro" id="sitIntro-${v.id}"></p>
    <ul class="situation" id="situation-${v.id}"></ul>
    <p class="sit-note" id="sitNote-${v.id}"></p>
  </div>
${v.metrics.map(m => metricSectionHtml(v, m)).join('\n')}
</div>`;
}

const tabsHtml = VIEW_DEFS.length > 1
  ? `<div class="tabs">${VIEW_DEFS.map((v, i) => `<button class="tab${i === 0 ? ' active' : ''}" data-view="${v.id}">${v.name}</button>`).join('')}</div>`
  : '';

const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root{
    --bg:#f5f7fa; --panel:#ffffff; --panel2:#f8fafc; --line:#e2e8f0;
    --txt:#1a202c; --muted:#64748b; --muted2:#94a3b8; --accent:#2563eb; --accent-bg:#eff6ff;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--txt);}
  header{padding:22px 24px 0;background:var(--panel);border-bottom:1px solid var(--line);}
  header h1{margin:0;font-size:19px;font-weight:700;color:var(--txt);}
  header .lead{color:var(--muted);font-size:13px;margin-top:6px;line-height:1.5;max-width:760px;}
  header .sub{color:var(--muted2);font-size:12px;margin-top:6px;}
  .tabs{display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;}
  .tab{padding:9px 20px;border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0;background:var(--panel2);font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .12s;}
  .tab:hover{color:var(--accent);}
  .tab.active{background:var(--bg);color:var(--accent);border-color:var(--line);position:relative;}
  .wrap{padding:18px 24px 48px;}
  .view{display:none;}
  .view.active{display:block;}
  .view-lead{color:var(--muted);font-size:13px;line-height:1.5;margin:0 0 14px;max-width:820px;}
  .card-base{background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
  .controls{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;margin:0 0 14px;padding:12px 14px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;}
  .ctrl{display:flex;flex-direction:column;gap:5px;}
  .ctrl label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted2);font-weight:600;}
  select,button{background:#fff;color:#374151;border:1px solid var(--line);border-radius:6px;padding:7px 10px;font-size:13px;cursor:pointer;outline:none;transition:all .12s;}
  select:focus{border-color:var(--accent);}
  button:hover{border-color:var(--accent);color:var(--accent);}
  .btns{display:flex;gap:8px;}
  .panel-card{padding:16px 18px;margin-bottom:16px;}
  .panel-card h2{margin:0 0 10px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--txt);display:flex;align-items:center;gap:8px;}
  .sit-intro{font-size:14px;line-height:1.6;color:#374151;margin:0 0 12px;}
  .sit-intro b{color:var(--txt);}
  .situation{margin:0;padding-left:18px;}
  .situation li{margin:7px 0;font-size:14px;line-height:1.5;color:#374151;}
  .situation li .tag{font-weight:700;}
  .t-up{color:#dc2626;} .t-down{color:#16a34a;} .t-new{color:#b45309;} .t-gone{color:#64748b;} .t-top{color:#2563eb;}
  .sit-note{margin:14px 0 0;font-size:11.5px;line-height:1.5;color:var(--muted2);border-top:1px solid var(--line);padding-top:10px;}

  .metric-section{margin-bottom:18px;padding:18px 20px;}
  .metric-section h2{margin:0;font-size:16px;font-weight:700;color:var(--txt);}
  .metric-def{margin:8px 0 14px;font-size:12.5px;line-height:1.55;color:var(--muted);background:var(--panel2);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:6px;padding:10px 12px;}
  .chart-box{position:relative;height:420px;}
  .keypoints{margin:14px 0 0;padding:0;list-style:none;}
  .keypoints li{margin:6px 0;font-size:13.5px;line-height:1.5;color:#374151;padding-left:20px;position:relative;}
  .keypoints li::before{content:"";position:absolute;left:4px;top:8px;width:6px;height:6px;border-radius:50%;background:var(--accent);}
  .keypoints li.warn::before{background:#dc2626;}
  .keypoints li .tag{font-weight:700;}
</style>
</head>
<body>
<header>
  <h1>${title}</h1>
  <div class="lead">How the competitors bidding in your <b>Google Ads auctions</b> are moving, week by week. Use the tabs to switch between reports.</div>
  <div class="sub"><span id="meta"></span></div>
  ${tabsHtml}
</header>
<div class="wrap">
${VIEW_DEFS.map((v, i) => viewHtml(v, i === 0)).join('\n')}
</div>

<script>
// LIVE mode: the per-view CSV URLs are injected from the client's live.json (hub
// manifest or legacy). When empty the dashboard uses the embedded data, which is
// current as at the last build.
const CONFIG = ${JSON.stringify({ csvUrl: CSV_URLS })};

let DATA = ${JSON.stringify(payload)};
const VIEWS = ${JSON.stringify(VIEW_DEFS)};
const LT10 = ${LT10_VALUE};
const YOU = ${JSON.stringify(P.YOU)};
const YOU_LABELS = ${JSON.stringify([...P.YOU_LABELS])};

const el = id => document.getElementById(id);
const lc = s => s.charAt(0).toLowerCase() + s.slice(1);
function ddmm(w){ const p = w.split('-'); return p[2] + '/' + p[1]; }
// 1st, 2nd, 3rd, 4th ... 11th, 21st
function ord(n){
  const rem100 = n % 100, rem10 = n % 10;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  return n + (rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th');
}

// ---- stable colour per store/domain ----
const PALETTE = ['#4f8cff','#ff6b6b','#22c55e','#f59e0b','#a855f7','#06b6d4','#ec4899','#84cc16',
  '#f97316','#14b8a6','#8b5cf6','#ef4444','#10b981','#eab308','#3b82f6','#f43f5e','#0ea5e9','#d946ef',
  '#65a30d','#fb923c','#2dd4bf','#c026d3','#dc2626','#16a34a','#ca8a04','#2563eb','#e11d48','#0891b2'];
function colorFor(store, i){ return store === YOU ? '#0f172a' : PALETTE[i % PALETTE.length]; }

// fast lookup per view: store -> week -> record
const IDX = {};
function rebuildIdx(viewId){
  IDX[viewId] = {};
  const D = DATA[viewId];
  if (!D) return;
  for (const r of D.rows){ (IDX[viewId][r.s] = IDX[viewId][r.s] || {})[r.w] = r; }
}
function val(viewId, store, week, metric){
  const rec = IDX[viewId] && IDX[viewId][store] && IDX[viewId][store][week];
  return rec ? (rec[metric] == null ? null : rec[metric]) : null;
}

// rank competitors by their average on the metric over the selected period
function rankStores(v, metric, weeksSel){
  return DATA[v.id].stores
    .filter(s => s !== YOU)
    .map(s => {
      const vals = weeksSel.map(w => val(v.id, s, w, metric)).filter(x => x != null);
      const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : -1;
      return { s, avg };
    })
    .sort((a,b) => b.avg - a.avg)
    .map(o => o.s);
}

const charts = {};

function weeksInRange(v, sfx){
  const from = el('from-'+sfx).value, to = el('to-'+sfx).value;
  return DATA[v.id].weeks.filter(w => w >= from && w <= to);
}

// adaptive Y axis: tightens onto the real range of the visible data
function yRange(datasets){
  const flat = datasets.flatMap(d => d.data).filter(x => x != null);
  if (!flat.length) return { min: 0, max: 100 };
  let lo = Math.min(...flat), hi = Math.max(...flat);
  const span = hi - lo;
  const pad = Math.max(3, span * 0.2);
  let min = Math.max(0, Math.floor((lo - pad) / 5) * 5);
  let max = Math.min(100, Math.ceil((hi + pad) / 5) * 5);
  if (max - min < 10) max = Math.min(100, min + 10);   // minimum readable height
  return { min, max };
}

function buildOne(v, m){
  const sfx = v.id + '-' + m.key;
  const weeksSel = weeksInRange(v, sfx);
  const topn = parseInt(el('topn-'+sfx).value, 10);
  const isolate = el('isolate-'+sfx).value;

  let ranked = rankStores(v, m.key, weeksSel);
  let shown = ranked.slice(0, topn);
  if (isolate){ shown = [isolate]; }

  const order = m.includeYou ? [YOU, ...shown] : [...shown];

  const datasets = order.map(s => {
    const isYou = s === YOU;
    return {
      label: s,
      data: weeksSel.map(w => val(v.id, s, w, m.key)),
      borderColor: colorFor(s, DATA[v.id].stores.indexOf(s)),
      backgroundColor: colorFor(s, DATA[v.id].stores.indexOf(s)),
      borderWidth: isYou ? 4 : 2,
      pointRadius: isYou ? 3 : 2,
      pointHoverRadius: 5,
      tension: 0.25,
      spanGaps: true,
      order: isYou ? 0 : 1,
    };
  });

  const yr = yRange(datasets);

  const cfg = {
    type: 'line',
    data: { labels: weeksSel, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#374151', boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 12, font:{size:12} }
        },
        tooltip: {
          callbacks: {
            label: c => \`\${c.dataset.label}: \${c.parsed.y == null ? 'no data' : c.parsed.y.toFixed(2) + '%'}\`
          }
        },
        title: { display: false }
      },
      scales: {
        y: { min: yr.min, max: yr.max, ticks:{ color:'#64748b', callback:x=>x+'%' }, grid:{ color:'#eef2f7' }, title:{ display:true, text: m.title + ' (%)', color:'#64748b' } },
        x: { ticks:{ color:'#64748b' }, grid:{ color:'#f1f5f9' } }
      }
    }
  };

  if (charts[sfx]) charts[sfx].destroy();
  charts[sfx] = new Chart(el('chart-'+sfx), cfg);
}

function buildView(v){ v.metrics.forEach(m => buildOne(v, m)); }

function setVisibility(sfx, visible){
  const ch = charts[sfx];
  if (!ch) return;
  ch.data.datasets.forEach((ds, i) => {
    if (ds.label === YOU) { ch.setDatasetVisibility(i, true); return; }
    ch.setDatasetVisibility(i, visible);
  });
  ch.update();
}

// ---- key points per metric ----
function kpLeader(m, s, x){
  if (m.key === 'imp') return \`<b>\${s}</b> leads the auctions with an impression share of <b>\${x}%</b>\`;
  switch (m.kind){
    case 'self':    return \`<b>\${s}</b> has the highest \${lc(m.title)}: <b>\${x}%</b>\`;
    case 'outrank': return \`<b>\${s}</b> is the competitor you come out ahead of most often (<b>\${x}%</b>)\`;
    case 'overlap': return \`<b>\${s}</b> is the competitor you meet most often in the same auctions (overlap of <b>\${x}%</b>)\`;
    case 'above':   return \`<b>\${s}</b> is the competitor that appears above you most often (<b>\${x}%</b>)\`;
  }
}
function kpExtreme(m, s, x){
  switch (m.kind){
    case 'outrank': return { tag:'Hardest to beat', txt:\`<b>\${s}</b> is the competitor you come out ahead of least often (<b>\${x}%</b>), so they are the closest challenge on ranking.\` };
    case 'overlap': return { tag:'Least overlap', txt:\`<b>\${s}</b> rarely turns up in the same auctions as you (<b>\${x}%</b>), so the competition is marginal.\` };
    case 'above':   return { tag:'Almost never above you', txt:\`<b>\${s}</b> rarely appears above your ad (<b>\${x}%</b>).\` };
    default: return null;
  }
}

// at least three key points per metric, based on the last 2 weeks
function metricInsights(v, m){
  const D = DATA[v.id];
  const weeks = D.weeks;
  if (weeks.length < 1) return [];
  const last = weeks[weeks.length - 1];
  const prev = weeks.length >= 2 ? weeks[weeks.length - 2] : null;
  const out = [];

  const rowsLast = D.rows.filter(r => r.w === last && r.s !== YOU);
  const withVal = rowsLast.map(r => ({ s:r.s, v:r[m.key] })).filter(o => o.v != null).sort((a,b) => b.v - a.v);

  // 1) leader on this metric, among competitors
  if (withVal.length){
    const t = withVal[0];
    out.push({ cls:'t-top', warn:false, tag:'Leader', txt: kpLeader(m, t.s, t.v.toFixed(1)) + \` (week of \${ddmm(last)}).\` });
  }

  // 2) your own figure (self metrics) or the market average
  if (m.kind === 'self'){
    const youV = val(v.id, YOU, last, m.key);
    if (youV != null){
      const ahead = withVal.filter(o => o.v > youV).length;
      const posTxt = ahead === 0 ? 'the highest in the market' : \`\${ord(ahead + 1)} place, with \${ahead} competitor\${ahead === 1 ? '' : 's'} ahead of you\`;
      const tag = m.key === 'imp' ? 'Your share' : 'Your figure';
      out.push({ cls:'t-top', warn:false, tag, txt:\`Your \${lc(m.title)} is <b>\${youV.toFixed(1)}%</b>, \${posTxt}.\` });
    }
  } else if (withVal.length){
    const avg = withVal.reduce((a,o) => a + o.v, 0) / withVal.length;
    out.push({ cls:'t-top', warn:false, tag:'Market average', txt:\`Competitors average <b>\${avg.toFixed(1)}%</b> on this metric in the week of \${ddmm(last)}.\` });
  }

  // 3) biggest move over the last 2 weeks (self metrics include your own row)
  if (prev){
    const pool = m.kind === 'self' ? D.rows.filter(r => r.w === last) : rowsLast;
    let chg = null;
    pool.forEach(r => {
      const a = val(v.id, r.s, prev, m.key), b = r[m.key];
      if (a != null && b != null){ const d = b - a; if (!chg || Math.abs(d) > Math.abs(chg.d)) chg = { s:r.s, d, a, b }; }
    });
    if (chg && Math.abs(chg.d) >= 1){
      const up = chg.d > 0;
      out.push({ cls: up ? 't-up' : 't-down', warn: Math.abs(chg.d) >= 8, tag:'Biggest move', txt:\`<b>\${chg.s}</b> \${up ? 'up' : 'down'} \${Math.abs(chg.d).toFixed(1)} points (from \${chg.a.toFixed(1)}% to \${chg.b.toFixed(1)}%) between \${ddmm(prev)} and \${ddmm(last)}.\` });
    } else {
      out.push({ cls:'t-gone', warn:false, tag:'Steady', txt:\`No meaningful change (1 point or more) against the week of \${ddmm(prev)}.\` });
    }
  }

  // 4) the opposite end of the range, for context
  const ex = kpExtreme(m, null, null);
  if (ex && withVal.length > 1){
    const e = withVal[withVal.length - 1];
    const filled = kpExtreme(m, e.s, e.v.toFixed(1));
    out.push({ cls:'t-gone', warn:false, tag: filled.tag, txt: filled.txt });
  }

  if (!out.length){
    out.push({ cls:'t-gone', warn:false, tag:'Not enough data', txt:'No competitors appear in the data for this metric.' });
  }

  return out;
}

function renderKeyPoints(v){
  v.metrics.forEach(m => {
    const ul = el('kp-' + v.id + '-' + m.key);
    ul.innerHTML = '';
    metricInsights(v, m).forEach(p => {
      const li = document.createElement('li');
      if (p.warn) li.className = 'warn';
      li.innerHTML = \`<span class="tag \${p.cls}">\${p.tag}:</span> \${p.txt}\`;
      ul.appendChild(li);
    });
  });
}

// ---- "where things stand" panel per view (last 2 weeks, on impression share) ----
function analyzeInsights(v){
  const D = DATA[v.id];
  const weeks = D.weeks;
  if (weeks.length < 2) return [];
  const last = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
  const inWeek = w => new Set(D.rows.filter(r => r.w === w).map(r => r.s));
  const lastSet = inWeek(last), prevSet = inWeek(prev);
  const beforeLast = new Set(D.rows.filter(r => r.w !== last).map(r => r.s));
  const comps = [...lastSet].filter(s => s !== YOU);
  const impAt = (s, w) => val(v.id, s, w, 'imp');
  const out = [];

  const top = comps.map(s => ({ s, v: impAt(s, last) })).filter(o => o.v != null).sort((a, b) => b.v - a.v)[0];
  if (top) out.push({ cls:'t-top', tag:'Top competitor', txt:\`<b>\${top.s}</b> leads the auctions with an impression share of \${top.v.toFixed(1)}% in the week of \${ddmm(last)}.\` });

  const youV = impAt(YOU, last);
  if (youV != null){
    const ahead = comps.map(s => impAt(s, last)).filter(x => x != null).filter(x => x > youV).length;
    out.push({ cls:'t-top', tag:'Your share', txt:\`Your impression share is <b>\${youV.toFixed(1)}%</b>, \${ahead === 0 ? 'the highest in the market' : ord(ahead + 1) + ' place (' + ahead + ' competitor' + (ahead === 1 ? '' : 's') + ' ahead of you)'}.\` });
  }

  let chg = null;
  comps.forEach(s => {
    const a = impAt(s, prev), b = impAt(s, last);
    if (a != null && b != null){ const d = b - a; if (!chg || Math.abs(d) > Math.abs(chg.d)) chg = { s, d, a, b }; }
  });
  if (chg && Math.abs(chg.d) >= 1){
    const up = chg.d > 0;
    out.push({ cls: up ? 't-up' : 't-down', tag:'Biggest move', txt:\`<b>\${chg.s}</b> \${up ? 'up' : 'down'} \${Math.abs(chg.d).toFixed(1)} points (from \${chg.a.toFixed(1)}% to \${chg.b.toFixed(1)}%) between \${ddmm(prev)} and \${ddmm(last)}.\` });
  }

  const gone = [...prevSet].filter(s => s !== YOU && !lastSet.has(s));
  if (gone.length) out.push({ cls:'t-gone', tag:'Left the auctions', txt:\`No longer showing in the latest week: <b>\${gone.join(', ')}</b>.\` });

  const entrants = [...lastSet].filter(s => s !== YOU && !beforeLast.has(s));
  if (entrants.length) out.push({ cls:'t-new', tag:'New entrants', txt:\`New competitors in the auctions: <b>\${entrants.join(', ')}</b>.\` });

  if (comps.length && !gone.length && !entrants.length) out.push({ cls:'t-gone', tag:'Steady', txt:\`Nobody dropped out and nobody new appeared against the week of \${ddmm(prev)}.\` });

  return out;
}

function renderSituation(v){
  const D = DATA[v.id];
  const intro = el('sitIntro-' + v.id);
  const pct = x => x == null ? 'no data' : x.toFixed(1) + '%';

  if (D.weeks.length){
    const last = D.weeks[D.weeks.length - 1];
    const comps = D.rows.filter(r => r.w === last && r.s !== YOU);
    const youV = val(v.id, YOU, last, 'imp');

    if (!comps.length){
      let txt = \`In the latest week recorded (<b>\${ddmm(last)}</b>) the report holds no competitor rows: there is only your own row.\`;
      if (youV != null) txt += \` Your impression share is <b>\${pct(youV)}</b>.\`;
      txt += \` If you expected to see competitors here, check the filters on the scheduled report in Google Ads.\`;
      intro.innerHTML = txt;
    } else {
      const avg = key => {
        const vals = comps.map(r => r[key]).filter(x => x != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const parts = v.metrics.map(m => ({ m, a: avg(m.key) })).filter(o => o.a != null)
        .map(o => \`\${lc(o.m.title)} <b>\${pct(o.a)}</b>\`);
      const ahead = comps.map(r => r.imp).filter(x => x != null).filter(x => x > (youV == null ? Infinity : youV)).length;
      let pos = '';
      if (youV != null) pos = ahead === 0
        ? \` Your impression share is <b>\${pct(youV)}</b>, the highest in the market.\`
        : \` Your impression share is <b>\${pct(youV)}</b>, \${ord(ahead + 1)} place with \${ahead} competitor\${ahead === 1 ? '' : 's'} ahead of you.\`;
      intro.innerHTML = \`In the latest week recorded (<b>\${ddmm(last)}</b>), <b>\${comps.length} competitor\${comps.length === 1 ? '' : 's'}</b> bid in the same auctions as you. On average they record: \${parts.join(', ')}.\${pos}\`;
    }
  }

  const ul = el('situation-' + v.id);
  ul.innerHTML = '';
  analyzeInsights(v).forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = \`<span class="tag \${p.cls}">\${p.tag}:</span> \${p.txt}\`;
    ul.appendChild(li);
  });

  el('sitNote-' + v.id).innerHTML = \`<b>About the "less than 10%" values:</b> when Google Ads will not put a number on an impression share it reports it as &lt; 10%. Here that is shown as <b>\${LT10}%</b>, the midpoint of the 0-10% band, so the lines on the chart do not break and averages can still be worked out. For those points the exact figure is an approximation: the real share is somewhere below 10%.\`;
}

// first week where the metric has any value at all, so a line that starts
// mid-period is not squashed against the right-hand edge
function firstWeekWithData(v, metric){
  const D = DATA[v.id];
  for (const w of D.weeks){
    for (const s of D.stores){ if (val(v.id, s, w, metric) != null) return w; }
  }
  return D.weeks[0];
}

function initControls(v){
  const D = DATA[v.id];
  v.metrics.forEach(m => {
    const sfx = v.id + '-' + m.key;
    const fromSel = el('from-'+sfx), toSel = el('to-'+sfx), iso = el('isolate-'+sfx);
    fromSel.innerHTML = ''; toSel.innerHTML = '';
    iso.innerHTML = '<option value="">none</option>';
    D.weeks.forEach(w => { fromSel.add(new Option(w, w)); toSel.add(new Option(w, w)); });
    fromSel.value = firstWeekWithData(v, m.key);
    toSel.value = D.weeks[D.weeks.length - 1];
    D.stores.filter(s => s !== YOU).forEach(s => iso.add(new Option(s, s)));
  });
}

function bindControls(v){
  v.metrics.forEach(m => {
    const sfx = v.id + '-' + m.key;
    ['from-'+sfx,'to-'+sfx,'topn-'+sfx,'isolate-'+sfx].forEach(id => el(id).addEventListener('change', () => buildOne(v, m)));
    el('showAll-'+sfx).addEventListener('click', () => setVisibility(sfx, true));
    el('hideAll-'+sfx).addEventListener('click', () => setVisibility(sfx, false));
  });
}

function updateMeta(v){
  const D = DATA[v.id];
  el('meta').textContent = D.weeks.length
    ? \`\${v.name}: \${D.weeks.length} weeks (\${D.weeks[0]} to \${D.weeks[D.weeks.length-1]}) · \${D.stores.length} \${v.unit}\`
    : \`\${v.name}: no data\`;
}

// lazy build: charts in a hidden tab cannot size themselves, so each view is
// built the first time it becomes visible
const builtViews = {};
function showView(id){
  document.querySelectorAll('.view').forEach(d => d.classList.toggle('active', d.id === 'view-' + id));
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  const v = VIEWS.find(x => x.id === id);
  updateMeta(v);
  if (!builtViews[id]){ buildView(v); builtViews[id] = true; }
}

// ---- LIVE mode (published CSVs from the hub sheet) ----
// Mirrors scripts/lib/ai-parse.cjs: same locale-safe number handling and the
// same header-driven column mapping, so a browser refresh can never disagree
// with the data embedded at build time.
function splitCsvLine(line){
  const out = []; let cur = '', q = false;
  for (const ch of line){
    if (ch === '"'){ q = !q; continue; }
    if (ch === ',' && !q){ out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function cleanPct(raw){
  if (raw == null) return null;
  let s = String(raw).replace(/"/g,'').replace(/\\u00a0/g,' ').trim();
  if (s === '' || s === '--' || s === '-') return null;
  if (/^<\\s*10\\s*%?$/.test(s)) return LT10;
  s = s.replace(/%/g,'').replace(/\\s/g,'');
  if (!/^[\\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let norm;
  if (lastDot !== -1 && lastComma !== -1){
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
  return Number.isNaN(n) ? null : Math.round(n * 100) / 100;
}

const FIELD_MATCHERS = ${JSON.stringify(P.FIELD_MATCHERS)};
const METRIC_FIELDS = ${JSON.stringify(P.METRIC_FIELDS)};

function normHeader(h){
  return String(h == null ? '' : h).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function headerMatches(m, norm){
  if (m.any) return m.any.some(f => norm.includes(f));
  return m.all.every(g => g.some(f => norm.includes(f)));
}
function mapColumns(cells){
  const map = {};
  cells.forEach((h, i) => {
    const norm = normHeader(h);
    if (!norm) return;
    const hit = FIELD_MATCHERS.find(m => map[m.field] === undefined && headerMatches(m, norm));
    if (hit) map[hit.field] = i;
  });
  return map;
}

async function maybeLoadLive(v){
  const url = CONFIG.csvUrl[v.id];
  if (!url || !DATA[v.id]) return;
  try {
    const txt = await (await fetch(url)).text();
    const lines = txt.split(/\\r?\\n/).filter(l => l.trim());

    // find the header row the same way the build-time parser does
    let headerRow = -1, map = null;
    for (let i = 0; i < Math.min(lines.length, 8); i++){
      const cand = mapColumns(splitCsvLine(lines[i]).map(x => x.trim()));
      if (cand.week !== undefined && cand.entity !== undefined){ headerRow = i; map = cand; break; }
    }
    if (headerRow === -1){ console.warn('Live CSV for ' + v.id + ': header not recognised, keeping embedded data.'); return; }

    const rows = [];
    for (let i = headerRow + 1; i < lines.length; i++){
      const c = splitCsvLine(lines[i]).map(x => x.trim());
      if (c.length <= map.entity) continue;
      const wk = (String(c[map.week]).match(/\\d{4}-\\d{2}-\\d{2}/) || [null])[0];
      if (!wk) continue;
      let store = c[map.entity];
      if (YOU_LABELS.indexOf(String(store).toLowerCase()) !== -1) store = YOU;
      const row = { w: wk, s: store };
      METRIC_FIELDS.forEach(f => { row[f] = map[f] === undefined ? null : cleanPct(c[map[f]]); });
      rows.push(row);
    }
    if (rows.length){
      const weeks = [...new Set(rows.map(r=>r.w))].sort();
      const stores = [...new Set(rows.map(r=>r.s))].sort((a,b)=> a===YOU?-1:b===YOU?1:a.localeCompare(b));
      DATA[v.id] = { weeks, stores, rows };
      rebuildIdx(v.id);
    }
  } catch(e){ console.warn('Live CSV not loaded for ' + v.id + ', using embedded data:', e); }
}

(async function(){
  for (const v of VIEWS){
    await maybeLoadLive(v);
    rebuildIdx(v.id);
    initControls(v);
    bindControls(v);
    renderSituation(v);
    renderKeyPoints(v);
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  showView(VIEWS[0].id);
})();
</script>
</body>
</html>`;

fs.writeFileSync(outputPath, html);
console.log(`Dashboard written: ${outputPath} (${(html.length / 1024).toFixed(0)} KB, ${VIEW_DEFS.length} tab${VIEW_DEFS.length === 1 ? '' : 's'})`);
