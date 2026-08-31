# Performance Max Asset Group Creator

Built by **Gabriele Benedetti** and shared free with the Ads2AI community.

## How to use it

Say "create a PMax asset group" from your brain and it walks you through the inputs one step
at a time: account, campaign, name, copy, audience signals, images and videos. It runs as a
dry run and shows you the whole build before writing anything, and the asset group is always
created paused.

**This is a Python skill.** You need Python 3 and the Google Ads client library installed
(`pip install google-ads`, plus `pyyaml` and `pillow`), and a working `google-ads.yaml`. See
the SKILL.md Requirements section.

## A few things to know

- **It writes to a live Google Ads account.** Every run is a dry run until you pass
  `--execute`, and `--execute` makes you retype the customer ID first. Read the dry-run
  summary before you confirm.
- **You run this on your own account**, with your own Google Ads credentials and your own
  Anthropic usage.
- **Provided as-is, with no warranty.** Check the paused asset group in the Google Ads UI
  before you enable it. Google can still reject assets for policy or trademark reasons.

## Credit

Created by Gabriele Benedetti. Shared with the Ads2AI community with his permission. Please
keep Gabriele's credit if you pass it on.
