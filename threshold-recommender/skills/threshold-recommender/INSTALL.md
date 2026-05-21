# Install: threshold-recommender

An interactive Shopping Threshold Recommender for Google Ads. Pulls 8 weeks of product-level Shopping data and builds an HTML app with adjustable ROAS/CPA and Cost/Clicks sliders that bucket products into Profitable, Costly, Flukes, and Meh quadrants in real time, plus AI recommendations based on Andrew Lolk's framework.

## Prerequisites

1. **`~/google-ads.yaml`** — your Google Ads API credentials (developer token, OAuth client, refresh token).
2. **`.claude/accounts.json`** — at least one client entry with `id`, `name`, `currency`, and (if you use an MCC) `login_customer_id`. See SKILL.md for the exact shape.
3. **A Python `.venv`** with the Google Ads library: `pip install google-ads`.

## Installation Steps

This skill's two scripts live in your brain's `data/` folder (they resolve every other
path relative to your brain root from there). Copy both files in:

```bash
cp threshold_recommender.py data/threshold_recommender.py
cp client_helper.py data/client_helper.py
```

The SKILL.md (loaded automatically when you install the plugin) tells Claude how to run it.

## Run

```bash
source .venv/bin/activate
python3 data/threshold_recommender.py <client-alias>
open 'clients/<client-alias>/reports/threshold-recommender.html'
```

`<client-alias>` is any key, alias, name, or ID from your `.claude/accounts.json`. The report
is written to `clients/<client-alias>/reports/threshold-recommender.html`.

## Notes

- `client_helper.py` is a shared helper for brain Google Ads scripts. If you already have a
  `data/client_helper.py`, diff before overwriting — this copy adds a `check_pmax_brand_exclusions`
  helper that the threshold report imports but does not require.
- See SKILL.md for the full error-handling table.
