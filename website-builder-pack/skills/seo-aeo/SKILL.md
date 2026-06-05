---
name: seo-aeo
description: "SEO and AEO audit and optimisation for WordPress website builds. Runs at three points: after the site plan (structure analysis), before writing copy (keyword mapping), and after copy is written (on-page scoring and schema markup). Use at any of these stages or all three in sequence."
triggers:
  - "SEO audit"
  - "AEO audit"
  - "optimise for search"
  - "keyword research for my site"
  - "add schema markup"
  - "check my SEO"
---

# SEO / AEO Skill

Handles three jobs in the website build:

- **Mode 0**: Site structure analysis. Runs at Stage 3 of the website build.
- **Mode 1**: Keyword planning per page. Runs at Stage 6 of the website build.
- **Mode 2**: On-page SEO/AEO audit with scoring and schema markup. Runs at Stage 8 of the website build.

Run all three in sequence for a new build, or use any mode individually.

---

## Mode 0: Site Structure Analysis (post site-plan)

Run this after the site-planner produces the site map and before anything is built. Analyses the proposed structure for SEO effectiveness and flags gaps or improvements.

### What You Need From the User

- Business name, what they do, and location (if local)
- The site plan output from the site-planner (page list, site map, navigation)
- Primary business goal (leads, sales, bookings, credibility)

### What to Analyse

#### 1. Topical Authority

Does the site plan support topical authority: the signal to search engines that this site is a trusted source on its subject?

Check:
- Is there a clear primary topic the site is built around?
- Are there enough supporting pages to cover the topic in depth?
- Is there a logical cluster structure: one main pillar page supported by related pages?

Flag if: the site has a single services page with no individual service pages. Google rewards depth. A plumber with separate pages for boiler installation, emergency call-outs, and bathroom fitting outranks one with a single "Services" page.

Recommend additions where coverage is thin. Cap at 10-12 pages for a first build.

#### 2. Page Hierarchy and Crawl Path

Can search engines discover and understand every page?

Check:
- Is the homepage at the top of the hierarchy?
- Are all important pages reachable within 2 clicks from the homepage?
- Are any pages orphaned (not linked from anywhere in the proposed navigation)?
- Does the navigation include the primary commercial pages?

Flag any page in the plan that has no clear parent or entry point.

#### 3. Internal Linking Opportunities

Map the natural internal linking structure based on the page list:

- Which pages should link to which?
- Is there a clear path from informational pages to commercial pages?
- Does every page have at least one logical internal link target?

Produce a simple linking map:

```
Homepage → Services, About, Contact
Services → Individual service pages, Contact
Individual service pages → Other services, Contact, Testimonials
Blog posts → Relevant service pages, Contact
```

#### 4. URL Structure

Review the proposed page slugs (or suggest them if not set):

- Short, descriptive, keyword-inclusive slugs
- Consistent naming convention
- No duplicate or overlapping slugs
- Hierarchy reflected in URL where appropriate (e.g. `/services/boiler-installation/`)

#### 5. Missing Pages

Based on the business type and goal, flag any pages that would materially improve SEO but are missing from the plan:

| Business Type | Commonly Missing |
|---|---|
| Local service | Individual location pages, areas covered, Google reviews page |
| Professional services | FAQ page, how it works, case studies |
| E-commerce | Category pages, comparison pages, buying guides |
| Any | Privacy policy, 404 page |

Only flag pages that would genuinely help. Do not pad the site plan.

### Output Format

```
## Site Structure SEO Analysis: [Business Name]

### Topical Authority
[Assessment + recommendations]

### Page Hierarchy
[Assessment + any orphaned pages]

### Internal Linking Map
[Simple map as above]

### URL Recommendations
| Page | Recommended Slug |
|---|---|
| Homepage | / |
| Services | /services/ |
| [etc] | ... |

### Missing Pages
| Page | Why It Helps | Priority |
|---|---|---|
| [page] | [reason] | High / Medium / Low |

### Verdict
[One paragraph summary: is the structure solid, or does it need work before building?]
```

---

## Mode 1: Keyword Planning (pre-writing)

Run this before the content-writer to give each page a clear keyword target and intent classification.

### What You Need From the User

- Business name and what they do
- Location (if local business)
- Page list from the site-planner

### Process

For each page in the build:

1. **Identify the primary keyword**
   - What would the target customer type into Google to find this page?
   - Prefer specific over broad: "emergency plumber Manchester" beats "plumbing"
   - For local businesses: always include location in the primary keyword

2. **Classify intent**
   - **Informational**: researching a topic (blog, FAQ, guide pages)
   - **Commercial**: comparing options (service pages, about page)
   - **Transactional**: ready to act (contact page, landing pages, booking pages)
   - **Navigational**: looking for a specific brand (homepage)

3. **Identify 3-5 supporting keywords (LSI)**
   - Related terms, synonyms, and variations
   - These go into subheadings and body copy naturally

4. **Note search intent format**
   - What format does Google show for this keyword? List, guide, service page?
   - Match the format to what's ranking

### Output Format

```
## Keyword Plan: [Business Name]

| Page | Primary Keyword | Intent | Supporting Keywords | Format |
|---|---|---|---|---|
| Homepage | [keyword] | Navigational | [list] | Service overview |
| Services | [keyword] | Commercial | [list] | Service page |
| Contact | [keyword] | Transactional | [list] | Contact page |
| [etc] | ... | ... | ... | ... |
```

Hand this to the content-writer before writing begins.

---

## Mode 2: On-Page SEO/AEO Audit (post-writing)

Run this after the content-writer has written and the superhuman-writer has done the voice pass. Audits every page and produces a fix list.

### What You Need

- The written copy for each page (or the file paths)
- The keyword plan from Mode 1

### On-Page SEO Checklist (run per page)

#### Title Tag
- [ ] 50-60 characters
- [ ] Primary keyword in first 3 words
- [ ] Distinct from H1
- [ ] Includes business name on homepage

#### Meta Description
- [ ] 140-155 characters
- [ ] Primary keyword present
- [ ] Includes a benefit and soft CTA
- [ ] Unique per page

#### H1
- [ ] One H1 per page
- [ ] Contains primary keyword
- [ ] Human-readable, not stuffed

#### Headings (H2/H3)
- [ ] At least 3 H2s per page
- [ ] 60%+ of H2s phrased as questions
- [ ] No heading levels skipped
- [ ] At least one H2 per 300 words of body copy

#### Body Copy
- [ ] Primary keyword in first 100 words
- [ ] Keyword density 0.8-1.5% (flag if over 2%)
- [ ] 5+ LSI/supporting keywords used naturally
- [ ] Sentences under 25 words on average
- [ ] Active voice throughout

#### Internal Links
- [ ] Minimum 2 internal links per page
- [ ] Descriptive anchor text (not "click here")
- [ ] Homepage links to primary service/contact page

#### Images (flag for user to action)
- [ ] Every image needs a descriptive filename
- [ ] Alt text on every image including primary keyword where natural
- [ ] Images under 200KB where possible

### AEO Checklist (run per page)

Answer Engine Optimisation ensures pages can be extracted and cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews).

#### Answer-First Structure
- [ ] Opening paragraph answers the page's primary question directly
- [ ] Pattern: "[Topic] is [definition/answer]" in first 150 words
- [ ] No warm-up before the answer

#### Self-Contained Sections
- [ ] Each H2 section stands alone as a complete answer
- [ ] No "as mentioned above" or back-references between sections
- [ ] Each section: topic + claim + supporting detail

#### FAQ Section
- [ ] At least 4 Q&As per page (service/informational pages)
- [ ] Questions phrased as natural search queries
- [ ] Answers are 2-4 sentences, standalone

#### Schema Markup
Generate JSON-LD schema for each page type:

| Page Type | Schema Required |
|---|---|
| Homepage | Organization + WebSite |
| Service page | Service (or LocalBusiness if local) |
| About page | Organization + Person (founder) |
| Contact page | LocalBusiness |
| Blog/guide | BlogPosting + FAQPage |
| Landing page | Service + Offer |

Generate the complete JSON-LD snippet for each page and include it in the output.

### Scoring

Score each page out of 10 across three areas:

| Area | Max Score | What It Covers |
|---|---|---|
| Technical SEO | 4 | Title, meta, H1, headings, keyword placement |
| Content SEO | 3 | Keyword density, LSI, internal links, readability |
| AEO | 3 | Answer-first, self-contained sections, FAQ, schema |

**Target: 8/10 minimum before launch.**

### Output Format

```
## SEO/AEO Audit: [Business Name]

### [Page Name]
**Score: [X]/10**: Technical: [X]/4 | Content: [X]/3 | AEO: [X]/3

**Primary keyword:** [keyword]

**Fixes Required (do before launch):**
- [ ] [specific fix]

**Fixes Recommended (do soon):**
- [ ] [specific fix]

**Schema Markup:**
```json
[JSON-LD snippet]
```

---
[repeat for each page]

### Summary
Pages scoring 8+: [count]
Pages needing work: [list]
```

---

## Kill Switches

- Never invent keyword volumes or difficulty scores. State what you can assess from the copy and context.
- Never add keywords in a way that makes copy sound unnatural. Flag the conflict and let the user decide.
- Never generate schema with placeholder values left unfilled. Ask for the missing information.
- If a page has no copy yet, run Mode 1 only and return the keyword plan.
