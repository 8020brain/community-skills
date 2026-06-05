#!/usr/bin/env python3
"""
WordPress PHP Security Scanner
Scans a WordPress theme directory for common PHP security issues.
Usage: python scan_php_files.py <theme-path>
"""

import os
import re
import sys
from pathlib import Path


PATTERNS = [
    # SQL Injection
    {
        "id": "SQL_INJECTION",
        "severity": "High",
        "pattern": r"\$wpdb->(query|get_results|get_row|get_var)\s*\(\s*[\"'].*\$_(GET|POST|REQUEST|COOKIE)",
        "description": "Possible SQL injection: user input interpolated directly into wpdb query.",
        "fix": "Use $wpdb->prepare() with placeholders instead of interpolating $_GET/$_POST directly.",
    },
    # XSS - echoing superglobals
    {
        "id": "XSS_ECHO",
        "severity": "High",
        "pattern": r"echo\s+\$_(GET|POST|REQUEST|COOKIE|SERVER)\[",
        "description": "Unescaped output of user-controlled data.",
        "fix": "Wrap output in esc_html(), esc_attr(), or esc_url() as appropriate.",
    },
    # XSS - print superglobals
    {
        "id": "XSS_PRINT",
        "severity": "High",
        "pattern": r"print\s+\$_(GET|POST|REQUEST|COOKIE)\[",
        "description": "Unescaped output of user-controlled data via print.",
        "fix": "Wrap output in esc_html() or esc_attr().",
    },
    # CSRF - POST handlers without nonce check
    {
        "id": "CSRF_NO_NONCE",
        "severity": "High",
        "pattern": r"\$_(POST|REQUEST)\[.+\](?!.*wp_verify_nonce)",
        "description": "POST data processed without nonce verification detected nearby.",
        "fix": "Add wp_verify_nonce() check before processing POST data.",
    },
    # Dangerous functions
    {
        "id": "DANGEROUS_EVAL",
        "severity": "Critical",
        "pattern": r"\beval\s*\(",
        "description": "eval() found. Executes arbitrary code.",
        "fix": "Remove eval(). Rewrite the logic without dynamic code execution.",
    },
    {
        "id": "DANGEROUS_EXEC",
        "severity": "Critical",
        "pattern": r"\b(exec|system|shell_exec|passthru|popen)\s*\(",
        "description": "Shell execution function found.",
        "fix": "Remove shell execution. If needed, use escapeshellarg() and restrict strictly.",
    },
    # Deserialization
    {
        "id": "UNSERIALIZE",
        "severity": "Critical",
        "pattern": r"\bunserialize\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)",
        "description": "Deserializing user-controlled input. Can lead to object injection.",
        "fix": "Never unserialize user input. Use JSON instead.",
    },
    # File inclusion with user input
    {
        "id": "FILE_INCLUSION",
        "severity": "Critical",
        "pattern": r"\b(include|require|include_once|require_once)\s*\(?\s*\$_(GET|POST|REQUEST)",
        "description": "File inclusion with user-controlled path.",
        "fix": "Never pass user input to include/require. Use a whitelist of allowed files.",
    },
    # Missing ABSPATH guard
    {
        "id": "NO_ABSPATH",
        "severity": "Medium",
        "pattern": r"^<\?php(?![\s\S]*defined\s*\(\s*['\"]ABSPATH['\"])",
        "description": "PHP file lacks ABSPATH guard at the top.",
        "fix": "Add: if ( ! defined( 'ABSPATH' ) ) exit; after the opening <?php tag.",
        "multiline": True,
        "check_start": True,
    },
    # Hardcoded credentials
    {
        "id": "HARDCODED_CREDS",
        "severity": "Critical",
        "pattern": r"(password|passwd|secret|api_key|apikey|access_token)\s*=\s*['\"][^'\"]{4,}['\"]",
        "description": "Possible hardcoded credential.",
        "fix": "Move credentials to wp-config.php constants or environment variables.",
    },
    # base64_decode on user input
    {
        "id": "BASE64_USER_INPUT",
        "severity": "High",
        "pattern": r"base64_decode\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)",
        "description": "base64_decode() on user-controlled input. Common obfuscation vector.",
        "fix": "Validate and sanitize input before any decoding operation.",
    },
    # Textarea saved with sanitize_text_field instead of wp_kses_post
    {
        "id": "TEXTAREA_SANITIZE",
        "severity": "Medium",
        "pattern": r"sanitize_text_field\s*\(\s*\$_(POST|REQUEST)\[",
        "description": "sanitize_text_field() strips HTML but may be wrong for textarea/rich text fields.",
        "fix": "Use wp_kses_post() for fields that accept HTML content.",
    },
]


def scan_file(filepath):
    findings = []
    try:
        content = Path(filepath).read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings

    lines = content.splitlines()

    for pattern_def in PATTERNS:
        flags = re.IGNORECASE
        if pattern_def.get("multiline"):
            flags |= re.DOTALL
            matches = list(re.finditer(pattern_def["pattern"], content, flags))
            for match in matches:
                line_num = content[: match.start()].count("\n") + 1
                findings.append(
                    {
                        "file": str(filepath),
                        "line": line_num,
                        "severity": pattern_def["severity"],
                        "id": pattern_def["id"],
                        "description": pattern_def["description"],
                        "fix": pattern_def["fix"],
                        "snippet": lines[line_num - 1].strip() if line_num <= len(lines) else "",
                    }
                )
        else:
            for i, line in enumerate(lines, 1):
                if re.search(pattern_def["pattern"], line, flags):
                    findings.append(
                        {
                            "file": str(filepath),
                            "line": i,
                            "severity": pattern_def["severity"],
                            "id": pattern_def["id"],
                            "description": pattern_def["description"],
                            "fix": pattern_def["fix"],
                            "snippet": line.strip(),
                        }
                    )

    return findings


def scan_directory(theme_path):
    all_findings = []
    php_files = list(Path(theme_path).rglob("*.php"))

    if not php_files:
        print(f"No PHP files found in: {theme_path}")
        return all_findings

    for php_file in php_files:
        findings = scan_file(php_file)
        all_findings.extend(findings)

    return all_findings


def severity_order(s):
    return {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}.get(s, 4)


def print_report(findings, theme_path):
    counts = {"Critical": 0, "High": 0, "Medium": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    print(f"\n# PHP Security Scan: {theme_path}")
    print(f"Files scanned: {len(list(Path(theme_path).rglob('*.php')))}\n")
    print("## Summary")
    print(f"| Severity | Count |")
    print(f"|----------|-------|")
    for sev in ["Critical", "High", "Medium"]:
        print(f"| {sev} | {counts.get(sev, 0)} |")

    if not findings:
        print("\nNo issues found.")
        return

    print("\n## Findings\n")
    sorted_findings = sorted(findings, key=lambda x: severity_order(x["severity"]))

    for f in sorted_findings:
        print(f"### [{f['severity']}] {f['id']}")
        print(f"**File:** {f['file']} (line {f['line']})")
        print(f"**Snippet:** `{f['snippet']}`")
        print(f"**Issue:** {f['description']}")
        print(f"**Fix:** {f['fix']}")
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scan_php_files.py <theme-path>")
        sys.exit(1)

    theme_path = sys.argv[1]
    if not os.path.isdir(theme_path):
        print(f"Error: {theme_path} is not a valid directory.")
        sys.exit(1)

    findings = scan_directory(theme_path)
    print_report(findings, theme_path)
