/**
 * Microsoft Ads API helper - REST API v13.
 *
 * Migrated from SOAP 2026-06-10 (SOAP is deprecated 31 Jan 2027, REST-only
 * features from 1 Oct 2026). OAuth flow is unchanged; all API calls are
 * JSON over the v13 REST endpoints.
 *
 * Endpoint pattern: POST https://{host}/{Service}/v13/{Entity}/{Action}
 * Headers: Authorization Bearer, DeveloperToken, CustomerId, CustomerAccountId.
 * Gotcha: flag enums (e.g. CampaignType) are COMMA-separated strings in JSON,
 * not the space-separated form SOAP used, and not arrays.
 */

const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// Load credentials from .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const CLIENT_ID = env.MICROSOFT_ADS_CLIENT_ID;
const CLIENT_SECRET = env.MICROSOFT_ADS_CLIENT_SECRET;
const DEV_TOKEN = env.MICROSOFT_ADS_DEVELOPER_TOKEN;
let REFRESH_TOKEN = env.MICROSOFT_ADS_REFRESH_TOKEN;

function httpPost(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const options = { hostname, path, method: 'POST', headers };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getAccessToken() {
  const tokenBody = querystring.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://ads.microsoft.com/msads.manage offline_access',
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });
  const resp = await httpPost('login.microsoftonline.com', '/common/oauth2/v2.0/token', tokenBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(tokenBody),
  });
  const parsed = JSON.parse(resp);
  if (parsed.error) {
    throw new Error(`Token error: ${parsed.error} - ${parsed.error_description}`);
  }
  // Save rotated refresh token back to .env
  if (parsed.refresh_token && parsed.refresh_token !== REFRESH_TOKEN) {
    const updatedEnv = fs.readFileSync(envPath, 'utf8').replace(
      /MICROSOFT_ADS_REFRESH_TOKEN=.*/,
      'MICROSOFT_ADS_REFRESH_TOKEN=' + parsed.refresh_token
    );
    fs.writeFileSync(envPath, updatedEnv);
    REFRESH_TOKEN = parsed.refresh_token;
  }
  return parsed.access_token;
}

const REST_HOSTS = {
  CustomerManagement: { host: 'clientcenter.api.bingads.microsoft.com', base: '/CustomerManagement/v13/' },
  CampaignManagement: { host: 'campaign.api.bingads.microsoft.com', base: '/CampaignManagement/v13/' },
  Reporting: { host: 'reporting.api.bingads.microsoft.com', base: '/Reporting/v13/' },
};

/**
 * Generic REST call. `operationPath` is the entity/action path, e.g.
 * 'AccountsInfo/Query', 'Campaigns/QueryByAccountId', 'GenerateReport/Submit'.
 * Returns parsed JSON; throws with the API's error payload on failure.
 */
async function restCall(service, operationPath, body, { token, customerId, accountId } = {}) {
  const svc = REST_HOSTS[service];
  if (!svc) throw new Error(`Unknown service: ${service} (use CustomerManagement | CampaignManagement | Reporting)`);
  token = token || await getAccessToken();

  const json = JSON.stringify(body || {});
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Authorization': 'Bearer ' + token,
    'DeveloperToken': DEV_TOKEN,
  };
  if (customerId) headers.CustomerId = String(customerId);
  if (accountId) headers.CustomerAccountId = String(accountId);

  const raw = await new Promise((resolve, reject) => {
    const req = https.request({ hostname: svc.host, path: svc.base + operationPath, method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(json);
    req.end();
  });

  let parsed;
  try { parsed = JSON.parse(raw.data); } catch (e) {
    throw new Error(`${service}/${operationPath} HTTP ${raw.status}: non-JSON response: ${raw.data.slice(0, 300)}`);
  }
  if (raw.status >= 400 || parsed.OperationErrors || parsed.Type === 'ApiFaultDetail' || parsed.Type === 'AdApiFaultDetail') {
    const errs = (parsed.OperationErrors || parsed.Errors || []).map(e => `${e.ErrorCode || e.Code}: ${e.Message}${e.Details ? ' (' + e.Details + ')' : ''}`).join('; ');
    throw new Error(`${service}/${operationPath} failed (HTTP ${raw.status}): ${errs || raw.data.slice(0, 300)}`);
  }
  return parsed;
}

// SOAP transport was removed in the REST migration. Loud failure for any
// script still passing XML (one-off scripts live in archived-soap-scripts/).
function soapCall() {
  throw new Error('soapCall was removed 2026-06-10: Microsoft Ads migrated to REST (SOAP dies 31 Jan 2027). Use restCall(service, operationPath, jsonBody, {customerId, accountId}) instead.');
}
const reportCall = soapCall;
const xmlEscape = (s) => String(s == null ? '' : s); // XML escaping no longer needed under JSON

// Every customer the authenticated user can access (GetCustomersInfo).
async function getCustomers(token) {
  const r = await restCall('CustomerManagement', 'CustomersInfo/Query', { CustomerNameFilter: '', TopN: 100 }, { token });
  return (r.CustomersInfo || []).map(c => ({ id: String(c.Id), name: c.Name }));
}

// The authenticated user (GetUser). Returns the raw {User, CustomerRoles, Roles} object.
async function getUser(token) {
  return restCall('CustomerManagement', 'User/Query', { UserId: null }, { token });
}

// Accounts under a customer. NOTE: returns NOTHING without a CustomerId.
async function getAccounts(token, customerId) {
  const r = await restCall('CustomerManagement', 'AccountsInfo/Query',
    { CustomerId: Number(customerId), OnlyParentAccounts: false }, { token });
  return (r.AccountsInfo || []).map(a => ({
    id: String(a.Id), name: a.Name, number: a.Number,
    status: a.AccountLifeCycleStatus, customerId,
  }));
}

// Resolve an account by its alphanumeric Number (e.g. X1234567) or by name, across all customers.
// Returns {id, name, number, status, customerId} or null.
async function findAccount(query) {
  const token = await getAccessToken();
  const q = String(query).toUpperCase();
  for (const c of await getCustomers(token)) {
    const hit = (await getAccounts(token, c.id)).find(a => (a.number || '').toUpperCase() === q || (a.name || '').toUpperCase().includes(q));
    if (hit) return hit;
  }
  return null;
}

/**
 * Run any report end to end from a full JSON ReportRequest (must include
 * Type, e.g. 'CampaignPerformanceReportRequest'): submit -> poll -> download
 * -> unzip -> CSV string. Use this for report types runReport() doesn't
 * cover (e.g. change-history reports, which have no Aggregation field).
 */
async function runReportRaw(reportRequest, { token, customerId, accountId, pollIntervalMs = 3000, pollMaxAttempts = 60 } = {}) {
  token = token || await getAccessToken();
  const ids = { token, customerId, accountId };

  const sub = await restCall('Reporting', 'GenerateReport/Submit', { ReportRequest: reportRequest }, ids);
  const reqId = sub.ReportRequestId;
  if (!reqId) throw new Error('SubmitGenerateReport returned no ReportRequestId: ' + JSON.stringify(sub).slice(0, 400));

  let url = null;
  for (let i = 0; i < pollMaxAttempts; i++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    const pr = await restCall('Reporting', 'GenerateReport/Poll', { ReportRequestId: reqId }, ids);
    const st = pr.ReportRequestStatus && pr.ReportRequestStatus.Status;
    if (st === 'Success') { url = pr.ReportRequestStatus.ReportDownloadUrl; break; }
    if (st === 'Error') throw new Error('Report generation error: ' + JSON.stringify(pr).slice(0, 400));
  }
  if (url === null) throw new Error('Report timed out');
  if (!url) return ''; // Success with no download URL = no data for the range

  const get = u => new Promise((resolve, reject) => https.get(u, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(get(res.headers.location));
    const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
  }).on('error', reject));
  const buf = await get(url);
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const { execSync } = require('child_process');
    const os = require('os');
    const tmp = path.join(os.tmpdir(), 'msads-report-' + Date.now());
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'r.zip'), buf);
    execSync('unzip -o "' + path.join(tmp, 'r.zip') + '" -d "' + tmp + '"');
    const f = fs.readdirSync(tmp).find(x => x.toLowerCase().endsWith('.csv'));
    return fs.readFileSync(path.join(tmp, f), 'utf8');
  }
  return buf.toString('utf8');
}

// Run a performance report end to end: submit -> poll -> download -> unzip -> CSV string.
// reportType e.g. 'CampaignPerformanceReport' | 'AccountPerformanceReport' | 'KeywordPerformanceReport' | 'SearchQueryPerformanceReport'.
// Pass days (custom range ending yesterday) OR predefinedTime (a VALID enum, e.g. 'LastFourWeeks' - 'LastThirtyDays' is NOT valid).
async function runReport({ token, accountId, customerId, reportType, columns, days = 30, aggregation = 'Summary', predefinedTime = null }) {
  let time;
  if (predefinedTime) {
    time = { PredefinedTime: predefinedTime };
  } else {
    const de = new Date(Date.now() - 86400000);
    const ds = new Date(de.getTime() - (days - 1) * 86400000);
    time = {
      CustomDateRangeStart: { Day: ds.getDate(), Month: ds.getMonth() + 1, Year: ds.getFullYear() },
      CustomDateRangeEnd: { Day: de.getDate(), Month: de.getMonth() + 1, Year: de.getFullYear() },
    };
  }
  const reportRequest = {
    Type: reportType + 'Request',
    ExcludeColumnHeaders: false,
    ExcludeReportFooter: true,
    ExcludeReportHeader: true,
    Format: 'Csv',
    FormatVersion: '2.0',
    ReturnOnlyCompleteData: false,
    Aggregation: aggregation,
    Columns: columns,
    Scope: { AccountIds: [Number(accountId)] },
    Time: time,
  };
  return runReportRaw(reportRequest, { token, customerId, accountId });
}

module.exports = { getAccessToken, restCall, httpPost, getCustomers, getUser, getAccounts, findAccount, runReport, runReportRaw, soapCall, reportCall, xmlEscape };
