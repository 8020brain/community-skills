---
name: google-ads-auction-insights
description: Consolidates Google Ads Auction Insights scheduled reports (competitor trends in Search and Shopping auctions) into a hub sheet and builds an interactive HTML dashboard, one tab per report. USE WHEN the user says "auction insights", "who am I competing with on Google Ads", "competitor impression share", "auction dashboard for [client]", "update the auction insights for [client]", or asks to set up auction monitoring for a client.
---

# Google Ads Auction Insights

Tracks how competitors move in a client's Google Ads auctions (Search and
Shopping), week by week, in a reusable interactive dashboard.

English fork by Sandra Walsh of Andrea Lombardi's skill (Ads2AI, shared 23 Jul
2026), itself based on an idea by Mike Rhodes. See "What this fork changes" at the
bottom.

## Installing

From the A2AI marketplace:

```
claude plugin install google-ads-auction-insights@a2ai-community
```

Or drop the whole `google-ads-auction-insights/` folder into `.claude/skills/` in
your brain and restart the session. The Node scripts use only built-ins plus
`curl`, so there is nothing to install. The command examples below write to a
`clients/<client>/auction-insights/` folder in your brain; if your brain keeps
clients somewhere else, use that path instead (and `--clients` for the alerts and
refresh scripts). Plugin installs keep the scripts inside the plugin folder rather
than `.claude/skills/`, so adjust the script paths in the examples to wherever this
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

Rebuild **every** configured client's dashboard so none of them are stale (this is
the pair that runs in the morning routine, and it picks up new clients on its own):

```bash
node .claude/skills/google-ads-auction-insights/scripts/refresh-dashboards.cjs --quiet
node .claude/skills/google-ads-auction-insights/scripts/auction-alerts.cjs
```

## Set up the mail filter BEFORE your first report

**Do this once, before you create any scheduled report. It is not optional
housekeeping, it is the thing most likely to make you abandon this skill.**

**Every scheduled report run emails you.** One email per report per run, from
`ads-account-noreply@google.com`, subject "Your Google Ads report is ready:
<report name>". **There is no setting anywhere in Google Ads to turn this off.**
The email is a fixed cost of the report existing.

On a daily schedule that is one email per report per day, forever. Across a book of
accounts, with more than one report on some of them, that is a daily pile of mail
you will never read. Nobody tolerates that for long, and the usual outcome is that
the whole pipeline gets abandoned rather than the mail getting filtered.

**The filter, and the one thing you must get right:**

- From: `ads-account-noreply@google.com`
- **Subject contains: `Your Google Ads report is ready`**
- Skip the Inbox, mark as read, apply a label such as `Ads reports`

⚠️ **DO NOT filter on the sender alone.** `ads-account-noreply@google.com` is also
the address Google uses for **account security mail**. Real examples from a live
inbox, all from that same sender inside two weeks:

- "Admin user removed from your Google Ads account (XXX-XXX-XXXX)"
- "[Action required] Review security request"
- "Your security request was approved"

A sender-only rule that skips the inbox **silently buries every one of those**.
Those are exactly the messages that tell you someone gained or lost access to a
client account. Match on the subject as well and they keep arriving normally,
because the report mail has a completely distinct subject line.

**Keep the mail, do not delete it.** Archived under a label it costs nothing and
gives you a way to check whether a run actually happened. Auto-deleting it removes
your only independent record that Google is still producing the file. Note that
the email is *not* evidence the data is current — a frozen report emails you
faithfully every morning.

**One filter covers every client you will ever add**, because the sender and
subject are the same on all of them. Set it once now.

## Setup for a new client

### Check these BEFORE you begin — both block you mid-setup otherwise

**1. You need ADMIN access on the Google Ads account, as a DIRECT user.**

Not access through a manager account, and not a lower access level. Admin as a
direct user on the account itself is what lets you put your own address in the
report's Recipients field with **"Can edit"**. Reach the account through an MCC and
Google Ads rejects the address outright with "enter a valid email address with
account access".

Check this on every account **before you promise the dashboard to anyone**, because
fixing it is not a settings change you can make yourself — it means asking the
client, or their other agency, to grant you admin, and that can take days. Finding
out inside the Schedule dialog means abandoning a half-finished setup while you
wait.

Worth checking early too: an **Allowed domains** restriction can block the
invitation before access level even comes into it. It lives under Admin → Access
and security → **Security** tab and only an admin can change it.

**2. The mail filter must exist before your first report.** Sender **and** subject,
never sender alone — that address also carries account security alerts. See "Set up
the mail filter BEFORE your first report". One filter covers every client forever.

### Then, on the Google side (once, done by whoever owns the account):

0. **Make the client's Drive folder first**, before opening Google Ads: New → New
   folder, named `<Client> - Auction Insights`. The Schedule dialog's Folder field
   picks an existing folder and cannot create one. If a folder for that client is
   already there under a different name, use it rather than making a second one —
   the name is cosmetic, the script resolves by `FOLDER_ID`.
   **Folder only — no sheet.** Google Ads creates the report sheets itself; the
   only hand-made sheet is the hub, at step 3.
1. **Set the table's date range to a PRESET first.** Open the Auction insights
   view and set the date picker to **Last 30 days** (or another preset) *before*
   you open any dialog. The picker must read "Last 30 days", **not "Custom"**. Get
   this wrong and the report freezes forever while looking perfectly healthy — see
   "The one setting that silently breaks everything" below. This is step one for a
   reason.
2. **Google Ads scheduled reports** → type "Auction insights", format Sheets,
   daily or weekly, all saved into the **same Drive folder** for that client. One
   per view you want, each with a **different, descriptive name** ("Client account
   shopping", "Client brand search"). Each name becomes a hub tab and a dashboard
   tab. Route: **Download → Schedule** from the Auction insights view (there is no
   email or schedule icon on that toolbar).
3. **Hub sheet**: a new Google Sheet, "Client name - Auction Insights HUB".
4. **Extensions → Apps Script**: paste `consolidate-from-folder.gs`, set
   `CONFIG.FOLDER_ID` to the Drive folder from step 2.
5. Run `firstRun` (authorise; creates one tab per report plus `Manifest`), then
   `setupDailyTrigger` (or menu "Auction Insights → Turn on daily refresh").
6. **File → Share → Publish to web → Entire document**: copy the URL it gives
   you. The dialog hands out a `/pubhtml` address; paste it as-is, the dashboard
   normalises it to `/pub`. **Entire document matters** — a single-sheet publish
   exposes one tab and the Manifest discovery fails.

On the brain side:

7. Create `clients/<client>/auction-insights/live.json` holding
   `{ "hub": "<the /pub URL>" }`.
8. **Run `--inspect` first** and check the column mapping (see above).
9. Build the dashboard with the command above.
10. **Confirm the data actually moves.** The first file arrives the next morning,
    and the newest week in it must be the current or previous week. Do not treat
    the setup as finished until you have seen that — see below.

## Adding a report to an existing client

Once a client is live this is the more common job, and it is **much** shorter than a
new-client setup. Only steps 1-2 above apply: **the scheduled report, then a
dashboard rebuild.** That is the whole thing.

**Skip all of this. It already exists and is working:**

- ❌ No new Drive folder. The report goes into the client's existing one.
- ❌ No new hub sheet.
- ❌ No Apps Script work, no `FOLDER_ID` edit, no `firstRun`, no `setupDailyTrigger`.
  The existing daily trigger picks the new file up on its own.
- ❌ No publish to web. Already published.
- ❌ No `live.json` change. The hub manifest discovers new tabs by itself.

The new tab appears in the hub on the next Apps Script run and on the dashboard on
the next rebuild. That is the point of the manifest design.

**The file name is the one thing that must be right.** The Apps Script groups files
by report name, ignoring the trailing date. A *matching* name continues an existing
tab; a *different* name creates a new one. Adding a report means you want a new tab,
so a different, descriptive name is correct — but a typo, or reusing the existing
report's name, merges two campaigns' data into one tab and it cannot be separated
afterwards without deleting and recreating.

⚠️ **Verify the new tab by eye the first time. The staleness guard will not do it
for you** — see below.

## Walking someone through the setup

Most of the setup happens in interfaces you cannot touch: Google Ads, Drive, the
Apps Script editor. You are guiding, not doing. That changes how to run it.

**For Parts 2-4, give ONE step at a time and wait for them to confirm before the
next one.** A list of four steps looks efficient and is not: on the first real
setup, four steps at once meant the user could not find the Run button, and the
recovery cost more than the walkthrough saved. One step, confirm, next.

**Part 1 is the exception, and getting this wrong is what loses the read-backs.**
The Schedule dialog is a form, not a sequence, and its field order is not stable
(see step 4). A competent user will open it and fill most of it themselves before
you have finished dictating — that happened on three consecutive setups on 5 Aug
2026, and on one of them the Totals box was never read back at all, because the
step carrying it had been overtaken.

So for Part 1: **hand over the whole settings card up front**, in one block, and
let them work at their own speed. Then hold exactly **two mandatory read-backs**,
stated as read-backs rather than as steps, so they survive being worked ahead of:

1. **The date picker label**, before the dialog is opened.
2. **Title/date range ticked and Totals unticked**, immediately before Schedule is
   pressed.

Everything else on the card can be self-served. Those two are the only guards in
the setup and neither can be verified after the fact from inside the dialog.

**Do not put a full stop after a folder or file name.** Written in bold at the end
of a sentence, the trailing full stop reads as part of the name and gets typed in.
Put the name on its own line, unpunctuated.

**Ask what they can see rather than assuming it worked.** "Tell me what the
dropdown says now" beats "then select firstRun", because the dropdown is empty
until the file is saved and they will not know that matters.

**When something looks wrong, get a readout before theorising.** Run `diagnose`,
or ask for the execution log. Reasoning backwards from an empty sheet produces
confident wrong answers; the log produces the actual one.

### Part 1: the scheduled report (Google Ads)

Done by whoever has direct access to the account. The settings below are verified
as working; the exact button wording moves around, so ask what they can see rather
than reading a click path to them.

0. **Confirm they have ADMIN access on the account, as a direct user, before you
   start walking them through anything.** Ask them to check rather than assuming
   from the fact that they manage the account — managing it through an MCC is
   exactly the case that fails. Without it the Recipients field rejects their
   address and the setup stalls at the last field of the dialog, with a Drive
   folder made and a date preset set for nothing. This is not something they can
   fix in the moment: it needs the client or the incumbent agency to grant it.
0b. **Check they have the mail filter in place first.** Ask whether they have set it
   up, and if not, do that before anything else — see "Set up the mail filter
   BEFORE your first report". Once the report exists it emails them every single
   morning and there is no way to stop it at the Google Ads end. Doing this after
   the fact means they have already had a week of it and have formed an opinion
   about the whole thing. Warn them explicitly not to filter on the sender alone,
   because that address also carries account security alerts.
1. **Create the client's Drive folder before you open Google Ads at all.** Give the
   instruction as an action, not as a search:

   > In Drive: New → New folder, named
   >
   > `<Client> - Auction Insights`

   The Schedule dialog's **Folder** field only picks an existing folder, so leaving
   this until you are standing in the dialog means breaking off mid-setup to go and
   make it. Observed 5 Aug 2026: presented as a field to fill rather than a
   prerequisite, it stalled the walkthrough twice.

   **Then, subordinate to that instruction, not in front of it:** if a folder for
   this client is already there under a different name, use that one. Do not create
   a second with the "correct" name — that is how a report ends up writing somewhere
   the Apps Script is not looking. The name is cosmetic; the script resolves by
   `FOLDER_ID`. Observed 5 Aug 2026 on a six-account rollout, where the names had
   drifted between accounts.

   ⚠️ **Lead with the action.** Opening this step with the check turns it into a
   search task before any instruction has been given, and it reads as a stall.
   Corrected on Sandi's instruction 5 Aug 2026: "the skill should say, first of all,
   in Drive, new folder, named whatever it should be named."

   **Only the folder. Do not create any sheet.** This is the point people get
   stuck, because "format: Google Sheets" reads as though you must supply one. You
   do not: **Google Ads creates a brand new sheet in that folder every morning by
   itself.** The one sheet you *do* create by hand is the **hub sheet**, and that
   belongs to Part 2, after the first report file has landed. Say this out loud
   before they ask, because the question is guaranteed.
2. Open the campaign or ad group you want, then its **Auction insights** view.
3. **Set the date range to a PRESET before anything else.** Ask them to read the
   date picker back to you. It must say **"Last 30 days"**, not "Custom". This is
   the single most important instruction in the whole setup: the report inherits
   the table's range permanently and a Custom range freezes it at its end date
   while every other signal keeps saying healthy. Do not move on until they have
   read the label back. See "The one setting that silently breaks everything".

   **If the Schedule dialog is already open when you get here, cancel out of it,
   set the preset, and reopen.** The dialog covers the date picker, so the label
   cannot be verified while it is up, and there is no date control inside it to
   check instead. Losing ninety seconds of typed fields beats a permanently frozen
   report. Do not carry on and hope. This is not hypothetical — on one live
   setup, 5 Aug 2026, the user reached the dialog and filled several fields
   before the preset had been mentioned at all.
4. Create the scheduled report from that view via **Download → Schedule**. There
   is no email or schedule icon on this toolbar, which is where people get stuck.

   **Treat the bullets below as a checklist, not a sequence.** Work through them in
   whatever order the dialog actually shows them, and ask rather than assert. Do not
   read fields out in an order they cannot see — that makes people hunt, and they
   will tell you so. **The order is not stable:** two setups on 5 Aug 2026 in the
   same account presented these fields differently, one with Segment before File
   name and Folder, the other the reverse. Asserting a fixed order is the same
   failure as reading them out by importance.
   - **Frequency: daily, 08:00**, even if you only want weekly data. A weekly
     schedule can leave you waiting most of a week for the first file. Warn them
     the frequency may not be editable afterwards, so it is worth getting right
     now, and that every run sends an email (a mail filter beats fighting the
     schedule).
   - **Format: Google Sheets.** This is the one that matters. It is what makes
     Google Ads create a real file in Drive, and it is what reveals the File name
     and Folder fields. With CSV you get an emailed attachment and nothing lands
     in Drive, whatever Google's help page says. Changing it here also **removes
     Report name and Owner** — nothing has gone wrong.
   - **Recipients:** their own address, permission **"Can edit"** (that is the
     exact wording in the dialog; it is not called "edit rights"). The address
     must be a **direct user on the account with ADMIN access** — sort that out
     before you start, not from inside the dialog. See the gotchas.
   - **Segment: Week.** Without it there is no weekly history and the dashboard
     has nothing to plot.
   - **Title and date range: ticked.**
   - **Totals: UNTICKED.**
   - **File name**: name it after the campaign or ad group, not the client. It
     becomes the hub tab name and the dashboard tab name.
   - **Folder**: the folder you made in step 1. The picker selects an existing
     folder only, which is why step 1 comes first. One folder per client; several
     reports can share it.
   - There is **no date range control in this dialog**. That is expected; step 3
     is what set it.
   - The button that commits it is **Schedule**, not Save. Say so — "save it" sends
     people hunting for a button that is not there.

   **Confirm Title/date range TICKED and Totals UNTICKED last, immediately before
   Schedule is pressed.** These two are the ones that get skipped: they sit at the
   bottom of the dialog and are less memorable than the named fields, so a user
   moving at speed commits before either is confirmed. Observed on a live setup,
   5 Aug 2026 — the dialog was committed with both unverified. This is the
   second of the two mandatory read-backs.

   If they were missed anyway, do not guess from recall: verify them from the first
   file with `--inspect`. **Deleting and recreating the report is safe and loses no
   history**, provided you keep the same file name and folder, because every file
   carries its full lookback window and the consolidation dedupes by week plus
   competitor.
5. The first file arrives the next morning. Nothing can be tested until it does.

### Part 2: the hub sheet (Apps Script)

1. Create a Google Sheet, "Client name - Auction Insights HUB". **Create it in the
   interface, not through the API**, so it inherits a real timezone and locale.
2. **Extensions → Apps Script** from inside that sheet. It must be bound to the
   sheet; a standalone script has nothing to write to.
3. Paste `consolidate-from-folder.gs` over the placeholder in `Code.gs`.
4. **Set `CONFIG.FOLDER_ID` by editing that one line.** Never with a find and
   replace across the file.
5. **Save.** The function dropdown says "No functions" and Run stays greyed out
   until they do. Ask them to confirm the dropdown has filled in.
6. Run **`diagnose`** first. It writes nothing and confirms the binding, the
   folder and the files it can see. If this is wrong, everything after it is wrong.
7. Run **`firstRun`** and authorise: Review permissions, pick the account,
   Advanced, "Go to ... (unsafe)", Allow. Warn them this screen is coming and that
   it is normal for a script they pasted themselves.
8. Check the sheet has `Manifest`, `File List`, `Log` and one tab per report.
9. Run **`setupDailyTrigger`**, then confirm on the Triggers page (the clock icon)
   that exactly one time-based `importAndConsolidate` trigger is listed. "Last run"
   showing a dash is correct, it has not fired yet. **Note what time it is set to
   run** — you need it in Part 4.

**No Deploy step exists.** Deploy is for web apps and add-ons. A bound script with
a time trigger runs from saved code, and people will ask.

### Part 3: publish and build

1. In the sheet: **File → Share → Publish to web → Entire document → Publish.**
   Entire document matters; a single-sheet publish breaks Manifest discovery.
2. Copy the URL. It ends in `/pubhtml`, which is correct, paste it as-is.
3. Put it in `live.json` as `{ "hub": "<url>" }` and check it is gitignored before
   anything else. It grants access to the client's competitor data.
4. Run `--inspect` against the data, check the column mapping, then build.

### Part 4: prove the data actually moves

**The setup is not finished when the dashboard builds.** It is finished when you
have seen the newest data week advance.

1. **Check after the Apps Script trigger has run, not after the report has run.**
   These are two separate schedules. On the pilot account the Google Ads file lands
   about 08:00 and the consolidation runs at 09:33; a check at 08:30 shows the old
   week and looks like a failure when nothing is wrong. Use the trigger time you
   noted in Part 2.
2. Rebuild and read the newest week back:
   ```bash
   node scripts/refresh-dashboards.cjs --quiet
   ```
   It prints the newest data week per client. It should be the current or previous
   week.
3. If it has not moved, do **not** look at file timestamps, emails or the Manifest
   date — they will all look fine. Go straight to the date range on the scheduled
   report.

## The one setting that silently breaks everything

**Read this before setting up any report, and before believing any dashboard.**

The Auction insights date picker resolves **All time**, and any custom selection,
to `Custom <start> - <end>` with a hard end date. Only a **preset** holds a
relative range. The Schedule dialog has **no date range control of its own**, so
whatever the table is showing at the moment you open it is what the report keeps
**forever**.

A report created on a Custom range **freezes at its end date**. What makes this
dangerous is that every other signal keeps saying healthy:

- Google Ads writes a new file into Drive every morning, on time.
- The "your report is ready" email arrives every morning.
- The Apps Script consolidates it every day without error.
- The hub's `Manifest` tab gets stamped with today's date.
- The dashboard rebuilds cleanly and the build timestamp reads today.

Only the data never advances. **The single reliable tell is the newest week in
the data itself.** Nothing else in the pipeline is evidence of anything.

Observed on the pilot account 29 Jul – 4 Aug 2026: the hub sat at exactly 126 rows
for six days and the newest week's figures stayed byte-identical, while every
check above passed. It was twice confirmed "current" by eye, because the build
timestamp was misread as a data week.

**The fix:** set the date picker to a preset ("Last 30 days") *before* opening the
Schedule dialog, and confirm the label reads "Last 30 days" rather than "Custom".

**Repairing a frozen report:** create a replacement with a preset range and the
**same file name and folder**, so it continues the same hub tab instead of
starting a second one. **No history is lost** — every file carries its full
lookback window, `consolidate-from-folder.gs` reads every file in the folder, and
it dedupes by week plus competitor with the most recent file winning. Leave the
old report in place until the replacement is confirmed carrying a current week,
then delete it. Expect two files and two emails on the overlap day; the shared
file name means they merge into one tab.

**Timing matters when you check.** The Google Ads file and the consolidation are
two separate schedules. On the pilot account the file lands about 08:00 and the
Apps Script runs at 09:33, so a check at 08:30 shows the old newest week no matter
how healthy the setup is. Find out when your own trigger runs and check after it,
or you will diagnose a false failure.

**The automated guard:** `refresh-dashboards.cjs` reads the newest data week out of
each rebuilt dashboard and flags, loudly and overriding `--quiet`, any client whose
newest week is more than `STALE_DAYS` (12) old. It ignores the build timestamp by
design. Run it on a schedule; it is the only thing watching the number that
matters. The 12-day threshold is provisional and wants tuning once a healthy
account has been watched across a full week.

⚠️ **The guard reads per CLIENT, not per TAB.** On a client running more than one
report it takes the newest week across the whole client, so **one healthy tab masks
a frozen one indefinitely** — a fresh campaign-A tab keeps the client looking fine
while campaign B's tab never advances, and nothing anywhere will say so. This
silently reopens the exact failure the guard was built to catch, on the accounts
most likely to have it.

**So every newly added report must be checked by eye on the dashboard the first
time.** Read that tab's own newest week. Do not take the guard's silence as
evidence for a report it is not actually watching.

## Setup gotchas

Everything below was hit in a real setup on 28 Jul 2026 and none of it is in Google's
documentation. Read it before walking anyone through the setup.

- **The recipient must be a DIRECT user on the account.** Reaching the account
  through a manager account is not enough: Google Ads rejects the address with
  "enter a valid email address with account access". If you manage accounts through
  an MCC, check you are a listed user on each one before promising this to a client.
  **They need ADMIN access on the Google Ads account**, not merely a listed user,
  to be given **"Can edit"** on the report. Reported from practice 5 Aug 2026.
  Standard and read-only have not been tested against a lower report permission, so
  if you are setting this up for someone who is not an admin, expect to have to
  sort their access out first rather than discovering it inside the dialog.
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
- **You may not be able to change the frequency afterwards.** Observed 3 Aug 2026:
  the scheduled reports list showed the report and its Daily frequency with no edit
  control at all, no pencil and no three-dot row menu. Google's own help pages say
  the Reports page is where you "check the frequency of a report or change its
  recipients" but never give the steps, so treat the frequency you pick at creation
  as final. **Deleting and recreating is safe**: each report file carries the full
  lookback window, and the consolidation dedupes by week + competitor with the most
  recent file winning, so no history is lost. Keep the **same file name** if you do,
  or you get a second hub tab instead of a continuation.
- **Every run emails you and it cannot be turned off.** One per report per run, so
  a daily schedule across a book of accounts is a daily pile of mail. The fix is a
  mail filter, set up **before** your first report, matching on **sender AND
  subject** — the same sender also carries account security alerts and a
  sender-only rule buries them. Full detail and the exact filter: see "Set up the
  mail filter BEFORE your first report" above.
- **Untick Totals.** The summary row is no use here.
- **Set the table's date range to a PRESET before opening the dialog** — the
  scheduled report inherits whatever the table is showing, permanently, and a
  Custom range freezes it at its end date. This is the big one: see "The one
  setting that silently breaks everything" above.
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

## What to point a report at

This is your call per account, and it is the decision that most affects whether
the dashboard is worth looking at. What is fixed by the tooling:

- **One Drive folder per client.** Several reports can share it; they are grouped
  by file name into one tab each.
- **One report per view you want to track**, named after the **campaign or ad
  group**, not the client. That name becomes the hub tab and the dashboard tab.
- **Search and Shopping only.** Auction Insights does not cover Performance Max.

What is your judgement:

- **Campaign level or ad group level?** Decide on **impression volume, not
  structure**. Google suppresses rows below an unpublished reporting threshold, so
  a thin ad group returns "< 10%" against every competitor, or nothing at all, and
  you get two useless tabs instead of one usable one. As a working rule: if an ad
  group is running tens of impressions a week rather than hundreds, report at
  campaign level and split later only if the campaign comes back rich. Worked
  example, Aug 2026: one campaign's two ad groups ran ~50 and ~35 impressions a
  week against another campaign's 1,000-1,200, so the thin one was set up combined
  at campaign level (~85/wk). Whether even that clears the threshold is unknown —
  the threshold is not published and the report costs nothing to try.
- **How many reports?** Start with one, on the campaign where the competition
  actually matters commercially. Adding another later needs no rebuild of anything
  except the dashboard: the tab appears on the next Apps Script run.
- **Frequency: daily**, regardless of how often you look. The data is weekly
  either way (see below); daily just means you are never waiting most of a week
  for a first file, and the consolidation dedupes overlapping files anyway.

**The data is weekly, whatever the schedule.** The report is segmented by Week, so
a daily schedule does not give you daily numbers — it gives you a fresh file each
morning containing the same weekly history. A new week appears each Monday, and
the in-progress week is reported too, so the current week's figures should firm up
as it completes. How much reporting lag sits behind that has not been measured
across a full healthy week yet, so treat the newest week as provisional.

## How often to look at it, and how often to run it

**These are two different cadences and conflating them is how a freeze hides.**

**Run the rebuild daily. Read the dashboard weekly.**

- **Daily: `refresh-dashboards.cjs` + `auction-alerts.cjs` in your morning routine.**
  Not so you can look at it — the data barely changes day to day. The staleness
  check only runs when the script runs, so a daily run is what catches a frozen
  scheduled report inside a week instead of inside a month. Keep it silent when
  healthy; it is a tripwire, not a report.
- **Weekly: open the page.** Any day you like, but pick it deliberately rather
  than by habit. **The rule: read on the day after the first consolidation that
  includes a Monday report file.** The week closes Sunday; Monday's report file is
  the first whose range covers that complete week; your Apps Script trigger folds
  it into the hub later that morning; you read it the next day.

  For the standard setup in this skill (report ~08:00, `DAILY_HOUR: 9`) that makes
  it **Tuesday**, which is the recommendation. Work out your own if your times
  differ — if your trigger fires *before* your report lands, Monday's file is not
  in the hub until Tuesday's run, so your read day is Wednesday.

  Reading on Monday shows you a week **missing its final day**, because Monday's
  `/gm`-equivalent reads a hub last built on Sunday. Reading later in the week
  costs you nothing except freshness; there is no penalty for a Thursday read if
  that suits how you work.

**Do not try to shorten the chain by moving the Apps Script trigger earlier.** It
must fire *after* Google Ads writes the day's file, or it consolidates yesterday's.
`DAILY_HOUR: 9` against an 08:00 report is deliberate. If you want a same-day read,
re-run the two scripts by hand after the trigger has fired.

**When you read it, read the newest data week, not the build timestamp.** They are
different numbers and only one of them is evidence.

### Why not to fix the daily email with a weekly schedule

Set the mail filter up first (see "Set up the mail filter before your first
report"). If you are tempted to cut the email by moving the report to weekly
instead, **it is a trap**, for two reasons:

1. **You cannot reliably edit the frequency afterwards**, so it means deleting and
   recreating the report, which means re-proving a working pipeline.
2. **`STALE_DAYS` is tuned for a daily report and a weekly one trips it.** With a
   Monday weekly run, the newest complete week is 7 days old on the Monday and
   reaches **13 days old by the following Sunday** — over the 12-day threshold. You
   would get a "DATA HAS STOPPED MOVING" alarm every Sunday, with nothing wrong.
   Teaching yourself to ignore that alert defeats the only guard in the system.

**If you do want a weekly report**, raise `STALE_DAYS` in `refresh-dashboards.cjs`
to about 18 first, so it still catches a genuinely missed run without crying wolf
every week. Change the threshold before you change the schedule, not after.

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
  the reporting threshold. If instead **every** line stops at the same old week,
  the data has stopped moving. Rebuild first (or serve the page over http); if the
  newest week still does not advance, the scheduled report itself is frozen on a
  Custom date range — see "The one setting that silently breaks everything".
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
- **Portable client layout.** The alerts and refresh scripts scan
  `clients/<client>/auction-insights/` relative to wherever you run them
  (normally the brain root), with `--clients` to point anywhere else.
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
| `scripts/refresh-dashboards.cjs` | Canonical | Rebuilds every configured client's dashboard so the embedded data is current, and **flags any client whose newest data week has stopped advancing** (the only reliable freeze detector). Preserves each page's existing `<title>`. Always exits 0 |
| `references/report-headers.md` | Reference | Expected column names and how to add a new one |
