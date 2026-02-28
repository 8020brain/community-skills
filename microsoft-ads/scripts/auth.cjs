/**
 * Microsoft Ads OAuth Token Exchange
 *
 * Exchanges the refresh token for a fresh access token.
 * IMPORTANT: Microsoft uses rotating refresh tokens — the response includes
 * a new refresh token that MUST be saved (the old one eventually expires).
 *
 * Usage: node auth.cjs
 * Output: JSON with access_token and refresh_token
 */

const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const BRAIN_ROOT = path.resolve(__dirname, '../../../..');

function loadEnv() {
  const envPath = path.join(BRAIN_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env not found at ${envPath}`);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

function updateEnvRefreshToken(newToken) {
  const envPath = path.join(BRAIN_ROOT, '.env');
  let content = fs.readFileSync(envPath, 'utf8');
  if (content.includes('MICROSOFT_ADS_REFRESH_TOKEN=')) {
    content = content.replace(
      /MICROSOFT_ADS_REFRESH_TOKEN=.*/,
      `MICROSOFT_ADS_REFRESH_TOKEN=${newToken}`
    );
  } else {
    content += `\nMICROSOFT_ADS_REFRESH_TOKEN=${newToken}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const env = loadEnv();

  const required = [
    'MICROSOFT_ADS_CLIENT_ID',
    'MICROSOFT_ADS_CLIENT_SECRET',
    'MICROSOFT_ADS_REFRESH_TOKEN',
  ];
  for (const key of required) {
    if (!env[key]) {
      console.error(`Missing ${key} in .env`);
      process.exit(1);
    }
  }

  const body = querystring.stringify({
    client_id: env.MICROSOFT_ADS_CLIENT_ID,
    client_secret: env.MICROSOFT_ADS_CLIENT_SECRET,
    scope: 'https://ads.microsoft.com/msads.manage offline_access',
    grant_type: 'refresh_token',
    refresh_token: env.MICROSOFT_ADS_REFRESH_TOKEN,
  });

  const resp = await httpPost(
    'login.microsoftonline.com',
    '/common/oauth2/v2.0/token',
    body
  );

  const parsed = JSON.parse(resp);

  if (parsed.error) {
    console.error('Token exchange failed:', parsed.error, parsed.error_description);
    process.exit(1);
  }

  // Persist the rotated refresh token
  if (parsed.refresh_token) {
    updateEnvRefreshToken(parsed.refresh_token);
  }

  // Output the tokens as JSON
  console.log(JSON.stringify({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
    expires_in: parsed.expires_in,
  }, null, 2));
}

main().catch((err) => {
  console.error('Auth error:', err.message);
  process.exit(1);
});
