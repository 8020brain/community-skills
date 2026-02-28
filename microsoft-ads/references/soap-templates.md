# Microsoft Ads SOAP Templates

Common SOAP request bodies for use with `query.cjs`.

## Customer Management

### GetUser
```xml
<GetUserRequest xmlns="https://bingads.microsoft.com/Customer/v13">
  <UserId xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/>
</GetUserRequest>
```

### SearchAccounts
```xml
<SearchAccountsRequest xmlns="https://bingads.microsoft.com/Customer/v13">
  <Predicates>
    <Predicate>
      <Field>UserId</Field>
      <Operator>Equals</Operator>
      <Value>{USER_ID}</Value>
    </Predicate>
  </Predicates>
  <Ordering xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/>
  <PageInfo>
    <Index>0</Index>
    <Size>100</Size>
  </PageInfo>
</SearchAccountsRequest>
```

## Campaign Management

### GetCampaignsByAccountId
```xml
<GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
  <AccountId>{ACCOUNT_ID}</AccountId>
  <CampaignType>Search Shopping Audience Performance</CampaignType>
  <ReturnAdditionalFields>BiddingScheme</ReturnAdditionalFields>
</GetCampaignsByAccountIdRequest>
```

### GetConversionGoalsByIds (all goals)
```xml
<GetConversionGoalsByIdsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
  <ConversionGoalIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/>
  <ConversionGoalTypes>Url Duration Pages Event AppInstall OfflineConversion InStoreTransaction</ConversionGoalTypes>
  <ReturnAdditionalFields>ViewThroughConversionWindowInMinutes InStoreTransactionAmount</ReturnAdditionalFields>
</GetConversionGoalsByIdsRequest>
```

### GetUetTagsByIds (all tags)
```xml
<GetUetTagsByIdsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
  <TagIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays" xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/>
</GetUetTagsByIdsRequest>
```

## Reporting

### Campaign Performance Report (Summary)
```xml
<SubmitGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
  <ReportRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="CampaignPerformanceReportRequest">
    <ExcludeColumnHeaders>false</ExcludeColumnHeaders>
    <ExcludeReportFooter>true</ExcludeReportFooter>
    <ExcludeReportHeader>true</ExcludeReportHeader>
    <Format>Csv</Format>
    <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
    <Aggregation>Summary</Aggregation>
    <Columns>
      <Column>AccountName</Column>
      <Column>CampaignName</Column>
      <Column>CampaignId</Column>
      <Column>Impressions</Column>
      <Column>Clicks</Column>
      <Column>Ctr</Column>
      <Column>Spend</Column>
      <Column>Conversions</Column>
      <Column>Revenue</Column>
      <Column>CostPerConversion</Column>
    </Columns>
    <Scope>
      <AccountIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
        <a:long>{ACCOUNT_ID}</a:long>
      </AccountIds>
    </Scope>
    <Time>
      <PredefinedTime>Last30Days</PredefinedTime>
    </Time>
  </ReportRequest>
</SubmitGenerateReportRequest>
```

### Search Query Performance Report
```xml
<SubmitGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
  <ReportRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="SearchQueryPerformanceReportRequest">
    <ExcludeColumnHeaders>false</ExcludeColumnHeaders>
    <ExcludeReportFooter>true</ExcludeReportFooter>
    <ExcludeReportHeader>true</ExcludeReportHeader>
    <Format>Csv</Format>
    <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
    <Aggregation>Summary</Aggregation>
    <Columns>
      <Column>AccountName</Column>
      <Column>CampaignName</Column>
      <Column>AdGroupName</Column>
      <Column>SearchQuery</Column>
      <Column>Impressions</Column>
      <Column>Clicks</Column>
      <Column>Ctr</Column>
      <Column>Spend</Column>
      <Column>Conversions</Column>
      <Column>Revenue</Column>
    </Columns>
    <Scope>
      <AccountIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
        <a:long>{ACCOUNT_ID}</a:long>
      </AccountIds>
    </Scope>
    <Time>
      <PredefinedTime>Last30Days</PredefinedTime>
    </Time>
  </ReportRequest>
</SubmitGenerateReportRequest>
```

### Poll Report Status
```xml
<PollGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
  <ReportRequestId>{REQUEST_ID}</ReportRequestId>
</PollGenerateReportRequest>
```
