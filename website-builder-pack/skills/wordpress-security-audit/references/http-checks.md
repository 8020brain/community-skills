# HTTP-Exposed File Checks

Return 403/404 or flag severity:

| Path | Severity |
|------|----------|
| wp-config.php | Critical |
| .env | Critical |
| .git/config | High |
| .git/HEAD | High |
| wp-content/debug.log | High |
| wp-content/updraft/*.log | High |
| readme.html | Medium |
| license.txt | Low |
| xmlrpc.php | Medium |

## User Enumeration

GET /?author=1 redirects to /author/[username]/ -> Medium
GET /wp-json/wp/v2/users returns usernames -> Medium