---
name: logo-brief
description: Write a logo brief for a client (or your own business) to paste into Claude Design (claude.ai/design), which then produces the logo concepts. Fills the brief from what your brain already knows about the client and their website, asks you only for what is missing, one question at a time, and saves it with the client's files. USE WHEN the user asks for a logo, logo concepts, logo ideas, a logo brief or a brand mark for a client or their own business.
---

# Logo Brief

The logo concepts come from Claude Design, not from the brain. This skill's job is the brief, because a thin brief gives generic logos. The template is `assets/brief-template.md`.

## Step 0: Price check

Logo work is usually extra work, not part of a normal retainer. Before writing the brief, ask once in one line: "Is this paid work, or a goodwill extra?" Then carry on either way.

## Step 1: Fill in what the brain already knows

Read whatever the brain holds on the client: profile, notes, landing page briefs, reports, call notes. Check their website too. If the site is built with Wix, Squarespace or another JavaScript-heavy builder, a simple page fetch can miss content, so use a tool that renders the page (such as Playwright) or ask the user to paste the text. From that, fill in:
- What the business does, who runs it, where, and how long for
- The one thing that sets it apart from competitors
- Who the customers are (and any second audience, such as referrers)
- Colours already in use (hex codes from the site)
- The clichés in their industry to avoid

**Only verified facts.** Years in business, qualifications, locations and claims must come from a file or the live site. If one isn't verified, leave it as a question for the user. Never invent personality words or a differentiator to make the brief read well.

## Step 2: Ask only for the gaps

Ask one question at a time, in plain English. Always ask this one, even if everything else is filled in:

> "Does the client already have a logo, symbol or mark they're attached to?"

If they do, get a copy and make round one a modernised take on it, with fresh directions as extras. Otherwise the first round of brand-new concepts can be set aside the moment the client sends their old mark.

Don't hand the user a list of style directions to choose from. Use the four in the template, drop any that clearly don't suit (e.g. heritage for a modern trade business), and say which you dropped and why.

## Step 3: Write and save the brief

- Fill in `assets/brief-template.md`. Delete the "How to use it" lines and any bracket that isn't relevant. The version the user pastes should have no brackets left.
- Save it with the client's files, dated (e.g. `logo-concepts/logo-brief-YYYYMMDD.md` in the client's folder).
- Copy the paste-ready part to the clipboard and tell the user: paste it into Claude Design, then export the result (Save as PDF, or the handoff bundle) into that same folder.

## Step 4: Round two (when they come back)

- Write a short round-two brief naming the chosen concepts and what to change.
- If the logo will go on Google Ads, look up Google's CURRENT business logo requirements (Google Ads Help) at the time and include them. Don't rely on remembered sizes; they change.
- If the concepts are going to the client, the user reviews them first. Draft any covering email for the user to send; never send it.

## Sharing

The blank template in `assets/` has no client details and is safe to share. A filled-in brief names the client, so never share one in a group or a public post.
