/**
 * Microsoft Ads — List All Accessible Accounts
 *
 * Calls GetUser then SearchAccounts to discover all customer/account IDs.
 * Requires a valid access token (run auth.cjs first).
 *
 * Usage: node get-accounts.cjs
 */

const https = require('https');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BRAIN_ROOT = path.resolve(__dirname, '../../../..');

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

function soapRequest(host, soapPath, namespace, devToken, accessToken, body, customerId, accountId) {
  const customerHeader = customerId
    ? `<h:CustomerId xmlns:h="${namespace}">${customerId}</h:CustomerId>`
    : '';
  const accountHeader = accountId
    ? `<h:CustomerAccountId xmlns:h="${namespace}">${accountId}</h:CustomerAccountId>`
    : '';

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:DeveloperToken xmlns:h="${namespace}">${devToken}</h:DeveloperToken>
    <h:AuthenticationToken xmlns:h="${namespace}">${accessToken}</h:AuthenticationToken>
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
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(envelope);
    req.end();
  });
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g');
  const matches = [];
  let m;
  while ((m = re.exec(xml)) !== null) matches.push(m[1]);
  return matches;
}

async function main() {
  // Get fresh access token
  const authOutput = execSync(`node ${path.join(__dirname, 'auth.cjs')}`, { encoding: 'utf8' });
  const { access_token } = JSON.parse(authOutput);

  const env = loadEnv();
  const devToken = env.MICROSOFT_ADS_DEVELOPER_TOKEN;

  if (!devToken) {
    console.error('Missing MICROSOFT_ADS_DEVELOPER_TOKEN in .env');
    process.exit(1);
  }

  const NS = 'https://bingads.microsoft.com/Customer/v13';
  const HOST = 'clientcenter.api.bingads.microsoft.com';
  const PATH = '/Api/CustomerManagement/v13/CustomerManagementService.svc';

  // Step 1: GetUser
  console.log('Getting user info...');
  const getUserBody = `<GetUserRequest xmlns="${NS}"><UserId xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/></GetUserRequest>`;
  const userResp = await soapRequest(HOST, PATH, NS, devToken, access_token, getUserBody);

  const userIds = extractTag(userResp, 'Id');
  const userNames = extractTag(userResp, 'UserName');
  if (userIds.length > 0) {
    console.log(`User ID: ${userIds[0]}, Username: ${userNames[0] || 'N/A'}`);
  }

  // Step 2: SearchAccounts
  console.log('\nSearching for accounts...');
  const searchBody = `<SearchAccountsRequest xmlns="${NS}">
    <Predicates>
      <Predicate>
        <Field>UserId</Field>
        <Operator>Equals</Operator>
        <Value>${userIds[0]}</Value>
      </Predicate>
    </Predicates>
    <Ordering xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:nil="true"/>
    <PageInfo>
      <Index>0</Index>
      <Size>100</Size>
    </PageInfo>
  </SearchAccountsRequest>`;

  const accountsResp = await soapRequest(HOST, PATH, NS, devToken, access_token, searchBody);

  const accountIds = extractTag(accountsResp, 'Id');
  const accountNames = extractTag(accountsResp, 'Name');
  const accountNumbers = extractTag(accountsResp, 'Number');
  const customerIds = extractTag(accountsResp, 'ParentCustomerId');

  console.log(`\nFound ${accountNames.length} account(s):\n`);
  for (let i = 0; i < accountNames.length; i++) {
    console.log(`  ${accountNames[i]}`);
    console.log(`    Account ID: ${accountIds[i]}`);
    console.log(`    Account Number: ${accountNumbers[i] || 'N/A'}`);
    console.log(`    Customer ID: ${customerIds[i] || 'N/A'}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
