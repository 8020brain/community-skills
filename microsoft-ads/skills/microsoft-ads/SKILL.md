---
name: microsoft-ads
description: |
  Query Microsoft Advertising (Bing Ads) accounts via the SOAP API. Pull campaign performance, search terms, conversion goals, and manage accounts. AUTO-ACTIVATE for ANY mention of: Microsoft Ads, Bing Ads, Microsoft Advertising, Bing campaigns, Bing search terms, Bing conversions, UET tags.
---

# Microsoft Ads Skill

Pull data, generate insights, and manage Microsoft Advertising accounts via the Bing Ads SOAP API.

## Prerequisites

Credentials in `.env` at the brain root:

```
MICROSOFT_ADS_CLIENT_ID=...
MICROSOFT_ADS_DEVELOPER_TOKEN=...
MICROSOFT_ADS_CLIENT_SECRET=...
MICROSOFT_ADS_REFRESH_TOKEN=...
```

See `references/SETUP-GUIDE.md` for full setup instructions.

## Command Format

```
/microsoft-ads <action> [account] [options]
```

**Examples:**
- `/microsoft-ads accounts` - List all accessible accounts
- `/microsoft-ads campaigns <account>` - Campaign performance (30d default)
- `/microsoft-ads search-terms <account> 7d` - Search terms, last 7 days
- `/microsoft-ads conversions <account>` - Conversion goals

## Process

### Step 1: Authenticate

Use `scripts/auth.cjs` to get a fresh access token:

```bash
node .claude/skills/microsoft-ads/scripts/auth.cjs
```

Returns JSON with `access_token` and a new `refresh_token`. **Always save the new refresh token** back to `.env` — Microsoft rotates them on each exchange.

### Step 2: Discover Accounts (first time)

Run `scripts/get-accounts.cjs` to list all accessible accounts:

```bash
node .claude/skills/microsoft-ads/scripts/get-accounts.cjs
```

Returns Customer IDs and Account IDs needed for all subsequent calls.

### Step 3: Execute Request

For data queries, use `scripts/query.cjs`:

```bash
node .claude/skills/microsoft-ads/scripts/query.cjs <service> <operation> [bodyFile]
```

- **service**: `customer`, `campaign`, or `reporting`
- **operation**: The SOAP operation name (e.g., `GetCampaignsByAccountId`, `SubmitGenerateReport`)
- **bodyFile**: Path to XML body file (optional — can also pipe via stdin)

For reports, use `scripts/report.cjs` which handles the async submit/poll/download flow:

```bash
node .claude/skills/microsoft-ads/scripts/report.cjs <account_id> <report_type> [days]
```

### Step 4: Generate Insights

After pulling data, analyze it and present:
1. Key metrics summary
2. Notable trends or anomalies
3. Numbered action options for the user

## Key Architecture Notes

- **SOAP API, not REST** — All calls use XML envelopes. See `references/soap-templates/` for examples.
- **Reports are async** — Submit request, poll for completion, download ZIP containing CSV.
- **Refresh tokens rotate** — Every token exchange returns a NEW refresh token. Always persist the latest one.
- **Cost values are in micros** — Divide by 1,000,000 for actual currency.
- **Conversion goals are customer-scoped** — They belong to the customer, not the account.
- **Report downloads need auth** — The download URL requires the AuthenticationToken header.

## API Endpoints

| Service | Host | Path |
|---------|------|------|
| Customer Management | clientcenter.api.bingads.microsoft.com | /Api/CustomerManagement/v13/CustomerManagementService.svc |
| Campaign Management | campaign.api.bingads.microsoft.com | /Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc |
| Reporting | reporting.api.bingads.microsoft.com | /Api/Advertiser/Reporting/v13/ReportingService.svc |

## SOAP Namespace Reference

| Service | Namespace |
|---------|-----------|
| Customer Management | `https://bingads.microsoft.com/Customer/v13` |
| Campaign Management | `https://bingads.microsoft.com/CampaignManagement/v13` |
| Reporting | `https://bingads.microsoft.com/Reporting/v13` |
