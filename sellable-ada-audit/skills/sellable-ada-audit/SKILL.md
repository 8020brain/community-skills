---
name: sellable-ada-audit
description: Audit a website for ADA compliance against WCAG 2.1 AA with a scored report, legal risk assessment, and prioritised developer-ready fixes. Use when user asks for an ADA audit, accessibility audit, WCAG check, ADA compliance review, or asks if a site is accessible or at risk of an ADA lawsuit.
---

# ADA Website Audit (WCAG 2.1 AA)

Audits a website against WCAG 2.1 AA, the standard US courts and the DOJ use for ADA Title III claims. Combines automated static checks with manual review of screenshots and HTML. Produces a client-ready report with scores, legal risk, and prioritised fixes.

## Trigger

- User asks for an ADA audit, accessibility audit, WCAG check, or ADA compliance review
- User asks "is this site accessible" or about ADA lawsuit risk
- User provides a URL and wants its accessibility checked

## Step 0: Gather Inputs

Need the URL as a minimum. If this is for a client, also get the client name, what name should appear as "prepared by", their industry, and which US states they serve (drives legal risk weighting). If the user just drops a URL, run with sensible defaults and note assumptions.

Pick pages to audit: homepage plus 2-4 key templates (contact/form page, a product or service page, checkout or booking if ecommerce). Find them by fetching the homepage navigation if not specified.

## Step 1: Run Automated Checks

```bash
node scripts/ada-check.cjs [url1] [url2] [url3]
```

(Run from this skill's folder, or use the full path to the script. Plain Node, no dependencies.)

Returns JSON per page: findings by severity (critical/serious/moderate/minor) with WCAG references, code examples, element counts, and confirmed passes. Covers: alt text, form labels, empty links/buttons, page language, title, heading structure, zoom blocking, positive tabindex, iframe titles, skip links, autoplay, keyboard-inaccessible click handlers.

If a page returns an error (bot blocking, auth), note it and audit from whatever pages are reachable. If all pages block, ask the user for the HTML or screenshots.

## Step 2: Capture Screenshots

```bash
node scripts/screenshot.cjs [URL] --output /tmp/ada-audit/screenshots
```

Requires Playwright (`npm install playwright` if missing). If the script fails, fall back to:

```bash
npx playwright screenshot [URL] /tmp/ada-audit/screenshots/desktop-full.png --viewport-size=1440,4000
npx playwright screenshot [URL] /tmp/ada-audit/screenshots/mobile-fold.png --viewport-size=375,812
```

READ the screenshots and check visually: colour contrast (grey-on-white text, text over images), information conveyed by colour alone, visible focus styling on buttons, carousels or animated content, mobile reflow at 375px.

## Step 3: Manual HTML Review

Fetch one or two key pages and check the items the script cannot catch: placeholder-only labels, autocomplete attributes, landmark usage, aria-live on dynamic content, overlay widgets (accessiBe, UserWay, AudioEye scripts in the HTML). An overlay widget is a finding in itself: it does not reduce legal risk and should be called out.

**Focus visibility (WCAG 2.4.7), check the CSS directly, do not leave as untested:** extract the stylesheet URLs from the page HTML (`<link rel="stylesheet">`), download each, and search the CSS plus all inline `<style>` blocks for `outline\s*:\s*(none|0)` and `:focus` / `:focus-visible` rules.
- No suppression found anywhere: PASS (browser default focus rings apply). Suggest a custom `:focus-visible` style as optional polish, especially on dark themes.
- `outline: none` found WITHOUT a replacement `:focus`/`:focus-visible` style on the same selectors: FAIL, serious.
- `outline: none` found WITH replacement focus styles: verify the replacement has 3:1 contrast.
- Only caveat to note: JS-injected styles cannot be ruled out statically, but with clean CSS the risk is negligible.

## Step 4: Score

Score against the six categories in `references/wcag-checklist.md` (criteria, weights, how-to-check per item, grade bands). Criteria that need hands-on interactive testing (a human tabbing through forms, running a screen reader) are marked untested and excluded from weighting, then listed in the report's "Manual Testing" section, framed as the next step rather than a limitation.

Apply the legal risk weighting from the same file: automated-detectable failures (missing alt, empty links, unlabelled inputs, contrast) carry the highest lawsuit exposure because litigation firms find targets with scanners. Industry and state context multiplies risk.

Set an overall legal risk level: Low / Moderate / High / Critical.

## Step 4b: Manual Checks Decision

If any criteria landed in "needs hands-on testing", use AskUserQuestion before writing the report:

**"Some checks need a person interacting with the site (forms, widgets, screen reader). How do you want to handle them?"**
1. **Walk me through them now** - guide the user through each applicable check from `references/manual-testing-guide.md` one at a time: give the exact steps, wait for their result, record pass/fail and what they saw. Then fold the results into the scores (a tested category comes back into the weighting), recalculate the overall score, and write the report with those items as tested findings. Note in the report that manual interactive testing was completed.
2. **Add instructions for the client** - include the relevant guide sections as a client-facing appendix, keep the "Manual Testing: The Final Step" section with the "we can complete these for you" offer.
3. **Both** - walk through what the user can test now (e.g. keyboard and screen reader), and include the appendix for anything left.

If walking through, keep it one check at a time, never dump the whole list. Skip checks that do not apply to the site (no chat widget = skip the chat check).

## Step 5: Write the Report

Follow `references/report-template.md` for structure, tone, and the mandatory disclaimer. Key rules:

- Plain English for business owners; every fix must be developer-ready
- Rank fixes by legal exposure first, user impact second
- Never claim fixes make the site "compliant" or "lawsuit-proof"
- Always include the "not legal advice" disclaimer

**Printable client report:** fill in `report-template.html` (bundled, self-contained CSS, print-ready). Replace every `[PLACEHOLDER]`, repeat the marked blocks per category/fix/criterion, embed screenshots as base64, and delete any optional blocks that do not apply (e.g. the overlay widget callout). Set the two CSS brand colour variables at the top to match your brand. Convert to PDF with any HTML-to-PDF tool, e.g. headless Chrome:

```bash
chrome --headless --print-to-pdf=report.pdf report.html
```

Save the report as `output/ada-audit-[site-name]-YYYY-MM-DD` (or wherever the user keeps client reports).

## Step 6: Summarise

Give the user the score, grade, legal risk level, top 3 fixes, and the report path. If it is a prospect audit, suggest the natural upsell: remediation plus retest.

## Output

- Markdown audit report (always): score, grade, legal risk level, prioritised fixes, manual testing section
- Printable PDF via `report-template.html` (default for client deliverables)
- Screenshots in the working folder
- Optional client appendix: manual testing instructions from the guide
## Bundled Resources

| File | Purpose |
|------|---------|
| `scripts/ada-check.cjs` | Automated static WCAG checks (no dependencies, plain Node) |
| `scripts/screenshot.cjs` | Desktop and mobile screenshot capture (requires Playwright) |
| `report-template.html` | Printable report template (cover, score bars, risk banner, fix groups), self-contained CSS |
| `references/wcag-checklist.md` | Full six-category checklist, scoring weights, legal risk weighting, key facts |
| `references/report-template.md` | Report structure, output formats, tone rules, disclaimer |
| `references/manual-testing-guide.md` | Step-by-step instructions for the hands-on checks (iframe forms, chat widgets, screen reader pass). Include relevant sections as a report appendix; offer to do these for the client as a follow-up service |

## Notes

- Automated checks catch roughly 30-40% of WCAG issues; the screenshot and HTML review steps are not optional
- Contrast ratios: 4.5:1 normal text, 3:1 large text and UI components; verify suspect pairs rather than guessing
- Most-sued industries: ecommerce, food/restaurant, hospitality, healthcare, finance. Highest-volume states: NY, FL, CA (Unruh Act adds $4,000 minimum statutory damages per violation in CA)
- Government clients (Title II): WCAG 2.1 AA is legally mandated, deadlines April 2026/2027 depending on population
