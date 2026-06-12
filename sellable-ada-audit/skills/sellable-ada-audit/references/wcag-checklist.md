# WCAG 2.1 AA Audit Checklist and Scoring

Six categories. Each criterion scores 0-2 (0 = fail, 1 = partial, 2 = pass). Weighted percentage gives the overall score.

## Category 1: Images and Media (weight 20%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 1.1 | All meaningful images have descriptive alt text | 1.1.1 | Script + spot-check alt quality in fetched HTML |
| 1.2 | Decorative images use alt="" or role="presentation" | 1.1.1 | Review script output and HTML |
| 1.3 | Alt text is meaningful (not filenames, not keyword stuffing) | 1.1.1 | Manual review of alt values |
| 1.4 | Videos have captions | 1.2.2 | Script flags missing track; verify on page (YouTube embeds usually pass) |
| 1.5 | Audio/video does not autoplay, or can be paused | 1.4.2, 2.2.2 | Script + visual check on screenshots |
| 1.6 | Complex images (charts, infographics) have text alternatives | 1.1.1 | Manual review |

## Category 2: Keyboard and Focus (weight 20%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 2.1 | All interactive elements reachable by keyboard | 2.1.1 | Script flags onclick div/span; check for custom widgets in HTML |
| 2.2 | No keyboard traps (modals, carousels, chat widgets) | 2.1.2 | Manual: note any modals/popups/chat widgets as risk items |
| 2.3 | Skip link or main landmark present | 2.4.1 | Script |
| 2.4 | Focus order is logical (no positive tabindex) | 2.4.3 | Script |
| 2.5 | Visible focus indicator (outline not suppressed) | 2.4.7 | Check CSS for outline:none / :focus rules; flag if found without replacement |
| 2.6 | No content triggered only by hover that can't be dismissed | 1.4.13 | Manual review of menus/tooltips |

## Category 3: Forms (weight 15%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 3.1 | Every input has a programmatic label | 1.3.1, 4.1.2 | Script |
| 3.2 | Placeholder is not the only label | 3.3.2 | Manual review of HTML |
| 3.3 | Required fields indicated in text, not colour alone | 1.4.1, 3.3.2 | Manual |
| 3.4 | Error messages identify the field and how to fix it | 3.3.1, 3.3.3 | Manual or note as untested |
| 3.5 | Autocomplete attributes on common fields (name, email, phone) | 1.3.5 | Check HTML |
| 3.6 | No time limits on form completion, or adjustable | 2.2.1 | Manual |

If the site has no forms, redistribute this weight evenly across the other categories.

## Category 4: Structure and Semantics (weight 15%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 4.1 | Page language set (lang attribute) | 3.1.1 | Script |
| 4.2 | Descriptive page title | 2.4.2 | Script |
| 4.3 | One h1, logical heading hierarchy, no skips | 1.3.1 | Script |
| 4.4 | Landmarks used (header, nav, main, footer) | 1.3.1 | Check HTML for semantic elements |
| 4.5 | Links have descriptive accessible names | 2.4.4 | Script (empty + generic link text) |
| 4.6 | Buttons have accessible names | 4.1.2 | Script |
| 4.7 | Iframes titled | 4.1.2 | Script |
| 4.8 | Lists marked up as lists, tables have headers | 1.3.1 | Manual review of HTML |

## Category 5: Colour and Visual (weight 15%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 5.1 | Text contrast at least 4.5:1 (3:1 for large text) | 1.4.3 | Read screenshots; flag suspect pairs (grey on white, white on light images). Verify exact ratios at webaim.org/resources/contrastchecker if hex values are available in CSS |
| 5.2 | UI component contrast at least 3:1 (buttons, inputs, icons) | 1.4.11 | Screenshots |
| 5.3 | Information not conveyed by colour alone | 1.4.1 | Screenshots + content review |
| 5.4 | Text resizes to 200% without loss (no zoom blocking) | 1.4.4 | Script (viewport check) |
| 5.5 | Reflow at 320px width without horizontal scroll | 1.4.10 | Mobile screenshot |
| 5.6 | Text spacing tolerant (no fixed-height truncation risk) | 1.4.12 | Screenshots |

## Category 6: Content and Behaviour (weight 15%)

| # | Criterion | WCAG | How to check |
|---|-----------|------|--------------|
| 6.1 | No content flashing more than 3 times per second | 2.3.1 | Screenshots + note animated elements |
| 6.2 | Moving/auto-updating content can be paused (carousels, tickers) | 2.2.2 | Manual review |
| 6.3 | Navigation consistent across pages | 3.2.3 | Compare multi-page results |
| 6.4 | No unexpected context changes on focus/input | 3.2.1, 3.2.2 | Manual or note as untested |
| 6.5 | Status messages announced (aria-live on dynamic content) | 4.1.3 | HTML review where dynamic content exists |
| 6.6 | Accessibility statement published | Best practice | Check footer links |

## Scoring

Overall = weighted percentage of points earned.

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Strong compliance posture, low legal risk |
| 75-89 | B | Good, a few gaps to close |
| 60-74 | C | Moderate risk, visible gaps a plaintiff scanner would catch |
| 40-59 | D | High risk, fails common automated scans used by litigation firms |
| 0-39 | F | Critical, serious barriers throughout |

Criteria that need hands-on interactive testing (e.g. error handling on a form that needs submission, screen reader behaviour) score as untested and are excluded from the weighting. List them in the report's "Manual Testing" section as the next step, offered as a service we can do for the client.

## Legal Risk Weighting

When prioritising fixes, weight by what actually drives ADA demand letters. Litigation firms run automated scanners, so automated-detectable failures carry the highest legal exposure regardless of severity to real users:

**Highest lawsuit risk (fix first):**
1. Missing alt text on images
2. Empty links and buttons
3. Form inputs without labels
4. Missing page language
5. Low colour contrast
6. No keyboard access to menus/modals

**Context multipliers:**
- Ecommerce, food/restaurant, hospitality, healthcare, finance: most-sued industries
- Business serves NY, FL, or CA customers: higher filing volume; CA adds Unruh Act damages ($4,000 minimum per violation)
- Accessibility overlay widget installed (accessiBe, UserWay, AudioEye): does NOT reduce risk; overlay-equipped sites are sued regularly. Flag it in the report and recommend fixing underlying code.

## Key Facts for the Report

- ADA Title III applies to websites of businesses open to the public; courts and DOJ treat WCAG 2.1 AA as the benchmark standard
- DOJ's 2024 Title II rule requires state/local government sites to meet WCAG 2.1 AA by April 2026 (population over 50,000) or April 2027 (smaller), signalling the direction for private enforcement
- Thousands of ADA website lawsuits are filed each year, plus far more pre-suit demand letters; typical settlements run $5,000-$25,000 plus remediation costs
- Automated tools catch roughly 30-40% of WCAG issues; manual testing covers the rest
- Accessibility overlays do not provide legal protection; the FTC fined accessiBe $1m in 2025 over misleading compliance claims
- Roughly 1 in 4 US adults has a disability; accessible sites also tend to convert and rank better (overlap with Core Web Vitals and semantic SEO)
