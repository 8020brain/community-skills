#!/usr/bin/env python3
"""
List upcoming bucket list items.

Parses markdown files and filters by date/timing.

Usage:
    python list-upcoming.py                          # Next 30 days
    python list-upcoming.py --days 60                # Next 60 days
    python list-upcoming.py --month february --year 2027
    python list-upcoming.py --this-weekend
    python list-upcoming.py --priority must-do
    python list-upcoming.py --type festival
"""

import argparse
import re
from datetime import datetime, timedelta
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
BUCKET_LIST_DIR = REPO_ROOT / "research" / "bucket-list"

# Folders to search (not attended)
FOLDERS = ["festivals", "phenomena", "experiences"]

# Month name to number mapping
MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
}


def parse_date(date_str: str) -> datetime:
    """Parse a date string into a datetime object."""
    if not date_str or date_str.upper() in ["TBD", "TBD (CONDITIONAL)", "ANYTIME"]:
        return None

    # Try various formats
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue

    return None


def parse_season(season_str: str) -> list:
    """Parse a season string into a list of month numbers."""
    if not season_str:
        return []

    season_str = season_str.lower()
    months = []

    # Check for month names
    for month_name, month_num in MONTHS.items():
        if month_name in season_str:
            months.append(month_num)

    # Check for ranges like "January - March"
    range_match = re.search(r'(\w+)\s*[-–to]+\s*(\w+)', season_str)
    if range_match:
        start_month = MONTHS.get(range_match.group(1).lower())
        end_month = MONTHS.get(range_match.group(2).lower())
        if start_month and end_month:
            if start_month <= end_month:
                months = list(range(start_month, end_month + 1))
            else:
                # Wraps around year (e.g., December - February)
                months = list(range(start_month, 13)) + list(range(1, end_month + 1))

    return months


def parse_item_file(file_path: Path) -> dict:
    """Parse a bucket list markdown file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return None

    # Extract name from title
    name_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    name = name_match.group(1) if name_match else file_path.stem

    # Extract type
    type_match = re.search(r'\*\*Type:\*\* (\w+(?:-\w+)?)', content)
    item_type = type_match.group(1) if type_match else "experience"

    # Extract priority
    priority_match = re.search(r'\*\*Priority:\*\* (\w+(?:-\w+)?)', content)
    priority = priority_match.group(1) if priority_match else "interested"

    # Extract next known date
    date_match = re.search(r'\*\*Next Known Date:\*\*\s*(.+?)(?:\n|$)', content)
    date_str = date_match.group(1).strip() if date_match else None
    next_date = parse_date(date_str)

    # Extract season
    season_match = re.search(r'\*\*(?:Season|Best Season|Typical Window):\*\*\s*(.+?)(?:\n|$)', content)
    season_str = season_match.group(1).strip() if season_match else None
    season_months = parse_season(season_str)

    # Extract location
    place_match = re.search(r'\*\*Place:\*\*\s*(.+?)(?:\n|$)', content)
    place = place_match.group(1).strip() if place_match else "TBD"

    # Extract distance
    distance_match = re.search(r'\*\*Distance:\*\*\s*(.+?)(?:\n|$)', content)
    distance = distance_match.group(1).strip() if distance_match else None

    return {
        "name": name,
        "slug": file_path.stem,
        "type": item_type,
        "priority": priority,
        "next_date": next_date,
        "date_str": date_str,
        "season_months": season_months,
        "season_str": season_str,
        "place": place,
        "distance": distance,
        "file_path": file_path
    }


def get_all_items() -> list:
    """Get all bucket list items from markdown files."""
    items = []

    for folder in FOLDERS:
        folder_path = BUCKET_LIST_DIR / folder
        if not folder_path.exists():
            continue

        for file_path in folder_path.glob("*.md"):
            if file_path.name == "README.md":
                continue

            item = parse_item_file(file_path)
            if item:
                items.append(item)

    return items


def filter_by_date_range(items: list, start_date: datetime, end_date: datetime) -> list:
    """Filter items by a date range."""
    filtered = []

    for item in items:
        # Check specific date
        if item["next_date"]:
            if start_date <= item["next_date"] <= end_date:
                filtered.append(item)
                continue

        # Check seasonal items
        if item["season_months"]:
            # Check if any month in the range matches
            check_date = start_date
            while check_date <= end_date:
                if check_date.month in item["season_months"]:
                    filtered.append(item)
                    break
                check_date += timedelta(days=28)  # Rough month increment

    return filtered


def filter_by_month(items: list, month: int, year: int) -> list:
    """Filter items that occur in a specific month."""
    filtered = []

    for item in items:
        # Check specific date
        if item["next_date"]:
            if item["next_date"].month == month and item["next_date"].year == year:
                filtered.append(item)
                continue

        # Check seasonal items
        if month in item["season_months"]:
            filtered.append(item)

    return filtered


def filter_by_priority(items: list, priority: str) -> list:
    """Filter items by priority level."""
    return [item for item in items if item["priority"] == priority]


def filter_by_type(items: list, item_type: str) -> list:
    """Filter items by type."""
    return [item for item in items if item["type"] == item_type]


def format_item(item: dict, today: datetime) -> str:
    """Format an item for display."""
    output = f"**{item['name']}**"

    if item["next_date"]:
        days_away = (item["next_date"] - today).days
        date_str = item["next_date"].strftime("%b %d")
        output += f" - {date_str} ({days_away} days)"
    elif item["season_str"]:
        output += f" - {item['season_str']}"

    output += f" [{item['priority']}]\n"

    if item["place"] and item["place"] != "TBD":
        output += f"  {item['place']}"
        if item["distance"]:
            output += f" ({item['distance']})"
        output += "\n"

    return output


def main():
    parser = argparse.ArgumentParser(description="List upcoming bucket list items")
    parser.add_argument("--days", "-d", type=int, default=30, help="Number of days to look ahead")
    parser.add_argument("--month", "-m", help="Specific month (name or number)")
    parser.add_argument("--year", "-y", type=int, help="Specific year (required with --month)")
    parser.add_argument("--this-weekend", action="store_true", help="Show items for this weekend")
    parser.add_argument("--priority", "-p", choices=["must-do", "interested", "someday"], help="Filter by priority")
    parser.add_argument("--type", "-t", choices=["festival", "phenomenon", "experience", "photo-trip"], help="Filter by type")
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all items
    items = get_all_items()

    if not items:
        print("No bucket list items found.")
        return

    # Apply filters
    if args.month:
        # Parse month
        month_str = args.month.lower()
        month = MONTHS.get(month_str) or int(month_str)
        year = args.year or today.year
        items = filter_by_month(items, month, year)
        print(f"## Bucket List Items for {args.month.title()} {year}\n")

    elif args.this_weekend:
        # Calculate this weekend (Saturday and Sunday)
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0 and today.weekday() != 5:
            days_until_saturday = 7
        saturday = today + timedelta(days=days_until_saturday)
        sunday = saturday + timedelta(days=1)
        items = filter_by_date_range(items, saturday, sunday)
        print(f"## Bucket List Items for This Weekend ({saturday.strftime('%b %d')}-{sunday.strftime('%b %d')})\n")

    else:
        # Default: next N days
        end_date = today + timedelta(days=args.days)
        items = filter_by_date_range(items, today, end_date)
        print(f"## Bucket List Items - Next {args.days} Days\n")

    # Additional filters
    if args.priority:
        items = filter_by_priority(items, args.priority)

    if args.type:
        items = filter_by_type(items, args.type)

    # Sort by date (items with dates first, then by date)
    items.sort(key=lambda x: (x["next_date"] is None, x["next_date"] or datetime.max))

    if not items:
        print("No matching items found.")
        return

    if args.json:
        import json
        output = []
        for item in items:
            output.append({
                "name": item["name"],
                "slug": item["slug"],
                "type": item["type"],
                "priority": item["priority"],
                "next_date": item["next_date"].isoformat() if item["next_date"] else None,
                "season": item["season_str"],
                "place": item["place"],
                "distance": item["distance"]
            })
        print(json.dumps(output, indent=2))
    else:
        for item in items:
            print(format_item(item, today))


if __name__ == "__main__":
    main()
