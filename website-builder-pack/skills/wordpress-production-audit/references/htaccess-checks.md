# .htaccess Checks

## Git Block

Root-only: RewriteRule ^\.git - [F,L] -> High (misses theme subdirectories)
Correct:   RewriteRule (^|/)\.git(/|$) - [F,L]

## xmlrpc.php -> Medium if not blocked

## UpdraftPlus Logs

wp-content/updraft/ not blocked -> High
Logs expose WP version, PHP version, MySQL version, server OS.

## Content Security Policy

No CSP header -> High
Site typically loads: Google Tag Manager, Leaflet (unpkg.com), Google Fonts.
Without CSP, a compromised CDN can inject arbitrary scripts.

## Security Headers -> Medium each if missing

X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
Referrer-Policy, Permissions-Policy

## Uploads PHP Execution

No wp-content/uploads/.htaccess -> High
Required content:
  <FilesMatch ".(php|php\d*|phtml|phar)$">
    Require all denied
  </FilesMatch>

## nginx Note

.htaccess is ignored on GHL, WP Engine, Kinsta, Cloudways nginx hosts.
Recommend Wordfence or 'Headers Security Advanced & HSTS WP' plugin for headers.