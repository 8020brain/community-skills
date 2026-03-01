/**
 * Microsoft Ads — Generic SOAP Query
 *
 * Sends a SOAP request to any Microsoft Ads API service.
 *
 * Usage: node query.cjs <service> <soapAction> [bodyFile]
 *   service: customer | campaign | reporting
 *   soapAction: The SOAP action (e.g., GetCampaignsByAccountId)
 *   bodyFile: Path to XML file with the <s:Body> contents (optional, reads stdin if omitted)
 *
 * Environment: Requires MICROSOFT_ADS_DEVELOPER_TOKEN in .env
 *              Calls auth.cjs for fresh access token
 *
 * Also reads MSADS_CUSTOMER_ID and MSADS_ACCOUNT_ID from env for convenience.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BRAIN_ROOT = path.resolve(__dirname, '../../../..');

const SERVICES = {
  customer: {
    host: 'clientcenter.api.bingads.microsoft.com',
    path: '/Api/CustomerManagement/v13/CustomerManagementService.svc',
    ns: 'https://bingads.microsoft.com/Customer/v13',
  },
  campaign: {
    host: 'campaign.api.bingads.microsoft.com',
    path: '/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
    ns: 'https://bingads.microsoft.com/CampaignManagement/v13',
  },
  reporting: {
    host: 'reporting.api.bingads.microsoft.com',
    path: '/Api/Advertiser/Reporting/v13/ReportingService.svc',
    ns: 'https://bingads.microsoft.com/Reporting/v13',
  },
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

function soapRequest(host, soapPath, ns, devToken, accessToken, body, customerId, accountId) {
  const customerHeader = customerId
    ? `<h:CustomerId xmlns:h="${ns}">${customerId}</h:CustomerId>`
    : '';
  const accountHeader = accountId
    ? `<h:CustomerAccountId xmlns:h="${ns}">${accountId}</h:CustomerAccountId>`
    : '';

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:DeveloperToken xmlns:h="${ns}">${devToken}</h:DeveloperToken>
    <h:AuthenticationToken xmlns:h="${ns}">${accessToken}</h:AuthenticationToken>
    ${customerHeader}
    ${accountHeader}
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

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => {
      if (!data) resolve('');
    }, 100);
  });
}

async function main() {
  const [,, service, soapAction, bodyFile] = process.argv;

  if (!service || !SERVICES[service]) {
    console.error('Usage: node query.cjs <customer|campaign|reporting> <soapAction> [bodyFile]');
    console.error('Services: customer, campaign, reporting');
    process.exit(1);
  }

  const svc = SERVICES[service];

  // Get body content
  let body;
  if (bodyFile) {
    body = fs.readFileSync(bodyFile, 'utf8');
  } else if (!process.stdin.isTTY) {
    body = await readStdin();
  } else {
    console.error('Provide body XML via file argument or stdin');
    process.exit(1);
  }

  // Get fresh access token
  const authOutput = execSync(`node ${path.join(__dirname, 'auth.cjs')}`, { encoding: 'utf8' });
  const { access_token } = JSON.parse(authOutput);

  const env = loadEnv();
  const devToken = env.MICROSOFT_ADS_DEVELOPER_TOKEN;
  const customerId = env.MSADS_CUSTOMER_ID || '';
  const accountId = env.MSADS_ACCOUNT_ID || '';

  const result = await soapRequest(
    svc.host, svc.path, svc.ns,
    devToken, access_token, body,
    customerId, accountId
  );

  if (result.status >= 400) {
    console.error(`HTTP ${result.status}`);
  }
  console.log(result.body);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
