---
name: wordpress-security-audit
description: "Pre-upload code security scan. Audits JavaScript files, PHP theme files, and theme directory cleanliness before you push to live hosting. Produces a structured report with severity ratings and exact fixes. Runs automatically at Stage 9 of the website-builder build process. For wp-config, .htaccess, exposed files, and server-level checks, use the wordpress-production-audit skill after going live."
triggers:
  - "security audit"
  - "security check"
  - "check my theme for security issues"
  - "scan my theme"
---

# WordPress Security Audit (Pre-Upload)

Scans the theme code before it leaves your computer. This catches dangerous patterns in your PHP and JavaScript before they reach a live server.

For server-level hardening (wp-config, .htaccess, exposed files, headers), use the `wordpress-production-audit` skill after migrating to live hosting.

Work through each step in order. Produce a consolidated report at the end.

## Step 1: JavaScript Scan

Search .js files in assets/ and inline script blocks in PHP templates.

Patterns to look for:
  .innerHTML =        .outerHTML =        document.write(
  .href =             sessionStorage.getItem    localStorage.getItem
  location.search     location.hash

Flag as:
- High: untrusted data into innerHTML/outerHTML/document.write without sanitization
- High: sessionStorage/localStorage data used in href without origin validation
- Medium: URL params reflected to DOM without encoding

## Step 2: PHP Theme Scan

Run: python scripts/scan_php_files.py <theme-path>

See references/php-patterns.md for what it checks. Key issues:
- SQL injection (raw $_GET or $_POST in wpdb queries)
- XSS (echo without esc_html/esc_attr/esc_url)
- CSRF (POST handlers missing wp_verify_nonce)
- Missing capability checks (current_user_can)
- Dangerous functions (eval, exec, system, shell_exec)
- Deserialization of user input (unserialize)
- Missing ABSPATH guard on template files
- Textarea fields using sanitize_text_field instead of wp_kses_post

## Step 3: Theme Directory Cleanliness

Scan theme root and wp-content/ for:
- .sql files -> High
- trash/, backup/, old/ directories -> High
- .log files -> Medium
- .bak, .orig, .save files -> Medium

---

## Report Format

```
# WordPress Security Audit (Pre-Upload)
**Theme:** [name]  **Date:** [today]

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

All Critical and High findings should be resolved before uploading to live hosting.
