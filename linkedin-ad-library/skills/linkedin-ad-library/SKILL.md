---
name: linkedin-ad-library
description: Save LinkedIn ad examples (screenshot + optional Ad Library URL) to your own "LinkedIn Ad Library" swipe file in Notion, auto-tagged by format, creative style, hook, industry, objective and CTA. First run sets up the Notion database and views for you. Use whenever the user shares a LinkedIn ad image/screenshot and/or a LinkedIn ad URL and wants to save, log, document, swipe or add it as an example, or says "set up my LinkedIn ad library".
---

# LinkedIn Ad Library

Builds a swipe file of LinkedIn ads in the user's Notion: one row per ad, with the screenshot as a gallery card, the copy pulled out verbatim, tags, and a short "why it works" note.

**Needs:** the Notion MCP connected (tools named like `notion-create-database`, `notion-create-pages`, `notion-create-file-upload`, `notion-update-page`, `notion-fetch`). The prefix varies by setup (e.g. `mcp__notion__` or `mcp__claude_ai_Notion__`); use whichever is available. If none is connected, stop and tell the user to connect Notion first.

## Config

The skill remembers the user's database in a small JSON file. Look for it in this order and use the first one found:
1. `.claude/linkedin-ad-library.json` in the current project (e.g. the brain folder)
2. `~/.claude/linkedin-ad-library.json`

```json
{
  "database_url": "https://www.notion.so/...",
  "data_source_id": "collection://...",
  "parent_page_url": "https://www.notion.so/...",
  "created": "YYYY-MM-DD"
}
```

- **No config file:** run **Setup** (below), then carry on with the ad the user shared, if any.
- **Config exists:** go straight to **Saving an ad**.
- If the database in the config can't be fetched (deleted, or access removed), tell the user and offer to run Setup again or point the skill at a different database.

## Setup (first run only)

1. **Ask one question:** "Which Notion page should the library live under? Paste its link, or say 'none' and I'll create it as a private page." Also offer the default Industry tags (below) and ask if they want to add or drop any. They can reply "defaults are fine".
2. **Already have a library?** If the user says they already have a LinkedIn ad database, fetch it, check it has at least `Name`, `Ad Image` (files) and `Ad URL`, and save its IDs to the config instead of creating a new one. Then skip to step 5.
3. **Create the database** with `notion-create-database`: title `LinkedIn Ad Library`, parent = the page they gave (omit parent if 'none'), and the schema in `references/schema.sql`, with the Industry list swapped for theirs if they changed it. Take the `collection://` data source ID from the response.
4. **Create three views** with `notion-create-view` on the new database (`database_id` = the database, `data_source_id` = the collection):
   - `🖼️ Gallery`, type `gallery`, configure: `COVER "Ad Image"; SORT BY "Date Added" DESC; SHOW "Name", "Advertiser", "Ad Format", "Hook", "Rating"`
   - `By Format`, type `board`, configure: `GROUP BY "Ad Format"; COVER "Ad Image"; SHOW "Name", "Advertiser", "Hook"`
   - `⭐ Best examples`, type `gallery`, configure: `FILTER "Rating" = "⭐⭐⭐ Swipe it"; COVER "Ad Image"; SHOW "Name", "Advertiser", "Ad Format", "Hook"`

   Notion also adds a plain table view by default. Leave it; it's handy for bulk editing tags.
5. **Write the config file.** Save it to `.claude/linkedin-ad-library.json` if you're in a project with a `.claude/` folder, else `~/.claude/linkedin-ad-library.json`.
6. **Tell the user** in 2–3 lines: the link to the library, and one manual tweak worth making: in each gallery view, **••• → Layout → turn on "Fit image"** and set **Card size → Large**, so tall ad screenshots show in full instead of being cropped. (The MCP can't set this.)

## Saving an ad

1. **Collect the inputs.** You need at least one image; the ad URL is optional.
   - Images must be **local file paths**. Images pasted straight into Claude Code aren't saved to disk. Dragged-in paths may have escaped spaces (`\ `) or quotes, so normalise them.
   - If the user pasted an image but gave no path, check the newest images on the Desktop and in Downloads (`ls -t ~/Desktop/*.png ~/Desktop/*.jpg ~/Downloads/*.png ~/Downloads/*.jpg 2>/dev/null | head -3`), and ask them to confirm the right file before using it.
   - Several images for one ad (e.g. carousel cards) go into one row. Several different ads become one row each. Ask if it's unclear.

2. **Load the current tag options.** Fetch the data source (`notion-fetch` on the `data_source_id`) and read the option lists for each select / multi-select. Use those, not the defaults in this file, because the user may have edited tags in Notion. Do this once per session, not per ad.

3. **Look at the image(s)** with the Read tool. Pull out the advertiser, headline, intro text, CTA button and visual approach. Copy text **verbatim**; if it's cut off or unreadable, leave it rather than guessing. If the intro text ends in "… more", store what's visible and add "(truncated in preview)".

4. **Don't fetch the URL.** LinkedIn blocks automated fetches, Ad Library links included, so take everything from the image. Store the URL as-is, but strip tracking parameters such as `?trk=...`.

5. **Tag it.** Choose only from the options you loaded in step 2; never invent new values. If nothing fits a property, leave it empty and mention it. Use 1–3 values per multi-select. Write `Why It Works` as a 1–2 sentence practitioner note (e.g. "Leads with a specific stat, and the face breaks up a text-heavy feed. The CTA matches the free-resource hook."). If the user said what they liked, use their words. Leave `Rating` empty unless they give one ("this is a great one" → `⭐⭐⭐ Swipe it`).

6. **Upload each image.** For each file:
   - Call `notion-create-file-upload` with `{"filename": "<basename>"}`.
   - POST the file to the returned `upload_url` with every header from `upload_headers`:
     `curl -s -X POST '<upload_url>' -H '<header>: <value>' -F 'file=@<path>'`
   - Check the response shows `"status":"uploaded"` and keep the file upload ID. The upload URL expires after a few minutes, so upload straight away.
   - Max 20 MB per file. If a video is too big, ask for a screenshot instead.

7. **Create the page** with `notion-create-pages` (`allow_async: false`, since the page ID is needed next):
   ```
   parent: { "type": "data_source_id", "data_source_id": "<from config, without collection://>" }
   properties: {
     "Name": "<Advertiser> – <short description>",
     "Ad URL": "...", "Advertiser": "...",
     "Ad Format": "Single image",
     "Creative Style": ["Stat / data", "Bold headline"],
     "Hook": [...], "Industry": [...],
     "Objective": "...", "CTA": "...",
     "Headline": "...", "Intro Text": "...", "Why It Works": "..."
   }
   content: "<image src=\"file-upload://<id>\"></image>\n\n[View ad](<Ad URL>)"
   ```
   Leave out properties you don't know rather than sending empty strings. Leave out the `[View ad]` line if there's no URL.

8. **Attach the image to `Ad Image`** with `notion-update-page`, `command: "update_properties"`:
   ```
   "Ad Image": [{"type": "file_upload", "file_upload": {"id": "<file upload id>"}}]
   ```
   The same upload ID used in the page body works here. The gallery cover depends on this property, so fetch the page afterwards and check `Ad Image` isn't empty.

9. **Confirm** in one or two lines: the ad name, the tags applied, and a link to the page. Don't show raw tool output.

## Notes
- It's a personal swipe file, so save straight away without asking for confirmation. Only ask when the image path or the one-ad/many-ads split is unclear.
- If a property errors (the user renamed or removed it in Notion), fetch the data source, adjust to the current schema, and retry once. If a core property (`Name`, `Ad Image`) is missing, tell the user.
- **Adding a tag option** (e.g. a new industry): use `notion-update-data-source` with `ALTER COLUMN "Industry" SET MULTI_SELECT(...)`, listing **all** existing options plus the new one, or existing options are lost.
- Never put the user's Notion IDs in this SKILL.md. They live only in the config file, so the skill can be shared and updated safely.
