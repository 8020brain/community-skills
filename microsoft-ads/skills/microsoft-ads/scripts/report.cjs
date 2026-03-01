/**
 * Microsoft Ads — Report Download Helper
 *
 * Handles the async report workflow: submit, poll, download ZIP, extract CSV.
 *
 * Usage: node report.cjs <account_id> <report_type> [days] [customer_id]
 *
 * Report types: campaign, search-term, keyword, ad-group, ad
 * Days: default 30
 *
 * Output: CSV content to stdout
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');

const BRAIN_ROOT = path.resolve(__dirname, '../../../..');
const SCRATCHPAD = process.env.SCRATCHPAD || '/tmp';

const REPORT_TYPES = {
  'campaign': 'CampaignPerformanceReportRequest',
  'search-term': 'SearchQueryPerformanceReportRequest',
  'keyword': 'KeywordPerformanceReportRequest',
  'ad-group': 'AdGroupPerformanceReportRequest',
  'ad': 'AdPerformanceReportRequest',
};

const REPORT_COLUMNS = {
  'campaign': ['AccountName', 'CampaignName', 'CampaignId', 'Impressions', 'Clicks', 'Ctr', 'Spend', 'Conversions', 'Revenue', 'CostPerConversion'],
  'search-term': ['AccountName', 'CampaignName', 'AdGroupName', 'SearchQuery', 'Impressions', 'Clicks', 'Ctr', 'Spend', 'Conversions', 'Revenue'],
  'keyword': ['AccountName', 'CampaignName', 'AdGroupName', 'Keyword', 'KeywordId', 'Impressions', 'Clicks', 'Ctr', 'Spend', 'Conversions', 'QualityScore'],
  'ad-group': ['AccountName', 'CampaignName', 'AdGroupName', 'AdGroupId', 'Impressions', 'Clicks', 'Ctr', 'Spend', 'Conversions', 'Revenue'],
  'ad': ['AccountName', 'CampaignName', 'AdGroupName', 'AdTitle', 'Impressions', 'Clicks', 'Ctr', 'Spend', 'Conversions'],
};

function loadEnv() {
  const envPath = path.join(BRAIN_ROOT, '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

function formatDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function soapRequest(host, soapPath, ns, devToken, accessToken, body, customerId, accountId) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:DeveloperToken xmlns:h="${ns}">${devToken}</h:DeveloperToken>
    <h:AuthenticationToken xmlns:h="${ns}">${accessToken}</h:AuthenticationToken>
    <h:CustomerId xmlns:h="${ns}">${customerId}</h:CustomerId>
    <h:CustomerAccountId xmlns:h="${ns}">${accountId}</h:CustomerAccountId>
  </s:Header>
  <s:Body>
    ${body}
  </s:Body>
</s:Envelope>`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      path: soapPath,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '',
        'Content-Length': Buffer.byteLength(envelope),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(envelope);
    req.end();
  });
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function downloadFile(url, accessToken, outputPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proto = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'AuthenticationToken': accessToken,
      },
    };
    const req = proto.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, accessToken, outputPath).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(outputPath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [,, accountId, reportType, daysStr, customerIdArg] = process.argv;

  if (!accountId || !reportType) {
    console.error('Usage: node report.cjs <account_id> <report_type> [days] [customer_id]');
    console.error('Report types:', Object.keys(REPORT_TYPES).join(', '));
    process.exit(1);
  }

  if (!REPORT_TYPES[reportType]) {
    console.error(`Unknown report type: ${reportType}`);
    console.error('Valid types:', Object.keys(REPORT_TYPES).join(', '));
    process.exit(1);
  }

  const days = parseInt(daysStr) || 30;
  const startDate = formatDate(days);
  const endDate = formatDate(1); // yesterday

  // Get fresh access token
  const authOutput = execSync(`node ${path.join(__dirname, 'auth.cjs')}`, { encoding: 'utf8' });
  const { access_token } = JSON.parse(authOutput);

  const env = loadEnv();
  const devToken = env.MICROSOFT_ADS_DEVELOPER_TOKEN;
  const customerId = customerIdArg || env.MSADS_CUSTOMER_ID;

  if (!customerId) {
    console.error('Customer ID required. Pass as 4th arg or set MSADS_CUSTOMER_ID in .env');
    process.exit(1);
  }

  const NS = 'https://bingads.microsoft.com/Reporting/v13';
  const HOST = 'reporting.api.bingads.microsoft.com';
  const PATH = '/Api/Advertiser/Reporting/v13/ReportingService.svc';

  const columns = REPORT_COLUMNS[reportType]
    .map(c => `<Column>${c}</Column>`)
    .join('\n          ');

  // Step 1: Submit report
  console.error(`Submitting ${reportType} report for account ${accountId} (${days} days)...`);

  const submitBody = `<SubmitGenerateReportRequest xmlns="${NS}">
    <ReportRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="${REPORT_TYPES[reportType]}">
      <ExcludeColumnHeaders>false</ExcludeColumnHeaders>
      <ExcludeReportFooter>true</ExcludeReportFooter>
      <ExcludeReportHeader>true</ExcludeReportHeader>
      <Format>Csv</Format>
      <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
      <Aggregation>Summary</Aggregation>
      <Columns>
        ${columns}
      </Columns>
      <Scope>
        <AccountIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
          <a:long>${accountId}</a:long>
        </AccountIds>
      </Scope>
      <Time>
        <CustomDateRangeStart>
          <Day>${new Date(startDate).getDate()}</Day>
          <Month>${new Date(startDate).getMonth() + 1}</Month>
          <Year>${new Date(startDate).getFullYear()}</Year>
        </CustomDateRangeStart>
        <CustomDateRangeEnd>
          <Day>${new Date(endDate).getDate()}</Day>
          <Month>${new Date(endDate).getMonth() + 1}</Month>
          <Year>${new Date(endDate).getFullYear()}</Year>
        </CustomDateRangeEnd>
      </Time>
    </ReportRequest>
  </SubmitGenerateReportRequest>`;

  const submitResp = await soapRequest(HOST, PATH, NS, devToken, access_token, submitBody, customerId, accountId);
  const requestId = extractTag(submitResp.body, 'ReportRequestId');

  if (!requestId) {
    console.error('Failed to submit report:');
    console.error(submitResp.body);
    process.exit(1);
  }

  console.error(`Report submitted. Request ID: ${requestId}`);

  // Step 2: Poll for completion
  let downloadUrl = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(2000);

    const pollBody = `<PollGenerateReportRequest xmlns="${NS}">
      <ReportRequestId>${requestId}</ReportRequestId>
    </PollGenerateReportRequest>`;

    const pollResp = await soapRequest(HOST, PATH, NS, devToken, access_token, pollBody, customerId, accountId);
    const status = extractTag(pollResp.body, 'Status');

    if (status === 'Success') {
      downloadUrl = extractTag(pollResp.body, 'ReportDownloadUrl');
      break;
    } else if (status === 'Error') {
      console.error('Report failed:', pollResp.body);
      process.exit(1);
    }
    // Pending — keep polling
    if (attempt % 5 === 0) console.error(`Still waiting... (${attempt * 2}s)`);
  }

  if (!downloadUrl) {
    console.error('Report timed out after 120s');
    process.exit(1);
  }

  // Step 3: Download ZIP
  console.error('Downloading report...');
  const zipPath = path.join(SCRATCHPAD, `msads-report-${Date.now()}.zip`);
  const csvDir = path.join(SCRATCHPAD, `msads-report-${Date.now()}`);

  await downloadFile(downloadUrl, access_token, zipPath);

  // Step 4: Extract CSV
  execSync(`mkdir -p "${csvDir}" && unzip -o "${zipPath}" -d "${csvDir}"`, { stdio: 'pipe' });

  // Find and output CSV
  const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    console.error('No CSV found in report download');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(path.join(csvDir, files[0]), 'utf8');
  console.log(csvContent);

  // Cleanup
  fs.unlinkSync(zipPath);
  fs.rmSync(csvDir, { recursive: true, force: true });

  console.error('Done.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
