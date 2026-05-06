# Install: home-repair-funds

A homeowner's sinking-fund planner. Tracks major home systems with install dates, expected lifespans, and replacement costs. Calculates how much you should be saving weekly to a HYSA + brokerage to fund future repairs/replacements without surprise bills.

## What It Does

- **Tracks 29 default home items** (roof, HVAC, water heater, all appliances, paint, etc.) — add/remove/customize freely.
- **Sinking fund math**: tells you how much to save weekly, with separate HYSA (short-term) and brokerage (long-term) buckets.
- **Inflation-adjusted future costs** + nominal investment growth — single accounting, no double counting.
- **HOA-covered flag** for townhome/condo owners (tracked for awareness but excluded from your savings target).
- **Catch-up planning**: parallel mode (save to both buckets simultaneously) and delayed-brokerage mode (HYSA first, then redirect after short-term goal hit).
- **HTML + PDF reports** generated to a configurable folder.

## Installation Steps

1. **Drop the folder** into your brain at:
   ```
   .claude/skills/home-repair-funds/
   ```

2. **Initialize your data file** with the default catalog of items:
   ```bash
   node .claude/skills/home-repair-funds/scripts/home.js init
   ```

3. **Set your home info**:
   ```bash
   node .claude/skills/home-repair-funds/scripts/home.js set-home --value 400000 --purchase-date 2020-01-15 --inflation 0.03
   ```

4. **Walk through your items** — for each one you actually have, run:
   ```bash
   node .claude/skills/home-repair-funds/scripts/home.js update <item-id> --type install --date YYYY-MM-DD
   ```
   Use `list` to see all items and IDs. If something doesn't apply (no fence, no garage), leave it untracked — it's ignored.

5. **Mark HOA-covered items** if you live in a townhome/condo:
   ```bash
   node .claude/skills/home-repair-funds/scripts/home.js flag roof --hoa true
   node .claude/skills/home-repair-funds/scripts/home.js flag siding --hoa true
   # etc.
   ```

## Daily Use

```bash
# Check where you stand
node .claude/skills/home-repair-funds/scripts/home.js status
node .claude/skills/home-repair-funds/scripts/home.js breakdown    # progress bars
node .claude/skills/home-repair-funds/scripts/home.js upcoming     # next 3 years
node .claude/skills/home-repair-funds/scripts/home.js catchup      # weekly savings plan

# Adjust assumptions
node .claude/skills/home-repair-funds/scripts/home.js catchup --hysa-rate 0.04 --growth-rate 0.07 --horizon 5

# Record a replacement (resets the clock for that item)
node .claude/skills/home-repair-funds/scripts/home.js update furnace --type replace --date 2026-05-04 --cost 5800

# Generate professional HTML + PDF report
node .claude/skills/home-repair-funds/scripts/home.js report
```

Or just say "home repair funds" / "sinking fund" / "what's coming up on the house" and Claude will run the right reports.

## Default Lifespans (You Can Override Per Item)

The seed catalog has reasonable lifespans — but everyone's situation differs. Single-occupant homes wear less. Townhome HOAs handle exteriors. Etc. Tune via `update <id> --lifespan N` or by editing `data/home-inventory.json` directly.

## Requirements

- Node.js (built-in, comes with most setups)
- Optional: Chrome/Chromium installed (for PDF generation — falls back to HTML-only if not found)

## How It Works (Math)

Each item has `replacement_cost`, `lifespan_years`, and `last_replaced` date. The skill computes:

- **Sinking fund target** = sum of `(years_used / lifespan) × cost` across all your items. This is the "depreciation accrual" — what you'd ideally have set aside today.
- **Annual contribution** = sum of `cost / lifespan` per item.
- **Two-bucket weekly contribution** = HYSA covers items due within `--horizon N` years; brokerage covers everything beyond, using compound growth math against the inflation-adjusted future cost.

## Privacy

This is a clean version. No personal data — you start fresh after `init`.
