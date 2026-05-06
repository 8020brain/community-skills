---
name: home-repair-funds
description: >
  Homeownership maintenance tracker and sinking fund planner. Tracks major home systems
  (roof, HVAC, water heater, appliances, etc.) with install dates, expected lifespans,
  and replacement costs. Calculates how much should be saved right now in a sinking fund
  and surfaces repairs coming up in the next 3 years. USE WHEN user mentions "home maintenance",
  "home repairs", "sinking fund", "house budget", "when do I need to replace", or asks about
  upcoming home repairs/replacements.
allowed-tools: Bash, Read, Write, Edit
user-invocable: true
---

# Home Maintenance Skill

Track major home systems and components, plan a sinking fund, and surface upcoming replacements.

## Triggers

| Trigger | Action |
|---------|--------|
| "set up home maintenance", "init home maintenance", "build home inventory" | Run `init` (interactive build) |
| "list home items", "show home inventory" | Run `list` |
| "add home item [name]" | Run `add` |
| "replaced [item]", "fixed [item]", "repaired [item]" | Run `update` |
| "home sinking fund", "how much should I have saved", "home maintenance status" | Run `status` |
| "upcoming home repairs", "what's coming up on the house", "home repairs next 3 years" | Run `upcoming` |

## Data File

Located at `.claude/skills/home-repair-funds/data/home-inventory.json`. Structure:

```json
{
  "home": {
    "purchase_date": "YYYY-MM-DD",
    "value": 400000,
    "notes": ""
  },
  "items": [
    {
      "id": "roof",
      "name": "Roof (asphalt shingle)",
      "category": "structure",
      "last_replaced": "YYYY-MM-DD",
      "lifespan_years": 22,
      "replacement_cost": 15000,
      "notes": "",
      "history": [
        {"date": "YYYY-MM-DD", "type": "install|replace|repair", "cost": 0, "notes": ""}
      ]
    }
  ]
}
```

## Operations

All operations run via the `home.js` script:

```bash
node .claude/skills/home-repair-funds/scripts/home.js <command> [args]
```

Commands:
- `init` - Create starter inventory with default categories. Asks for home value/purchase date if not set. Will not overwrite existing file unless `--force`.
- `list` - Print all tracked items with age and years remaining.
- `add` - Add a new item. Args: `--name "..." --category ... --last-replaced YYYY-MM-DD --lifespan N --cost N`
- `update <id>` - Record a repair/replacement. Args: `--type replace|repair --date YYYY-MM-DD --cost N --notes "..."`. A `replace` resets `last_replaced`.
- `status` - Show total sinking fund target (sum of accrued depreciation across all items) plus per-item breakdown.
- `breakdown` - Per-item saved-toward vs full goal with progress bars. Same math as status but visual.
- `upcoming [--years N]` - Show items due for replacement within N years (default 3).

## Init Flow

When Jeff says "set up home maintenance":
1. Check if data file exists. If yes, ask before overwriting.
2. Ask: home value, purchase date.
3. Walk through default categories (structure, hvac, plumbing, exterior, appliances, interior). For each item Jeff has, ask install date and confirm cost/lifespan defaults.
4. Save the file and run `status` to show starting picture.

## Status Calculation

For each item:
- `years_used = (today - last_replaced) / 365.25`
- `annual_accrual = replacement_cost / lifespan_years`
- `should_have_saved = min(years_used, lifespan_years) * annual_accrual`

Total sinking fund target = sum across all items.

Also compute per-paycheck (biweekly = 26/yr) savings target = total annual accrual / 26.

## Upcoming Calculation

For each item:
- `replace_due_date = last_replaced + lifespan_years`
- If `replace_due_date <= today + N years`, include in output.
- Sort by due date ascending.

## Default Item Catalog

When initializing, offer these defaults (Jeff confirms which apply):

**Structure**
- Roof (asphalt shingle) - 22yr - $15,000
- Siding - 30yr - $15,000
- Windows (whole house) - 25yr - $15,000
- Foundation waterproofing - 25yr - $8,000
- Driveway (asphalt) - 20yr - $7,000

**HVAC**
- Furnace - 18yr - $6,000
- Central AC - 15yr - $7,500
- Water heater (tank) - 12yr - $2,500
- Sump pump - 8yr - $700

**Plumbing/Electrical**
- Sewer line - 60yr - $8,000
- Electrical panel - 30yr - $3,000
- Toilets (each) - 28yr - $500
- Water softener - 12yr - $2,000

**Exterior**
- Deck - 20yr - $12,000
- Fence - 18yr - $5,000
- Garage door - 22yr - $2,500
- Garage door opener - 12yr - $600
- Exterior paint - 8yr - $6,000

**Appliances**
- Refrigerator - 13yr - $2,000
- Dishwasher - 10yr - $1,000
- Washer - 12yr - $900
- Dryer - 13yr - $900
- Range/oven - 14yr - $1,500
- Microwave - 9yr - $400
- Garbage disposal - 10yr - $350

**Interior**
- Carpet - 10yr - $4,000
- Hardwood refinish - 12yr - $2,500
- Interior paint - 8yr - $4,500
- Kitchen refresh - 22yr - $30,000
- Bathroom refresh - 18yr - $12,000

## Output Style

- Status report: tabular, group by category, show item / age / due in / cost / saved target.
- Upcoming: chronological list with due date, item, estimated cost, current age vs lifespan.
- Always include the per-paycheck savings target in status output.
- Use full dollar amounts (no abbreviations like "15k").
