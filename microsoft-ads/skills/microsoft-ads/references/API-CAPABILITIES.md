# Microsoft Ads API - Full Capabilities & Recommendations

## API Overview

200+ service operations across 4 services: Campaign Management, Customer Management, Reporting, and Bulk.

---

## Campaign Management (CRUD on Everything)

- Campaigns, Ad Groups, Ads, Keywords
- Responsive Search Ads, Dynamic Search Ads, Shopping/Product Ads
- Performance Max (asset groups, listing groups, audience groups)
- Ad Extensions (sitelinks, callouts, structured snippets, call extensions)
- Negative keywords & shared lists
- Budgets & bid strategies
- Labels for organization
- Experiments (A/B testing)
- Google Ads Import (programmatic via AddImportJobs)

## Audiences & Targeting

- Custom audiences, remarketing lists, in-market audiences
- LinkedIn segments (unique to Microsoft)
- Age/gender targeting
- Geographic/location targeting
- Device targeting
- Professional demographics (company, industry, job function)

## Conversion Tracking

- UET tags (create, update, list)
- Conversion goals (all types - URL, event, duration, pages viewed)
- Offline conversion uploads (ApplyOfflineConversions)
- Online conversion adjustments
- Conversion value rules
- New customer acquisition goals
- Campaign-level conversion goal assignments

## Reporting (35+ Report Types)

### Performance Reports
- AccountPerformanceReportRequest
- CampaignPerformanceReportRequest
- AdGroupPerformanceReportRequest
- KeywordPerformanceReportRequest
- AdPerformanceReportRequest
- AssetGroupPerformanceReportRequest
- AssetPerformanceReportRequest
- AudiencePerformanceReportRequest
- ConversionPerformanceReportRequest
- DestinationUrlPerformanceReportRequest
- GoalsAndFunnelsReportRequest
- ShareOfVoiceReportRequest

### Search & Query Reports
- SearchQueryPerformanceReportRequest
- ProductSearchQueryPerformanceReportRequest
- DSASearchQueryPerformanceReportRequest

### Targeting Reports
- AgeGenderAudienceReportRequest
- GeographicPerformanceReportRequest
- UserLocationPerformanceReportRequest
- ProfessionalDemographicsAudienceReportRequest (unique to Microsoft - company, industry, job function)
- NegativeKeywordConflictReportRequest

### Ad Extension Reports
- AdExtensionByAdReportRequest
- AdExtensionByKeywordReportRequest
- AdExtensionDetailReportRequest
- CallDetailReportRequest

### Shopping/Product Reports
- ProductDimensionPerformanceReportRequest
- ProductMatchCountReportRequest
- ProductPartitionPerformanceReportRequest
- ProductPartitionUnitPerformanceReportRequest

### DSA Reports
- DSAAutoTargetPerformanceReportRequest
- DSACategoryPerformanceReportRequest

### Other Reports
- BudgetSummaryReportRequest
- SearchCampaignChangeHistoryReportRequest
- PublisherUsagePerformanceReportRequest
- AdDynamicTextPerformanceReportRequest

### Report Aggregation Levels
- Hourly, Daily, DayOfWeek, HourOfDay, Weekly, Monthly, Yearly, Summary

### Report Formats
- CSV (default), TSV, XML

### Report Workflow
1. SubmitGenerateReport - submit request, get ReportRequestId
2. PollGenerateReport - poll until Status is "Success"
3. Download ZIP from ReportDownloadUrl (SAS-signed URL, no auth header needed)
4. Extract CSV from ZIP

## Bulk Operations

- Download entire accounts as CSV (up to 4M rows, 100MB)
- Bulk upload changes
- Delta downloads (only what changed since last download)
- DownloadCampaignsByAccountIds / DownloadCampaignsByCampaignIds

## Advanced Features

- Seasonality adjustments (AddSeasonalityAdjustments)
- Data exclusions (AddDataExclusions)
- Brand kits
- Generative AI recommendations (RSA, responsive ad, brand kit creation)
- Editorial review & appeals
- Google Ads Import automation

---

## Recommended Use Cases for Agencies

### Tier 1 - High Value, Build Now

1. **Automated Performance Reporting** - Pull campaign/keyword/search term reports across all client accounts. Weekly or monthly client reports with zero manual work.

2. **Search Term Mining** - SearchQueryPerformanceReportRequest gives actual search queries. Find new keywords and negatives automatically.

3. **Conversion Goal Auditing** - Programmatically check all accounts have correct conversion goals, correct bidding settings, correct attribution. One script, all accounts.

4. **Cross-Account Health Checks** - Loop through all client accounts and flag: campaigns with no conversions, high spend/low ROAS, budget-limited campaigns, impression share drops.

### Tier 2 - Medium Value, Build When Needed

5. **Negative Keyword Management** - Bulk add/remove negative keywords across accounts and shared lists.

6. **Google Ads Import Automation** - AddImportJobs to programmatically trigger Google Ads imports on schedule.

7. **Geographic Performance Analysis** - GeographicPerformanceReportRequest shows which cities/regions perform. Great for lead gen clients targeting specific areas.

8. **Professional Demographics Reports** - Unique to Microsoft - performance by company name, industry, and job function. Gold for enterprise/B2B clients.

### Tier 3 - Nice to Have

9. **Change History Auditing** - SearchCampaignChangeHistoryReportRequest tells who changed what and when.

10. **Budget Pacing** - BudgetSummaryReportRequest tracks monthly budget pacing. Alert on underspend/overspend.

11. **Bulk Account Setup** - Script entire new client setup: campaigns, ad groups, ads, extensions, conversion goals, audiences.

12. **A/B Testing via Experiments** - AddExperiments for programmatic campaign experiments.

---

## Key Data Points

- Cost values are in micros (divide by 1,000,000)
- CTR values are decimals (multiply by 100 for percentage)
- Customer IDs are digits only, no dashes
- Reports use FormatVersion "2.0" for clean number formatting
- Clicks take up to 2 hours to process
- Conversions take up to 3 hours to process
- Impression share columns are mutually exclusive with certain attribute columns (DeviceOS, Goal, GoalType, TopVsOther, BidMatchType)

## Reference Links

- Campaign Management Operations: https://learn.microsoft.com/en-us/advertising/campaign-management-service/campaign-management-service-operations?view=bingads-13
- Report Types: https://learn.microsoft.com/en-us/advertising/guides/report-types?view=bingads-13
- Campaign Management Guides: https://learn.microsoft.com/en-us/advertising/guides/campaign-management-guides?view=bingads-13
- Reporting Overview: https://learn.microsoft.com/en-us/advertising/guides/reports?view=bingads-13
- Bulk Service: https://learn.microsoft.com/en-us/advertising/bulk-service/bulk-service-reference?view=bingads-13
- API Release Notes: https://learn.microsoft.com/en-us/advertising/guides/release-notes?view=bingads-13
