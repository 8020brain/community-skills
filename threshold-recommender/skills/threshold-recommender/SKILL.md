---
name: threshold-recommender
description: "Generate an interactive Shopping Threshold Recommender HTML report for a Google Ads client. Pulls 8 weeks of product-level Shopping data via the API and produces an interactive HTML with adjustable ROAS/CPA and Cost/Clicks sliders that bucket products into Profitable/Costly/Flukes/Meh quadrants in real time. Includes AI recommendations based on Andrew Lolk's framework — opinionated campaign structure verdict, data fragmentation risk per bucket, bestseller ROAS headroom guidance, and zombie subcategory analysis. USE WHEN user asks to run the threshold recommender, generate a threshold report, create a shopping bucketing report, analyze shopping product thresholds, or segment products for a client."
---

# Threshold Recommender

## Prerequisites

1. **`~/google-ads.yaml`** — Google Ads API credentials (developer token, OAuth client, refresh token)
2. **`.claude/accounts.json`** — client entry with at least:
   ```json
   "my-client": {
     "id": "1234567890",
     "name": "My Client",
     "currency": "EUR",
     "login_customer_id": "9999999999"
   }
   ```
   `login_customer_id` is your MCC. Omit it if accessing the account directly (non-MCC).
3. **Python `.venv`** with `google-ads` installed (`pip install google-ads`)

## Run

```bash
source .venv/bin/activate
python3 data/threshold_recommender.py <client-alias>
open 'clients/<client-alias>/reports/threshold-recommender.html'
```

`<client-alias>` is any `_key`, alias, or name from your `.claude/accounts.json`.

## Dependencies

This script requires `data/client_helper.py` (included in the brain). It resolves all paths
relative to your brain root — no hardcoded paths.

## Error handling

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError` | Run `source .venv/bin/activate` first |
| `Account '...' not found` | Check the alias exists in `.claude/accounts.json` |
| `No Shopping data found` | Account has no Shopping campaigns in the lookback period |
| `GoogleAdsException: USER_PERMISSION_DENIED` | `login_customer_id` in `accounts.json` is wrong or missing |
| `GoogleAdsException` (other) | Check `~/google-ads.yaml` credentials |
