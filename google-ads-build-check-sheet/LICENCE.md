# Google Ads Build Check Sheet

Built by **Isadora Benjamin**, shared with the Ads2AI community by **Sandi Walsh**.

## How to use it

Install it with `claude plugin install google-ads-build-check-sheet@a2ai-community`, then
say "build check sheet for [client]" or "ad copy for approval for [client]". Claude asks for
what it needs (logo, brand colour, ad groups, keywords, copy, extras, locations and budget),
checks every line of copy, and builds one page you send the client as a single link.

Open `skills/google-ads-build-check-sheet/examples/harbour-paws/index.html` to see a finished
page for a made-up client. The skill's README lists the changes Sandi made to her own copy, in
case you want to do the same.

## A few things to know

- **It only makes the page.** It never connects to Google Ads and can't change anything in an
  account, so there's no API setup. The build script runs on Node.js.
- **Provided as-is, with no warranty.**

## Credit

Created by Isadora Benjamin and shared by Sandi Walsh. Please keep both credits if you pass it on.
