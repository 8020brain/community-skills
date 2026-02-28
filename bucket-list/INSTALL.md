# Installing Bucket List Skill

## Overview

Track bucket list experiences, festivals, natural phenomena, and photo trip opportunities with auto-enrichment via web research, date validation, and proactive suggestions.

## Prerequisites

- Python 3.8+
- Claude CLI installed and authenticated (for auto-enrichment feature)
- No additional Python packages required (uses stdlib only)

## Installation Instructions

Copy and paste this entire message into Claude Code to install the skill:

---

**Install the bucket-list skill. First, create a todo checklist to track progress:**

Use TodoWrite to create this checklist:
- [ ] Create skill directory structure
- [ ] Create SKILL.md
- [ ] Create add-item.py
- [ ] Create enrich-item.py
- [ ] Create list-upcoming.py
- [ ] Create list-past.py
- [ ] Create research/bucket-list folder structure
- [ ] Create research/bucket-list/README.md
- [ ] Create research/bucket-list/alerts.md
- [ ] Verify installation

**Mark each step complete as you finish it.**

### Step 1: Create the skill directory structure

Create these folders:
- `.claude/skills/bucket-list/`
- `.claude/skills/bucket-list/scripts/`

Mark "Create skill directory structure" as complete.

### Step 2: Create SKILL.md

Create file `.claude/skills/bucket-list/SKILL.md` with this content:

```markdown
---
name: bucket-list
description: >
  Track bucket list experiences, festivals, natural phenomena, and photo trip opportunities.
  Supports auto-enrichment via web research, date validation, and proactive suggestions.
  USE WHEN user mentions bucket list, travel plans, "what can I do in [month]",
  photo trip ideas, festivals, or adventure planning.
allowed-tools: Bash, Read, Write, Glob, WebFetch, WebSearch
user-invocable: true
---

# Bucket List Skill

Track and manage bucket list items with auto-research, date validation, and proactive surfacing.

## Storage Location

All items stored in `research/bucket-list/` as markdown files:
- `festivals/` - Recurring events with specific dates
- `phenomena/` - Natural events (aurora, superbloom, tides)
- `experiences/` - General bucket list items
- `attended/` - Completed items with reviews
- `alerts.md` - Active phenomenon alerts

## Triggers

Activate this skill when user says:

| Trigger | Action |
|---------|--------|
| "add X to bucket list" | Create item + auto-enrich |
| "add X to my bucket list" | Create item + auto-enrich |
| "what's on my bucket list" | List all items |
| "bucket list" | List all items |
| "what can I do in [month]" | Query by month |
| "what's happening in [month]" | Query by month |
| "what bucket list items for [month]" | Query by month |
| "I did X" / "I went to X" | Log attended item |
| "bucket list alerts" | Show aurora/eclipse status |
| "any aurora tonight" | Check alerts.md |
| "research [type] trips" | Discover new items |

## Adding Items

When user says "add X to bucket list":

1. Extract item name from the request
2. Run add-item.py to create markdown file
3. Automatically call enrich-item.py to research:
   - Location and distance from your home city
   - Timing (specific dates for festivals, seasons for others)
   - Preparation requirements (for physical activities)
   - Key logistics and tips
4. Report what was found

```bash
# Create and enrich
python .claude/skills/bucket-list/scripts/add-item.py "Great Divide Mountain Bike Route"

# Skip enrichment (just create skeleton)
python .claude/skills/bucket-list/scripts/add-item.py "Quick Item" --no-enrich
```

## Querying Items

```bash
# What's coming up in next 30 days?
python .claude/skills/bucket-list/scripts/list-upcoming.py

# What's in a specific month?
python .claude/skills/bucket-list/scripts/list-upcoming.py --month february --year 2027

# This weekend opportunities
python .claude/skills/bucket-list/scripts/list-upcoming.py --this-weekend

# Filter by priority
python .claude/skills/bucket-list/scripts/list-upcoming.py --priority must-do

# Filter by type
python .claude/skills/bucket-list/scripts/list-upcoming.py --type festival
```

## Date Validation

Monthly task checks for outdated dates:

```bash
# Find items with dates in the past
python .claude/skills/bucket-list/scripts/list-past.py

# Create inbox note for items needing updates
python .claude/skills/bucket-list/scripts/list-past.py --create-inbox-note
```

## Enrichment

Research and fill in details for any item:

```bash
# Enrich an item
python .claude/skills/bucket-list/scripts/enrich-item.py great-divide-mtb-route

# Re-enrich with fresh research
python .claude/skills/bucket-list/scripts/enrich-item.py winona-ice-festival --refresh
```

## Item Types

| Type | Examples | Auto-Research Includes |
|------|----------|----------------------|
| festival | Ice festivals, air shows | Official dates, website |
| phenomenon | Superbloom, aurora, tides | Conditions, best viewing |
| experience | Road trips, destinations | Best season, logistics |
| photo-trip | Dark sky parks, wildlife | Light conditions, permits |

## Priority Levels

| Priority | Meaning | When Surfaced |
|----------|---------|---------------|
| must-do | High priority | 2-4 weeks ahead |
| interested | Would be nice | 1 week ahead |
| someday | Low priority | Only if convenient |

## Physical Activity Detection

For items detected as physical activities (hiking, biking, climbing):
- Training requirements automatically researched
- Preparation timeline included
- Difficulty rating and key challenges noted

## Alerts

Check `research/bucket-list/alerts.md` for:
- Aurora watch (Kp index)
- Upcoming eclipses
- Meteor shower schedule
- Conditional phenomena status (superbloom, king tides)

## Logging Attended Items

When user says "I did X" or "I went to X":

1. Create file in `attended/` folder with date prefix
2. Ask for review: highlights, would do again, what to change
3. Link to original bucket list item if exists

## Briefing Integration

The generate-suggestions.py script provides data for daily briefings:
- Upcoming must-do items (next 30 days)
- Active alerts (aurora, eclipses)
- Travel drought reminder (days since last trip)
- Impromptu opportunities (this weekend)
```

Mark "Create SKILL.md" as complete.

### Step 3: Create add-item.py

Create file `.claude/skills/bucket-list/scripts/add-item.py` with this content:

```python
#!/usr/bin/env python3
"""
Add a new item to the bucket list.

Creates a markdown file with basic structure, then calls enrich-item.py
to research and fill in details.

Usage:
    python add-item.py "Great Divide Mountain Bike Route"
    python add-item.py "Winona Ice Festival" --type festival --priority must-do
    python add-item.py "Death Valley Superbloom" --type phenomenon --no-enrich
"""

import argparse
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
BUCKET_LIST_DIR = REPO_ROOT / "research" / "bucket-list"

# Valid values
TYPES = ["festival", "phenomenon", "experience", "photo-trip"]
PRIORITIES = ["must-do", "interested", "someday"]
PHOTO_TYPES = ["astro", "wildlife", "landscape", "event"]


def slugify(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


def detect_type(name: str) -> str:
    """Try to detect the item type from the name."""
    name_lower = name.lower()

    # Festival indicators
    festival_words = ["festival", "fair", "show", "expo", "convention", "parade", "celebration"]
    if any(word in name_lower for word in festival_words):
        return "festival"

    # Phenomenon indicators
    phenomenon_words = ["bloom", "superbloom", "aurora", "eclipse", "tide", "migration", "meteor", "comet"]
    if any(word in name_lower for word in phenomenon_words):
        return "phenomenon"

    # Photo trip indicators
    photo_words = ["photography", "photo", "dark sky", "stargazing", "wildlife viewing"]
    if any(word in name_lower for word in photo_words):
        return "photo-trip"

    # Default to experience
    return "experience"


def get_folder_for_type(item_type: str) -> Path:
    """Get the folder path for an item type."""
    type_to_folder = {
        "festival": "festivals",
        "phenomenon": "phenomena",
        "experience": "experiences",
        "photo-trip": "experiences",  # Photo trips go in experiences
    }
    folder_name = type_to_folder.get(item_type, "experiences")
    return BUCKET_LIST_DIR / folder_name


def create_item_file(name: str, item_type: str, priority: str, photo_type: str = None) -> Path:
    """Create a new bucket list item markdown file."""
    slug = slugify(name)
    folder = get_folder_for_type(item_type)
    folder.mkdir(parents=True, exist_ok=True)

    file_path = folder / f"{slug}.md"

    # Check if file already exists
    if file_path.exists():
        print(f"Item already exists: {file_path}")
        return file_path

    today = datetime.now().strftime("%Y-%m-%d")

    # Build the markdown content
    content = f"""# {name}

**Priority:** {priority}
**Type:** {item_type}
"""

    if photo_type:
        content += f"**Photo Type:** {photo_type}\n"

    content += """
## Location
- **Place:** TBD
- **Distance:** TBD
- **Region:** TBD

## Timing
- **Next Known Date:** TBD
- **Pattern:** TBD
- **Season:** TBD

## Details
(To be enriched)

## Notes
(To be enriched)

## Research Links
(To be enriched)

---
*Added: """ + today + """*
"""

    file_path.write_text(content, encoding="utf-8")
    return file_path


def enrich_item(slug: str) -> bool:
    """Call enrich-item.py to research and fill in details."""
    enrich_script = SCRIPT_DIR / "enrich-item.py"

    if not enrich_script.exists():
        print("Note: enrich-item.py not found, skipping enrichment")
        return False

    try:
        result = subprocess.run(
            [sys.executable, str(enrich_script), slug],
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            print(result.stdout)
            return True
        else:
            print(f"Enrichment failed: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print("Enrichment timed out")
        return False
    except Exception as e:
        print(f"Enrichment error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Add a new bucket list item")
    parser.add_argument("name", help="Name of the bucket list item")
    parser.add_argument("--type", "-t", choices=TYPES, help="Item type (auto-detected if not specified)")
    parser.add_argument("--priority", "-p", choices=PRIORITIES, default="interested", help="Priority level")
    parser.add_argument("--photo-type", choices=PHOTO_TYPES, help="Photography type (optional)")
    parser.add_argument("--no-enrich", action="store_true", help="Skip auto-enrichment")

    args = parser.parse_args()

    # Auto-detect type if not specified
    item_type = args.type or detect_type(args.name)

    print(f"Adding: {args.name}")
    print(f"Type: {item_type}")
    print(f"Priority: {args.priority}")

    # Create the file
    file_path = create_item_file(args.name, item_type, args.priority, args.photo_type)
    print(f"Created: {file_path.relative_to(REPO_ROOT)}")

    # Enrich unless skipped
    if not args.no_enrich:
        slug = slugify(args.name)
        print("\nResearching details...")
        enrich_item(slug)

    print(f"\nDone! Edit at: {file_path}")


if __name__ == "__main__":
    main()
```

Mark "Create add-item.py" as complete.

### Step 4: Create enrich-item.py

Create file `.claude/skills/bucket-list/scripts/enrich-item.py` with this content:

```python
#!/usr/bin/env python3
"""
Enrich a bucket list item with researched details.

Uses web search and Claude to fill in:
- Location details
- Timing information (dates, seasons, patterns)
- Preparation requirements (for physical activities)
- Key logistics and tips
- Research links

Usage:
    python enrich-item.py great-divide-mtb-route
    python enrich-item.py winona-ice-festival --refresh
"""

import argparse
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
BUCKET_LIST_DIR = REPO_ROOT / "research" / "bucket-list"

# Folders to search
FOLDERS = ["festivals", "phenomena", "experiences", "attended"]


def find_item_file(slug: str) -> Path:
    """Find the markdown file for an item by slug."""
    for folder in FOLDERS:
        folder_path = BUCKET_LIST_DIR / folder
        if folder_path.exists():
            file_path = folder_path / f"{slug}.md"
            if file_path.exists():
                return file_path

    # Try partial match
    for folder in FOLDERS:
        folder_path = BUCKET_LIST_DIR / folder
        if folder_path.exists():
            for file in folder_path.glob("*.md"):
                if slug in file.stem:
                    return file

    return None


def parse_item_file(file_path: Path) -> dict:
    """Parse a bucket list markdown file into a dict."""
    content = file_path.read_text(encoding="utf-8")

    # Extract name from title
    name_match = re.search(r'^# (.+)$', content, re.MULTILINE)
    name = name_match.group(1) if name_match else file_path.stem

    # Extract type
    type_match = re.search(r'\*\*Type:\*\* (\w+(?:-\w+)?)', content)
    item_type = type_match.group(1) if type_match else "experience"

    # Extract priority
    priority_match = re.search(r'\*\*Priority:\*\* (\w+(?:-\w+)?)', content)
    priority = priority_match.group(1) if priority_match else "interested"

    return {
        "name": name,
        "type": item_type,
        "priority": priority,
        "content": content,
        "file_path": file_path
    }


def build_research_prompt(item: dict) -> str:
    """Build a prompt for researching the item."""
    name = item["name"]
    item_type = item["type"]

    base_prompt = f"""Research "{name}" and provide detailed information.

I need factual information about this {item_type}. Search the web and provide:

1. **Location**: Where exactly is it? What region/state/country?

2. **Timing**: """

    if item_type == "festival":
        base_prompt += """When is it held? What are the specific dates for the next occurrence?
   What day of the week or pattern (e.g., "second Saturday of February")?"""
    elif item_type == "phenomenon":
        base_prompt += """When does it typically occur? Is it date-specific or condition-dependent?
   If conditional, what conditions are required?"""
    else:
        base_prompt += """What's the best time of year to do this? Any seasonal considerations?"""

    base_prompt += """

3. **Details**: What is it exactly? What should someone expect?

4. **Preparation**: """

    # Add physical activity detection
    physical_keywords = ["bike", "hike", "climb", "trek", "run", "marathon", "triathlon",
                        "kayak", "paddle", "ski", "snowboard", "surf", "dive", "swim"]
    if any(kw in name.lower() for kw in physical_keywords):
        base_prompt += """This seems like a physical activity. What training or fitness level is required?
   How long does it typically take? What's the difficulty level?"""
    else:
        base_prompt += """Any special preparation needed? Reservations, permits, gear?"""

    base_prompt += """

5. **Key logistics**: Any important tips, costs, or things to know?

6. **Official website or best resource**: URL to official site or most authoritative source.

Provide factual, researched information. Include specific dates and numbers where possible.
Format your response as structured text I can use to update a markdown file."""

    return base_prompt


def research_with_claude(prompt: str) -> str:
    """Use Claude CLI with web search to research the item."""
    try:
        # Use claude with web search capabilities
        result = subprocess.run(
            ["claude", "-p", prompt, "--model", "sonnet",
             "--allowedTools", "WebSearch,WebFetch"],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(REPO_ROOT)
        )

        if result.returncode == 0:
            output = result.stdout.strip()
            # Clean up any permission-related text that might slip through
            if "permission" in output.lower() and len(output) < 100:
                print("Warning: Got permission prompt instead of research", file=sys.stderr)
                return None
            return output
        else:
            print(f"Claude error: {result.stderr}", file=sys.stderr)
            return None

    except subprocess.TimeoutExpired:
        print("Research timed out after 3 minutes", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("Claude CLI not found. Make sure 'claude' is in PATH.", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Research error: {e}", file=sys.stderr)
        return None


def build_enrichment_prompt(item: dict, research: str) -> str:
    """Build a prompt to format research into markdown."""
    return f"""I have a bucket list item that needs to be enriched with research.

Current item:
```markdown
{item['content']}
```

Research findings:
{research}

Please update the markdown file with the research findings. Keep the existing structure but fill in the TBD sections with actual information.

Rules:
1. Keep the header and Priority/Type/Photo Type lines unchanged
2. Fill in Location section with Place, Distance from Chicago, and Region
3. Fill in Timing section with Next Known Date, Pattern, and Season
4. If this is a physical activity, add a "## Preparation Required" section with Training, Lead Time, and Fitness Level
5. Update Details section with a clear description
6. Update Notes section with practical tips
7. Add Research Links with actual URLs found
8. Add "*Auto-enriched: {datetime.now().strftime('%Y-%m-%d')}*" before the closing ---

Output ONLY the complete updated markdown file, nothing else."""


def format_with_claude(item: dict, research: str) -> str:
    """Use Claude to format research into the markdown template."""
    prompt = build_enrichment_prompt(item, research)

    try:
        result = subprocess.run(
            ["claude", "-p", prompt, "--model", "haiku"],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(REPO_ROOT)
        )

        if result.returncode == 0:
            output = result.stdout.strip()
            # Validate output looks like markdown
            if not output.startswith("#") and "permission" in output.lower():
                print("Warning: Got permission prompt instead of markdown", file=sys.stderr)
                return None
            # Remove markdown code fences if present
            if output.startswith("```markdown"):
                output = output[len("```markdown"):].strip()
            if output.startswith("```"):
                output = output[3:].strip()
            if output.endswith("```"):
                output = output[:-3].strip()
            return output
        else:
            print(f"Formatting error: {result.stderr}", file=sys.stderr)
            return None

    except Exception as e:
        print(f"Formatting error: {e}", file=sys.stderr)
        return None


def enrich_item(slug: str, refresh: bool = False) -> bool:
    """Enrich a bucket list item with research."""
    # Find the file
    file_path = find_item_file(slug)
    if not file_path:
        print(f"Item not found: {slug}")
        return False

    print(f"Enriching: {file_path.name}")

    # Parse current content
    item = parse_item_file(file_path)

    # Check if already enriched (unless refresh requested)
    if not refresh and "Auto-enriched:" in item["content"]:
        print("Item already enriched. Use --refresh to re-enrich.")
        return True

    # Build research prompt
    research_prompt = build_research_prompt(item)

    # Research with Claude + web search
    print("Researching...")
    research = research_with_claude(research_prompt)
    if not research:
        print("Research failed")
        return False

    # Format into markdown
    print("Formatting...")
    enriched_content = format_with_claude(item, research)
    if not enriched_content:
        print("Formatting failed")
        return False

    # Write back
    file_path.write_text(enriched_content, encoding="utf-8")
    print(f"Enriched: {file_path}")

    return True


def main():
    parser = argparse.ArgumentParser(description="Enrich a bucket list item with research")
    parser.add_argument("slug", help="Item slug or partial name")
    parser.add_argument("--refresh", "-r", action="store_true", help="Re-enrich even if already done")

    args = parser.parse_args()

    success = enrich_item(args.slug, args.refresh)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
```

Mark "Create enrich-item.py" as complete.

### Step 5: Create list-upcoming.py

Create file `.claude/skills/bucket-list/scripts/list-upcoming.py` with this content:

```python
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
```

Mark "Create list-upcoming.py" as complete.

### Step 6: Create list-past.py

Create file `.claude/skills/bucket-list/scripts/list-past.py` with this content:

```python
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
```

Mark "Create list-past.py" as complete.

### Step 7: Create research/bucket-list folder structure

Create these folders:
- `research/bucket-list/`
- `research/bucket-list/festivals/`
- `research/bucket-list/phenomena/`
- `research/bucket-list/experiences/`
- `research/bucket-list/attended/`

Mark "Create research/bucket-list folder structure" as complete.

### Step 8: Create research/bucket-list/README.md

Create file `research/bucket-list/README.md` with this content:

```markdown
# Bucket List

Personal bucket list tracking system for festivals, natural phenomena, experiences, and photo trips.

## Folder Structure

- **festivals/** - Recurring events with specific dates (ice festivals, air shows, etc.)
- **phenomena/** - Natural events with timing windows (superbloom, king tides, aurora)
- **experiences/** - General bucket list items (road trips, adventures, destinations)
- **attended/** - Completed items with reviews
- **alerts.md** - Active phenomenon alerts (aurora, eclipses, meteor showers)

## File Format

### Required Fields

```markdown
# Item Name

**Priority:** must-do | interested | someday
**Type:** festival | phenomenon | experience | photo-trip
```

### Timing Section

```markdown
## Timing
- **Next Known Date:** YYYY-MM-DD or TBD (conditional)
- **Pattern:** Annual, monthly, conditional, etc.
- **Season:** Best time of year
```

### For Physical Activities

Include preparation requirements:

```markdown
## Preparation Required
- **Training:** Description of fitness requirements
- **Lead Time:** How far in advance to prepare
- **Fitness Level:** Beginner | Intermediate | Advanced
```

## Priority Levels

| Priority | Meaning | When Surfaced |
|----------|---------|---------------|
| must-do | High priority, don't miss | 2-4 weeks ahead |
| interested | Would be nice | 1 week ahead |
| someday | Low priority | Only if very convenient |

## Item Types

| Type | Examples |
|------|----------|
| festival | Ice festivals, air shows, county fairs |
| phenomenon | Superbloom, king tides, migrations, aurora |
| experience | Road trips, destinations, adventures |
| photo-trip | Dark sky parks, wildlife photography locations |

## Commands

- "Add X to bucket list" - Creates new item with auto-enrichment
- "What's on my bucket list?" - Lists all items
- "What can I do in [month]?" - Query by date
- "I did X" - Log attended item
- "Any bucket list alerts?" - Check aurora/eclipse status

## Timestamps

Every file should end with:

```markdown
---
*Added: YYYY-MM-DD*
*Last Validated: YYYY-MM-DD*
*Auto-enriched: YYYY-MM-DD* (if applicable)
```
```

Mark "Create research/bucket-list/README.md" as complete.

### Step 9: Create research/bucket-list/alerts.md

Create file `research/bucket-list/alerts.md` with this content:

```markdown
# Active Bucket List Alerts

## Aurora Watch
**Status:** Inactive
**Current Conditions:** Check NOAA for current Kp index
**Check:** https://www.swpc.noaa.gov/products/aurora-30-minute-forecast
**Last Updated:** (update when checked)

## Upcoming Eclipses

Check NASA eclipse website for upcoming events:
https://eclipse.gsfc.nasa.gov/

## Meteor Showers (Next 3 Months)

| Shower | Peak | Moon Phase | Quality |
|--------|------|------------|---------|
| (research and update) | | | |

## Conditional Phenomena

### Superbloom Watch
**Status:** Inactive
**Conditions Required:** Above-average fall/winter rainfall
**Monitor:** NPS wildflower reports starting December

---
*Last Updated: (date)*
```

Mark "Create research/bucket-list/alerts.md" as complete.

### Step 10: Verify installation

Run these commands to verify:

```bash
ls -la .claude/skills/bucket-list/
ls -la .claude/skills/bucket-list/scripts/
ls -la research/bucket-list/
```

You should see:
- `.claude/skills/bucket-list/SKILL.md`
- `.claude/skills/bucket-list/scripts/add-item.py`
- `.claude/skills/bucket-list/scripts/enrich-item.py`
- `.claude/skills/bucket-list/scripts/list-upcoming.py`
- `.claude/skills/bucket-list/scripts/list-past.py`
- `research/bucket-list/README.md`
- `research/bucket-list/alerts.md`
- `research/bucket-list/festivals/`
- `research/bucket-list/phenomena/`
- `research/bucket-list/experiences/`
- `research/bucket-list/attended/`

Mark "Verify installation" as complete.

---

## Usage

After installation, just say things like:

- "Add Winona Ice Festival to bucket list"
- "What's on my bucket list?"
- "What can I do in February?"
- "What's happening this weekend?"
- "I went to the ice festival" (to log attended)

The skill will auto-detect item types (festival, phenomenon, experience) and research details via web search.

## Customization

Edit `enrich-item.py` to change:
- The home city for distance calculations (currently Chicago)
- Physical activity keywords that trigger training requirement research
- The Claude model used for research (currently sonnet for research, haiku for formatting)

## Optional: Monthly Validation

Add a scheduled task to check for outdated dates monthly:

```bash
python .claude/skills/bucket-list/scripts/list-past.py --create-inbox-note
```

This creates an inbox note listing items needing date updates.
