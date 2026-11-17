# Google Ads Build Check Sheet

A Claude Code skill by Isadora Benjamin.

It makes one branded web page to send a client before a campaign goes live: where the
ads will show, the budget, the blocked searches, the selling points, every ad group with
a Google preview and all its headlines and descriptions, the sitelinks and callouts, what
is left before launch and what you need from them. The client reads it and asks for
changes, and the wording is settled before anything is uploaded.

Before it builds the page, it checks every line of copy against Google's character
limits and a set of house rules (spelling, Title Case, "&" instead of "and", minimum
description length, duplicate headlines, and any words you ban for a client). If
anything fails, it lists the problems and builds nothing until they are fixed.

It only makes the page. It never connects to Google Ads and cannot change anything in an
account, so there is no API setup.

## Install

1. Unzip and put the `google-ads-build-check-sheet` folder into `.claude/skills/` in your
   brain, so you have `.claude/skills/google-ads-build-check-sheet/SKILL.md`.
2. Open Claude Code in your brain. It picks the skill up automatically.

The build script runs on Node.js.

## Use

Say "build check sheet for [client]" or "ad copy for approval for [client]". Claude asks
for what it needs (logo, brand colour, ad groups, keywords, copy, extras, locations and
budget), writes the client's file and builds the page.

- Open `examples/harbour-paws/index.html` to see a finished page for a made-up client.
- The spelling check is set to Australian English, which also suits UK English. Use
  `spelling: 'us'` for US English, or `'off'`.
- Each client's file goes in `clients/<client>/build-sheet/` by default. If your brain
  keeps client files somewhere else, tell Claude where.
- The copy rules ("&", Title Case, number of descriptions per ad) are settings in
  `rules`, so you can switch them to suit how you work. SKILL.md lists them all.

## Making it your own

This zip is Isadora's original. Sandi Walsh, who is sharing it, changed a few things in
her own copy to suit how she works. They're listed here in case you want to do the same.
The easiest way to make any of these changes is to ask Claude to do it for you in your
brain.

**Settings (change the defaults in `scripts/build-sheet.mjs` and in your `sheet.cjs`):**
- `ampersand: false`, so "and" is never swapped for "&".
- `descriptionsPerAd: 0`, which allows 2 to 4 descriptions per ad instead of exactly 4.
  Useful on smaller accounts, where fewer descriptions work better.

**Code changes (both in the `style` function in `scripts/build-sheet.mjs`):**
- **Title Case on headlines only.** Descriptions and sitelink descriptions are left in
  normal sentence case. The Title Case line becomes:
  ```js
  if (rules.titleCase && kind === 'headline' && !titleCased(text)) problems.push(`${where}: ${kind} is not Title Case - "${text}"`);
  ```
- **Phone numbers blocked in all ad copy.** Google Ads doesn't allow them in headlines or
  descriptions. The number belongs in the call asset only. Added straight after the
  Title Case line:
  ```js
  if (/(?:\d[\s().-]*){10,}/.test(text)) {
    problems.push(`${where}: ${kind} contains a phone number, which breaks Google Ads policy. Use the Call asset only - "${text}"`);
  }
  ```

**Folder:** each client's file is saved where her brain keeps client files, rather than
`clients/<client>/build-sheet/`. Update the paths in SKILL.md if yours live elsewhere.

**Her own rules in SKILL.md:** she added a short list of house rules for Claude to follow
when using the skill, for example that the page says "I" rather than "we" because she
works on her own. Add your own in the same way.
