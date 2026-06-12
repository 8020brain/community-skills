# Manual Testing Guide

Instructions for the checks that need a person interacting with the site (automated tools cannot do them). Two ways to use this file, decided in SKILL.md Step 4b:

- **Walkthrough mode:** guide the person running the audit through each applicable check one at a time. Give the steps for one check, wait for their result, record pass/fail and what they saw, then move to the next. Fold results back into the scores as tested findings.
- **Appendix mode:** include the relevant sections in the audit report as a client-facing appendix, adapting the wording to the client's site. Frame as a follow-up service we can run for them.

Skip any check that does not apply (no chat widget = skip section 2). Total time: roughly 30 minutes.

## 1. Embedded / Third-Party Forms (~10 mins)

Applies to forms inside iframes (GHL/SpringboardCRM, HubSpot, Typeform, Calendly etc.). Third-party widgets remain the site owner's legal responsibility.

**Keyboard access:**
1. Open the form page in Chrome, click the address bar to reset focus
2. Press Tab repeatedly until focus enters the form
3. Confirm every field, date picker, dropdown and the submit button is reachable with Tab, Shift+Tab and arrow keys
4. Failure modes: focus disappears (no visible ring anywhere), or a keyboard trap (focus cannot leave the widget)

**Labels (WCAG 1.3.1, 3.3.2):**
5. Click into each field and type. Placeholder-only labels that vanish on input are a fail
6. Inspect each input: needs a `<label for>` matching its id, or an `aria-label`

**Error handling (WCAG 3.3.1, 3.3.3):**
7. Submit empty. Errors must appear as text (not colour alone), identify the field, and say how to fix it. Focus moving to the first error is best practice

## 2. Chat Widgets and Popups (~5 mins)

1. Load the page, wait for the widget to appear
2. Tab through the page: the widget trigger must receive visible focus eventually
3. Open it with Enter; Tab through all controls (input, send, close)
4. Esc should close it and return focus to the page (WCAG 2.1.2)
5. Auto-appearing popups must never steal focus from what the user is doing (WCAG 3.2.1)

## 3. Screen Reader Pass (~15 mins)

Windows: NVDA, free from nvaccess.org (NVDA key = Insert). Mac: VoiceOver, built in (Cmd+F5, VO key = Ctrl+Option).

With NVDA running on the page:
1. **H** cycles headings: order should be logical, no missing names
2. **K** cycles links: every link announces meaningful text. Fails: "link, graphic" with no name, filenames as names
3. **D** cycles landmarks: expect navigation, main, content info
4. Tab through buttons: each announces a name plus the role "button"
5. Arrow through content near icons: decorative SVGs should be silent (else they need `aria-hidden="true"`); meaningful images should announce a description
6. Insert+F7 lists all links and headings for a final scan
7. Quit: Insert+Q

## What To Do With Your Results

For each check, jot down pass or fail and what you saw. A screenshot helps if something looked wrong.

**If everything passed:** great, your site now meets the accessibility standard on every point that can be checked. Keep your notes with the audit report as a record that the testing was done.

**If something failed:** send your notes to your web developer (or back to us) and describe what happened, for example "I could not reach the Send button on the contact form using the Tab key". Fix the most serious problems first: a form that cannot be filled in by keyboard locks people out completely, while a mislabelled icon is a smaller annoyance.

**After a fix:** repeat just that one check to confirm it now works. There is no need to redo the whole list.

(Note for report use: keep this section in the client's appendix verbatim; it is written for a non-technical reader.)
