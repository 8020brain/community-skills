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
        # --dangerouslySkipPermissions avoids interactive prompts
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