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