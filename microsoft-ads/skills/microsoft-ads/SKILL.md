---
name: microsoft-ads
description: |
  Microsoft Advertising (Bing Ads) API operations - pull data, manage campaigns, conversion goals, UET tags, and reporting. AUTO-ACTIVATE for ANY mention of: Microsoft Ads, Bing Ads, Microsoft Advertising, Bing campaigns, Microsoft conversion goals, UET tags, Microsoft search terms, Bing performance, Microsoft Ads report. Phrases: "get bing", "pull microsoft", "show me bing", "microsoft ads performance". Also triggered by /microsoft-ads command.
---

# Microsoft Ads Skill

Manage Microsoft Advertising (Bing Ads) accounts via the REST API v13.

**REST only.** Migrated from SOAP 2026-06-10. SOAP gets no new features after 1 Oct 2026 and is fully deprecated 31 Jan 2027. NEVER build anything new on SOAP; `soapCall` was removed from the helper and now throws.

## Prerequisites

Credentials must be set in `.env`:
```
MICROSOFT_ADS_CLIENT_ID=your_client_id
MICROSOFT_ADS_DEVELOPER_TOKEN=your_dev_token
MICROSOFT_ADS_CLIENT_SECRET=your_client_secret
MICROSOFT_ADS_REFRESH_TOKEN=your_refresh_token
```

If these are not set, direct the user to `CONNECTION-GUIDE.md` (community-facing, solves the Azure "directory retired" wall and the developer-token "contact support" wall). `SETUP.md` is the original step list; `CONNECTION-GUIDE.md` supersedes it for onboarding. OAuth is identical under REST; nothing in the auth flow changed in the migration.

## API Architecture

JSON over REST. Endpoint pattern: `POST https://{host}/{Service}/v13/{Entity}/{Action}`.

| Service | Host | Base path | Example operation |
|---------|------|-----------|-------------------|
| Customer Management | `clientcenter.api.bingads.microsoft.com` | `/CustomerManagement/v13/` | `CustomersInfo/Query`, `AccountsInfo/Query`, `User/Query` |
| Campaign Management | `campaign.api.bingads.microsoft.com` | `/CampaignManagement/v13/` | `Campaigns/QueryByAccountId`, `ConversionGoals/QueryByTagIds`, `Ads/Add` |
| Reporting | `reporting.api.bingads.microsoft.com` | `/Reporting/v13/` | `GenerateReport/Submit`, `GenerateReport/Poll` |

Headers on every call: `Authorization: Bearer {token}`, `DeveloperToken`, `Content-Type: application/json`, plus `CustomerId` and `CustomerAccountId` where the operation needs account scope. Same SOAP operation names map to REST paths; the REST tab on each operation's Microsoft Learn page gives the exact path and JSON template.

## Helper Script

Use `scripts/msads-helper.js` for all API calls. It handles:
- OAuth token refresh (with rotating token support)
- REST headers, JSON encoding, and API error surfacing
- The async reporting flow (submit -> poll -> download -> unzip -> CSV)

### Usage

```javascript
const {
  getAccessToken, restCall,
  getCustomers, getUser, getAccounts, findAccount,
  runReport, runReportRaw
} = require('./scripts/msads-helper');

// Get fresh access token (optional - every helper fetches one if not passed)
const token = await getAccessToken();

// Generic REST call: service, 'Entity/Action', JSON body, scope ids
const result = await restCall('CampaignManagement', 'Campaigns/QueryByAccountId',
  { AccountId: 123456789, CampaignType: 'Search,Shopping,PerformanceMax' },
  { token, customerId: '987654321', accountId: '123456789' });
// -> parsed JSON ({ Campaigns: [...] }); throws with the API error message on failure
```

### High-level helpers (prefer these)

```javascript
// Resolve an account by its alphanumeric Number (e.g. 'X1234567') or name, across ALL customers.
const acct = await findAccount('X1234567'); // -> {id, name, number, status, customerId}

// Enumerate everything the user can access.
const customers = await getCustomers();             // [{id, name}, ...]
const accounts  = await getAccounts(token, custId); // [{id, name, number, status, customerId}, ...]
const me        = await getUser();                  // raw {User, CustomerRoles, ...}

// Run a performance report end to end (submit -> poll -> download -> unzip -> CSV string).
const csv = await runReport({
  accountId: acct.id, customerId: acct.customerId,
  reportType: 'CampaignPerformanceReport',
  columns: ['CampaignName','Impressions','Clicks','Spend','Conversions'],
  days: 30,            // custom range ending yesterday; OR pass predefinedTime:'LastFourWeeks'
});

// Full control (other report types, explicit date ranges, no Aggregation field,
// ReportTimeZone, etc.): pass a complete JSON ReportRequest with its Type.
const csv2 = await runReportRaw({
  Type: 'SearchCampaignChangeHistoryReportRequest',
  Format: 'Csv', FormatVersion: '2.0',
  ExcludeColumnHeaders: false, ExcludeReportHeader: true, ExcludeReportFooter: true,
  ReturnOnlyCompleteData: false,
  Columns: ['DateTime','AccountName','ChangedBy','ItemChanged','AttributeChanged'],
  Scope: { AccountIds: [Number(acct.id)] },
  Time: { PredefinedTime: 'LastFourWeeks' },
}, { customerId: acct.customerId, accountId: acct.id });
```

## Common Operations

### List Accounts
- `CustomerManagement` `CustomersInfo/Query` (no scope needed) then `AccountsInfo/Query` per customer; or `findAccount()` / `getCustomers()` / `getAccounts()`.

### Get Conversion Goals
- `CampaignManagement` `ConversionGoals/QueryByIds` or `ConversionGoals/QueryByTagIds`
- **Note:** Conversion goals are **customer-scoped**, not account-scoped

### Update Conversion Goals
- `CampaignManagement` `ConversionGoals/Update`

### Get UET Tags
- `CampaignManagement` `UetTags/QueryByIds`

### Pull Performance Reports
- Reporting service, async: `GenerateReport/Submit` -> poll `GenerateReport/Poll` until `ReportRequestStatus.Status === 'Success'` -> download ZIP from `ReportDownloadUrl` (SAS-signed, no auth header) -> extract CSV. Use `runReport()` / `runReportRaw()` instead of hand-rolling.

## JSON Encoding Gotchas (the REST footguns)

1. **Flag enums are COMMA-separated strings**, e.g. `CampaignType: 'Search,Shopping,Audience,DynamicSearchAds,PerformanceMax'`. The SOAP space-separated form and JSON arrays both 400 with "Invalid JSON ... Path: $.CampaignType".
2. **Polymorphic objects use a `Type` field**, e.g. a report request is `{ Type: 'CampaignPerformanceReportRequest', ... }`, an RSA is `{ Type: 'ResponsiveSearchAd', ... }`. No element ordering rules; JSON key order does not matter (the old SOAP alphabetical-ordering footgun is gone).
3. **Columns are plain string arrays** (`Columns: ['CampaignName', ...]`), not per-report-type wrapped elements.
4. **Errors come back as JSON with `OperationErrors` / `BatchErrors`** and usually HTTP 400 + `Type: 'ApiFaultDetail'`. `restCall` throws with these decoded.
5. **`ReportTimeZone` must be a valid enum value**: Melbourne is `CanberraMelbourneSydney` (`MelbournePerth` does not exist).

## Key Gotchas (unchanged from SOAP era)

1. **Personal Microsoft account required** - Work/school accounts won't work
2. **Refresh tokens rotate** - Each exchange returns a NEW token, the helper saves it back to `.env`
3. **Conversion goals are customer-scoped** - Pass the account's OWN customer ID. `ConversionGoals/QueryByTagIds` is the easy way to list an account's goals.
4. **Reports are async** - Submit, poll, download ZIP, extract CSV. Use `runReport()` / `runReportRaw()`.
5. **`LastThirtyDays` is NOT a valid report time** - valid `PredefinedTime` enums are e.g. `Today`, `Yesterday`, `LastSevenDays`, `LastFourWeeks`, `ThisMonth`, `LastMonth`. For 30 days use a custom date range - `runReport({days:30})` does this.
6. **`AccountsInfo/Query` returns nothing without a CustomerId** - to enumerate everything, call `CustomersInfo/Query` (no scope) then `AccountsInfo/Query` per customer. Use `findAccount()` / `getCustomers()` / `getAccounts()`.
7. **`Ads/QueryByAdGroupId` can fault on some accounts** ("Creating or updating ads of this type is not allowed") even for a plain read. This is a READ quirk, NOT a write block: `Ads/Add` works fine. Verify ad existence via the Add response (AdIds + no PartialErrors) or a performance report, not by reading the ad back.
8. **The Microsoft Advertising Editor / bulk CSV import SKIPS responsive search ads** that use the bulk JSON `Headline`/`Description` column format. Create RSAs via the `Ads/Add` API instead (assets are `{ AssetLink: { Asset: { Type: 'TextAsset', Text: '..' }, PinnedField: 'Headline1' } }`).
9. **Change-history report requests have NO `Aggregation` field** - including one fails the request.
10. **Cost values in micros** - Divide by 1,000,000
11. **CTR as decimals** - Multiply by 100 for percentage
12. **Customer IDs** - Digits only, no dashes
13. **Reporting is click-date only** - there is no by-conversion-date equivalent (unlike Google Ads), and reports only return completed days.

## Data Formatting

| Field | Conversion |
|-------|-----------|
| Cost | Divide by 1,000,000 |
| CTR | Multiply by 100 |
| Customer IDs | Digits only, no dashes |
