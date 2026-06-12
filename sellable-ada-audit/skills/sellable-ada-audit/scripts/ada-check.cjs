#!/usr/bin/env node
/**
 * Static WCAG 2.1 AA checks on a page's HTML.
 * Usage: node ada-check.cjs <url> [url2] [url3] ...
 * Outputs JSON findings per URL to stdout.
 *
 * Catches the automated-detectable subset only (roughly 30-40% of WCAG issues).
 * Manual checks (keyboard, contrast, screen reader) are still required.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// Strip script/style/comments so attribute checks don't hit JS strings
function cleanHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function getTags(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

function getTagsWithContent(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push({ open: m[0].match(/^<[^>]*>/)[0], inner: m[1] });
  return out;
}

function hasAttr(tag, attr) {
  return new RegExp(`\\s${attr}\\s*=`, 'i').test(tag) || new RegExp(`\\s${attr}(\\s|>|/)`, 'i').test(tag);
}

function getAttr(tag, attr) {
  const m = tag.match(new RegExp(`\\s${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
}

function textOf(innerHtml) {
  return innerHtml.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function snippet(s, len = 120) {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > len ? s.slice(0, len) + '...' : s;
}

function auditPage(rawHtml, url) {
  const html = cleanHtml(rawHtml);
  const findings = []; // { wcag, level, severity, issue, count, examples }
  const add = (wcag, severity, issue, examples) => {
    if (!examples || examples.length === 0) return;
    findings.push({
      wcag,
      severity, // critical | serious | moderate | minor
      issue,
      count: examples.length,
      examples: examples.slice(0, 5).map((e) => snippet(e)),
    });
  };
  const passes = [];

  // 3.1.1 Language of page
  const htmlTag = (html.match(/<html\b[^>]*>/i) || [])[0] || '';
  if (!hasAttr(htmlTag, 'lang') || !getAttr(htmlTag, 'lang')) {
    add('3.1.1', 'serious', 'Page is missing a lang attribute on the <html> element', [htmlTag || '<html> tag not found']);
  } else passes.push('3.1.1 Page language is set (lang="' + getAttr(htmlTag, 'lang') + '")');

  // 2.4.2 Page title
  const title = getTagsWithContent(html, 'title')[0];
  if (!title || !textOf(title.inner)) {
    add('2.4.2', 'serious', 'Page has no <title> or the title is empty', ['<title> missing or empty']);
  } else passes.push('2.4.2 Page has a title: "' + snippet(textOf(title.inner), 80) + '"');

  // 1.1.1 Images: missing alt attribute (decorative alt="" is fine and not flagged)
  const imgs = getTags(html, 'img');
  const noAlt = imgs.filter((t) => !hasAttr(t, 'alt') && !/role\s*=\s*["']?presentation/i.test(t));
  add('1.1.1', 'critical', 'Images missing alt attribute (screen readers will announce the filename or nothing)', noAlt);
  if (imgs.length && noAlt.length === 0) passes.push(`1.1.1 All ${imgs.length} <img> tags have an alt attribute`);

  // 1.1.1 Suspicious alt text (filename used as alt)
  const badAlt = imgs.filter((t) => {
    const a = getAttr(t, 'alt');
    return a && /\.(jpe?g|png|gif|webp|svg)$/i.test(a.trim());
  });
  add('1.1.1', 'moderate', 'Images using a filename as alt text (not meaningful to screen reader users)', badAlt);

  // 1.3.1 Form inputs without labels
  const inputs = getTags(html, 'input').filter((t) => {
    const type = (getAttr(t, 'type') || 'text').toLowerCase();
    return !['hidden', 'submit', 'button', 'image', 'reset'].includes(type);
  });
  const labelFor = new Set(getTags(html, 'label').map((t) => getAttr(t, 'for')).filter(Boolean));
  const unlabeled = inputs.filter((t) => {
    const id = getAttr(t, 'id');
    if (id && labelFor.has(id)) return false;
    if (hasAttr(t, 'aria-label') || hasAttr(t, 'aria-labelledby') || hasAttr(t, 'title')) return false;
    return true;
  });
  add('1.3.1', 'critical', 'Form inputs without an associated label, aria-label, or title', unlabeled);
  if (inputs.length && unlabeled.length === 0) passes.push(`1.3.1 All ${inputs.length} visible form inputs are labelled`);
  const selectsTextareas = [...getTags(html, 'select'), ...getTags(html, 'textarea')].filter((t) => {
    const id = getAttr(t, 'id');
    if (id && labelFor.has(id)) return false;
    return !(hasAttr(t, 'aria-label') || hasAttr(t, 'aria-labelledby') || hasAttr(t, 'title'));
  });
  add('1.3.1', 'serious', 'Select/textarea elements without an associated label', selectsTextareas);

  // 2.4.4 Empty links / links with no accessible name
  const links = getTagsWithContent(html, 'a');
  const emptyLinks = links.filter((l) => {
    if (textOf(l.inner)) return false;
    if (hasAttr(l.open, 'aria-label') || hasAttr(l.open, 'aria-labelledby') || hasAttr(l.open, 'title')) return false;
    // image link with alt counts as named
    const innerImg = (l.inner.match(/<img\b[^>]*>/i) || [])[0];
    if (innerImg && getAttr(innerImg, 'alt')) return false;
    if (/<svg[\s\S]*?(aria-label|<title)/i.test(l.inner)) return false;
    return true;
  }).map((l) => l.open + '...' + '</a>');
  add('2.4.4', 'serious', 'Links with no accessible name (empty or icon-only with no label)', emptyLinks);

  // 2.4.4 Generic link text
  const genericLinks = links
    .filter((l) => /^(click here|here|read more|more|learn more|link)$/i.test(textOf(l.inner)))
    .map((l) => l.open + textOf(l.inner) + '</a>');
  add('2.4.4', 'minor', 'Links with generic text ("click here", "read more") that lack context out of sequence', genericLinks);

  // 4.1.2 Empty buttons
  const buttons = getTagsWithContent(html, 'button');
  const emptyButtons = buttons.filter((b) => {
    if (textOf(b.inner)) return false;
    if (hasAttr(b.open, 'aria-label') || hasAttr(b.open, 'aria-labelledby') || hasAttr(b.open, 'title')) return false;
    if (/<svg[\s\S]*?(aria-label|<title)/i.test(b.inner)) return false;
    const innerImg = (b.inner.match(/<img\b[^>]*>/i) || [])[0];
    if (innerImg && getAttr(innerImg, 'alt')) return false;
    return true;
  }).map((b) => b.open);
  add('4.1.2', 'serious', 'Buttons with no accessible name', emptyButtons);

  // 1.3.1 Heading structure
  const headings = [];
  for (let i = 1; i <= 6; i++) {
    for (const h of getTagsWithContent(html, `h${i}`)) headings.push({ level: i, text: textOf(h.inner) });
  }
  const headingOrderRe = /<h([1-6])\b/gi;
  const seq = [];
  let hm;
  while ((hm = headingOrderRe.exec(html)) !== null) seq.push(parseInt(hm[1], 10));
  const h1Count = seq.filter((n) => n === 1).length;
  if (h1Count === 0) add('1.3.1', 'serious', 'Page has no <h1>', ['No <h1> found']);
  if (h1Count > 1) add('1.3.1', 'minor', `Page has ${h1Count} <h1> elements (one is recommended)`, [`${h1Count} h1 tags`]);
  const skips = [];
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] - seq[i - 1] > 1) skips.push(`h${seq[i - 1]} followed by h${seq[i]}`);
  }
  add('1.3.1', 'minor', 'Heading levels skipped (breaks document outline for screen readers)', skips);
  if (h1Count === 1 && skips.length === 0 && seq.length) passes.push(`1.3.1 Heading structure is sound (${seq.length} headings, one h1, no skips)`);

  // 1.4.4 / 1.4.10 Viewport blocks zoom
  const metas = getTags(html, 'meta');
  const viewport = metas.find((t) => /name\s*=\s*["']?viewport/i.test(t));
  if (viewport && /(user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0+)?\b)/i.test(viewport)) {
    add('1.4.4', 'serious', 'Viewport meta tag blocks pinch-zoom (user-scalable=no or maximum-scale=1)', [viewport]);
  } else if (viewport) passes.push('1.4.4 Viewport allows zooming');

  // 2.4.3 Positive tabindex
  const posTabindex = (html.match(/<[^>]*\stabindex\s*=\s*["']?[1-9]\d*["']?[^>]*>/gi) || []);
  add('2.4.3', 'moderate', 'Elements with positive tabindex (creates unpredictable keyboard order)', posTabindex);

  // 4.1.2 iframes without title
  const iframes = getTags(html, 'iframe').filter((t) => !getAttr(t, 'title') && !hasAttr(t, 'aria-label'));
  add('4.1.2', 'moderate', 'Iframes without a title attribute', iframes);

  // 2.4.1 Skip link heuristic
  const firstChunk = html.slice(0, 6000);
  const hasSkip = /<a[^>]*href\s*=\s*["']#[^"']*["'][^>]*>[\s\S]{0,80}?(skip|jump)[\s\S]{0,40}?<\/a>/i.test(firstChunk);
  const hasMainLandmark = /<main\b/i.test(html) || /role\s*=\s*["']?main/i.test(html);
  if (!hasSkip && !hasMainLandmark) {
    add('2.4.1', 'moderate', 'No skip link and no <main> landmark found (keyboard users must tab through all navigation)', ['No skip-to-content mechanism detected']);
  } else passes.push('2.4.1 Skip link or main landmark present');

  // 2.2.2 Auto-playing media / marquee / blink
  const autoplay = [...getTags(html, 'video'), ...getTags(html, 'audio')].filter((t) => hasAttr(t, 'autoplay'));
  add('2.2.2', 'moderate', 'Media set to autoplay (must be pausable; audio over 3s must be stoppable)', autoplay);
  const marquee = [...getTags(html, 'marquee'), ...getTags(html, 'blink')];
  add('2.2.2', 'serious', 'Deprecated moving/blinking elements (marquee/blink)', marquee);

  // 1.2.2 Video captions hint
  const videos = getTagsWithContent(html, 'video');
  const noTrack = videos.filter((v) => !/<track\b/i.test(v.inner)).map((v) => v.open);
  add('1.2.2', 'moderate', 'Video elements without a <track> captions element (verify captions exist another way)', noTrack);

  // Inline event handlers on non-interactive elements (keyboard access risk, 2.1.1)
  const clickDivs = (html.match(/<(div|span)\b[^>]*\sonclick\s*=[^>]*>/gi) || []).filter(
    (t) => !/role\s*=\s*["']?(button|link)/i.test(t) || !hasAttr(t, 'tabindex')
  );
  add('2.1.1', 'serious', 'Click handlers on div/span without role and tabindex (not reachable by keyboard)', clickDivs);

  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    url,
    stats: {
      images: imgs.length,
      links: links.length,
      formInputs: inputs.length,
      headings: seq.length,
      iframes: getTags(html, 'iframe').length,
    },
    totals: {
      critical: findings.filter((f) => f.severity === 'critical').reduce((s, f) => s + f.count, 0),
      serious: findings.filter((f) => f.severity === 'serious').reduce((s, f) => s + f.count, 0),
      moderate: findings.filter((f) => f.severity === 'moderate').reduce((s, f) => s + f.count, 0),
      minor: findings.filter((f) => f.severity === 'minor').reduce((s, f) => s + f.count, 0),
    },
    findings,
    passes,
    note: 'Static checks only. Colour contrast, focus visibility, keyboard traps, and dynamic content require manual review.',
  };
}

(async () => {
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error('Usage: node ada-check.cjs <url> [url2] ...');
    process.exit(1);
  }
  const results = [];
  for (const url of urls) {
    try {
      const html = await fetchHtml(url);
      results.push(auditPage(html, url));
    } catch (err) {
      results.push({ url, error: err.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
})();
