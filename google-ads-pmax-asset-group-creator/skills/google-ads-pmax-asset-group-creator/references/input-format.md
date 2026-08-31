# Input file reference

The script reads one YAML or JSON file describing the asset group. YAML needs PyYAML
installed; JSON always works. All relative paths inside the file resolve against the
file's own directory.

## Contents

- [Field reference](#field-reference)
- [Declaring images](#declaring-images)
- [Image requirements](#image-requirements)
- [Text limits](#text-limits)
- [Command line overrides](#command-line-overrides)
- [Common errors](#common-errors)

## Field reference

| Field | Required | Notes |
|---|---|---|
| `customer_id` | one of these | Target account, digits only (dashes are stripped) |
| `account` | one of these | Alias resolved via `accounts.json` |
| `login_customer_id` | no | Manager (MCC) account used for authentication |
| `google_ads_yaml` | no | Path to `google-ads.yaml`; defaults to `~/google-ads.yaml` |
| `asset_group_name` | yes | Name of the new asset group |
| `final_url` | yes | Landing page |
| `business_name` | yes | Max 25 characters |
| `path1`, `path2` | no | Display URL paths after the domain, max 15 characters each; `path2` needs `path1` |
| `headlines` | yes | 3-15 entries |
| `long_headlines` | yes | 1-5 entries |
| `descriptions` | yes | 2-5 entries |
| `images` | one of these | Map of role to file paths |
| `images_dir` | one of these | Folder scanned using filename prefixes |
| `existing_assets` | no | Map of role to IDs of assets already in the account |
| `youtube_ids` | no | Up to 5 video IDs, 11 characters each, not URLs |
| `audience_signals` | no | Audience IDs to attach as signals |
| `search_themes` | no | Search theme phrases to attach as signals |

`images`, `images_dir` and `existing_assets` can be combined; the results are merged, and
per-role limits count uploads and reused assets together.

The target campaign is deliberately absent from this table. It is chosen at run time with
`--campaign-id`, so an old input file cannot silently point a write at the wrong campaign.
A `campaign` key left in the file is rejected with an error rather than ignored.

## Choosing the campaign

```bash
python3 create_asset_group.py --list-campaigns --customer-id 1234567890
```

Prints every non-removed Performance Max campaign as JSON:

```json
[
  { "id": "17333656448", "name": "Brand | PMAX", "status": "ENABLED" },
  { "id": "20569481502", "name": "Shopping | PMAX", "status": "PAUSED" }
]
```

Pass the chosen `id` to the real run with `--campaign-id`. `--campaign "<exact name>"` also
works, but IDs avoid quoting trouble with names containing pipes or apostrophes.

`--list-campaigns` accepts `--customer-id` or `--account` on its own; it does not need
`--input`.

## Declaring images

**Explicit mapping** — clearest, and it does not care how files are named:

```yaml
images:
  logo:
    - brand/logo-square.png
  marketing:
    - shots/hero-wide.jpg
  square:
    - shots/hero-square.jpg
  portrait:
    - shots/hero-portrait.jpg
  landscape_logo:
    - brand/logo-wide.png
```

**Folder scan** — convenient when files are already named by role. Each filename must start
with one of these prefixes, and anything else in the folder is skipped with a warning:

```yaml
images_dir: ./images
```

| Prefix | Role |
|---|---|
| `logo_` | LOGO |
| `landscape_logo_` | LANDSCAPE_LOGO |
| `marketing_` | MARKETING_IMAGE |
| `square_` | SQUARE_MARKETING_IMAGE |
| `portrait_` | PORTRAIT_MARKETING_IMAGE |

## Reusing assets already in the account

Brand assets such as logos usually exist in the account already. Link them instead of
uploading a duplicate:

```yaml
existing_assets:
  logo:
    - "6709283074"
    - "39956917292"
  landscape_logo:
    - "6709283071"
```

Values are bare asset IDs, or full `customers/<cid>/assets/<id>` resource names for the same
account. Accepted roles are the five image roles plus `youtube`. Every ID is verified against
the account before anything is written, and the dry-run summary prints each one's size and
name so a wrong ID is visible rather than silently linked.

To find the assets an existing asset group uses:

```sql
SELECT asset_group.name, asset_group_asset.field_type, asset.id, asset.name
FROM asset_group_asset
WHERE asset_group.name = 'Some Asset Group'
```

Reused assets satisfy the per-role minimums, so an asset group whose logo comes from the
account needs no local logo file.

## Audience signals

Signals are optional. Without them the asset group relies on the campaign's own signals.

```yaml
audience_signals:
  - "11185684"          # audience ID, or a full customers/<cid>/audiences/<id> name
search_themes:
  - "brand name"
  - "competitor name"
```

An audience is a shared account resource, so listing its ID links the existing audience
rather than copying it; every ID is verified against the account before anything is written,
and the dry-run summary prints the audience's name and status. Search themes are plain text
and belong to the asset group itself.

Signals are created in the same atomic mutate as the asset group, so a rejected signal means
nothing at all is created.

To see what a campaign's other asset groups already use:

```bash
python3 create_asset_group.py --list-signals --customer-id <id> --campaign-id <id>
```

```json
{
  "audiences": [
    { "id": "11185684", "name": "p-max", "status": "ENABLED", "used_by": 17 }
  ],
  "search_themes": [
    { "text": "max mara", "used_by": 13 }
  ]
}
```

`used_by` counts the campaign's asset groups using that signal, which is what makes one
audience recognisable as the account's convention. Only ENABLED audiences are listed. Empty
lists mean the campaign has no signals to copy.

Duplicate search themes are rejected. Google documents a limit of 25 per asset group; going
over produces a warning rather than a refusal, so the script does not block on a limit that
may change.

## Image requirements

Checked locally when Pillow is installed. Aspect ratio is enforced within a 2% tolerance,
because the API rejects anything outside it.

| Role | Key | Ratio | Minimum size | Count |
|---|---|---|---|---|
| Marketing image | `marketing` | 1.91:1 | 600x314 | 1-20, required |
| Square marketing image | `square` | 1:1 | 300x300 | 1-20, required |
| Logo | `logo` | 1:1 | 128x128 | 1-5, required |
| Portrait marketing image | `portrait` | 4:5 | 480x600 | 0-20, optional |
| Landscape logo | `landscape_logo` | 4:1 | 512x128 | 0-5, optional |

Accepted formats are JPG, PNG and GIF, each at most 5 MB.

Google recommends larger than the minimum: 1200x628 for marketing, 1200x1200 for square and
logo, 960x1200 for portrait, 1200x300 for landscape logo.

## Text limits

| Field | Max characters | Count |
|---|---|---|
| Headline | 30 | 3-15 |
| Long headline | 90 | 1-5 |
| Description | 90 | 2-5 |
| Business name | 25 | 1 |
| Display path | 15 | 0-2 |

Duplicate entries within a field are rejected — Google treats them as one asset anyway.

The script warns when no description is 60 characters or shorter. Some placements use a short
description, so including one is worthwhile even though the API does not require it.

## Command line overrides

| Flag | Effect |
|---|---|
| `--check-text` | Validate only the text fields and exit; no account, images or API call |
| `--list-campaigns` | Print the account's Performance Max campaigns as JSON and exit |
| `--list-signals` | Print the campaign's existing audience signals and search themes as JSON |
| `--campaign-id` | ID of the target campaign, from `--list-campaigns` |
| `--campaign` | Exact campaign name, as an alternative to `--campaign-id` |
| `--account`, `--customer-id`, `--login-customer-id` | Override the account in the input file |
| `--google-ads-yaml` | Override the credentials file path |
| `--api-version` | Pin a Google Ads API version instead of the library default |
| `--execute` | Perform the write; without it the run is a dry run |
| `--yes` | Skip the interactive confirmation prompt |

Overriding the account is useful for pushing the same asset group definition into several
accounts without editing the file.

## Common errors

**`no campaign with ID X`** — the campaign was not found, or it was removed. The script
prints every Performance Max campaign in the account; take an ID from that list.

**`no target campaign`** — neither `--campaign-id` nor `--campaign` was passed. Run
`--list-campaigns` first.

**`'campaign' is no longer read from the input file`** — remove that key and pass
`--campaign-id` instead.

**`N Performance Max campaigns share the name X`** — the name is ambiguous. Target the
campaign by `--campaign-id`.

**`aspect ratio 2.00:1 but 4.00:1 is required`** — crop or re-export the image. Padding it
to the right ratio also works.

**`--execute needs an interactive confirmation`** — the confirmation prompt needs a terminal.
Run it in one, or pass `--yes` for an unattended run.

**`looks like a URL`** — pass only the ID from `youtube.com/watch?v=<ID>`, not the whole URL.
