#!/usr/bin/env python3
"""
Create a new Asset Group (text, image and YouTube video assets) inside an
existing Performance Max campaign.

The Asset Group is always created in PAUSED status. The script runs in
dry-run mode by default: nothing is written until you pass --execute.

Usage:
    python3 create_asset_group.py --input asset_group.yaml
    python3 create_asset_group.py --input asset_group.yaml --execute
"""
import argparse
import json
import os
import sys
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

# ---------------------------------------------------------------------------
# Google Ads asset specifications
# ---------------------------------------------------------------------------

IMAGE_MIME = {
    ".jpg": "IMAGE_JPEG",
    ".jpeg": "IMAGE_JPEG",
    ".png": "IMAGE_PNG",
    ".gif": "IMAGE_GIF",
}

# Filename prefix -> AssetFieldType, used when discovering images from a folder.
IMAGE_ROLE_PREFIXES = {
    "landscape_logo_": "LANDSCAPE_LOGO",
    "logo_": "LOGO",
    "square_": "SQUARE_MARKETING_IMAGE",
    "marketing_": "MARKETING_IMAGE",
    "portrait_": "PORTRAIT_MARKETING_IMAGE",
}

# Key accepted in the input file's `images:` and `existing_assets:` maps -> AssetFieldType.
IMAGE_ROLE_KEYS = {
    "logo": "LOGO",
    "landscape_logo": "LANDSCAPE_LOGO",
    "marketing": "MARKETING_IMAGE",
    "square": "SQUARE_MARKETING_IMAGE",
    "portrait": "PORTRAIT_MARKETING_IMAGE",
}

# Roles that `existing_assets:` may reference, beyond the image roles above.
EXTRA_EXISTING_ROLE_KEYS = {
    "youtube": "YOUTUBE_VIDEO",
}

# AssetFieldType -> (required aspect ratio w/h, min width, min height)
IMAGE_SPECS = {
    "MARKETING_IMAGE": (1.91, 600, 314),
    "SQUARE_MARKETING_IMAGE": (1.0, 300, 300),
    "PORTRAIT_MARKETING_IMAGE": (0.8, 480, 600),
    "LOGO": (1.0, 128, 128),
    "LANDSCAPE_LOGO": (4.0, 512, 128),
}

# AssetFieldType -> (min count, max count)
IMAGE_COUNTS = {
    "MARKETING_IMAGE": (1, 20),
    "SQUARE_MARKETING_IMAGE": (1, 20),
    "PORTRAIT_MARKETING_IMAGE": (0, 20),
    "LOGO": (1, 5),
    "LANDSCAPE_LOGO": (0, 5),
}

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ASPECT_TOLERANCE = 0.02  # 2% relative tolerance on aspect ratio

TEXT_SPECS = {
    # field: (max chars, min count, max count)
    "headlines": (30, 3, 15),
    "long_headlines": (90, 1, 5),
    "descriptions": (90, 2, 5),
}
BUSINESS_NAME_MAX = 25
SHORT_DESCRIPTION_MAX = 60
MAX_YOUTUBE_VIDEOS = 5
PATH_MAX = 15

# Google documents 25 search themes per asset group. Warn rather than block, so a
# change on their side does not turn into a wrong local refusal.
SEARCH_THEMES_SOFT_MAX = 25


# ---------------------------------------------------------------------------
# Input loading
# ---------------------------------------------------------------------------


def load_input_file(path):
    """Load the asset group definition from a YAML or JSON file."""
    path = Path(path).expanduser()
    if not path.is_file():
        sys.exit(f"ERROR: input file not found: {path}")

    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            sys.exit(
                "ERROR: reading a YAML input file requires PyYAML.\n"
                "  Install it with: pip install pyyaml\n"
                "  Or convert your input file to JSON and pass that instead."
            )
        data = yaml.safe_load(text)
    else:
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            sys.exit(f"ERROR: invalid JSON in {path}: {exc}")

    if not isinstance(data, dict):
        sys.exit(f"ERROR: {path} must contain a mapping at the top level.")
    return data


def get_list(data, key):
    """Read a key expected to hold a list of strings."""
    value = data.get(key) or []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        sys.exit(f"ERROR: '{key}' must be a list in the input file.")
    return [str(v).strip() for v in value if str(v).strip()]


# ---------------------------------------------------------------------------
# Account resolution (accounts.json optional)
# ---------------------------------------------------------------------------


def find_accounts_json():
    """Locate an optional accounts.json, walking up from cwd then falling back to ~."""
    env_path = os.environ.get("GOOGLE_ADS_ACCOUNTS_JSON")
    if env_path:
        candidate = Path(env_path).expanduser()
        return candidate if candidate.is_file() else None

    current = Path.cwd().resolve()
    for directory in [current, *current.parents]:
        candidate = directory / ".claude" / "accounts.json"
        if candidate.is_file():
            return candidate

    fallback = Path.home() / ".claude" / "accounts.json"
    return fallback if fallback.is_file() else None


def lookup_account_alias(alias):
    """Resolve an alias via accounts.json. Returns the account dict, or exits."""
    accounts_path = find_accounts_json()
    if accounts_path is None:
        sys.exit(
            f"ERROR: input file uses account alias '{alias}' but no accounts.json was found.\n"
            "  Either provide customer_id (and login_customer_id) directly in the input file,\n"
            "  or set GOOGLE_ADS_ACCOUNTS_JSON to the path of your accounts.json."
        )

    try:
        accounts = json.loads(accounts_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"ERROR: could not read {accounts_path}: {exc}")

    if alias in accounts:
        return accounts[alias]
    for account in accounts.values():
        if alias in account.get("aliases", []):
            return account

    available = ", ".join(sorted(accounts.keys()))
    sys.exit(
        f"ERROR: account alias '{alias}' not found in {accounts_path}.\n"
        f"  Available aliases: {available}"
    )


def resolve_account(data, args):
    """Determine customer_id, login_customer_id, a display label and the yaml path."""
    customer_id = args.customer_id or data.get("customer_id")
    login_customer_id = args.login_customer_id or data.get("login_customer_id")
    label = None
    yaml_path = args.google_ads_yaml or data.get("google_ads_yaml")

    alias = args.account or data.get("account")
    if customer_id is None and alias:
        account = lookup_account_alias(alias)
        customer_id = account.get("id")
        login_customer_id = login_customer_id or account.get("login_customer_id")
        label = account.get("name", alias)
        yaml_path = yaml_path or account.get("yaml_path")

    if not customer_id:
        sys.exit(
            "ERROR: no target account. Provide one of:\n"
            "  - 'customer_id' in the input file (or --customer-id)\n"
            "  - 'account' alias in the input file, resolvable via accounts.json"
        )

    customer_id = str(customer_id).replace("-", "")
    if login_customer_id:
        login_customer_id = str(login_customer_id).replace("-", "")

    if not yaml_path:
        yaml_path = os.environ.get("GOOGLE_ADS_CONFIGURATION_FILE_PATH", "~/google-ads.yaml")

    return customer_id, login_customer_id, label or alias or customer_id, yaml_path


def build_client(yaml_path, login_customer_id, api_version):
    path = Path(yaml_path).expanduser()
    if not path.is_file():
        sys.exit(
            f"ERROR: Google Ads config file not found: {path}\n"
            "  Create it (developer token, OAuth credentials) or point to it with\n"
            "  'google_ads_yaml' in the input file, --google-ads-yaml, or\n"
            "  the GOOGLE_ADS_CONFIGURATION_FILE_PATH environment variable."
        )
    kwargs = {"version": api_version} if api_version else {}
    client = GoogleAdsClient.load_from_storage(str(path), **kwargs)
    if login_customer_id:
        client.login_customer_id = login_customer_id
    return client


# ---------------------------------------------------------------------------
# Campaign lookup
# ---------------------------------------------------------------------------


def gaql_quote(value):
    """Quote a string for safe use inside a GAQL literal."""
    escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def list_pmax_campaigns(client, customer_id):
    """Return every non-removed Performance Max campaign in the account."""
    ga_service = client.get_service("GoogleAdsService")
    query = """
        SELECT campaign.id, campaign.name, campaign.status
        FROM campaign
        WHERE campaign.advertising_channel_type = 'PERFORMANCE_MAX'
          AND campaign.status != 'REMOVED'
        ORDER BY campaign.name
    """
    return [
        {
            "id": str(row.campaign.id),
            "name": row.campaign.name,
            "status": row.campaign.status.name,
        }
        for row in ga_service.search(customer_id=customer_id, query=query)
    ]


def list_campaign_signals(client, customer_id, campaign_resource_name):
    """Report the signals the campaign's existing asset groups use.

    Returns {"audiences": [...], "search_themes": [...]}, each entry carrying how many
    asset groups use it. Only ENABLED audiences are reported: a removed one is not
    something to offer for a new asset group.
    """
    ga_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT asset_group.name,
               asset_group_signal.audience.audience,
               asset_group_signal.search_theme.text
        FROM asset_group_signal
        WHERE asset_group.campaign = '{campaign_resource_name}'
          AND asset_group.status != 'REMOVED'
    """

    audience_users, theme_users = {}, {}
    for row in ga_service.search(customer_id=customer_id, query=query):
        signal = row.asset_group_signal
        group = row.asset_group.name
        if signal.audience.audience:
            audience_users.setdefault(signal.audience.audience, set()).add(group)
        if signal.search_theme.text:
            theme_users.setdefault(signal.search_theme.text, set()).add(group)

    audiences = []
    if audience_users:
        ids = sorted({rn.rsplit("/", 1)[-1] for rn in audience_users})
        detail_query = f"""
            SELECT audience.id, audience.resource_name, audience.name, audience.status
            FROM audience
            WHERE audience.id IN ({','.join(ids)})
        """
        for row in ga_service.search(customer_id=customer_id, query=detail_query):
            audience = row.audience
            if audience.status.name != "ENABLED":
                continue
            audiences.append({
                "id": str(audience.id),
                "name": audience.name or "(unnamed)",
                "status": audience.status.name,
                "used_by": len(audience_users.get(audience.resource_name, ())),
            })

    return {
        "audiences": sorted(audiences, key=lambda a: -a["used_by"]),
        "search_themes": sorted(
            ({"text": text, "used_by": len(groups)} for text, groups in theme_users.items()),
            key=lambda t: (-t["used_by"], t["text"]),
        ),
    }


def resolve_campaign(client, customer_id, campaign_name=None, campaign_id=None):
    """Resolve a Performance Max campaign by ID or exact name.

    Returns (resource_name, name, status).
    """
    ga_service = client.get_service("GoogleAdsService")

    if campaign_id:
        if not str(campaign_id).isdigit():
            sys.exit(f"ERROR: --campaign-id must be numeric, got '{campaign_id}'")
        condition = f"campaign.id = {campaign_id}"
        label = f"ID {campaign_id}"
    else:
        condition = f"campaign.name = {gaql_quote(campaign_name)}"
        label = f"name '{campaign_name}'"

    query = f"""
        SELECT campaign.resource_name, campaign.id, campaign.name,
               campaign.status, campaign.advertising_channel_type
        FROM campaign
        WHERE {condition}
          AND campaign.status != 'REMOVED'
    """
    rows = list(ga_service.search(customer_id=customer_id, query=query))

    if not rows:
        available = list_pmax_campaigns(client, customer_id)
        message = [f"ERROR: no campaign with {label} in account {customer_id}."]
        if available:
            message.append("  Performance Max campaigns in this account:")
            message.extend(
                f"    {c['id']}  [{c['status']}]  {c['name']}" for c in available
            )
        else:
            message.append("  This account has no Performance Max campaigns.")
        sys.exit("\n".join(message))

    pmax_rows = [r for r in rows
                 if r.campaign.advertising_channel_type.name == "PERFORMANCE_MAX"]
    if not pmax_rows:
        found_type = rows[0].campaign.advertising_channel_type.name
        sys.exit(
            f"ERROR: the campaign with {label} exists but its type is {found_type}, "
            "not PERFORMANCE_MAX."
        )
    if len(pmax_rows) > 1:
        sys.exit(
            f"ERROR: {len(pmax_rows)} Performance Max campaigns share the {label}. "
            "Target it by --campaign-id instead."
        )

    campaign = pmax_rows[0].campaign
    return campaign.resource_name, campaign.name, campaign.status.name


def campaign_brand_guidelines_roles(client, customer_id, campaign_id):
    """Return which of BUSINESS_NAME/LOGO/LANDSCAPE_LOGO to skip at the asset group level
    because Brand Guidelines is enabled on the campaign.

    Campaigns can carry campaign-level BUSINESS_NAME/LOGO CampaignAsset rows for reasons
    unrelated to Brand Guidelines (leftover from campaign creation, other features), and a
    campaign group with such rows still requires each asset group to bring its own -
    omitting them there fails with "asset for a valid asset group is not enough". The only
    reliable signal is campaign.brand_guidelines_enabled itself. When it's true, business
    name and logo must live only at the campaign level (the API rejects a duplicate at the
    asset group level); landscape logo isn't mentioned by that requirement, so it is only
    skipped if it also happens to be linked at the campaign level.
    """
    ga_service = client.get_service("GoogleAdsService")
    campaign_query = f"""
        SELECT campaign.id, campaign.brand_guidelines_enabled
        FROM campaign
        WHERE campaign.id = {campaign_id}
    """
    rows = list(ga_service.search(customer_id=customer_id, query=campaign_query))
    if not rows or not rows[0].campaign.brand_guidelines_enabled:
        return set()

    skip_roles = {"BUSINESS_NAME", "LOGO"}
    asset_query = f"""
        SELECT campaign.id, campaign_asset.field_type
        FROM campaign_asset
        WHERE campaign.id = {campaign_id}
          AND campaign_asset.field_type = 'LANDSCAPE_LOGO'
          AND campaign_asset.status != 'REMOVED'
    """
    if list(ga_service.search(customer_id=customer_id, query=asset_query)):
        skip_roles.add("LANDSCAPE_LOGO")
    return skip_roles


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def load_text_spec(data):
    """Extract the text portion of the input file and validate it.

    Returns (spec, headlines, long_headlines, descriptions, errors, warnings).
    """
    spec = {
        "asset_group_name": (data.get("asset_group_name") or "").strip(),
        "final_url": (data.get("final_url") or "").strip(),
        "business_name": (data.get("business_name") or "").strip(),
        "path1": (data.get("path1") or "").strip(),
        "path2": (data.get("path2") or "").strip(),
    }
    headlines = get_list(data, "headlines")
    long_headlines = get_list(data, "long_headlines")
    descriptions = get_list(data, "descriptions")

    errors = [
        f"missing required field: {key}"
        for key in ("asset_group_name", "final_url", "business_name")
        if not spec[key]
    ]
    text_errors, warnings = validate_text(
        headlines, long_headlines, descriptions,
        spec["business_name"], spec["path1"], spec["path2"],
    )
    errors.extend(text_errors)
    return spec, headlines, long_headlines, descriptions, errors, warnings


def validate_text(headlines, long_headlines, descriptions, business_name, path1, path2):
    errors, warnings = [], []

    for key, values in (("headlines", headlines),
                        ("long_headlines", long_headlines),
                        ("descriptions", descriptions)):
        max_chars, min_count, max_count = TEXT_SPECS[key]
        if not (min_count <= len(values) <= max_count):
            errors.append(
                f"{key}: need {min_count}-{max_count} entries, found {len(values)}"
            )
        for value in values:
            if len(value) > max_chars:
                errors.append(f"{key}: too long ({len(value)}/{max_chars}): '{value}'")
        duplicates = {v for v in values if values.count(v) > 1}
        for duplicate in sorted(duplicates):
            errors.append(f"{key}: duplicate entry '{duplicate}'")

    # Absence is reported by load_text_spec's required-field check; only length here.
    if business_name and len(business_name) > BUSINESS_NAME_MAX:
        errors.append(
            f"business_name: too long ({len(business_name)}/{BUSINESS_NAME_MAX}): '{business_name}'"
        )

    if descriptions and not any(len(d) <= SHORT_DESCRIPTION_MAX for d in descriptions):
        warnings.append(
            f"no description is {SHORT_DESCRIPTION_MAX} characters or shorter; Google uses a "
            "short description in some placements, so consider adding one"
        )

    for name, value in (("path1", path1), ("path2", path2)):
        if value and len(value) > PATH_MAX:
            errors.append(f"{name}: too long ({len(value)}/{PATH_MAX}): '{value}'")
    if path2 and not path1:
        errors.append("path2 is set but path1 is empty; path1 must be filled first")

    return errors, warnings


def collect_images(data, input_dir):
    """Build {AssetFieldType: [Path]} from an explicit `images` map or an `images_dir`."""
    images_by_role, unmatched = {}, []

    def resolve(raw_path):
        candidate = Path(str(raw_path)).expanduser()
        if not candidate.is_absolute():
            candidate = (input_dir / candidate).resolve()
        return candidate

    explicit = data.get("images")
    if explicit:
        if not isinstance(explicit, dict):
            sys.exit("ERROR: 'images' must be a mapping of role -> list of file paths.")
        for key, paths in explicit.items():
            role = IMAGE_ROLE_KEYS.get(str(key).strip().lower())
            if role is None:
                sys.exit(
                    f"ERROR: unknown image role '{key}'. "
                    f"Valid roles: {', '.join(sorted(IMAGE_ROLE_KEYS))}"
                )
            if isinstance(paths, str):
                paths = [paths]
            for raw_path in paths:
                images_by_role.setdefault(role, []).append(resolve(raw_path))

    images_dir = data.get("images_dir")
    if images_dir:
        directory = resolve(images_dir)
        if not directory.is_dir():
            sys.exit(f"ERROR: images_dir is not a directory: {directory}")
        for path in sorted(directory.iterdir()):
            if path.suffix.lower() not in IMAGE_MIME:
                continue
            name = path.name.lower()
            role = next(
                (r for prefix, r in IMAGE_ROLE_PREFIXES.items() if name.startswith(prefix)),
                None,
            )
            if role is None:
                unmatched.append(path.name)
            else:
                images_by_role.setdefault(role, []).append(path)

    # No local images is legitimate when every role is filled from `existing_assets`;
    # the per-role count checks in validate_images report anything actually missing.
    return images_by_role, unmatched


def collect_existing_assets(data, customer_id):
    """Build {AssetFieldType: [resource_name]} from the `existing_assets` map."""
    raw = data.get("existing_assets")
    if not raw:
        return {}
    if not isinstance(raw, dict):
        sys.exit("ERROR: 'existing_assets' must be a mapping of role -> list of asset IDs.")

    roles = {**IMAGE_ROLE_KEYS, **EXTRA_EXISTING_ROLE_KEYS}
    by_role = {}
    for key, values in raw.items():
        role = roles.get(str(key).strip().lower())
        if role is None:
            sys.exit(
                f"ERROR: unknown existing_assets role '{key}'. "
                f"Valid roles: {', '.join(sorted(roles))}"
            )
        if isinstance(values, (str, int)):
            values = [values]
        for value in values:
            value = str(value).strip()
            if value.isdigit():
                value = f"customers/{customer_id}/assets/{value}"
            elif not value.startswith(f"customers/{customer_id}/assets/"):
                sys.exit(
                    f"ERROR: existing asset '{value}' does not belong to account {customer_id}. "
                    "Give a bare asset ID, or a full resource name for this account."
                )
            by_role.setdefault(role, []).append(value)
    return by_role


def collect_audience_signals(data, customer_id):
    """Normalise `audience_signals` into a list of audience resource names."""
    values = data.get("audience_signals") or []
    if isinstance(values, (str, int)):
        values = [values]
    if not isinstance(values, list):
        sys.exit("ERROR: 'audience_signals' must be a list of audience IDs.")

    resource_names = []
    for value in values:
        value = str(value).strip()
        if not value:
            continue
        if value.isdigit():
            value = f"customers/{customer_id}/audiences/{value}"
        elif not value.startswith(f"customers/{customer_id}/audiences/"):
            sys.exit(
                f"ERROR: audience '{value}' does not belong to account {customer_id}. "
                "Give a bare audience ID, or a full resource name for this account."
            )
        resource_names.append(value)
    return resource_names


def verify_audiences(client, customer_id, audience_resource_names):
    """Confirm every referenced audience exists, and return {resource_name: name}."""
    if not audience_resource_names:
        return {}

    ids = sorted({rn.rsplit("/", 1)[-1] for rn in audience_resource_names})
    ga_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT audience.id, audience.resource_name, audience.name, audience.status
        FROM audience
        WHERE audience.id IN ({','.join(ids)})
    """
    found = {
        row.audience.resource_name: f"{row.audience.name or '(unnamed)'} "
                                    f"[{row.audience.status.name}]"
        for row in ga_service.search(customer_id=customer_id, query=query)
    }

    missing = [rn for rn in audience_resource_names if rn not in found]
    if missing:
        sys.exit(
            f"ERROR: these audiences were not found in account {customer_id}:\n"
            + "\n".join(f"  - {rn}" for rn in missing)
        )
    return found


def verify_existing_assets(client, customer_id, existing_by_role):
    """Confirm every referenced asset exists in the account, and report what it is."""
    if not existing_by_role:
        return {}

    ids = sorted({rn.rsplit("/", 1)[-1] for rns in existing_by_role.values() for rn in rns})
    ga_service = client.get_service("GoogleAdsService")
    query = f"""
        SELECT asset.id, asset.resource_name, asset.name, asset.type,
               asset.image_asset.full_size.width_pixels,
               asset.image_asset.full_size.height_pixels
        FROM asset
        WHERE asset.id IN ({','.join(ids)})
    """
    found = {}
    for row in ga_service.search(customer_id=customer_id, query=query):
        asset = row.asset
        width = asset.image_asset.full_size.width_pixels
        height = asset.image_asset.full_size.height_pixels
        found[asset.resource_name] = {
            "name": asset.name or "(unnamed)",
            "type": asset.type_.name,
            "size": f"{width}x{height}" if width else "",
        }

    missing = [rn for rns in existing_by_role.values() for rn in rns if rn not in found]
    if missing:
        sys.exit(
            "ERROR: these existing assets were not found in account "
            f"{customer_id}:\n" + "\n".join(f"  - {rn}" for rn in missing)
        )
    return found


def validate_images(images_by_role, existing_by_role=None):
    existing_by_role = existing_by_role or {}
    errors, warnings = [], []

    try:
        from PIL import Image
    except ImportError:
        Image = None
        warnings.append(
            "Pillow is not installed, so image dimensions and aspect ratios were not "
            "checked locally. Install it with 'pip install pillow' to catch bad images "
            "before they reach the API."
        )

    for role, (min_count, max_count) in IMAGE_COUNTS.items():
        # Reused account assets count toward the same per-role limits as uploads.
        count = len(images_by_role.get(role, [])) + len(existing_by_role.get(role, []))
        if count < min_count:
            errors.append(f"{role}: need at least {min_count} image(s), found {count}")
        elif count > max_count:
            errors.append(f"{role}: at most {max_count} image(s) allowed, found {count}")

    for role, paths in images_by_role.items():
        for path in paths:
            if not path.is_file():
                errors.append(f"{role}: file not found: {path}")
                continue
            if path.suffix.lower() not in IMAGE_MIME:
                errors.append(f"{role}: unsupported file type '{path.suffix}': {path.name}")
                continue

            size = path.stat().st_size
            if size == 0:
                errors.append(f"{role}: file is empty: {path.name}")
                continue
            if size > MAX_IMAGE_BYTES:
                errors.append(
                    f"{role}: file is {size / 1024 / 1024:.1f} MB, over the 5 MB limit: {path.name}"
                )

            if Image is None or role not in IMAGE_SPECS:
                continue
            try:
                with Image.open(path) as img:
                    width, height = img.size
            except Exception as exc:  # unreadable or corrupt image
                errors.append(f"{role}: could not read image {path.name}: {exc}")
                continue

            expected_ratio, min_w, min_h = IMAGE_SPECS[role]
            if width < min_w or height < min_h:
                errors.append(
                    f"{role}: {path.name} is {width}x{height}, below the minimum {min_w}x{min_h}"
                )
            actual_ratio = width / height
            if abs(actual_ratio - expected_ratio) > expected_ratio * ASPECT_TOLERANCE:
                errors.append(
                    f"{role}: {path.name} has aspect ratio {actual_ratio:.2f}:1 "
                    f"({width}x{height}), but {expected_ratio:.2f}:1 is required"
                )

    return errors, warnings


# ---------------------------------------------------------------------------
# Mutate operation building
# ---------------------------------------------------------------------------


def build_operations(client, customer_id, campaign_resource_name, spec,
                     headlines, long_headlines, descriptions, images_by_role, youtube_ids,
                     existing_by_role=None, audience_signals=None, search_themes=None,
                     skip_brand_roles=None):
    asset_service = client.get_service("AssetService")
    field_type_enum = client.enums.AssetFieldTypeEnum
    operations = []
    next_id = [-2]  # -1 is reserved for the asset group itself

    def temp_asset_resource_name():
        resource_name = asset_service.asset_path(customer_id, next_id[0])
        next_id[0] -= 1
        return resource_name

    def add_text_asset(text, field_type):
        operation = client.get_type("MutateOperation")
        asset = operation.asset_operation.create
        asset.resource_name = temp_asset_resource_name()
        asset.text_asset.text = text
        operations.append(operation)
        return asset.resource_name, field_type

    def add_image_asset(path, field_type):
        operation = client.get_type("MutateOperation")
        asset = operation.asset_operation.create
        asset.resource_name = temp_asset_resource_name()
        asset.name = path.stem
        asset.type_ = client.enums.AssetTypeEnum.IMAGE
        asset.image_asset.data = path.read_bytes()
        asset.image_asset.mime_type = client.enums.MimeTypeEnum[IMAGE_MIME[path.suffix.lower()]]
        operations.append(operation)
        return asset.resource_name, field_type

    def add_youtube_asset(video_id, field_type):
        operation = client.get_type("MutateOperation")
        asset = operation.asset_operation.create
        asset.resource_name = temp_asset_resource_name()
        asset.name = f"YouTube video {video_id}"
        asset.youtube_video_asset.youtube_video_id = video_id
        operations.append(operation)
        return asset.resource_name, field_type

    skip_brand_roles = skip_brand_roles or set()

    asset_refs = []
    for headline in headlines:
        asset_refs.append(add_text_asset(headline, field_type_enum.HEADLINE))
    for long_headline in long_headlines:
        asset_refs.append(add_text_asset(long_headline, field_type_enum.LONG_HEADLINE))
    for description in descriptions:
        asset_refs.append(add_text_asset(description, field_type_enum.DESCRIPTION))
    if "BUSINESS_NAME" not in skip_brand_roles:
        asset_refs.append(add_text_asset(spec["business_name"], field_type_enum.BUSINESS_NAME))

    for role, paths in images_by_role.items():
        if role in skip_brand_roles:
            continue
        for path in paths:
            asset_refs.append(add_image_asset(path, field_type_enum[role]))

    for video_id in youtube_ids:
        asset_refs.append(add_youtube_asset(video_id, field_type_enum.YOUTUBE_VIDEO))

    # Assets that already live in the account are linked, not re-uploaded.
    for role, resource_names in (existing_by_role or {}).items():
        if role in skip_brand_roles:
            continue
        for resource_name in resource_names:
            asset_refs.append((resource_name, field_type_enum[role]))

    asset_group_operation = client.get_type("MutateOperation")
    asset_group = asset_group_operation.asset_group_operation.create
    asset_group.resource_name = client.get_service("AssetGroupService").asset_group_path(
        customer_id, -1
    )
    asset_group.name = spec["asset_group_name"]
    asset_group.campaign = campaign_resource_name
    asset_group.final_urls.append(spec["final_url"])
    asset_group.status = client.enums.AssetGroupStatusEnum.PAUSED
    if spec.get("path1"):
        asset_group.path1 = spec["path1"]
    if spec.get("path2"):
        asset_group.path2 = spec["path2"]
    operations.append(asset_group_operation)

    for resource_name, field_type in asset_refs:
        operation = client.get_type("MutateOperation")
        link = operation.asset_group_asset_operation.create
        link.asset_group = asset_group.resource_name
        link.asset = resource_name
        link.field_type = field_type
        operations.append(operation)

    # Signals belong to the asset group itself, so they ride in the same atomic mutate.
    for audience_resource_name in (audience_signals or []):
        operation = client.get_type("MutateOperation")
        signal = operation.asset_group_signal_operation.create
        signal.asset_group = asset_group.resource_name
        signal.audience.audience = audience_resource_name
        operations.append(operation)

    for theme in (search_themes or []):
        operation = client.get_type("MutateOperation")
        signal = operation.asset_group_signal_operation.create
        signal.asset_group = asset_group.resource_name
        signal.search_theme.text = theme
        operations.append(operation)

    # A malformed entry here is invisible until the API rejects the whole request,
    # and a dry run would still report a plausible operation count.
    wrong = [type(op).__name__ for op in operations if type(op).__name__ != "MutateOperation"]
    if wrong:
        sys.exit(
            f"INTERNAL ERROR: {len(wrong)} operation(s) are not MutateOperation: "
            f"{sorted(set(wrong))}"
        )
    return operations


# ---------------------------------------------------------------------------
# Reporting and confirmation
# ---------------------------------------------------------------------------


def print_summary(spec, account_label, customer_id, campaign_name, campaign_status,
                  headlines, long_headlines, descriptions, images_by_role, youtube_ids,
                  existing_by_role=None, existing_details=None,
                  audience_signals=None, audience_names=None, search_themes=None,
                  skip_brand_roles=None):
    skip_brand_roles = skip_brand_roles or set()
    print("=" * 70)
    print(f"Account         : {account_label} (customer ID {customer_id})")
    print(f"Campaign        : {campaign_name}  [{campaign_status}]")
    print(f"New asset group : {spec['asset_group_name']}  [status: PAUSED]")
    print(f"Final URL       : {spec['final_url']}")
    business_name_note = " (not linked here — Brand Guidelines, already at campaign level)" \
        if "BUSINESS_NAME" in skip_brand_roles else ""
    print(f"Business name   : {spec['business_name']}{business_name_note}")
    if spec.get("path1"):
        display_path = "/" + spec["path1"]
        if spec.get("path2"):
            display_path += "/" + spec["path2"]
        print(f"Display path    : {display_path}")
    print("-" * 70)
    print(f"Headlines ({len(headlines)}):")
    for headline in headlines:
        print(f"  [{len(headline):>2}/30] {headline}")
    print(f"Long headlines ({len(long_headlines)}):")
    for long_headline in long_headlines:
        print(f"  [{len(long_headline):>2}/90] {long_headline}")
    print(f"Descriptions ({len(descriptions)}):")
    for description in descriptions:
        print(f"  [{len(description):>2}/90] {description}")
    print("-" * 70)
    for role in sorted(images_by_role):
        paths = images_by_role[role]
        print(f"{role} ({len(paths)}):")
        for path in paths:
            print(f"  {path.name}")
    print(f"YouTube videos ({len(youtube_ids)}): {', '.join(youtube_ids) or 'none'}")
    if existing_by_role:
        details = existing_details or {}
        print("-" * 70)
        print("Reused from the account (linked, not re-uploaded):")
        for role in sorted(existing_by_role):
            role_note = " [not linked here — already at campaign level via Brand Guidelines]" \
                if role in skip_brand_roles else ""
            for resource_name in existing_by_role[role]:
                info = details.get(resource_name, {})
                extra = " ".join(x for x in (info.get("size", ""), info.get("name", "")) if x)
                print(f"  {role}: {resource_name.rsplit('/', 1)[-1]}  {extra}{role_note}")
    if audience_signals or search_themes:
        names = audience_names or {}
        print("-" * 70)
        print("Audience signals:")
        for resource_name in (audience_signals or []):
            label = names.get(resource_name, "")
            print(f"  audience {resource_name.rsplit('/', 1)[-1]}  {label}")
        if search_themes:
            print(f"  search themes ({len(search_themes)}): {', '.join(search_themes)}")
    else:
        print("-" * 70)
        print("Audience signals: none (the asset group will rely on the campaign's own)")
    print("=" * 70)


def confirm_execution(account_label, customer_id, campaign_name, asset_group_name):
    """Require the operator to retype the customer ID before writing."""
    print()
    print("!" * 70)
    print("  ABOUT TO WRITE TO A LIVE GOOGLE ADS ACCOUNT")
    print(f"  Account     : {account_label} (customer ID {customer_id})")
    print(f"  Campaign    : {campaign_name}")
    print(f"  Asset group : {asset_group_name} (will be created PAUSED)")
    print("!" * 70)

    if not sys.stdin.isatty():
        sys.exit(
            "ERROR: --execute needs an interactive confirmation, but stdin is not a terminal.\n"
            "  Re-run in a terminal, or pass --yes to skip the prompt if you are certain."
        )

    answer = input(f"\nType the customer ID ({customer_id}) to confirm, anything else to abort: ")
    if answer.strip().replace("-", "") != customer_id:
        sys.exit("Aborted: confirmation did not match. Nothing was written.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input",
                        help="Path to the YAML or JSON asset group definition file")
    parser.add_argument("--check-text", action="store_true",
                        help="Validate only the text fields of the input file and exit. "
                             "No account, images or API call needed")
    parser.add_argument("--list-campaigns", action="store_true",
                        help="Print this account's Performance Max campaigns as JSON and exit. "
                             "Use it to pick a target, then pass --campaign-id")
    parser.add_argument("--list-signals", action="store_true",
                        help="Print the audience signals and search themes the campaign's "
                             "existing asset groups use, as JSON, and exit. Needs --campaign-id")
    parser.add_argument("--campaign-id",
                        help="ID of the target Performance Max campaign (from --list-campaigns)")
    parser.add_argument("--campaign",
                        help="Exact name of the target campaign, as an alternative to --campaign-id")
    parser.add_argument("--account",
                        help="Account alias from accounts.json (overrides the input file)")
    parser.add_argument("--customer-id",
                        help="Target Google Ads customer ID (overrides the input file)")
    parser.add_argument("--login-customer-id",
                        help="Manager (MCC) customer ID used for authentication")
    parser.add_argument("--google-ads-yaml",
                        help="Path to google-ads.yaml (default: ~/google-ads.yaml)")
    parser.add_argument("--api-version",
                        help="Pin the Google Ads API version (default: library default)")
    parser.add_argument("--execute", action="store_true",
                        help="Actually create the asset group. Without this flag, dry-run only")
    parser.add_argument("--yes", action="store_true",
                        help="Skip the interactive confirmation prompt when using --execute")
    args = parser.parse_args()

    # --check-text needs nothing but the text fields: no account, images or API call.
    if args.check_text:
        if not args.input:
            sys.exit("ERROR: --check-text requires --input.")
        spec, headlines, long_headlines, descriptions, errors, warnings = load_text_spec(
            load_input_file(args.input)
        )
        for warning in warnings:
            print(f"WARNING: {warning}")
        if errors:
            print("TEXT VALIDATION FAILED:")
            for error in errors:
                print(f"  - {error}")
            sys.exit(1)
        print("Text assets are valid.")
        print(f"  asset group name : {spec['asset_group_name']}")
        print(f"  final URL        : {spec['final_url']}")
        print(f"  business name    : {spec['business_name']} ({len(spec['business_name'])}/25)")
        for label, values, limit in (("headline", headlines, 30),
                                     ("long headline", long_headlines, 90),
                                     ("description", descriptions, 90)):
            print(f"  {label}s ({len(values)}):")
            for value in values:
                print(f"    [{len(value):>2}/{limit}] {value}")
        return

    # --list-campaigns only needs an account, not a full asset group definition.
    if args.list_campaigns:
        data = load_input_file(args.input) if args.input else {}
        customer_id, login_customer_id, _, yaml_path = resolve_account(data, args)
        client = build_client(yaml_path, login_customer_id, args.api_version)
        print(json.dumps(list_pmax_campaigns(client, customer_id), indent=2))
        return

    # --list-signals needs an account and a campaign, not an asset group definition.
    if args.list_signals:
        if not args.campaign_id and not args.campaign:
            sys.exit("ERROR: --list-signals requires --campaign-id (or --campaign).")
        data = load_input_file(args.input) if args.input else {}
        customer_id, login_customer_id, _, yaml_path = resolve_account(data, args)
        client = build_client(yaml_path, login_customer_id, args.api_version)
        campaign_resource_name, _, _ = resolve_campaign(
            client, customer_id, campaign_name=args.campaign, campaign_id=args.campaign_id
        )
        print(json.dumps(
            list_campaign_signals(client, customer_id, campaign_resource_name), indent=2
        ))
        return

    if not args.input:
        sys.exit("ERROR: --input is required (or use --list-campaigns to browse campaigns).")
    if not args.campaign_id and not args.campaign:
        sys.exit(
            "ERROR: no target campaign. Run with --list-campaigns to see the account's\n"
            "  Performance Max campaigns, then pass --campaign-id <id>."
        )

    data = load_input_file(args.input)
    input_dir = Path(args.input).expanduser().resolve().parent

    if data.get("campaign"):
        sys.exit(
            "ERROR: 'campaign' is no longer read from the input file, so a stale value cannot\n"
            "  silently retarget the write. Remove it and pass --campaign-id instead."
        )

    spec, headlines, long_headlines, descriptions, errors, warnings = load_text_spec(data)
    youtube_ids = get_list(data, "youtube_ids")

    if len(youtube_ids) > MAX_YOUTUBE_VIDEOS:
        errors.append(
            f"youtube_ids: at most {MAX_YOUTUBE_VIDEOS} videos allowed, found {len(youtube_ids)}"
        )
    for video_id in youtube_ids:
        if "/" in video_id or "youtube" in video_id.lower():
            errors.append(
                f"youtube_ids: '{video_id}' looks like a URL. Use the 11-character video ID only "
                "(the v= part of the URL)."
            )

    customer_id, login_customer_id, account_label, yaml_path = resolve_account(data, args)
    existing_by_role = collect_existing_assets(data, customer_id)
    audience_signals = collect_audience_signals(data, customer_id)
    search_themes = get_list(data, "search_themes")

    if len(search_themes) > SEARCH_THEMES_SOFT_MAX:
        warnings.append(
            f"{len(search_themes)} search themes: Google documents a limit of "
            f"{SEARCH_THEMES_SOFT_MAX} per asset group, so the API may reject the extras"
        )
    duplicate_themes = {t for t in search_themes if search_themes.count(t) > 1}
    for theme in sorted(duplicate_themes):
        errors.append(f"search_themes: duplicate entry '{theme}'")

    images_by_role, unmatched = collect_images(data, input_dir)
    image_errors, image_warnings = validate_images(images_by_role, existing_by_role)
    errors.extend(image_errors)
    warnings.extend(image_warnings)
    if unmatched:
        warnings.append(
            f"{len(unmatched)} file(s) in images_dir were skipped because their name does not "
            f"start with a known role prefix: {', '.join(unmatched)}"
        )

    if warnings:
        print("WARNINGS:")
        for warning in warnings:
            print(f"  ! {warning}")
        print()

    if errors:
        print("VALIDATION FAILED:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)

    client = build_client(yaml_path, login_customer_id, args.api_version)
    campaign_resource_name, campaign_name, campaign_status = resolve_campaign(
        client, customer_id, campaign_name=args.campaign, campaign_id=args.campaign_id
    )
    existing_details = verify_existing_assets(client, customer_id, existing_by_role)
    audience_names = verify_audiences(client, customer_id, audience_signals)

    resolved_campaign_id = campaign_resource_name.rsplit("/", 1)[-1]
    skip_brand_roles = campaign_brand_guidelines_roles(client, customer_id, resolved_campaign_id)
    if skip_brand_roles:
        print(
            "NOTE: Brand Guidelines is enabled on this campaign — "
            f"{', '.join(sorted(skip_brand_roles))} already linked at campaign level, "
            "so this asset group will not re-link them.\n"
        )

    print_summary(spec, account_label, customer_id, campaign_name, campaign_status,
                  headlines, long_headlines, descriptions, images_by_role, youtube_ids,
                  existing_by_role, existing_details,
                  audience_signals, audience_names, search_themes,
                  skip_brand_roles)
    print(f"Campaign resource: {campaign_resource_name}")

    operations = build_operations(
        client, customer_id, campaign_resource_name, spec,
        headlines, long_headlines, descriptions, images_by_role, youtube_ids,
        existing_by_role, audience_signals, search_themes,
        skip_brand_roles,
    )
    print(f"Prepared {len(operations)} API operations.")

    if not args.execute:
        print("\nDRY RUN: nothing was written.")
        print("Review the summary above, then re-run with --execute to create the asset group.")
        return

    if not args.yes:
        confirm_execution(account_label, customer_id, campaign_name, spec["asset_group_name"])

    ga_service = client.get_service("GoogleAdsService")
    try:
        response = ga_service.mutate(customer_id=customer_id, mutate_operations=operations)
    except GoogleAdsException as exc:
        print(f"\nAPI ERROR (request ID {exc.request_id}):")
        for error in exc.failure.errors:
            location = ""
            if error.location and error.location.field_path_elements:
                location = " at " + ".".join(
                    element.field_name for element in error.location.field_path_elements
                )
            print(f"  - {error.message}{location}")
        print("\nThe request is atomic: nothing was created.")
        sys.exit(1)

    print(f"\nDONE. {len(response.mutate_operation_responses)} resources created.")
    for result in response.mutate_operation_responses:
        if result.asset_group_result.resource_name:
            print(f"Asset group: {result.asset_group_result.resource_name}")
    print("The asset group is PAUSED. Review it in the Google Ads UI before enabling it.")


if __name__ == "__main__":
    main()
