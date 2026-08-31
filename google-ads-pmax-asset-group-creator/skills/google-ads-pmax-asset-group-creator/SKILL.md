---
name: google-ads-pmax-asset-group-creator
description: "Create a new asset group (headlines, descriptions, images, YouTube videos) inside an existing Performance Max campaign through the Google Ads API. The asset group is always created paused, and the script is dry-run by default. Use when someone supplies asset group copy, an images folder, a landing page URL and a target PMax campaign and wants it pushed into the account. Triggers: create asset group, new pmax asset group, add asset group, upload asset group to performance max."
---

# Performance Max Asset Group Creator

Builds a new asset group in an existing Performance Max campaign with one atomic
`GoogleAdsService.Mutate` call. The asset group is always created **paused**, so nothing
starts serving until a human reviews it in the UI.

## When to use

Trigger this skill when someone says any of: "create an asset group", "new PMax asset
group", "add an asset group", "upload an asset group to Performance Max", or supplies asset
group copy plus an images folder and wants it pushed into a PMax campaign. It builds new
asset groups only; it does not edit existing ones.

## Requirements

**This is a Python skill.** It needs Python 3 and the Google Ads client library, not just
Claude Code:

```bash
pip install google-ads      # required
pip install pyyaml          # required only for YAML input files (JSON works without it)
pip install pillow          # optional but recommended: validates image size and ratio locally
```

A `google-ads.yaml` with a developer token and OAuth credentials is required. The script
looks for it at `~/google-ads.yaml`, or wherever `google_ads_yaml` /
`--google-ads-yaml` / `GOOGLE_ADS_CONFIGURATION_FILE_PATH` points.

## Bundled files

| File | What it is |
|---|---|
| `scripts/create_asset_group.py` | The whole tool: validation, campaign and signal lookups, dry run and the atomic mutate |
| `references/input-format.md` | Full field reference for the input file, image specs and text limits |
| `assets/example-input.yaml` | A worked example input file to copy from |

## Workflow

Work through the stages below in order, **one per turn**. Never ask for everything in a
single message: each stage is validated before the next begins, so a mistake surfaces while
the user still has that part in mind.

The order follows the decisions themselves — first where the asset group goes, then what it
is called, then what goes in it. Build the input file incrementally, rewriting it at the end
of each stage. Read [references/input-format.md](references/input-format.md) for the full
field reference.

### 1. Account and campaign

Determine the target account: a customer ID, or an alias if the user keeps an
`accounts.json`. Then list the account's campaigns:

```bash
python3 scripts/create_asset_group.py --list-campaigns --customer-id <id>
```

This prints every non-removed Performance Max campaign as JSON, each with `id`, `name` and
`status`. Never pick one on the user's behalf — always present the choice:

1. **Show the enabled campaigns.** With **3 or fewer**, offer them as options via
   AskUserQuestion, adding a final option worded like *"the campaign I need isn't
   here — show me the paused ones"*. With **more than 3**, print a numbered list instead
   (AskUserQuestion allows at most 4 options) and end it with that same escape line, asking
   the user to reply with a number.
2. **If the user asks for the paused ones**, present them the same way: buttons when there
   are 3 or fewer, otherwise a numbered list.
3. If the account has no enabled Performance Max campaigns, go straight to the paused ones
   and say why.

Keep the campaign ID for the dry run. Show names to the user, never raw IDs.

### 2. Asset group name

Ask one question and nothing else: what should the new asset group be called? Do not fold
this into the copy request, and do not name it yourself — it is the user's label for the
thing they are about to create inside the campaign they just picked.

### 3. Text assets

Ask the user to paste the copy into the chat. Ask for nothing else — no images, no videos.
Request this shape, and state the character limits:

```
Final URL:
Business name:            (max 25 characters)
Headlines:                (3-15, max 30 characters each)
Long headlines:           (1-5, max 90 characters each)
Descriptions:             (2-5, max 90 characters each)
```

Write what they paste into the input file, alongside the name from stage 2, then check it:

```bash
python3 scripts/create_asset_group.py --check-text --input asset_group.yaml
```

This needs no account, images or API call. It reports every problem at once with exact
character counts. If anything fails, show the user which entries are over and by how much,
and offer a shorter rewrite for each — do not silently truncate or invent replacement copy.
Repeat until it passes.

### 4. Audience signals

As soon as the final URL and business name are in, check whether the campaign's existing
asset groups already carry signals:

```bash
python3 scripts/create_asset_group.py --list-signals --customer-id <id> --campaign-id <id>
```

This returns the ENABLED audiences and the search themes in use, each with `used_by`: how
many asset groups in the campaign use it. Removed audiences are filtered out, since they are
not worth offering.

**If both lists come back empty, say nothing and move on to images.** There is nothing to
propose, and inventing an audience is not this skill's job.

**If an audience comes back**, offer it. Show its name and how widely it is used — "p-max,
used by 17 of the campaign's asset groups" tells the user far more than an ID does. Include
the search themes in the same offer when the campaign has them; they travel together. Always
give the user two ways out:

- **Use the existing audience** — write it into the input file
- **Skip for now** — create the signal themselves later, in the UI

Skipping is a legitimate choice, not a fallback: word it as such, and do not re-ask later.
When the user accepts, write the choice into the input file:

```yaml
audience_signals:
  - "11185684"
search_themes:
  - "brand name"
```

An audience is a shared account resource, so referencing its ID links the existing one rather
than copying it. Search themes are plain text and belong to the new asset group.

### 5. Images

Ask whether the user has a local folder with the images. This is a yes/no fork, so use
AskUserQuestion.

If yes, list the folder and map each file to a role. When filenames already follow the
`logo_` / `marketing_` / `square_` / `portrait_` / `landscape_logo_` convention, the script
maps them itself via `images_dir`. **When they do not, show the user the filenames and ask
which role each one fills — never guess from the file name.** Write the confirmed mapping
into the input file as an explicit `images:` block.

Three roles are mandatory: **logo** (1:1), **marketing** (1.91:1) and **square** (1:1).

When a mandatory role has no file — a missing logo is the usual case, since brand assets
live in the account rather than in a campaign folder — look for it in the account before
asking the user to supply one:

```sql
SELECT asset_group.name, asset_group_asset.field_type, asset.id, asset.name
FROM asset_group_asset
WHERE asset_group.campaign = 'customers/<cid>/campaigns/<campaign-id>'
  AND asset_group_asset.field_type IN ('LOGO', 'LANDSCAPE_LOGO')
```

Offer the user the assets the campaign's other asset groups already use, listing them by
size and name, and write the chosen IDs under `existing_assets` in the input file. Linking
the existing brand logo beats uploading a duplicate. If nothing suitable exists, ask for a
file. If the user has no images at all, stop and explain that Google will not accept an
asset group without them.

### 6. YouTube videos

Ask whether the user has videos to include, up to 5. Also a yes/no fork.

Accept whatever they paste — full URLs are fine. Extract the 11-character ID from each link
and write the IDs into the input file; the script rejects full URLs on purpose. All these
forms appear in practice:

| Link | ID |
|---|---|
| `youtube.com/watch?v=c9qGlDE0te4` | `c9qGlDE0te4` |
| `youtube.com/shorts/BA0qUZIdooc` | `BA0qUZIdooc` |
| `youtu.be/BA0qUZIdooc` | `BA0qUZIdooc` |

If they say no, skip the field entirely: videos are optional. Note that the videos must be
public or unlisted — the API rejects private ones at execute time.

### 7. Dry run

```bash
python3 scripts/create_asset_group.py --input asset_group.yaml --campaign-id <id>
```

This re-validates the text, checks image dimensions and aspect ratios, resolves the
campaign, and builds the API operations — writing nothing. Show the user the printed
summary before going further.

### 8. Execute

Only after the user confirms the dry-run output:

```bash
python3 scripts/create_asset_group.py --input asset_group.yaml --campaign-id <id> --execute
```

The script prints the target account and asks the operator to retype the customer ID
before writing. **Let the user answer that prompt themselves** — it is the last guard
against writing to the wrong account. Pass `--yes` to skip it only when the user has
explicitly asked for an unattended run.

The mutate is atomic: if anything is rejected, nothing is created.

## Account configuration

Two ways to target an account, checked in this order:

1. **Explicit** — `customer_id` (and `login_customer_id` for manager accounts) in the input file
2. **Alias** — `account: my-client` resolved against an `accounts.json` mapping aliases to
   `{id, name, login_customer_id, yaml_path}`, searched upward from the working directory,
   then at `~/.claude/accounts.json`, or wherever `GOOGLE_ADS_ACCOUNTS_JSON` points

Explicit IDs always work with no config file. The alias path is a convenience for people who
already keep an account registry.

## Known limitations

- **No listing groups.** For retail campaigns the asset group inherits the default "all
  products" listing group. Refine it in the UI if the user needs a product subset.
- **Creation only.** The script builds a new asset group; it cannot add assets or signals to
  one that already exists.
- **Text assets are not deduplicated against the account.** Identical text already present
  elsewhere is uploaded again as a new asset.
- **Google may still reject assets** for policy or trademark reasons after creation. Check
  the asset group's status in the UI before enabling it.
