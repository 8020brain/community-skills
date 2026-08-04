#!/usr/bin/env node
/**
 * analyze.cjs — key points and alerts from an Auction Insights file.
 *
 * Same logic as the "Where things stand" panel on the dashboard, but from the
 * command line so it can feed a routine. It looks at the last 2 weeks of
 * impression share (how present you are in the auctions) and reports: the top
 * competitor, your own position, the biggest move, who dropped out and who is new.
 *
 * Usage:
 *   node analyze.cjs <file.psv|file.csv> [--label "Client name"] [--json] [--inspect]
 *
 * Columns are read from the file's own header row, in any supported language, by
 * scripts/lib/ai-parse.cjs. Values may be "46.75%" or "46,75%", "< 10%" (plotted
 * as 5) or "--" (not applicable).
 *
 * Always exits 0 so it can never block the routine that calls it.
 *
 * Based on the original by Andrea Lombardi (Ads2AI).
 */

'use strict';

const fs = require('fs');
const P = require('./lib/ai-parse.cjs');

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const file = process.argv[2];
const label = arg('--label', 'Auction Insights');
const asJson = process.argv.includes('--json');
const inspect = process.argv.includes('--inspect');

if (!file || !fs.existsSync(file)) {
  console.log(`[${label}] no data available (${file || 'no file given'}).`);
  process.exit(0);
}

let parsed;
try {
  parsed = P.parseReport(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.log(`[${label}] could not read the report: ${e.message}`);
  process.exit(0);
}

if (inspect) {
  console.log(`=== ${label}: ${file} ===`);
  console.log(P.describeMapping(parsed));
  parsed.rows.slice(0, 3).forEach(r => console.log('  ' + JSON.stringify(r)));
  process.exit(0);
}

parsed.warnings.forEach(w => console.log(`[${label}] note: ${w}`));

const rows = P.dedupe(parsed.rows);
const weeks = [...new Set(rows.map(r => r.w))].sort();
const idx = {};
rows.forEach(r => { (idx[r.s] = idx[r.s] || {})[r.w] = r; });
const impAt = (s, w) => (idx[s] && idx[s][w] ? idx[s][w].imp : null);
const ddmm = w => { const p = w.split('-'); return p[2] + '/' + p[1]; };
function ord(n) {
  const rem100 = n % 100, rem10 = n % 10;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  return n + (rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th');
}

function analyse() {
  if (weeks.length < 2) return [];
  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const inWeek = w => new Set(rows.filter(r => r.w === w).map(r => r.s));
  const lastSet = inWeek(last), prevSet = inWeek(prev);
  const beforeLast = new Set(rows.filter(r => r.w !== last).map(r => r.s));
  const comps = [...lastSet].filter(s => s !== P.YOU);
  const out = [];

  const top = comps.map(s => ({ s, v: impAt(s, last) })).filter(o => o.v != null).sort((a, b) => b.v - a.v)[0];
  if (top) out.push({ level: 'info', tag: 'Top competitor', text: `${top.s} leads the auctions with an impression share of ${top.v.toFixed(1)}% (week of ${ddmm(last)}).` });

  const youV = impAt(P.YOU, last);
  if (youV != null) {
    const ahead = comps.map(s => impAt(s, last)).filter(v => v != null).filter(v => v > youV).length;
    out.push({ level: 'info', tag: 'Your share', text: `Impression share ${youV.toFixed(1)}%, ${ahead === 0 ? 'the highest in the market' : `${ord(ahead + 1)} place (${ahead} competitor${ahead === 1 ? '' : 's'} ahead of you)`}.` });
  }

  let chg = null;
  comps.forEach(s => {
    const a = impAt(s, prev), b = impAt(s, last);
    if (a != null && b != null) { const d = b - a; if (!chg || Math.abs(d) > Math.abs(chg.d)) chg = { s, d, a, b }; }
  });
  if (chg && Math.abs(chg.d) >= 1) {
    const up = chg.d > 0;
    out.push({
      level: Math.abs(chg.d) >= 8 ? 'warn' : 'info',
      tag: 'Biggest move',
      text: `${chg.s} ${up ? 'up' : 'down'} ${Math.abs(chg.d).toFixed(1)} points (from ${chg.a.toFixed(1)}% to ${chg.b.toFixed(1)}%) between ${ddmm(prev)} and ${ddmm(last)}.`,
    });
  }

  const gone = [...prevSet].filter(s => s !== P.YOU && !lastSet.has(s));
  if (gone.length) out.push({ level: 'warn', tag: 'Left the auctions', text: `No longer showing in the latest week: ${gone.join(', ')}.` });

  const entrants = [...lastSet].filter(s => s !== P.YOU && !beforeLast.has(s));
  if (entrants.length) out.push({ level: 'warn', tag: 'New entrants', text: `New competitors in the auctions: ${entrants.join(', ')}.` });

  if (!gone.length && !entrants.length) out.push({ level: 'info', tag: 'Steady', text: `Nobody dropped out and nobody new appeared against ${ddmm(prev)}.` });

  return out;
}

function stats() {
  if (!weeks.length) return null;
  const last = weeks[weeks.length - 1];
  const comps = rows.filter(r => r.w === last && r.s !== P.YOU);
  const avg = key => {
    const v = comps.map(r => r[key]).filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const fmt = v => (v == null ? 'no data' : v.toFixed(1) + '%');
  return { last, nComp: comps.length, avgImp: fmt(avg('imp')), avgOv: fmt(avg('ov')), avgOt: fmt(avg('ot')) };
}

const points = analyse();
const st = stats();

if (asJson) {
  console.log(JSON.stringify({
    label,
    weeks: weeks.length,
    range: weeks.length ? [weeks[0], weeks[weeks.length - 1]] : [],
    reportType: parsed.type,
    stats: st,
    points,
  }, null, 2));
} else {
  const icon = { info: '•', warn: '!' };
  console.log(`\nAuction Insights — ${label} (${weeks.length} weeks, latest: ${weeks.slice(-2).map(ddmm).join(' to ')})`);
  if (st) console.log(`  Week of ${ddmm(st.last)}: ${st.nComp} competitor${st.nComp === 1 ? '' : 's'} · competitor averages — impression share ${st.avgImp}, overlap ${st.avgOv}, outranking ${st.avgOt}`);
  if (!points.length) console.log('  (not enough data)');
  points.forEach(p => console.log(`  ${icon[p.level] || '•'} ${p.tag}: ${p.text}`));
  const alerts = points.filter(p => p.level === 'warn').length;
  console.log(`  -> ${alerts ? alerts + ' thing' + (alerts === 1 ? '' : 's') + ' worth a look' : 'nothing that needs attention'}`);
}
