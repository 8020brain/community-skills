#!/usr/bin/env node
/**
 * Google Ads build check sheet
 *
 * Reads <folder>/sheet.cjs, checks every line of ad copy, and writes
 * <folder>/index.html: a self-contained client page showing the campaign plan
 * and ad wording for approval before anything goes live.
 *
 *   node .claude/skills/google-ads-build-check-sheet/scripts/build-sheet.mjs clients/<key>/build-sheet
 *   node .../build-sheet.mjs clients/<key>/build-sheet --check     validate only, write nothing
 *
 * Refuses to write if any line breaks a Google limit or a house rule
 * (see `rules` in the sheet). It never connects to Google Ads.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const b = require('./blocks.cjs');
const { esc } = b;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const dirArg = args.find((a) => !a.startsWith('--'));
if (!dirArg) {
  console.error('Usage: build-sheet.mjs <folder containing sheet.cjs> [--check]');
  process.exit(1);
}
const DIR = resolve(dirArg);
const SHEET = join(DIR, 'sheet.cjs');
if (!existsSync(SHEET)) {
  console.error(`No sheet.cjs in ${DIR}. Copy examples/harbour-paws/sheet.cjs there to start.`);
  process.exit(1);
}

let sheet = require(SHEET);
if (typeof sheet === 'function') sheet = sheet(b);

const meta = sheet.meta || {};
const copy = sheet.copy || {};
const rules = {
  spelling: 'au', // 'au' (also right for NZ and UK), 'us', or 'off'
  ampersand: true, // "&" instead of "and" in ad copy, saves characters
  titleCase: true, // Every Word Capitalised
  descMin: 78, // descriptions shorter than this waste paid-for space; 0 turns it off
  descriptionsPerAd: 4, // exact number wanted per ad; 0 means anything from 2 to 4
  banned: [], // [{ pattern: /regex/i, why: 'reason' }], e.g. AHPRA words for health clients
  ...(sheet.rules || {}),
};

// ---------------------------------------------------------------- copy

const SHARED_USP = copy.SHARED_USP || [];
const SHARED_CTA = copy.SHARED_CTA || [];
const SHARED_HEADLINES = copy.SHARED_HEADLINES || [...SHARED_USP, ...SHARED_CTA];
const SHARED_DESC = copy.SHARED_DESC || [];
const AD_GROUPS = copy.AD_GROUPS || [];
const SITELINKS = copy.SITELINKS || [];
const SITELINKS_REMOVE = copy.SITELINKS_REMOVE || [];
const CALLOUTS = copy.CALLOUTS || [];
const SNIPPETS = copy.SNIPPETS || null;
const CALL_ASSET = copy.CALL_ASSET || null;

// ---------------------------------------------------------------- validation

const LIMITS = {
  headline: 30,
  description: 90,
  callout: 25,
  sitelinkText: 25,
  sitelinkDesc: 35,
  snippetValue: 25,
  path: 15,
};
const MAX_HEADLINES = 15;
const MIN_HEADLINES = 3;

const problems = [];

const check = (kind, value, where) => {
  if (typeof value !== 'string' || !value.trim()) {
    problems.push(`${where}: empty ${kind}`);
    return;
  }
  if (value.length > LIMITS[kind]) {
    problems.push(`${where}: ${kind} is ${value.length}/${LIMITS[kind]} - "${value}"`);
  }
};

// US spellings to catch in Australian, NZ or UK copy. Keywords are never checked,
// because people search in both spellings.
const US_WORDS = [
  [/\bpediatric/i, 'paediatric'], [/\borthopedic/i, 'orthopaedic'], [/\bcolor/i, 'colour'],
  [/\bfavorite/i, 'favourite'], [/\bbehavior/i, 'behaviour'], [/\bhonor/i, 'honour'],
  [/\blabor\b/i, 'labour'], [/\bneighbor/i, 'neighbour'], [/\bflavor/i, 'flavour'],
  [/\bcenter(s|ed)?\b/i, 'centre'], [/\btheater/i, 'theatre'], [/\bfiber/i, 'fibre'],
  [/\bjewelry/i, 'jewellery'], [/\bgray\b/i, 'grey'], [/\bcatalog\b/i, 'catalogue'],
  [/\banalyz/i, 'analyse'], [/\bdefense\b/i, 'defence'], [/\bmold(s|ing)?\b/i, 'mould'],
  [/\benroll(ment|s)?\b/i, 'enrol'], [/\b(travel|cancel|model|label|fuel)(ed|ing|er)\b/i, 'double l'],
  [/\bcheck(s)?\b(?= (payment|book))/i, 'cheque'], [/\bpajama/i, 'pyjama'], [/\btire(s)?\b(?= (fitting|repair|change))/i, 'tyre'],
];
const IZE_OK = /(size|prize|seize|maize|baize|capsize)/i;
const IZE = /\b[\p{L}]+iz(e|es|ed|ing|ation|ations|er|ers)\b/giu;

// The reverse, for US clients.
const AU_WORDS = [
  [/\bpaediatric/i, 'pediatric'], [/\borthopaedic/i, 'orthopedic'], [/\bcolour/i, 'color'],
  [/\bfavourite/i, 'favorite'], [/\bbehaviour/i, 'behavior'], [/\bhonour/i, 'honor'],
  [/\blabour\b/i, 'labor'], [/\bneighbour/i, 'neighbor'], [/\bflavour/i, 'flavor'],
  [/\bcentre(s|d)?\b/i, 'center'], [/\btheatre/i, 'theater'], [/\bfibre/i, 'fiber'],
  [/\bjewellery/i, 'jewelry'], [/\bgrey\b/i, 'gray'], [/\bcatalogue\b/i, 'catalog'],
  [/\banalys(e|es|ed|ing)\b/i, 'analyze'], [/\bdefence\b/i, 'defense'], [/\bmould/i, 'mold'],
  [/\benrol(ment|s)?\b/i, 'enroll'], [/\b(travel|cancel|model|label|fuel)l(ed|ing|er)\b/i, 'single l'],
  [/\bcheque/i, 'check'], [/\btyre/i, 'tire'], [/\bpyjama/i, 'pajama'],
];

const spelling = (text) => {
  const hits = [];
  if (rules.spelling === 'au') {
    for (const [re, want] of US_WORDS) if (re.test(text)) hits.push(`US spelling, want ${want}`);
    for (const m of text.matchAll(IZE)) if (!IZE_OK.test(m[0])) hits.push(`"${m[0]}" is US spelling, use -ise`);
  } else if (rules.spelling === 'us') {
    for (const [re, want] of AU_WORDS) if (re.test(text)) hits.push(`non-US spelling, want ${want}`);
  }
  return hits;
};

const titleCased = (text) =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => {
      const stripped = w.replace(/^[^\p{L}\p{N}]+/u, '');
      const first = stripped[0];
      if (!first || /\p{N}/u.test(first)) return true;
      return first === first.toUpperCase();
    });

const style = (text, where, kind, opts = {}) => {
  if (typeof text !== 'string') return;
  for (const hit of spelling(text)) problems.push(`${where}: ${kind} ${hit} - "${text}"`);
  if (rules.ampersand && /\band\b/i.test(text)) problems.push(`${where}: ${kind} spells out "and", use "&" - "${text}"`);
  if (rules.titleCase && !titleCased(text)) problems.push(`${where}: ${kind} is not Title Case - "${text}"`);
  for (const { pattern, why } of rules.banned) {
    if (pattern.test(text)) problems.push(`${where}: ${kind} breaks a rule (${why}) - "${text}"`);
  }
  if (opts.min && text.length < opts.min) {
    problems.push(`${where}: ${kind} is only ${text.length} characters, minimum ${opts.min} - "${text}"`);
  }
};

const descMin = rules.descMin || 0;

SHARED_HEADLINES.forEach((h) => { check('headline', h, 'Shared'); style(h, 'Shared', 'headline'); });
SHARED_DESC.forEach((d) => { check('description', d, 'Shared'); style(d, 'Shared', 'description', { min: descMin }); });

if (!AD_GROUPS.length) problems.push('copy.AD_GROUPS is empty. A build check sheet needs at least one ad group.');

for (const ag of AD_GROUPS) {
  const where = ag.name || '(unnamed ad group)';
  ag.headlines = ag.headlines || [];
  ag.descriptions = ag.descriptions || [];
  ag.keywords = ag.keywords || [];
  ag.path = ag.path || [];
  ag.allHeadlines = [...ag.headlines, ...SHARED_HEADLINES];
  ag.allDescriptions = [...ag.descriptions, ...SHARED_DESC];

  if (!ag.name) problems.push('An ad group has no name.');
  if (!ag.keywords.length) problems.push(`${where}: no keywords`);
  ag.headlines.forEach((h) => { check('headline', h, where); style(h, where, 'headline'); });
  ag.descriptions.forEach((d) => { check('description', d, where); style(d, where, 'description', { min: descMin }); });
  ag.path.forEach((p) => check('path', p, where));
  if (ag.path.length > 2) problems.push(`${where}: ${ag.path.length} path parts, Google allows 2`);

  const lower = ag.allHeadlines.map((h) => h.toLowerCase());
  const dupes = ag.allHeadlines.filter((h, i) => lower.indexOf(h.toLowerCase()) !== i);
  if (dupes.length) problems.push(`${where}: duplicate headline - ${[...new Set(dupes)].join(', ')}`);
  if (ag.allHeadlines.length > MAX_HEADLINES) problems.push(`${where}: ${ag.allHeadlines.length} headlines, Google allows ${MAX_HEADLINES}`);
  if (ag.allHeadlines.length < MIN_HEADLINES) problems.push(`${where}: ${ag.allHeadlines.length} headlines, Google needs at least ${MIN_HEADLINES}`);
  const n = ag.allDescriptions.length;
  if (rules.descriptionsPerAd && n !== rules.descriptionsPerAd) {
    problems.push(`${where}: ${n} descriptions, want ${rules.descriptionsPerAd}`);
  } else if (n < 2 || n > 4) {
    problems.push(`${where}: ${n} descriptions, Google needs 2 to 4`);
  }
}

SITELINKS.forEach((s) => {
  const where = `Sitelink "${s.text}"`;
  check('sitelinkText', s.text, where);
  if (s.d1) check('sitelinkDesc', s.d1, where);
  if (s.d2) check('sitelinkDesc', s.d2, where);
  [s.text, s.d1, s.d2].filter(Boolean).forEach((t) => style(t, where, 'text'));
});
CALLOUTS.forEach((c) => { check('callout', c.text, 'Callout'); style(c.text, 'Callout', 'text'); });
if (SNIPPETS) {
  (SNIPPETS.values || []).forEach((v) => { check('snippetValue', v, 'Snippet'); style(v, 'Snippet', 'value'); });
  const n = (SNIPPETS.values || []).length;
  if (n < 3 || n > 10) problems.push(`Snippet: ${n} values, Google needs 3 to 10`);
}

if (problems.length) {
  console.error(`\nCOPY FAILED ${problems.length} CHECK${problems.length === 1 ? '' : 'S'}. Nothing written.\n`);
  problems.forEach((p) => console.error('  ' + p));
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------- totals

const actionOf = (a) => a && (a.action || 'new');
const assets = [...SITELINKS, ...CALLOUTS, SNIPPETS, CALL_ASSET].filter(Boolean);
const descLens = AD_GROUPS.flatMap((a) => a.allDescriptions).map((d) => d.length);
const totals = {
  adGroups: AD_GROUPS.length,
  keywords: AD_GROUPS.reduce((n, a) => n + a.keywords.length, 0),
  sharedLines: SHARED_HEADLINES.length + SHARED_DESC.length,
  maxPerAd: Math.max(...AD_GROUPS.map((a) => a.allHeadlines.length)),
  descPerAd: Math.max(...AD_GROUPS.map((a) => a.allDescriptions.length)),
  avgDesc: Math.round(descLens.reduce((a, c) => a + c, 0) / descLens.length),
  keep: assets.filter((a) => actionOf(a) === 'keep').length,
  update: assets.filter((a) => actionOf(a) === 'update').length,
  add: assets.filter((a) => actionOf(a) === 'new').length,
  remove:
    SITELINKS_REMOVE.reduce((n, s) => n + (s.count || 1), 0) +
    CALLOUTS.filter((c) => c.action === 'remove').length,
};
const hasExisting = assets.some((a) => a.have) || SITELINKS_REMOVE.length > 0;

if (checkOnly) {
  console.log('Passes every check. --check given, nothing written.');
  process.exit(0);
}

// ---------------------------------------------------------------- theme

const DEFAULT_LIGHT = {
  ground: '#F7F7F5', surface: '#FFFFFF', 'surface-2': '#EFEFEC',
  ink: '#0B0B0B', 'ink-2': '#3A3A38', muted: '#6F6D68', line: '#E0E0DB', 'line-strong': '#C2C2BB',
  brand: '#2458D6', 'brand-ink': '#FFFFFF', accent: '#1B47B0', 'accent-soft': '#E6EDFB',
  good: '#3E7A55', 'good-soft': '#E2EFE7', warn: '#8A6A12', 'warn-soft': '#FBF3D4',
  shadow: '0 1px 2px rgba(11,11,11,.06),0 4px 14px rgba(11,11,11,.05)',
  'serp-link': '#1A0DAB', 'serp-ground': '#FFFFFF', over: '#A83226',
};
const DEFAULT_DARK = {
  ground: '#111211', surface: '#1A1B1A', 'surface-2': '#232523',
  ink: '#F1F2F0', 'ink-2': '#C8CBC6', muted: '#8B8F8A', line: '#2D302D', 'line-strong': '#444843',
  brand: '#6C9BFF', 'brand-ink': '#08142E', accent: '#8DB2FF', 'accent-soft': '#16213A',
  good: '#79C79A', 'good-soft': '#1B2C22', warn: '#E4C46A', 'warn-soft': '#2E2717',
  shadow: '0 1px 2px rgba(0,0,0,.5),0 4px 14px rgba(0,0,0,.35)',
  'serp-link': '#99C3FF', 'serp-ground': '#1C252E', over: '#E58A7C',
};
const DEFAULT_FONTS = {
  head: '"Barlow Condensed","Source Sans 3",sans-serif',
  body: '"Source Sans 3",ui-sans-serif,system-ui,sans-serif',
  mono: '"IBM Plex Mono",ui-monospace,monospace',
  googleFonts:
    'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
};

const theme = sheet.theme || {};
// theme.brand is a shortcut: one hex colour used for the brand edge in both modes.
const shortcut = theme.brand ? { brand: theme.brand, accent: theme.brand } : {};
const light = { ...DEFAULT_LIGHT, ...shortcut, ...(theme.light || {}) };
const dark = { ...DEFAULT_DARK, ...(theme.brand ? { brand: theme.brand, accent: theme.brand } : {}), ...(theme.dark || {}) };
if (theme.brand && !(theme.light || {})['accent-soft']) light['accent-soft'] = `color-mix(in srgb, ${theme.brand} 12%, #FFFFFF)`;
if (theme.brand && !(theme.dark || {})['accent-soft']) dark['accent-soft'] = `color-mix(in srgb, ${theme.brand} 18%, #1A1B1A)`;
const fonts = { ...DEFAULT_FONTS, ...(theme.fonts || {}) };

const vars = (map) => Object.entries(map).map(([k, v]) => `--${k}:${v};`).join(' ');
const themeCss = `
:root{ ${vars(light)} --font-head:${fonts.head}; --font-body:${fonts.body}; --font-mono:${fonts.mono}; }
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){ ${vars(dark)} }}
:root[data-theme="dark"]{ ${vars(dark)} }`;

// ---------------------------------------------------------------- logos

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const inline = (file) => {
  if (!file) return null;
  if (/^(https?:|data:)/.test(file)) return file;
  const p = resolve(DIR, file);
  if (!existsSync(p)) {
    console.warn(`  logo not found, using text instead: ${p}`);
    return null;
  }
  const mime = MIME[extname(p).toLowerCase()] || 'image/png';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
};
const logos = meta.logos || {};
const clientLogo = inline(logos.client);
const agencyLogo = inline(logos.agency);

// ---------------------------------------------------------------- render

const client = meta.client || 'Your business';
const preparedBy = meta.preparedBy || '';
const built = meta.status === 'built';
const domain = (meta.domain || 'yourwebsite.com.au').replace(/^https?:\/\//, '').replace(/\/$/, '');

let n = 0;
const section = (title, html) => {
  n += 1;
  return `
<section>
  <div class="shead"><span class="num">${String(n).padStart(2, '0')}</span><h2>${title}</h2></div>
${html}
</section>`;
};

const copyList = (items, limit, cls = '', shared = new Set()) => `
      <ul class="copy ${cls}">
${items
  .map((t) => {
    const isShared = shared.has(t);
    return `        <li${isShared ? ' class="is-shared"' : ''}><span>${esc(t)}${isShared ? '<em class="shr">Shared</em>' : ''}</span><span class="len${t.length > limit ? ' over' : ''}">${t.length}</span></li>`;
  })
  .join('\n')}
      </ul>`;

const SHARED_H = new Set(SHARED_HEADLINES);
const SHARED_D = new Set(SHARED_DESC);

const pill = {
  keep: b.pill('Already there', 'old'),
  update: b.pill('Updated', 'upd'),
  new: b.pill(hasExisting ? 'Added' : 'New', 'new'),
  remove: b.pill('Removed', 'old'),
};

const serpTitle = (ag) => {
  const lead = ag.headlines.slice(0, 2);
  const tail = SHARED_CTA[0] || SHARED_HEADLINES.find((h) => !lead.includes(h)) || ag.headlines[2];
  return [...lead, tail].filter(Boolean).join(' | ');
};
const serpDesc = (ag) => [ag.descriptions[0] || SHARED_DESC[0], ag.descriptions[0] ? SHARED_DESC[0] : SHARED_DESC[1]].filter(Boolean).join(' ');
const serpPath = (ag) => [domain, ...ag.path].map(esc).join('/');

const adGroup = (ag, i) => `
  <details class="adgrp">
    <summary>
      <span class="agname">${i + 1}. ${esc(ag.name)}</span>
      <span class="cnt">${ag.allHeadlines.length} headlines &middot; ${ag.allDescriptions.length} descriptions</span>
    </summary>
    <div class="bd">
      ${ag.intent ? `<p class="why">${esc(ag.intent)}</p>` : ''}
      <div class="plabel">Searches this ad answers</div>
      <div>${ag.keywords.map((k) => `<span class="kwchip">${esc(k)}</span>`).join('')}</div>

      <div class="plabel">How it could show on Google</div>
      <div class="serp">
        <div class="sp">Sponsored</div>
        <div class="u">${serpPath(ag)}</div>
        <div class="t">${esc(serpTitle(ag))}</div>
        <div class="d">${esc(serpDesc(ag))}</div>
${SITELINKS.length ? `        <div class="sl">\n${SITELINKS.slice(0, 4).map((s) => `          <span>${esc(s.text)}</span>`).join('\n')}\n        </div>` : ''}
      </div>
      <p class="snote">Google mixes and matches the lines, so what shows changes with each search. This is one likely combination.${SITELINKS.length ? ' The blue links are your sitelinks and can appear on every ad.' : ''}</p>

      <div class="plabel">All ${ag.allHeadlines.length} headlines in this ad &middot; ${LIMITS.headline} character limit</div>
${copyList(ag.allHeadlines, LIMITS.headline, '', SHARED_H)}
      <div class="plabel">All ${ag.allDescriptions.length} descriptions in this ad &middot; ${LIMITS.description} character limit</div>
${copyList(ag.allDescriptions, LIMITS.description, 'one', SHARED_D)}
      <p class="snote">${totals.sharedLines ? `The lines marked <em class="shr">Shared</em> run in all ${totals.adGroups} ads and are written once, so changing one changes it everywhere. The rest are written only for this ad group. ` : ''}${ag.note ? esc(ag.note) : ''}</p>
    </div>
  </details>`;

const assetRow = (text, detail, action, have) => `
      <tr>
        <td class="ag">${esc(text)}</td>
        <td>${detail}${have ? `<span class="sub">${esc(have)}</span>` : ''}</td>
        <td>${pill[action] || pill.new}</td>
      </tr>`;

const custom = (list = []) => list.map((s) => section(s.title, s.html)).join('\n');

// -- targeting
const t = sheet.targeting;
const targetingHtml = t
  ? [
      t.intro ? b.note(t.intro) : '',
      t.locations && t.locations.length
        ? b.table(['Area we target', 'What it covers'], t.locations.map(([area, covers]) => [esc(area), esc(covers || '')]))
        : '',
      t.stats && t.stats.length ? b.stats(t.stats).replace('class="strip"', 'class="strip" style="margin-top:22px"') : '',
      t.negatives && t.negatives.lists && t.negatives.lists.length
        ? `  <div class="plabel" style="margin-top:30px">Searches we block before they cost you anything</div>
  ${b.note(t.negatives.intro || `Just as important as choosing what to appear for is choosing what not to. We have loaded <strong>${t.negatives.lists.reduce((s, l) => s + (l.count || 0), 0)} blocked terms</strong> across ${t.negatives.lists.length} lists, so your budget is not spent on people who were never going to buy.`)}
${b.table(['What we block', 'Examples', 'Terms'], t.negatives.lists.map((l) => [esc(l.name), esc(l.examples || ''), `<span class="num2">${l.count ?? ''}</span>`]))}`
        : '',
      b.calls(t.notes),
    ].join('\n')
  : '';

// -- positioning
const pos = sheet.positioning;
const positioningHtml = pos
  ? [
      pos.intro ? b.note(pos.intro) : '',
      pos.pillars && pos.pillars.length
        ? `  <div class="pillars">
${pos.pillars.map((p, i) => `    <div class="pil"><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="h">${p.h}</div><div class="d">${p.d}</div></div>`).join('\n')}
  </div>`
        : '',
      b.calls(pos.notes),
    ].join('\n')
  : '';

// -- shared lines
const sharedHtml = totals.sharedLines
  ? `  ${b.note(`These ${totals.sharedLines} lines appear in all ${totals.adGroups} of your ads. They are written once and reused, so changing a word here changes it everywhere at once${totals.adGroups > 1 ? ` rather than in ${totals.adGroups} separate places` : ''}. Everything in the next section is wording written for one ad group only.`)}
${SHARED_USP.length ? `  <div class="plabel">Your selling points, in every ad</div>\n${copyList(SHARED_USP, LIMITS.headline)}` : ''}
${SHARED_CTA.length ? `  <div class="plabel">Your calls to action, in every ad</div>\n${copyList(SHARED_CTA, LIMITS.headline)}` : ''}
${!SHARED_USP.length && !SHARED_CTA.length && SHARED_HEADLINES.length ? `  <div class="plabel">Shared headlines, in every ad</div>\n${copyList(SHARED_HEADLINES, LIMITS.headline)}` : ''}
${SHARED_DESC.length ? `  <div class="plabel">Shared descriptions, in every ad</div>\n${copyList(SHARED_DESC, LIMITS.description, 'one')}` : ''}
  ${b.call('Why the numbers beside each line matter', `Google gives you ${LIMITS.headline} characters for a headline and ${LIMITS.description} for a description, and charges the same whether you use them or not. The number is what each line uses. Across your ads the descriptions average ${totals.avgDesc} of the ${LIMITS.description} available.`)}`
  : '';

// -- ads
const adsStatus = built
  ? b.call('Built in your account and paused', 'Every ad below is now in your Google Ads account, switched off. Nothing runs and no budget is spent until we switch it on together. If you would like a line changed, tell us before we go live, because Google will not let us edit an ad in place once it is running.')
  : b.call('Waiting on your approval', 'None of this is in your Google Ads account yet. Once you are happy with the wording we build it, paused, and nothing runs until we switch it on together. Changes are easiest now, because Google will not let us edit an ad in place once it is running.');
const adsHtml = `  ${b.note(sheet.adsIntro || `${totals.adGroups} group${totals.adGroups === 1 ? '' : 's'} of ads, each answering one thing people type into Google. Google builds each ad by picking from a pool of headlines and descriptions, then testing the combinations, so the wording is raw material rather than a finished ad. Each ad gets up to ${totals.maxPerAd} headlines and ${totals.descPerAd} descriptions${totals.maxPerAd === MAX_HEADLINES ? ', the most Google allows' : ''}. <strong>Tap any ad group below to open it.</strong>`)}
  ${adsStatus}
${AD_GROUPS.map(adGroup).join('\n')}`;

// -- assets
const assetStats = [
  hasExisting ? { label: 'Already correct', value: `${totals.keep} assets`, sub: 'Kept as they were' } : null,
  hasExisting ? { label: 'To update', value: `${totals.update} assets`, sub: 'Rewritten and sharper' } : null,
  { label: hasExisting ? 'To add' : 'New', value: `${totals.add} assets`, sub: 'Brand new' },
  totals.remove ? { label: 'To remove', value: `${totals.remove} assets`, sub: 'Taken out', wait: true } : null,
].filter(Boolean);
const anyAssets = SITELINKS.length || CALLOUTS.length || SNIPPETS || CALL_ASSET || SITELINKS_REMOVE.length;
const assetsHtml = anyAssets
  ? [
      b.note(sheet.assetsIntro || `These sit beneath the ad and give people a second and third way in. They usually lift the click rate on the whole ad and cost nothing extra.${hasExisting ? ' We read what is already in your account, and this is what we would change.' : ''}`),
      b.stats(assetStats),
      b.calls(sheet.assetNotes),
      SITELINKS.length || SITELINKS_REMOVE.length
        ? `  <div class="plabel" style="margin-top:26px">Sitelinks, the blue links under the ad</div>
  <div class="tw"><table>
    <thead><tr><th>Link</th><th>What it will say${hasExisting ? ', and what is there now' : ''}</th><th>Action</th></tr></thead>
    <tbody>
${SITELINKS.map((s) => assetRow(s.text, [s.d1, s.d2].filter(Boolean).map(esc).join(' &middot; '), actionOf(s), s.have)).join('')}
${SITELINKS_REMOVE.map((s) => assetRow(s.text, `<em>${esc(s.detail || 'Being taken out')}</em>`, 'remove', s.why)).join('')}
    </tbody>
  </table></div>`
        : '',
      CALLOUTS.length
        ? `  <div class="plabel" style="margin-top:26px">Callouts, short phrases under the ad</div>
  <div class="tw"><table>
    <thead><tr><th>Callout</th><th>${hasExisting ? 'What is there now' : 'Length'}</th><th>Action</th></tr></thead>
    <tbody>
${CALLOUTS.map((c) => assetRow(c.text, `<span class="num2">${c.text.length}/${LIMITS.callout} characters</span>`, actionOf(c), c.have)).join('')}
    </tbody>
  </table></div>`
        : '',
      SNIPPETS
        ? `  <div class="plabel" style="margin-top:26px">${esc(SNIPPETS.header || 'Services')}, a list of what you do</div>
  <div class="tw"><table>
    <thead><tr><th>Header</th><th>Values</th><th>Action</th></tr></thead>
    <tbody>
      <tr>
        <td class="ag">${esc(SNIPPETS.header || 'Services')}</td>
        <td>${SNIPPETS.values.map((v) => `<span class="kwchip">${esc(v)}</span>`).join('')}${SNIPPETS.have ? `<span class="sub">${esc(SNIPPETS.have)}</span>` : ''}</td>
        <td>${pill[actionOf(SNIPPETS)]}</td>
      </tr>
    </tbody>
  </table></div>`
        : '',
      CALL_ASSET
        ? `  <div class="plabel" style="margin-top:26px">Call button</div>
  ${b.call(`Set to ${esc(CALL_ASSET.proposed)}`, CALL_ASSET.note || `The tap to call button in your ads rings this number${CALL_ASSET.have && CALL_ASSET.have !== CALL_ASSET.proposed ? `, replacing ${esc(CALL_ASSET.have)}` : ''}.`)}`
        : '',
    ].join('\n')
  : '';

// -- checklist
const STATUS = { done: b.pill('Done', 'upd'), waiting: b.pill('Waiting', 'wait'), todo: b.pill('To do', 'old') };
const cl = sheet.checklist;
const checklistHtml = cl && cl.items && cl.items.length
  ? `${b.table(['Step', 'Who', 'Status'], cl.items.map((i) => [esc(i.step), esc(i.who || ''), STATUS[i.status] || STATUS.todo]))}
${b.calls(cl.notes)}`
  : '';

// -- asks
const asksHtml = sheet.asks && sheet.asks.length
  ? b.list(sheet.asks.map((a) => (a.title ? `<strong>${a.title}</strong> ${a.body || ''}` : a.body || a)))
  : '';

const body = [
  custom(sheet.before),
  targetingHtml && section(t.title || 'Where your ads will show', targetingHtml),
  positioningHtml && section(pos.title || 'What every ad says about you', positioningHtml),
  sharedHtml && section('The lines every ad shares', sharedHtml),
  section('Your ads', adsHtml),
  assetsHtml && section('The extras under every ad', assetsHtml),
  custom(sheet.after),
  checklistHtml && section((cl && cl.title) || 'What is left before we go live', checklistHtml),
  asksHtml && section('What we need from you', asksHtml),
]
  .filter(Boolean)
  .join('\n');

const title = meta.title || `${client} Google Ads Build`;
const eyebrow = meta.eyebrow || [client, 'Google Ads', meta.date].filter(Boolean).map(esc).join(' &nbsp;/&nbsp; ');
const lede =
  meta.lede ||
  (built
    ? `This is your Google Ads build before it goes live: where the ads will show, what they say, and what we need from you. Everything is in your account and paused, so nothing runs and no budget is spent until we switch it on together.`
    : `This is the plan for your Google Ads before anything goes live: where the ads will show, what they will say, and what we need from you. Nothing runs and no budget is spent until you have approved it.`);
const footer =
  meta.footer ||
  `Prepared for ${esc(client)}${preparedBy ? ` by ${esc(preparedBy)}` : ''}${meta.date ? `, ${esc(meta.date)}` : ''}. ${built ? 'Your campaign is built and paused.' : 'Nothing is live yet.'} No budget is spent until we switch it on together.`;

const clientMark = clientLogo
  ? `<img class="logo-client${logos.clientBoxed ? ' boxed' : ''}" src="${clientLogo}" alt="${esc(client)}">`
  : `<span class="logo-text">${esc(client)}</span>`;
const agencyMark = agencyLogo
  ? `<img src="${agencyLogo}" alt="${esc(preparedBy)}">`
  : preparedBy
    ? `<span class="by-text">${esc(preparedBy)}</span>`
    : '';

const css = readFileSync(join(HERE, '..', 'assets', 'sheet.css'), 'utf8');

const html = `<!doctype html>
<html lang="${meta.lang || 'en-AU'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts.googleFonts}">
<style>
${themeCss}
${css}
</style>
</head>
<body>
<div class="wrap">
<div class="topbar">
  <div>${clientMark}</div>
  ${agencyMark ? `<div class="byline"><span class="lbl">Prepared&nbsp;by</span>${agencyMark}</div>` : ''}
</div>

<header>
  <span class="eyebrow">${eyebrow}</span>
  <h1>${esc(meta.heading || 'Your Google Ads Build')}</h1>
  <p class="lede">${lede}</p>
</header>
${sheet.summary && sheet.summary.length ? b.stats(sheet.summary) : ''}
${body}

<footer>${footer}</footer>
</div>
</body>
</html>
`;

const OUT = join(DIR, 'index.html');
writeFileSync(OUT, html, 'utf8');

console.log('Passes every check: Google limits, spelling, Title Case, ampersands, minimum lengths.');
console.log(`  ${totals.adGroups} ad groups, ${totals.keywords} keywords, up to ${totals.maxPerAd} headlines per ad, descriptions average ${totals.avgDesc}/90`);
if (anyAssets) console.log(`  assets: ${totals.keep} keep, ${totals.update} update, ${totals.add} new, ${totals.remove} remove`);
console.log(`  wrote ${OUT}`);
