# LinkedIn Ad Library

A Claude Code skill that turns LinkedIn ad screenshots into a tagged swipe file in your Notion.

Drop in a screenshot (and the Ad Library link if you have it) and Claude:
- reads the ad and copies the headline and intro text word for word
- tags it by format, creative style, hook, objective, CTA and industry
- writes a one-line "why it works" note
- saves it as a gallery card in Notion, with Gallery, By Format and ⭐ Best examples views

## What you need
- Claude Code
- The Notion connector/MCP connected to Claude Code

## Install
1. Copy the `linkedin-ad-library` folder into your brain's `.claude/skills/` folder (or `~/.claude/skills/` to use it everywhere).
2. Start a new Claude session.
3. Say **"set up my LinkedIn ad library"**. Claude asks which Notion page to put it under, builds the database and views, and remembers it.
4. One manual tweak in Notion: in each gallery view, go to **••• → Layout**, turn on **Fit image** and set **Card size → Large** so full screenshots show.

## Use
Drag a screenshot into the terminal, paste the ad link, and say something like *"save this LinkedIn ad"*. Add "this is a great one" to rate it ⭐⭐⭐.

Tip: LinkedIn's Ad Library (linkedin.com/ad-library) is the easiest place to find ads to screenshot.

## Customising
- **Tags:** edit the options in Notion directly. Claude reads them fresh each session and only uses what's there.
- **Your settings** are saved in `.claude/linkedin-ad-library.json`. Delete that file to set up again from scratch.
