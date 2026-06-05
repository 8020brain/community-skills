# wp-config.php Checks

## DB Credentials: Always Critical

DB_USER = 'root' -> Critical. No exceptions.
DB_PASSWORD weak (root, toor, password, admin, 123456, wordpress, blank) -> Critical.

Never soften to Info/Low because the environment is local. Local configs get cloned to staging
and staging to production. Root credentials are a Critical risk at every stage.

## Secret Keys

Any key containing 'put your unique phrase here' -> Critical.
All 8 keys must be unique and randomized.

## Debug

WP_DEBUG_DISPLAY = true -> High (leaks errors to visitors)
WP_DEBUG_LOG = true -> High (writes debug.log to webroot)

## Table Prefix

wp_ -> Medium (automated exploit tools target known table names)

## Hardening Constants

DISALLOW_FILE_EDIT missing -> Medium
FORCE_SSL_ADMIN missing -> Medium on live, Low on local
WP_DEBUG_DISPLAY not explicitly false -> Medium
WP_DEBUG_LOG not explicitly false -> Medium