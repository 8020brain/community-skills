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
   - Location and distance from Chicago
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
