const http = require('http');
const https = require('https');
const querystring = require('querystring');
const { URL } = require('url');

// ============ FILL THESE IN ============
const CLIENT_ID = 'YOUR_APPLICATION_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_VALUE';
// ========================================

const REDIRECT_URI = 'http://localhost:3847/callback';
const SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';

const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
  `client_id=${CLIENT_ID}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&prompt=select_account`;

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3847');

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      res.end('Error: No authorization code received.');
      server.close();
      return;
    }

    const tokenBody = querystring.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
    });

    try {
      const tokenResp = await httpPost('login.microsoftonline.com', '/common/oauth2/v2.0/token', tokenBody, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenBody),
      });

      const parsed = JSON.parse(tokenResp);
      if (parsed.error) {
        console.error('Token error:', parsed.error, parsed.error_description);
        res.end('Error getting token. Check terminal.');
      } else {
        console.log('\n=== SUCCESS ===');
        console.log('REFRESH_TOKEN=' + parsed.refresh_token);
        console.log('\nSave this refresh token in your .env file.');
        res.end('Success! You can close this tab.');
      }
    } catch (e) {
      console.error('Error:', e);
      res.end('Error. Check terminal.');
    }

    server.close();
  }
});

server.listen(3847, () => {
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for OAuth callback...');
});
