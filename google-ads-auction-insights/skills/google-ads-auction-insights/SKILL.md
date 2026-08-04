---
name: google-ads-auction-insights
description: Consolidates Google Ads Auction Insights scheduled reports (competitor trends in Search and Shopping auctions) into a hub sheet and builds an interactive HTML dashboard, one tab per report. USE WHEN the user says "auction insights", "who am I competing with on Google Ads", "competitor impression share", "auction dashboard for [client]", "update the auction insights for [client]", or asks to set up auction monitoring for a client.
---

# Google Ads Auction Insights

Tracks how competitors move in a client's Google Ads auctions (Search and
Shopping), week by week, in a reusable interactive dashboard.

English fork by Sandra Walsh of Andrea Lombardi's skill (Ads2AI, shared 23 Jul
2026), itself based on an idea by Mike Rhodes. See "What this fork changes" at
the bottom.

## Installing

From the A2AI marketplace:

```
claude plugin install google-ads-auction-insights@a2ai-community
```

Or drop the whole `google-ads-auction-insights/` folder into `.claude/skills/` in
your brain and restart the session. The Node scripts use only built-ins plus
`curl`, so there is nothing to install. The command examples below write to a
`clients/<client>/auction-insights/` folder in your brain; if your brain keeps
clients somewhere else, use that path instead (and `--clients` for the alerts
script). Plugin installs keep the scripts inside the plugin folder rather than
`.claude/skills/`, so adjust the script paths in the examples to wherever this
file actually lives.

To see it work before you have an account set up, build the dashboard straight from
the bundled sample:

```bash
node scripts/build-dashboard.cjs "" references/sample-search-report.csv /tmp/sample.html "Sample"
```

Then run the tests: `node scripts/lib/ai-parse.test.cjs`.

## Triggers

- "auction insights", "competitor impression share", "who am I bidding against"
- "auction dashboard for [client]", "update the auction insights for [client]"
- Setting up auction monitoring for a new client
- Periodic auction alerts inside a routine

## The problem this solves

Auction Insights metrics are **not available through the Google Ads API** for most
accounts. The only reliable route is a Google Ads **scheduled report**, which saves
a **brand new Google Sheet** into a Drive folder every day or week rather than
updating one file. Each file holds the full weekly history for its lookback window.

Nothing here writes to a Google Ads account. It reads scheduled report files, so it
sits inside the read-only rule for ad platform APIs.

## Architecture

Three pieces, all in `scripts/`:

1. **`consolidate-from-folder.gs`** (Apps Script, runs on the hub sheet)
   Reads every file in the client's Drive folder, including **several different
   reports in the same folder** (account-level shopping, one search campaign, and
   so on), and **groups them by report name** (a trailing date on the file name is
   ignored). Writes **one tab per report**, plus a **`Manifest`** tab in first
   position listing `Tab | Gid | Type | Report | Rows | Updated`. Report type is
   read from each file's own header row. Dedupes by week + competitor, most recent
   file wins. Daily trigger available, so daily and weekly reports can mix freely.
   **For a new client, change `CONFIG.FOLDER_ID` and nothing else.**

2. **`build-dashboard.cjs`** (Node, writes the HTML)
   Builds a Chart.js dashboard with **one tab per Manifest tab**. Metrics depend on
   the report type:
   - **Shopping**: impression share, outranking share, overlap rate
   - **Search network**: those three plus top of page rate, absolute top of page
     rate, position above rate

   Every chart has a plain-English explanation of the metric, independent controls
   (date range, top N, isolate one competitor, show/hide), auto-generated key
   points, and an adaptive Y axis. Each tab gets a "Where things stand" panel.
   `"< 10%"` is plotted as 5, the midpoint of the band, and the dashboard says so.

3. **`analyze.cjs` + `auction-alerts.cjs`** (Node, for periodic alerts)
   `auction-alerts.cjs` scans `clients/*/auction-insights/`, picks
   each client's best data source (live, then snapshot), and runs `analyze.cjs`,
   which produces key points over the last 2 weeks (top competitor, big moves,
   competitors that dropped out, new entrants). Always exits 0, so it can sit in a
   routine without ever blocking it.

`scripts/lib/ai-parse.cjs` is the shared parsing layer. Both Node scripts use it,
and `consolidate-from-folder.gs` mirrors it. `scripts/lib/ai-parse.test.cjs` covers
it: run `node scripts/lib/ai-parse.test.cjs` after touching any parsing code.

## VERIFY THE COLUMN MAPPING BEFORE TRUSTING ANY NUMBER

The parser maps columns by reading each report's header row, so it does not care
about column order or report language. It still has to recognise the wording.
**The first time you point this at a new account, run `--inspect` and check the
mapping and the first parsed rows against the report in the Google Ads interface:**

```bash
node .claude/skills/google-ads-auction-insights/scripts/build-dashboard.cjs --inspect \
  "" clients/<client>/auction-insights/_snapshot-search.psv
```

It prints which column each metric was taken from and the first few parsed rows,
then exits without writing anything. If a column says `(not found)`, add the
wording to `FIELD_MATCHERS` in `scripts/lib/ai-parse.cjs` **and** in
`consolidate-from-folder.gs` (the two lists are deliberately identical). A report
whose week and competitor columns cannot be found fails with an error rather than
falling back to column positions, because a silent positional fallback is exactly
how wrong numbers reach a client report.

The expected UK column names are in `references/report-headers.md`.

## Three data modes

**Hub manifest (recommended).** One URL in the client's **live.json** (same folder
as the HTML):

```json
{ "hub": "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub" }
```

Needs the hub sheet **published to the web as the ENTIRE document** (File → Share →
Publish to web). The dashboard downloads the `Manifest` tab (it is first, and the
published CSV with no gid returns the first sheet), finds every tab and its gid, and
builds one dashboard tab per report. Adding a new scheduled report needs no change
to live.json: the tab appears on the next Apps Script run, the dashboard tab on the
next rebuild.

**Legacy.** live.json with two published CSV URLs:

```json
{
  "shop": "https://docs.google.com/.../pub?gid=XXXX&single=true&output=csv",
  "srch": "https://docs.google.com/.../pub?gid=YYYY&single=true&output=csv"
}
```

**Snapshot (offline).** With no live.json the dashboard embeds the data from
`_snapshot.psv` (Shopping) and optionally `_snapshot-search.psv` (Search). Simple
but static: rebuild to update.

In both live modes `build-dashboard.cjs` does two things:
1. **At build time** it downloads the CSVs with `curl` (from Node, so no CORS) and
   **embeds** them, so the dashboard is current even when opened by double-click
   (`file://`, where the browser blocks `fetch` to remote URLs).
2. It leaves the per-tab URLs in `CONFIG.csvUrl`, so a page served over **http**
   also refreshes itself on load. The set of tabs is still whatever the last build
   produced: a brand new report needs a rebuild.

`auction-alerts.cjs` reads the same live.json (`hub` or `shop`).

## Privacy: the hub sheet is published to the web

Publishing to the web makes that sheet readable by anyone with the URL, and it
holds the client's competitor share data. Treat the published URL as sensitive:
keep `live.json` out of git (see below), do not paste the URL into anything
client-facing, and unpublish the sheet when a client leaves.

## Commands

Rebuild a client's dashboard (picks up live.json automatically if present):

```bash
node .claude/skills/google-ads-auction-insights/scripts/build-dashboard.cjs \
  clients/<client>/auction-insights/_snapshot.psv \
  clients/<client>/auction-insights/_snapshot-search.psv \
  clients/<client>/auction-insights/auction-insights.html \
  "<Client>: Auction Insights"
```

Key points from the command line for one client:

```bash
node .claude/skills/google-ads-auction-insights/scripts/analyze.cjs \
  clients/<client>/auction-insights/_snapshot.psv --label "<Client>"
```

Alerts across every configured client:

```bash
node .claude/skills/google-ads-auction-insights/scripts/auction-alerts.cjs
```

## Setup for a new client

On the Google side (once, done by whoever owns the account):

1. **Google Ads scheduled reports** → type "Auction insights", format Sheets,
   daily or weekly, all saved into the **same Drive folder** for that client. One
   per view you want, each with a **different, descriptive name** ("Client account
   shopping", "Client brand search"). Each name becomes a hub tab and a dashboard
   tab.
2. **Hub sheet**: a new Google Sheet, "Client name - Auction Insights HUB".
3. **Extensions → Apps Script**: paste `consolidate-from-folder.gs`, set
   `CONFIG.FOLDER_ID` to the Drive folder from step 1.
4. Run `firstRun` (authorise; creates one tab per report plus `Manifest`), then
   `setupDailyTrigger` (or menu "Auction Insights → Turn on daily refresh").
5. **File → Share → Publish to web → Entire document**: copy the URL it gives
   you. The dialog hands out a `/pubhtml` address; paste it as-is, the dashboard
   normalises it to `/pub`. **Entire document matters** — a single-sheet publish
   exposes one tab and the Manifest discovery fails.

On the brain side:

6. Create `clients/<client>/auction-insights/live.json` holding
   `{ "hub": "<the /pub URL>" }`.
7. **Run `--inspect` first** and check the column mapping (see above).
8. Build the dashboard with the command above.

To add a report to an existing client, only step 1 is needed: the tab and the
dashboard tab appear on the next Apps Script run plus a rebuild.

## Setup gotchas

Everything below was hit in a real setup on 28 Jul 2026 and none of it is in Google's
documentation. Read it before walking anyone through the setup.

- **The recipient must be a DIRECT user on the account.** Reaching the account
  through a manager account is not enough: Google Ads rejects the address with
  "enter a valid email address with account access". If you manage accounts through
  an MCC, check you are a listed user on each one before promising this to a client.
- **An Allowed domains restriction can block the invitation** before you even get
  that far. It lives under Admin → Access and security → **Security** tab, and only
  an admin can change it. If the account allows one agency's domain and not yours,
  no invitation to your address will succeed until your domain is added.
- **The Week segment only exists on the scheduled report.** A manual download from
  the Auction insights view has no week column at all: it is one snapshot of the
  whole date range. Do not try to build the history from manual exports.
- **Choose Google Sheets as the format.** That is what makes Google Ads create a
  real file in Drive, and it is what reveals the **File name** and **Folder**
  fields. With a CSV format you get an emailed attachment and nothing lands in
  Drive. Google's own help page says delivery is email only, which is wrong.
- **Picking Google Sheets removes the Report name and Owner fields** and replaces
  them with File name and Folder. Nothing has gone wrong if you cannot find them.
- **Daily beats weekly for the first run.** A weekly schedule can leave you waiting
  the best part of a week for the first file. Daily lands one the next morning, and
  the consolidation dedupes overlapping files anyway.
- **Untick Totals.** The summary row is no use here.
- **Set the table's date range before opening the dialog** — the scheduled report
  inherits whatever the table is showing.
- **A run that "completes" and changes nothing is the FOLDER_ID guard.** Run
  `diagnose` from the function dropdown: it logs whether the script is bound to a
  sheet and which one, the folder id it resolved, and the files it can actually
  see, without writing anything. Read that instead of reasoning backwards from an
  empty sheet.
- **Never set FOLDER_ID with a find-and-replace across the whole file.** It also
  rewrites the guard that checks for the placeholder, so the guard compares the id
  to itself, matches, and every run exits early reporting the id as unset while the
  config line looks perfectly correct. The guard is shape-based now for exactly
  this reason, but edit the one config line regardless.
- **A hub sheet created through the Sheets API defaults to the `Etc/GMT`
  timezone**, which Apps Script cannot map, so `getSpreadsheetTimeZone()` returns
  a non-string and every date format call throws. Handled with a fallback, but
  set the sheet to a real timezone under File → Settings anyway.
- **Nothing appears until you click OK on nothing.** Progress messages are toasts,
  never modal alerts: a modal blocks execution until someone clicks it *in the
  spreadsheet*, and when you run from the editor nobody is looking there. The run
  appears to hang on work it has already finished.
- **The file name becomes the tab name** in the hub sheet and on the dashboard, so
  name each report after its campaign or ad group, not after the client.

## Before you show this to a client

- **Two clients in the same area will appear in each other's reports.** That is
  normal and unavoidable: they are bidding in the same auctions. Both can already
  see each other in their own accounts, so nothing is being disclosed that they
  could not find themselves. What to watch is your own commentary. Do not let
  anything you know from one account inform what you write about the other, and do
  not comment on a named competitor's strategy when that competitor is also a
  client.
- **`< 10%` is an approximation.** It is plotted as 5, the midpoint of the band.
  The dashboard says so on the page. Do not quote it as a figure in a report.
- **A line stopping mid-chart is not a bug.** Google stops reporting a competitor
  in weeks where they leave the auctions or drop below the reporting threshold.
- **A competitor's impression share is not their budget, spend, or lead volume.**
  It is a share of eligible impressions. Do not translate it into money.

## Which clients this is worth doing for

Any account with real competition in the auctions, which is most of them.

Two things worth knowing rather than assuming:

- **Franchises of the same brand never appear in each other's reports** when each
  one geo-fences to its own territory. That is by design and should never be
  presented to the client as a finding. It does **not** make the report low value:
  the real competitor set is the independent operators in that market, and a
  territory-limited franchise is usually Ad Rank constrained rather than budget
  constrained, which is exactly what position above rate and outranking share
  speak to.
- **Auction Insights does not cover Performance Max.** Scope the reports to Search
  and Shopping campaigns.

## Operational notes

- Client output (HTML, snapshots, live.json, `.live-cache.csv`) is gitignored and
  stays **local**. The skill code itself is committed. Nothing in this brain is
  local-only by default, so that gitignore entry is what keeps a published-sheet
  URL out of the repo.
- A search tab holding only the "You" row is **not an error**: it means no
  competitors were detected in those auctions.
- A competitor's line **stopping mid-chart** on current data is not a bug: Google
  stops reporting a competitor in weeks where they leave the auctions or fall below
  the reporting threshold. If instead every line stops at an old week, the embedded
  data is stale: rebuild, or serve the page over http.
- New data arrives when Google Ads writes to the Drive folder, usually weekly. The
  daily trigger only keeps the hub in step.
- Report value formats handled: dot or comma decimals, `"< 10%"`, `"--"` for not
  applicable. Your own "You" row always has `--` for overlap and outranking.

## What this fork changes

Against Andrea's original, reviewed 23 Jul 2026:

- **Locale-safe numbers.** The original stripped dots as thousands separators, so a
  UK "46.75%" parsed as 4675, silently and with no error. Now the decimal separator
  is worked out from the value itself and both formats parse correctly. The Apps
  Script also reads display values rather than raw cell values, so a percentage-
  formatted cell cannot arrive as an ambiguous fraction.
- **Header-driven columns.** Columns were positional and the headers were expected
  in Italian. They are now matched from each report's own header row, in either
  language, in any order, and an unrecognisable header fails loudly.
- **English throughout.** SKILL.md, dashboard UI, metric explanations, key points,
  Apps Script menus and log tabs.
- **Portable client layout.** The alerts scan `clients/<client>/auction-insights/`
  relative to wherever you run them (normally the brain root), with `--clients`
  to point anywhere else.
- **Tests.** `scripts/lib/ai-parse.test.cjs` locks the number and header handling.
- Security review found nothing to change: the Apps Script stays inside your own
  Drive and Sheets, the Node scripts only download from URLs you configure
  yourself, and no credentials are touched.

## Resources

| File | Status | What it does |
|------|--------|--------------|
| `scripts/lib/ai-parse.cjs` | Canonical | Shared parsing: locale-safe percentages, header-driven column mapping |
| `scripts/lib/ai-parse.test.cjs` | Tests | Run after any change to parsing |
| `scripts/consolidate-from-folder.gs` | Canonical | Apps Script on the hub sheet: groups the Drive folder's files by report name, one tab per report plus `Manifest` |
| `scripts/build-dashboard.cjs` | Canonical | Builds the Chart.js dashboard, one tab per report (hub manifest) or two fixed tabs (legacy/snapshot). `--inspect` prints the column mapping |
| `scripts/analyze.cjs` | Canonical | Key points over the last 2 weeks from the command line (always exits 0) |
| `scripts/auction-alerts.cjs` | Canonical | Scans `clients/*/auction-insights/` and runs analyze.cjs per client |
| `references/report-headers.md` | Reference | Expected column names and how to add a new one |
