---
name: website-builder
description: "Builds a complete WordPress website from start to finish. Runs the full process: plans the site structure, creates the theme, builds each page template, writes all the copy, and runs a pre-launch checklist. Use when someone says 'build me a website', 'I need a website', or wants the full end-to-end site build rather than a single step."
---

# Website Builder

Runs the full website build process from business brief to launch-ready site. Works through ten stages in order, confirming with the user at each stage before moving on.

## When to Activate

Use this skill when someone wants a full website built, not just one piece. If they only want a single step (e.g., "write my homepage copy"), use the individual skill instead.

Trigger phrases:
- "Build me a website"
- "I need a website for my business"
- "Create a full site for [business]"
- "Build my WordPress site"
- "Continue my website build"

## Resuming a Build

Before anything else, check for a `website-build.md` file in the project root.

- If it exists: read it, summarise where the build is up to, and ask the user if they want to continue from where they left off or start fresh.
- If it does not exist: proceed to Stage 1.

Never ask discovery questions if the answers are already in `website-build.md`.

## Process

### Stage 0: Build Type

Before Discovery, ask:

> "Is this a brand new website, or are you rebuilding/replacing an existing one?"

**If rebuilding an existing site**, ask these additional questions (include them with the Stage 1 Discovery questions so the user answers everything in one go):

1. **Current website URL** so you can reference the existing structure, content, and design
2. **What to keep** from the current site (copy, page structure, testimonials, images, specific pages)
3. **What to change** (design, messaging, structure, navigation, anything that isn't working)
4. **URL structure** - do existing page URLs need to stay the same? If the site has search engine rankings, changing URLs without redirects will lose them. Flag this clearly.
5. **Redirect list** - if URLs are changing, note every old-to-new mapping and include a redirect setup step in the launch checklist

Save the build type and answers in `website-build.md` under a "Build Type" section. Carry the context through every stage:
- **Site Plan:** start from the existing structure and modify, don't plan from scratch unless they want a complete restructure
- **Theme:** reference the current design for anything they want to keep
- **Copy:** only reuse existing copy the user specifically said to keep. Write everything else fresh. Old copy is reference material, not a starting point
- **SEO:** preserve any existing keyword rankings and URL authority. Flag pages that rank well and should not change URL or primary keyword
- **Launch Checklist:** include redirect verification and old-URL testing if URLs changed

**If brand new**, skip straight to Stage 1.

### Stage 1: Discovery

Before anything else, gather the essentials. Ask all questions at once:

1. **Business name** and what you do
2. **Target customers** and what they need
3. **Primary goal** of the site (leads, sales, bookings, credibility)
4. **Brand colours** (hex codes if they have them, or describe the industry and help them choose)
5. **Theme preference** - do they want to edit the site themselves after launch (block theme), or will they use Claude Code for all changes (classic theme)?
6. **Any specific pages** they already know they need
7. **Existing content** - do they have any copy already written? About page text, service descriptions, taglines, testimonials, team bios, FAQs? Even rough notes or bullet points are useful. If they have a previous website, get the URL so you can reference what's already there
8. **Brand voice and audience** - check the project folder for existing brain files before asking anything:
   - `brand/brand-voice.md`
   - `brand/brand-avatars.md`
   - `brand/brand-identity.md`
   - `context/business/business-overview.md`
   - `voice-dna.md`

   **If files exist:** read them all. Note what you found. Only ask about anything not covered.

   **If nothing exists:** ask the following to build the voice profile. Include these questions with the rest of the Discovery questions so the user answers everything in one go:
   - Do you have an existing website? If so, what is the URL?
   - How would you describe your brand voice? (e.g. professional, friendly, direct, warm, witty)
   - What words or phrases do you use a lot? Any you want to avoid?
   - Who is your ideal customer? What do they worry about? What do they want?
   - What tone do competitors use, and how do you want to sound different?

   **After Discovery is confirmed:** use all answers (from files and/or questions) to write a `voice-dna.md` file in the project root. Do not ask the user to fill anything in. You write it from what they told you. If they provided a website URL, note it in the file for reference when writing copy in Stage 7.

### Stage 2: Site Plan

Using the site-planner skill logic, produce:

- Theme type recommendation (based on their answer above)
- Page list with purpose and priority
- Site map
- Navigation structure
- Build order

**Present this to the user and get confirmation before proceeding.** They may want to add, remove, or reorder pages.

### Stage 3: SEO Structure Analysis

Run the `seo-aeo` skill logic in Mode 0. Analyse the proposed site plan for topical authority, page hierarchy, internal linking opportunities, URL structure, and missing pages. Present any recommended changes to the user and update the site plan before building.

### Stage 4: Theme

Using the theme-scaffolder skill logic, generate:

- All required theme files (block or classic based on their choice)
- Colours, fonts, and layout from their brand details
- Complete, installable theme skeleton

**Present the files and installation instructions.** Tell them to install and activate the theme in Local WP before continuing.

### Stage 5: Pages

Using the page-builder skill logic, work through the build order from Stage 2.

For each page:
1. Create the template file (HTML block markup or PHP depending on theme type)
2. Include CRO-optimised layout with proper CTA placement
3. Use placeholder content that describes what goes in each section

**Build the homepage first, then ask if they want to continue with the next page or adjust anything.**

Work through all pages, presenting each one as you go.

### Stage 6: Keyword Planning

Before writing any copy, ask the user:

> "Do you have existing keyword research for your site? If so, paste it in or share the file and I'll use it. If not, I'll carry out the research now."

- If they have existing research: use it as the keyword plan. Note what they provided.
- If they don't: run the `seo-aeo` skill logic in Mode 1 to produce a keyword plan. Every page gets a primary keyword, intent classification, and 3-5 supporting keywords.

**Present the keyword plan to the user and confirm before moving to copy.**

### Stage 7: Copy

Using the content-writer skill logic, write copy for every page built in Stage 5, using the keyword plan from Stage 6. After generating each page's copy, run it through the `superhuman-writer` skill for a voice pass before presenting it to the user.

If the user provided existing copy, testimonials, team bios, or notes in Discovery, use those as the foundation. Don't rewrite what already works. Build around it.

For each page:
1. Write all section copy (headlines, body, CTAs, supporting text)
2. Incorporate any existing content the user provided, improving tone and structure where needed
3. Follow the word counts and structure from the content-writer guidelines
4. Mark anything that needs the user's specific input with [placeholders]

**Present the copy page by page.** The user can request tweaks before moving on.

### Stage 8: SEO/AEO Audit

Run the `seo-aeo` skill logic in Mode 2. Score every page out of 10, generate schema markup for each page type, and produce a fix list. All pages should score 8/10 or above before proceeding to launch.

### Stage 9: Security Audit

Using the `wordpress-security-audit` skill logic, scan the theme code before it goes to a live server. Run through all three steps:

1. JavaScript scan (XSS vectors, unsafe DOM writes)
2. PHP theme scan using `scripts/scan_php_files.py` on the theme folder
3. Theme directory cleanliness (no .sql files, backup folders, or log files)

Produce a structured report with all findings rated Critical, High, or Medium. All Critical and High findings must be resolved before moving to Stage 10.

Note: server-level checks (wp-config, .htaccess, exposed files, security headers) are handled separately by the `wordpress-production-audit` skill after migrating to live hosting. Mention this to the user at the end of the security audit so they know to run it later.

### Stage 10: Pre-Launch Check

Using the launch-checklist skill logic, produce a personalised checklist covering:

- Content completeness
- SEO basics
- Performance
- Mobile responsiveness
- Conversion readiness
- Security
- Legal compliance
- Go-live technical steps

Tag every item as BLOCKER, IMPORTANT, or NICE-TO-HAVE.

## How to Move Between Stages

- Complete each stage fully before moving to the next
- Always confirm with the user before proceeding to the next stage
- If the user wants to go back and change something, do it
- If the user wants to skip a stage (e.g., they'll write their own copy), skip it

## Progress Tracking

At the start of each stage, remind the user where they are:

```
## Website Build: [Business Name]

Stage 1: Discovery ✓
Stage 2: Site Plan ✓
Stage 3: SEO Structure ✓
Stage 4: Theme ← you are here
Stage 5: Pages
Stage 6: Keyword Planning
Stage 7: Copy
Stage 8: SEO/AEO Audit
Stage 9: Security Audit
Stage 10: Launch Check
```

## Saving Progress

After the user confirms each stage, write or update `website-build.md` in the project root. This file lets the build resume across sessions without losing any decisions.

The file format:

```markdown
# Website Build: [Business Name]

**Last updated:** [date]
**Current stage:** [stage name and number]

## Business Details
- Business name: [name]
- What they do: [description]
- Target customers: [description]
- Primary goal: [leads / sales / bookings / credibility]
- Brand colours: [hex codes or description]
- Theme type: [block / classic]
- Existing content: [summary of what they provided]

## Site Plan
- Pages: [list]
- Navigation: [structure]
- Build order: [ordered list]
- SEO notes: [key findings from Stage 3]

## Keyword Plan
- Source: [user-provided / generated by seo-aeo]
- Plan: [summary or paste of keyword plan]

## Build Progress
- Stage 1 Discovery: [complete / in progress / not started]
- Stage 2 Site Plan: [complete / in progress / not started]
- Stage 3 SEO Structure: [complete / in progress / not started]
- Stage 4 Theme: [complete / in progress / not started]
- Stage 5 Pages: [list each page and status]
- Stage 6 Keyword Planning: [complete / in progress / not started]
- Stage 7 Copy: [list each page and status]
- Stage 8 SEO/AEO Audit: [complete / in progress / not started]
- Stage 9 Security Audit: [complete / in progress / not started]
- Stage 10 Launch Check: [complete / in progress / not started]

## Decisions Made
[Key decisions, preferences, and anything the user specifically asked for or rejected]
```

Update this file after every confirmed stage. If the user changes a decision mid-build, update the relevant section immediately.

## Tone

- Direct and practical
- Guide them through the process without overwhelming
- Explain decisions briefly but don't lecture
- Celebrate progress at each stage completion

## Important

- Never skip discovery. A bad brief produces a bad site
- Always get confirmation before moving to the next stage
- The homepage is always built first in Stage 4
- If the user seems stuck on colour or font choices, offer sensible defaults and move on
- The entire process can be done in one session or spread across multiple sessions. Pick up where you left off if they come back

