#!/usr/bin/env python3
"""
List bucket list items with dates in the past that need updating.

Used by monthly validation to identify items needing date research.

Usage:
    python list-past.py
    python list-past.py --create-inbox-note
"""

import argparse
from datetime import datetime
from pathlib import Path
import sys

# Paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
BUCKET_LIST_DIR = REPO_ROOT / "research" / "bucket-list"
INBOX_DIR = REPO_ROOT / "!inbox"

# Import from list-upcoming
sys.path.insert(0, str(SCRIPT_DIR))
from list_upcoming import get_all_items, parse_date


def find_past_items() -> list:
    """Find items with dates in the past."""
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    items = get_all_items()

    past_items = []
    for item in items:
        if item["next_date"] and item["next_date"] < today:
            days_past = (today - item["next_date"]).days
            item["days_past"] = days_past
            past_items.append(item)

    # Sort by most overdue first
    past_items.sort(key=lambda x: x["days_past"], reverse=True)
    return past_items


def format_past_item(item: dict) -> str:
    """Format a past item for display."""
    date_str = item["next_date"].strftime("%Y-%m-%d")
    return f"- **{item['name']}** - {date_str} ({item['days_past']} days ago) [{item['type']}]"


def create_inbox_note(past_items: list) -> Path:
    """Create an inbox note for items needing updates."""
    today = datetime.now().strftime("%Y%m%d")
    INBOX_DIR.mkdir(parents=True, exist_ok=True)

    note_path = INBOX_DIR / f"{today}-bucket-list-validation.md"

    content = f"""# Bucket List Date Validation - {datetime.now().strftime('%Y-%m-%d')}

## Items Needing Date Updates

"""

    if past_items:
        for item in past_items:
            date_str = item["next_date"].strftime("%Y-%m-%d")
            content += f"""### {item['name']}
- **Last known date:** {date_str} ({item['days_past']} days past)
- **Type:** {item['type']}
- **File:** {item['file_path'].relative_to(REPO_ROOT)}
- **Action:** Research new dates

"""
    else:
        content += "All items have current dates!\n"

    content += """## Suggested Actions

1. Research new dates for each item above
2. Update the "Next Known Date" field in each file
3. Update the "Last Validated" timestamp

Run `python .claude/skills/bucket-list/scripts/enrich-item.py <slug> --refresh` to auto-research.
"""

    note_path.write_text(content, encoding="utf-8")
    return note_path


def main():
    parser = argparse.ArgumentParser(description="List bucket list items with past dates")
    parser.add_argument("--create-inbox-note", action="store_true", help="Create inbox note for items needing updates")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    past_items = find_past_items()

    if args.create_inbox_note:
        note_path = create_inbox_note(past_items)
        print(f"Created inbox note: {note_path.relative_to(REPO_ROOT)}")
        return

    if args.json:
        import json
        output = []
        for item in past_items:
            output.append({
                "name": item["name"],
                "slug": item["slug"],
                "type": item["type"],
                "last_date": item["next_date"].isoformat(),
                "days_past": item["days_past"],
                "file": str(item["file_path"].relative_to(REPO_ROOT))
            })
        print(json.dumps(output, indent=2))
        return

    print("## Bucket List Items with Past Dates\n")

    if not past_items:
        print("All items have current dates!")
        return

    for item in past_items:
        print(format_past_item(item))

    print(f"\n**{len(past_items)} items need date updates**")


if __name__ == "__main__":
    main()
