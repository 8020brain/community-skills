---
name: wordpress-production-audit
description: "Post-launch server and environment security audit. Checks wp-config.php, .htaccess, security headers, exposed files, and meta security on a live WordPress site. Run this after migrating from Local WP to live hosting. For pre-upload code scanning, use the wordpress-security-audit skill."
triggers:
  - "production audit"
  - "harden WordPress"
  - "is this site secure"
  - "post-launch security"
  - "check my live site"
---

# WordPress Production Audit

Server-level security checks for a live WordPress site. Run this after you have migrated from Local WP to your hosting provider.

For pre-upload code scanning (PHP, JavaScript, theme cleanliness), use the `wordpress-security-audit` skill before migration.

Work through each step in order. Produce a consolidated report at the end.

## Step 1: wp-config.php

Read wp-config.php. Check every item in references/wp-config-checks.md.

Key flags:
- DB_USER = 'root' -> Critical
- DB_PASSWORD weak (root, toor, password, admin, 123456, wordpress) -> Critical
- table_prefix = 'wp_' -> Medium
- WP_DEBUG_DISPLAY not false -> High
- WP_DEBUG_LOG not false -> High
- DISALLOW_FILE_EDIT missing -> Medium
- FORCE_SSL_ADMIN missing -> Medium
- Secret keys not randomized -> Critical

## Step 2: .htaccess

Read root .htaccess. Check references/htaccess-checks.md.

Key flags:
- .git only blocked at root (not subdirectories) -> High
- No xmlrpc.php block -> Medium
- No CSP header -> High
- No security headers -> Medium
- uploads/ has no PHP execution block -> High
- UpdraftPlus directory not blocked -> High
- Options -Indexes missing -> Medium

Note: .htaccess is ignored on nginx hosts (Cloudways, WP Engine, Kinsta, etc.). On those hosts, security headers must be set via plugin or host CDN settings.

## Step 3: Exposed Files Check

See references/http-checks.md. Files that must return 403/404:
wp-config.php, .env, .git/config, readme.html, debug.log,
wp-content/debug.log, wp-content/updraft/*.log

## Step 4: Meta Security

- ?author=1 redirects to a username URL -> Medium
- Admin username is 'admin' -> Medium
- Hardcoded API keys or credentials in PHP -> Critical

---

## Report Format

```
# WordPress Production Audit
**Site:** [name]  **Date:** [today]

## Summary
| Severity | Count |
|----------|-------|
| Critical | N |
| High     | N |
| Medium   | N |

## Findings

### [SEVERITY] Title
**File:** path/to/file (line N)
**Issue:** What it is and why it matters.
**Fix:** Exact change to apply.

## Passing Checks
[List what is already correctly implemented]

## Top 3 Actions
[In priority order]
```

Critical = exploitable now. High = significant risk. Medium = defence-in-depth.
