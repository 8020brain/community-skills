# PHP Security Patterns

## SQL Injection
High: $wpdb->(query|get_results|get_row) with raw $_GET or $_POST
Safe: wpdb->prepare(), wpdb->insert(), wpdb->update()

## XSS
High: echo $_GET[ / echo $_POST[ / echo $_REQUEST[
All output: esc_html(), esc_attr(), esc_url(), esc_js()
Textarea/rich text: wp_kses_post()

## CSRF
save_post / admin_post_* / wp_ajax_* without wp_verify_nonce() -> High

## Capability Checks
Admin ops without current_user_can() -> High

## Dangerous Functions
Critical: eval(, system(, exec(, shell_exec(, passthru(, popen(
High: base64_decode( on user input

## Deserialization
unserialize( on user-controlled input -> Critical

## File Inclusion
include/require with $_GET or $_POST -> Critical

## ABSPATH Guard
Template files without defined('ABSPATH') || exit; at top -> Medium

## Sanitization
Textarea meta saved with sanitize_text_field() -> Medium
Use wp_kses_post() for any field that accepts HTML