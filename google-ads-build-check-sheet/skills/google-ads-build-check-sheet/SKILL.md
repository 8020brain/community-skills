---
name: google-ads-build-check-sheet
description: "Build a client-facing Google Ads build check sheet: one branded web page showing the campaign plan (locations, budget, blocked searches, positioning), every ad group with a Google preview and all its headlines and descriptions, the sitelinks, callouts and other extras, what is left before launch and what we need from the client. Checks every line of copy against Google's character limits and house rules (spelling, Title Case, & not and, minimum description length, banned words) and refuses to build if anything fails. Never connects to Google Ads. USE WHEN someone says 'build check sheet', 'ad copy for approval', 'client build doc', 'show the client the ads before launch', or has drafted a new campaign and needs the client's sign-off."
version: 1.0
last_updated: 2026-09-23
---

# Google Ads Build Check Sheet

One page the client reads before anything goes live. It shows the plan and every word of
the ads, so they can approve or change it while changes are still cheap. Google will not
let you edit an ad once it is uploaded, so this is where the wording gets settled.

**This skill only makes the page.** It never logs into Google Ads and changes nothing in
any account. Building the campaign is a separate job, done by hand or by another skill.

## What you get

`index.html`, a single self-contained file: logos embedded, works offline, light and
dark mode, readable on a phone, and marked `noindex` so search engines skip it if it is
put online. Publish it as an artifact, open it locally, or put it on Vercel.

Sections, numbered automatically, each left out if you give it nothing:

| Section | Comes from |
|---|---|
| Summary tiles under the heading | `summary` |
| Anything you write yourself, e.g. "What we found", tracking | `before` |
| Where your ads will show (areas, budget, hours, blocked searches) | `targeting` |
| What every ad says about you (the 3 or 4 selling points) | `positioning` |
| The lines every ad shares | `copy.SHARED_*` |
| Your ads (one collapsible panel per ad group, with a Google preview) | `copy.AD_GROUPS` (required) |
| The extras under every ad (sitelinks, callouts, services, call button) | `copy.SITELINKS` etc. |
| More of your own sections | `after` |
| What is left before we go live | `checklist` |
| What we need from you | `asks` |

## How to run it

### 1. Gather what you need

Ask for anything missing. Do not invent facts about the client's business.

- Client name, website domain, and their logo file if they have one
- Your own name or business name, and your logo if you want it on the page
- A brand colour (a hex code; otherwise take it from their website)
- Whether this is **draft** (awaiting approval, not in the account) or **built**
  (already in the account and paused)
- Ad groups: name, keywords, what the searcher wants, and 2 display path words each
- The copy: shared headlines and descriptions used in every ad, plus the unique
  lines for each ad group. Write it if asked, following the rules below
- Sitelinks, callouts, a services list and the call number. For an existing account,
  what is there now (`have`) and whether each is kept, updated, added or removed
- Locations, daily budget, ad hours, and the blocked-search lists with counts
- Anything the client needs to do, and what is left before launch

### 2. Write the sheet

If you installed this skill as a plugin, its files live in the plugin folder rather than
`.claude/skills/`, so in the commands below use the folder this SKILL.md actually sits in.

```bash
mkdir -p clients/<key>/build-sheet
cp .claude/skills/google-ads-build-check-sheet/examples/harbour-paws/sheet.cjs clients/<key>/build-sheet/
```

Replace everything in the copy. The example has a comment on every field. Put the
client's logo in the same folder and set `meta.logos.client` to its file name.

If the brain has no `clients/` folder, any folder works. The script only needs a
`sheet.cjs` inside it.

**Free-written sections** (`before`, `after`, and any `notes`) are HTML. The sheet exports
a function that receives helpers so you don't have to hand-write the markup:
`b.note()`, `b.call(title, text, { warn })`, `b.table(headers, rows)`, `b.pill(text, kind)`,
`b.steps([{h, d}])`, `b.stats([...])`, `b.details(summary, count, inner)`, `b.list([...])`,
`b.mono()`. See `scripts/blocks.cjs`.

### 3. Build and fix

```bash
node .claude/skills/google-ads-build-check-sheet/scripts/build-sheet.mjs clients/<key>/build-sheet
```

Add `--check` to validate without writing. If anything fails, nothing is written and every
problem is listed. **Fix the copy, not the rules.** Only loosen a rule if the person asks.

### 4. Look at it, then share it

Open `index.html` in the browser and read it through before anyone else sees it. Check
that the tone is right for the client (see below).

To share it, either:
- publish `index.html` with the Artifact tool, which gives a private claude.ai page you
  can share, or
- deploy it to Vercel: copy `index.html` into an empty folder named `<client>-google-ads`
  and run `vercel --prod --yes` in it. It is public but not indexed, with no password.

When the client asks for changes, edit `sheet.cjs`, rebuild, and republish to the same
place so the link stays the same.

## The copy rules the script enforces

Set in `rules`. These are the defaults:

| Rule | Default | Why |
|---|---|---|
| Google limits | always on | Headline 30, description 90, path 15, callout 25, sitelink 25/35, snippet value 25. Max 15 headlines per ad, 2 to 4 descriptions, 3 to 10 snippet values |
| `spelling` | `'au'` | Flags US spellings in ad copy (paediatric, colour, centre, -ise). `'us'` does the reverse, `'off'` skips it. Keywords are never checked, people search both ways |
| `ampersand` | `true` | "&" instead of "and", which saves 2 characters every time |
| `titleCase` | `true` | Every Word Capitalised, the usual ad style |
| `descMin` | `78` | A short description wastes space you pay the same for. `0` turns it off |
| `descriptionsPerAd` | `4` | Exact count wanted, shared plus unique. `0` allows 2 to 4 |
| `banned` | none | `[{ pattern: /regex/i, why }]` for words a client can't use |

**Make banned patterns precise.** `/\bbest\b/` also catches "Help Your Child Be Their
Best", which is fine. For a health client under AHPRA (no testimonials, no claims of being
the best, no promised outcomes) use something like `/\bthe best\b|\bbest (physio|clinic)\b/i`
and `/testimonial/i`.

Duplicate headlines within an ad are also caught, including ones repeated between the
shared and unique lines.

## Writing for the client

This page is for the client, not for you.

- "We" and "your": "we built", "your website", "your budget".
- Plain English. Say what something means for them, not how it works inside Google Ads.
- No criticism of whoever ran the account before. State what was found and what it
  means now.
- IDs and technical detail go inside `b.details()`, collapsed, "for your records".
- For an existing account, `have` says what is there now in a line the client can follow.

## Reusing the copy for the account build

`copy` has the same shape as a `copy-data.cjs` (`SHARED_USP`, `SHARED_CTA`, `SHARED_DESC`,
`AD_GROUPS`, `SITELINKS`, `SITELINKS_REMOVE`, `CALLOUTS`, `SNIPPETS`, `CALL_ASSET`). If
another tool builds the campaign from a copy file, keep the copy in that one file and set
`copy: require('../copy-data.cjs')`. The approved page and the account then can't
end up saying different things.

## Files

- `scripts/build-sheet.mjs`: checks the copy and writes the page
- `scripts/blocks.cjs`: helpers for free-written sections
- `assets/sheet.css`: the page design. Colours and fonts come from `theme`
- `examples/harbour-paws/`: a complete made-up example, with its built `index.html` to
  show what the result looks like
