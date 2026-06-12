# ADA Audit Report Structure

Write for a non-technical business owner. Plain English, explain every acronym once, no scare tactics but honest about legal exposure. Use US spelling for US-based clients.

## Report Sections

### 1. Cover
- "Website Accessibility Audit (ADA / WCAG 2.1 AA)"
- Client name, site URL, pages audited, date, prepared by

### 2. Executive Summary (half page)
- Overall score and grade with a one-line verdict
- Legal risk level: Low / Moderate / High / Critical, with one sentence why
- Top 3 issues in plain English
- One-sentence reassurance: every issue found is fixable, most within [X days/weeks]

### 3. Why This Matters (short, standard copy, adapt to client)
- ADA Title III applies to business websites; WCAG 2.1 AA is the standard courts use
- Lawsuit and demand letter landscape (industry and state context from wcag-checklist.md)
- Business upside: roughly 1 in 4 US adults has a disability; accessibility improvements typically help SEO and conversion too
- If the site uses an overlay widget: explain plainly why it does not protect them

### 4. Score Breakdown
Table or bars: six categories, score per category, weight, grade.

### 5. Priority Fixes
Ranked list. For each fix:
- **What's wrong** (plain English) and where (page/element)
- **Who it affects** (e.g. "screen reader users cannot tell what this button does")
- **Legal exposure** (High/Medium/Low, automated-scanner-detectable or not)
- **How to fix** (specific, developer-ready instruction)
- **Effort** (Quick / Moderate / Larger)

Group into: Fix Now (legal exposure), Fix Soon (real barriers), Fix Later (polish).

### 6. Detailed Findings
Per category: criteria checked, pass/partial/fail, evidence (code snippets from the script output, screenshot references).

### 7. Manual Testing: The Final Step
List the criteria that need a person interacting with the site (form submission errors, full keyboard walkthrough, screen reader pass). Frame positively: the automated and expert review is done; these final checks take about 30 minutes and we can do them for you, or your team can use the included guide. Never frame as "could not test", it reads as a gap in the audit rather than the natural next step.

### 8. Recommended Roadmap
- Week 1-2: critical fixes
- Month 1: serious issues
- Ongoing: accessibility statement, retest cadence (quarterly or after major site changes), team habits (alt text on every new image, etc.)

### 9. Next Steps
Offer: remediation, retest after fixes, ongoing monitoring.

## Output Formats

**Default:** Markdown report.

**Printable client deliverable:** Fill in the bundled `report-template.html` (self-contained CSS, all sections above pre-built with `[PLACEHOLDER]` tokens, brand colours configurable at the top of the stylesheet). Convert to PDF with any HTML-to-PDF tool, e.g. headless Chrome: `chrome --headless --print-to-pdf=out.pdf in.html`.

## Tone Rules

- No em dashes
- Never promise the site "will be compliant" or "lawsuit-proof" after fixes; say "substantially conforms to WCAG 2.1 AA" and "significantly reduces legal exposure"
- Include the disclaimer: "This audit is a technical assessment, not legal advice. For legal questions about ADA compliance, consult a lawyer."
