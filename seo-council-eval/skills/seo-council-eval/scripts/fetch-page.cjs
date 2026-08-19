#!/usr/bin/env node
/**
 * fetch-page.cjs — capture a page's real copy for the council to score.
 *
 * WHY THIS EXISTS (learned the hard way, 2026-08-08):
 * A council run scored a page using a source file built from a summarizing
 * fetcher. The fetcher silently dropped four of seven events and two of four
 * press links. Five of six independent readers then scored the page down for
 * "missing" content that was live on the page the whole time, and the run had
 * to be thrown away and re-run at full cost.
 *
 * A summarizer cannot be trusted to establish ABSENCE, and most of this
 * council's findings are absence claims: no link to the hub, no price stated,
 * no byline, no date on the event. So the source must be extracted
 * mechanically from raw HTML. That is all this script does.
 *
 * Usage:
 *   node fetch-page.cjs <url> [--out source.md] [--selector main|article|body]
 *                        [--expect url1,url2] [--browser-ua]
 *
 * Output is a markdown source file: metadata, a complete body-link inventory,
 * and the full body text with headings marked. Hand it to the scoring agents
 * as-is. Do not retype it, do not summarize it, do not "tidy" it.
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

// Default identifies the tool honestly. Some sites sit behind bot protection
// that 403s any unfamiliar agent, including a client's own storefront. Pass
// --browser-ua to present a standard desktop agent instead. Use it for pages you
// have a legitimate reason to read, which for this council means a client's or
// a named prospect's own public pages, and never to get around a login, a
// paywall, or an explicit instruction not to crawl.
const UA_DEFAULT = 'Mozilla/5.0 (compatible; seo-council-eval/1.0)';
const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function fetch(url, redirects = 0, ua = UA_DEFAULT) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetch(next, redirects + 1, ua));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ html: data, finalUrl: url }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Timed out after 30s')); });
  });
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function unescapeHtml(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (ENT[e]) return ENT[e];
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

function pickMain(html, selector) {
  const order = selector ? [selector] : ['main', 'article'];
  for (const tag of order) {
    if (tag === 'body') break;
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'i'));
    if (m) return { region: m[0], via: `<${tag}>` };
  }
  const b = html.match(/<body\b[^>]*>[\s\S]*?<\/body>/i);
  return { region: b ? b[0] : html, via: '<body> (no main/article found)' };
}

function stripNoise(s) {
  return s.replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '');
}

function toText(region) {
  let s = stripNoise(region);
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, lv, inner) => `\n\n[H${lv}] ${unescapeHtml(inner.replace(/<[^>]+>/g, '')).trim()}\n`);
  s = s.replace(/<li\b[^>]*>/gi, '\n  - ');
  s = s.replace(/<\/(p|div|li|tr|section|blockquote)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = unescapeHtml(s);
  s = s.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Anchor extraction. Handles double-quoted, single-quoted and unquoted href,
 * because a regex that only matched href="..." silently captured 1 link in 3 on
 * a test page, and every absence claim this council makes about linking depends
 * on this being complete.
 */
function links(region, base) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(stripNoise(region))) !== null) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel):/i.test(raw)) continue;
    const text = unescapeHtml(m[4].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    let href; try { href = new URL(raw, base).href; } catch { href = raw; }
    const key = text + '|' + href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: text || '(no anchor text)', href });
  }
  return out;
}

/** JSON-LD blocks, pulled out before script tags are stripped as noise. */
function jsonLd(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const types = [];
      const walk = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n['@type']) types.push(...[].concat(n['@type']));
        Object.values(n).forEach(walk);
      };
      walk(parsed);
      out.push({ ok: true, types: [...new Set(types)], raw });
    } catch (e) {
      out.push({ ok: false, error: e.message, raw: raw.slice(0, 300) });
    }
  }
  return out;
}

/** Regions outside the content area that still carry scoreable facts. */
function outsideRegion(html) {
  const grab = tag => {
    const m = html.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'i'));
    return m ? m[0] : '';
  };
  const footer = grab('footer');
  const forms = [];
  const fre = /<form\b[^>]*>[\s\S]*?<\/form>/gi;
  let m;
  while ((m = fre.exec(html)) !== null) {
    const f = m[0];
    const action = (f.match(/action\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '(none)';
    const labels = [...f.matchAll(/<(?:button|label|legend)\b[^>]*>([\s\S]*?)<\/(?:button|label|legend)>/gi)]
      .map(x => unescapeHtml(x[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const submit = (f.match(/<input\b[^>]*type\s*=\s*["']?submit["']?[^>]*value\s*=\s*["']([^"']+)/i) || [])[1];
    if (submit) labels.push(submit);
    forms.push({ action, labels: [...new Set(labels)] });
  }
  return { footerText: footer ? toText(footer) : '', forms };
}

/** Headings in document order, with level, from the content region. */
function headings(region) {
  const out = [];
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = re.exec(stripNoise(region))) !== null) {
    const text = unescapeHtml(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text) out.push({ level: +m[1], text });
  }
  return out;
}

const GENERIC_ANCHORS = [
  'click here', 'here', 'read more', 'learn more', 'more', 'this page',
  'link', 'this', 'find out more', 'see more', 'details', 'website',
];

function words(text) {
  return text.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length;
}

/** Content-word overlap between two strings, ignoring stopwords. */
function overlap(a, b) {
  const stop = new Set(['the', 'a', 'an', 'at', 'of', 'and', 'or', 'is', 'to', 'in', 'for', 'on', 'what']);
  const norm = s => new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !stop.has(w)) || []);
  const A = norm(a), B = norm(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

/**
 * The checkable half of the on-page dimension, computed rather than eyeballed.
 * A reader still has to judge whether headings are claims or labels, whether
 * anchors are apt, and whether overlap with a sibling is real cannibalization.
 * This just removes the counting errors from underneath those judgments.
 */
function mechanics(region, linkList, pageUrl, title, bodyText, expect) {
  const hs = headings(region);
  const h1s = hs.filter(h => h.level === 1);
  const origin = (() => { try { return new URL(pageUrl).origin; } catch { return ''; } })();

  const classified = linkList.map(l => {
    let internal = false, self = false;
    try {
      const u = new URL(l.href);
      internal = origin && u.origin === origin;
      self = u.href.replace(/\/$/, '') === pageUrl.replace(/\/$/, '');
    } catch { /* leave as external */ }
    const t = l.text.toLowerCase().replace(/[.,!?]$/, '').trim();
    const naked = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(t);
    return { ...l, internal, self, generic: GENERIC_ANCHORS.includes(t), naked };
  });

  const internal = classified.filter(l => l.internal && !l.self);
  const external = classified.filter(l => !l.internal);
  const selfLinks = classified.filter(l => l.self);
  const weak = classified.filter(l => l.generic || l.naked);

  // Hierarchy problems worth naming rather than leaving to a reader to spot.
  const issues = [];
  if (h1s.length === 0) issues.push('**No H1 in the content region.** The page has no declared subject heading.');
  if (h1s.length > 1) issues.push(`**${h1s.length} H1s.** A content region should declare one subject.`);
  for (let i = 1; i < hs.length; i++) {
    if (hs[i].level - hs[i - 1].level > 1) {
      issues.push(`Heading level skips from H${hs[i - 1].level} to H${hs[i].level} at "${hs[i].text.slice(0, 60)}".`);
      break;
    }
  }
  if (!internal.length) issues.push('**No internal links in the content region at all.**');
  else if (internal.length <= 6 && internal.every(l => /^(home|about|contact|solutions|services|products|what we do|who we (are|work with)|connect with us|blog|news|resources|menu)$/i.test(l.text.trim()))) {
    issues.push('**Every internal link looks like navigation, not prose.** Anchors are all site-section names, so this page may declare no contextual relationships despite having links. Check the inventory.');
  }
  const levels = [...new Set(hs.map(h => h.level))].sort();
  if (levels.length === 1 && hs.length > 3) {
    issues.push(`Outline is flat: ${hs.length} headings, all H${levels[0]}, no hierarchy expressed.`);
  }

  const topHeading = hs[0];
  const agree = topHeading && title ? overlap(title, topHeading.text) : null;

  // Match on normalized origin+pathname rather than substring, so that
  // "/tickets/" does not spuriously match "/preview-week-tickets/archive/".
  let expectReport = '';
  if (expect && expect.length) {
    const norm = u => {
      try { const p = new URL(u, pageUrl); return (p.origin + p.pathname).replace(/\/+$/, '').toLowerCase(); }
      catch { return String(u).replace(/\/+$/, '').toLowerCase(); }
    };
    const rows = expect.map(e => {
      const target = norm(e);
      const hit = classified.find(l => norm(l.href) === target)
        || classified.find(l => norm(l.href).endsWith(target.replace(/^https?:\/\/[^/]+/, '')));
      return `| \`${e}\` | ${hit ? '**linked** as "' + hit.text + '"' : '**NOT LINKED**'} |`;
    });
    expectReport = `\n### Expected links\n\nURLs the orchestrator said this page should link (hub, siblings, commercial pages). Matched on normalized origin and path, not substring:\n\n| Expected | Status |\n|---|---|\n${rows.join('\n')}\n`;
  }

  return `## Computed on-page checks

These are counted, not judged. Verify them rather than re-deriving them, and
spend your reasoning on what they cannot settle: whether the headings are claims
or labels, whether the anchors are apt, and whether topical overlap with a
sibling is genuine cannibalization.

- Body word count: **${words(bodyText)}**
- Headings: **${hs.length}** (${levels.map(l => `H${l}: ${hs.filter(h => h.level === l).length}`).join(', ') || 'none'})
- Links in content region: **${classified.length}** total, **${internal.length}** internal, **${external.length}** external, **${selfLinks.length}** self-referential
  - **These counts do not distinguish prose links from chrome.** Breadcrumbs, in-page nav and section CTAs often sit inside \`<main>\` and are counted here as internal. Read the inventory above and judge for yourself which links are contextual; two independent readers correctly caught an earlier version of this line calling six breadcrumb and nav links "internal contextual".
- Weak anchors (generic phrase or bare URL): **${weak.length}**${weak.length ? ' — ' + weak.map(l => `"${l.text}"`).join(', ') : ''}
- Title vs first heading agreement: ${agree === null ? 'n/a' : `**${Math.round(agree * 100)}%** content-word overlap`}

${issues.length ? '### Flagged automatically\n\n' + issues.map(i => `- ${i}`).join('\n') + '\n' : '### Flagged automatically\n\n- Nothing. Hierarchy, H1, and internal linking all pass the mechanical checks.\n'}
### Heading outline, in order

${hs.length ? hs.map(h => `${'  '.repeat(Math.max(0, h.level - 1))}- H${h.level}: ${h.text}`).join('\n') : '_(no headings found)_'}
${expectReport}`;
}

function meta(html, name) {
  const pats = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i'),
  ];
  for (const p of pats) { const m = html.match(p); if (m) return unescapeHtml(m[1]).trim(); }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => !a.startsWith('--'));
  if (!url) {
    console.error('usage: fetch-page.cjs <url> [--out file.md] [--selector main|article|body]');
    process.exit(1);
  }
  const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const outPath = flag('--out');
  // URLs or path fragments this page is expected to link (hub, siblings, ticket
  // pages). Turns the red-flag check from a judgment call into a lookup.
  const expect = (flag('--expect') || '').split(',').map(s => s.trim()).filter(Boolean);

  const ua = args.includes('--browser-ua') ? UA_BROWSER : UA_DEFAULT;
  let res;
  try { res = await fetch(url, 0, ua); }
  catch (e) { console.error(`Fetch failed: ${e.message}`); process.exit(1); }

  const { html } = res;
  const { region, via } = pickMain(html, flag('--selector'));
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1M = region.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const body = toText(region);
  const inv = links(region, url);

  const ld = jsonLd(html);
  const outside = outsideRegion(html);
  // Absence claims are only as good as the extraction. Say plainly when they
  // are safe and when they are not, rather than asserting completeness.
  const jsRisk = /<div[^>]+id=["'](root|app|__next)["']/i.test(html)
    || /window\.__(NUXT|NEXT|INITIAL)/.test(html);
  const confidence = jsRisk ? 'LOW' : (body.length < 400 ? 'LOW' : 'MODERATE');

  const doc = `# SOURCE COPY (mechanically extracted): ${url}

Retrieved ${new Date().toISOString().slice(0, 16).replace('T', ' ')} as raw HTML.
Content region: ${via}. Extracted ${body.length} characters and ${inv.length} links.

## Extraction confidence: ${confidence}

This is the full text of the page's content region as served, not a summary, so
quote from it freely. What it is safe to conclude from an absence depends on the
confidence above.

- **MODERATE** means the server-rendered content region was parsed cleanly. You
  may treat something missing from the body, the link inventory or the metadata
  as genuinely absent from that region, with the caveats below.
- **LOW** means either the body came back suspiciously short or the page shows
  signs of client-side rendering. **Do not score absence.** Say what you could
  not verify and mark your score provisional.

Known limits of this extractor, which apply at any confidence level. It parses
HTML with regular expressions rather than a full DOM, so unusual or malformed
markup can be misread. Content injected by JavaScript after load never appears.
Content hidden behind tabs, accordions or lazy loading may be absent from the
served HTML. If the body looks short for the page, re-run with \`--selector body\`
and compare before drawing any conclusion from what is missing.

Footer, forms and JSON-LD are captured separately below, because they sit
outside the content region but carry facts the rubric asks about.

## Metadata

- Meta title: ${titleM ? unescapeHtml(titleM[1]).replace(/\s+/g, ' ').trim() : '(none)'}
- Meta description: ${meta(html, 'description') || '(none)'}
- H1 in content region: ${h1M ? unescapeHtml(h1M[1].replace(/<[^>]+>/g, '')).trim() : '**(no H1 present)**'}
- Robots: ${meta(html, 'robots') || '(none specified)'}

## Complete link inventory for the content region

${inv.length ? inv.map(l => `- "${l.text}" -> ${l.href}`).join('\n') : '**(no links in the content region)**'}

${mechanics(region, inv, url, titleM ? unescapeHtml(titleM[1]).replace(/\s+/g, ' ').trim() : '', body, expect)}

## Structured data (JSON-LD)

${ld.length
  ? ld.map((b, i) => b.ok
      ? `**Block ${i + 1}** — types: ${b.types.length ? b.types.join(', ') : '(none declared)'}\n\n\`\`\`json\n${b.raw.length > 1200 ? b.raw.slice(0, 1200) + '\n... (truncated)' : b.raw}\n\`\`\``
      : `**Block ${i + 1}** — **INVALID JSON** (${b.error}). First 300 chars:\n\n\`\`\`\n${b.raw}\n\`\`\``
    ).join('\n\n')
  : '**No JSON-LD found on the page.** If the copy implies structured data (events with dates, products with prices, an organization with an address), that markup is either absent or injected by JavaScript.'}

## Footer and forms (outside the content region)

Captured because the rubric asks about NAP consistency, trust signals and
capture paths, all of which commonly live outside \`<main>\`.

**Forms:** ${outside.forms.length
  ? '\n\n' + outside.forms.map(f => `- action \`${f.action}\`, controls: ${f.labels.length ? f.labels.map(l => `"${l}"`).join(', ') : '(no labelled controls found)'}`).join('\n')
  : 'none found.'}

**Footer text:**

${outside.footerText ? outside.footerText.slice(0, 2000) + (outside.footerText.length > 2000 ? '\n... (truncated)' : '') : '_(no <footer> element found)_'}

## Full body text

${body}
`;

  if (outPath) { fs.writeFileSync(outPath, doc); console.error(`Wrote ${outPath} (${doc.length} chars, ${inv.length} links)`); }
  else console.log(doc);
}

main();
