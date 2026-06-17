# Meta Ads CLI — Setup Guide

A walkthrough for installing Meta's official `meta` command-line tool and connecting it to Claude Code (or any AI agent that runs shell commands). Once it's set up, you can ask Claude things like "pull last 7 days of spend across all campaigns" and it will run the right commands and give you the answer.

This guide assumes you're on macOS. Windows and Linux work too, with minor command tweaks.

**Time required:** ~20 minutes the first time, mostly waiting for Meta UI clicks. The actual installation is fast.

---

## What you'll end up with

- The `meta` CLI installed globally on your machine
- A Meta Developer App and a non-expiring System User Access Token tied to your ad account
- A `.env` file in a project folder so the CLI knows which token + account to use
- (Optional) A Claude Code skill so AI agents know how to use the CLI

---

## Prerequisites

You need:

- A Mac with Terminal access. Search "Terminal" in Spotlight if you've never used it.
- Admin access to a Meta Business Portfolio that owns the ad account(s) you want to manage.
- 20 minutes.

You do **not** need to know Python, OAuth, or how the Marketing API works. Just be willing to copy-paste commands.

---

## Step 1 — Install Python 3.12 and uv

The CLI is a Python package and requires Python 3.12 or higher. `uv` is a fast Python package manager from Astral that handles installation cleanly without polluting your system Python.

Open Terminal and check what you have:

```bash
python3 --version
```

If it says 3.12 or higher, you're fine. If it's older or `python3` isn't found, install via [python.org](https://www.python.org/downloads/) or with Homebrew (`brew install python@3.12`).

Then install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verify:

```bash
which uv
```

You should see a path like `/opt/homebrew/bin/uv` or `~/.cargo/bin/uv`. If you get nothing, restart Terminal and try again.

---

## Step 2 — Install the Meta CLI

One command:

```bash
uv tool install meta-ads --python 3.12
```

`uv tool install` puts the CLI in its own isolated environment and exposes the `meta` command on your `$PATH`, so you can run it from anywhere without activating a virtualenv.

Verify:

```bash
meta --version
```

Expected: `meta, version 1.0.1` (or newer).

**If it says `command not found`,** your shell doesn't know where uv installed the binary. Fix:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
meta --version
```

Now check the help to confirm the install:

```bash
meta ads --help
```

You should see a list of command groups: `ad`, `adaccount`, `adset`, `campaign`, `catalog`, `creative`, `dataset`, `insights`, `page`, `product-feed`, `product-item`, `product-set`.

---

## Step 3 — Create a Meta Developer App

The CLI authenticates via a System User Access Token, and that token has to be issued on behalf of a Meta Developer App. So you need to create one before you can generate the token.

Open [developers.facebook.com/apps](https://developers.facebook.com/apps) in your browser and log in with the Facebook account that has admin rights on your Business Portfolio.

1. Click **Create App** (top-right).
2. **App details** step — give it a display name like `Ads CLI` and your contact email. Click **Next**.
3. **Use cases** step — tick **Create & manage ads with Marketing API** (top of the list). Don't tick the others — they require separate review processes you don't need. Click **Next**.
4. **Business** step — pick your Business Portfolio from the dropdown. This links the app to the business that owns your ad account. Click **Next**.
5. **Requirements** step — Meta may show a few items here (verify your business, accept terms, etc.). Tick through whatever's listed.
6. **Overview** step — review and click **Create app**.

Once created, you'll land on the app dashboard. Make a note of the app — you'll select it when generating the token.

---

## Step 4 — Create a System User in Business Suite

A System User is a non-human identity that owns the access token. Unlike personal user tokens (which expire every 60 days), system user tokens don't expire.

Open [business.facebook.com](https://business.facebook.com/) in another tab.

1. Click **Settings** (gear icon, bottom-left of the sidebar).
2. Make sure the right Business Portfolio is selected at the top — if you have multiple, the dropdown next to "Settings" lets you switch.
3. Go to **Users → System Users** in the left sidebar.
4. Click **Add**.
5. Name it `Ads CLI`. Role: **Admin**. Click **Create**.

---

## Step 5 — Assign assets to the System User

The system user needs explicit permission on every asset (ad account, page, pixel, catalog) it wants to interact with.

Still in Business Suite → Settings → Users → System Users:

1. Click into the `Ads CLI` system user you just created.
2. Click **Assign Assets**.
3. Add:
   - **Ad accounts** — select the ad account(s) you want the CLI to manage. Grant **Full Control**.
   - **Pages** — the Facebook Page(s) you'll run ad creative from. Grant **Full Control**.
   - **Pixels / Datasets** — only if you want the CLI to manage conversion tracking. Grant **Full Control**.
   - **Catalogs** — only if you'll run catalog/dynamic ads. Grant **Full Control**.
4. Click **Save Changes**.

Skip any assets the CLI won't need — it's better to grant the minimum required.

---

## Step 6 — Add the System User as App Admin

The system user has to be linked to the developer app you created in step 3.

Go back to [developers.facebook.com/apps](https://developers.facebook.com/apps) and click into your `Ads CLI` app.

1. In the left sidebar, find **App Roles** → **Roles** (the exact menu name varies — look for a "Roles" link).
2. Scroll to the **System Users** section.
3. Click **Add System Users**.
4. Pick the `Ads CLI` system user. Role: **Admin**.
5. Save.

---

## Step 7 — Generate the access token

Back in [Business Suite](https://business.facebook.com/) → Settings → Users → System Users → click your `Ads CLI` system user.

1. Click **Generate New Token**.
2. **Select your app** — pick the `Ads CLI` app you just created. (If it's not in the list, step 6 didn't save — go back and check.)
3. **Token expiration** — leave on the default (no expiry).
4. **Permissions / scopes** — tick all of these:
   - `business_management`
   - `ads_management`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_ads`
   - `catalog_management`
   - `read_insights`
5. Click **Generate Token**.
6. **Copy the token immediately** — Meta only shows it once. If you lose it, you have to generate a new one.

The token will look like a long string starting with `EAA...`.

---

## Step 8 — Set up the project folder and `.env`

Back in Terminal, create a folder for the CLI to work in. The `.env` file lives in this folder, and the CLI auto-loads it when you `cd` in.

```bash
mkdir -p ~/dev/meta-ads-work
cd ~/dev/meta-ads-work
```

Create the `.env` file:

```bash
cat > .env <<'EOF'
ACCESS_TOKEN=
AD_ACCOUNT_ID=
EOF

chmod 600 .env
echo ".env" > .gitignore
```

`chmod 600` makes the file readable only by you. The `.gitignore` line stops the file ever being committed if you put this folder under version control.

Now open the `.env` in a text editor and paste the token in:

```bash
open -e .env
```

(Or use VS Code: `code .env`. Or nano: `nano .env`.)

It should look like this when filled in (don't use quotes, don't add spaces):

```
ACCESS_TOKEN=EAA...your_long_token_here...
AD_ACCOUNT_ID=
```

Save and close. Leave `AD_ACCOUNT_ID` blank for now — we'll find it next.

---

## Step 9 — Find your ad account ID

Run:

```bash
meta auth status
```

Should respond `Authenticated (token: EAA...XYZ)`. If it says authentication failed, the token didn't paste correctly. Re-open `.env` and check there are no stray quotes, spaces, or newlines.

Then:

```bash
meta ads adaccount list
```

This prints every ad account the system user can see, with columns for `ID`, `NAME`, `ACCOUNT_STATUS`, `CURRENCY`, and `TIMEZONE_NAME`. Copy the `ID` of the account you want to manage (it'll start with `act_`).

Open `.env` again and fill in `AD_ACCOUNT_ID`:

```
ACCESS_TOKEN=EAA...your_token...
AD_ACCOUNT_ID=act_1234567890
```

Save and close.

---

## Step 10 — Smoke test

Run a real query to confirm everything is wired up:

```bash
meta ads campaign list
```

You should see a table of all campaigns on the account (or an empty result if there are none). If you get an error, check the troubleshooting section below.

You're done with the CLI setup.

---

## Step 11 (Optional) — Wire it into Claude Code

If you want Claude Code or another AI agent to use the CLI, drop a skill file into your Claude config so the agent knows when and how to invoke it.

```bash
mkdir -p ~/.claude/skills/meta-ads
```

You don't have to write the skill file by hand. Open Claude Code in your `meta-ads-work` folder and ask it to create one, for example:

> Create a SKILL.md at ~/.claude/skills/meta-ads/SKILL.md that tells you to use the `meta ads` CLI for any Meta or Facebook ads request. Include the common commands (`meta ads insights get`, `meta ads campaign list`, `meta ads adset list`), the `--format json` flag for parsing, and the rule that everything is created paused.

Restart Claude Code, `cd` into your `meta-ads-work` folder so the `.env` is auto-loaded, and try a prompt like:

> Pull the last 7 days of spend, impressions, CTR, and conversions for all active campaigns. Format as a markdown table sorted by spend descending.

Claude should run `meta ads insights get ...`, parse the JSON output, and render the table.

---

## Troubleshooting

**`meta: command not found` after install.** Your `$PATH` doesn't include `~/.local/bin`. Fix: `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc`.

**`meta auth status` says authentication failed.** Re-open `.env` and check for stray quotes (`ACCESS_TOKEN="EAA..."` is wrong — should be `ACCESS_TOKEN=EAA...` with no quotes), trailing whitespace, or accidental line breaks in the middle of the token. If everything looks clean, the token may have been revoked or generated with insufficient scopes — go back to step 7 and generate a fresh one with all seven permissions ticked.

**`meta ads campaign list` says exit code 3.** Auth error. Either the token is missing a scope, or the system user doesn't have access to the ad account. Go to Business Suite → Settings → Users → System Users → click your system user → check Assign Assets includes the ad account, with Full Control.

**`meta ads campaign list` says exit code 4.** Generic API error. Re-run with `--format json` to see the full error body: `meta ads campaign list --format json`. Common causes are rate limits, the ad account being in a restricted state, or invalid query parameters.

**App not appearing in "Select your app" dropdown when generating the token.** Step 6 didn't save. Go back to developers.facebook.com → your app → App Roles → Roles → System Users, and confirm the system user is listed there as Admin.

**Can't find App Roles or Roles in the dev app sidebar.** Meta moves this menu around occasionally. Try "App Settings → Advanced" or use the search at the top of the dev console — search for "Roles" within your app.

---

## Multi-client setup (agencies)

The `.env` file is loaded from the current working directory. So you can have separate folders per client, each with its own token and ad account ID:

```
~/dev/
├── client-a/
│   └── .env  (ACCESS_TOKEN for Client A's system user, AD_ACCOUNT_ID for their account)
├── client-b/
│   └── .env  (Client B's token + account)
└── meta-ads-work/
    └── .env  (Your own token + account)
```

`cd` into the right folder before running the CLI, and you'll be operating on that client's account. No cross-contamination, no risk of running a command against the wrong account.

If a client lives under their own Business Portfolio (rather than yours), they'll need to invite your system user to that portfolio first, or you'll need to create a new system user inside their portfolio with its own token.

---

## What the CLI can do

A non-exhaustive list — run `meta ads <command> --help` for full flag details:

- **Campaigns** — list, create, update, delete. Always created PAUSED.
- **Ad sets** — same. Targeting, budgets, optimisation goals.
- **Ads** — same. Links creative to ad set.
- **Creatives** — create with image/video, body text, headline, link, CTA.
- **Insights** — query spend, impressions, CTR, conversions, ROAS by campaign / ad set / ad / age / gender / country / placement, with date presets or custom ranges.
- **Pages** — list FB Pages assigned to your system user.
- **Catalogs / products / product feeds / product sets** — for catalog ads and dynamic creative.
- **Datasets** — create and manage conversion pixels.

Output formats: `--format table` (default, human-readable), `--format json` (for piping to `jq` or AI agents), `--format plain` (tab-separated for shell pipelines).

---

## Safety guidelines

- **The CLI defaults to PAUSED.** Every `create` command produces paused resources. Nothing goes live until you explicitly run `meta ads campaign update CAMPAIGN_ID --status ACTIVE`. This is a feature — review everything in Ads Manager before activating spend.
- **Always preview creative in Ads Manager before activating.** The CLI doesn't render creative, it just submits the spec.
- **Daily budgets are in cents** (or whatever the minor unit is for your currency). $50 = `5000`. NZ$1,000 = `100000`. Double-check before running.
- **Don't put the access token in chat with an AI agent.** Tokens belong in `.env` (which the agent reads via the CLI, not directly). If you accidentally paste a token in chat, revoke it in Business Suite and generate a new one.
- **Don't commit `.env` to git.** The `.gitignore` line in step 8 handles this — don't remove it.

---

## Resources

- Meta's official Ads CLI documentation: [developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-cli](https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-cli/ads-cli-overview)
- Meta Marketing API reference: [developers.facebook.com/docs/marketing-apis](https://developers.facebook.com/docs/marketing-apis)
- `uv` documentation: [docs.astral.sh/uv](https://docs.astral.sh/uv/)

---

*Last updated: May 2026. The CLI was released by Meta on April 29, 2026. Commands and flags may change as Meta updates the tool — when in doubt, run `meta ads <command> --help` to see the current syntax.*
