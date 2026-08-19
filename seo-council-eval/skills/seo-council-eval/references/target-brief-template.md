# Target brief template

A one-page substitute for an entity blueprint and a topical map, fillable in about
ten minutes.

## Why this exists

The entity seat carries the heaviest weight on the board, and it scores two very
different things depending on what it is given.

With an assignment, it scores **conformance**: does this page cover the attributes
it was asked to cover, hold its context, and stay off its neighbours' territory.
Without one, it falls back to scoring **inferred coverage**: what the copy, the
target query and the SERP suggest the page probably should have said. That is a
weaker construct, it carries lower confidence, and comparisons across the
substitution are unsafe.

Most of the gap between those two is not the blueprint's size. It is a short list
of facts only the business can supply: what this page is about, which attributes it
owns, who is reading, and what it should link. A blueprint answers those as a
by-product of answering much more. This brief answers just those, deliberately.

**A filled brief moves the entity seat from inference to assignment.** It does not
make the run equivalent to one with a full blueprint, and the report should still
say which it had.

## How to use it

1. Copy the form below into `clients/<slug>/context/<page-label>-target-brief.md`,
   or anywhere the context pack builder will find it.
2. Fill what you know. Leave the rest blank; blanks are handled, guesses are not.
3. Name the file in the context pack so every reader sees it.

**Do not invent an answer to look complete.** A blank field costs some confidence
on one dimension. A wrong field sends seven readers to score against a target the
business does not actually hold, and nothing in the run will catch it.

## The ten-minute minimum

If you fill nothing else, fill these three. They are most of the value.

- **The entity**: what this page is about, named the way it should be named.
- **Attributes this page owns**: five to ten, with values.
- **What this page is not about**: the two or three neighbouring topics it must
  not drift into.

## The form

```markdown
# Target brief: <page label>

**URL or draft path:**
**Target query:**
**Vertical:** ecommerce | lead-gen | local | B2B
**Date:**

## 1. The entity

**Name, written the way it should appear in copy:**
**Type:** (organisation, product, service, place, person, event)
**Disambiguation:** does this name collide with anything else people search for?
If so, what, and how should the copy separate them?

## 2. Attributes this page owns

Five to ten. An attribute is a property a buyer or a machine would want a value
for. Write the value too, or mark it UNKNOWN and it becomes a finding.

| Attribute | Value |
|---|---|
| e.g. price | from $X |
| e.g. turnaround | 3 to 5 working days |
| | |

## 3. Questions this page must answer

What does someone type or ask before they land here, and what do they need
settled before they act? Three to six.

-
-

## 4. Who is reading

Include machine audiences if they matter to you. An answer engine reading for a
citable fact is a real audience with different needs from a buyer.

-
-

## 5. Contextual boundary

**This page is about:**
**This page is NOT about (neighbouring topics that belong elsewhere):**
-
-

## 6. Placement

**Parent or hub page:** (URL, or "none")
**Sibling pages on adjacent topics:** (URLs)
**Commercial page this should feed:** (URL, or "none")

## 7. Proof available

What can the business actually evidence? Certifications, dates, named clients,
numbers it will stand behind publicly. Mark anything it will not publish.

-
-
```

## What each blank costs

Blanks are safe. This table says what you give up, so you can decide which are
worth ten more minutes.

| Left blank | Consequence |
|---|---|
| 1. Entity | Entity seat infers the entity from the copy. If the name collides with something bigger, nobody will notice until the brand SERP is checked |
| 2. Attributes | The seat scores inferred coverage rather than conformance. This is the single biggest loss, and the report must flag it |
| 3. Questions | Intent readers work from the SERP and query data alone. Workable, and weaker where the business knows something the SERP does not show |
| 4. Audiences | Findings default to a generic buyer. Segment-specific gaps go unnoticed |
| 5. Boundary | Cannibalisation and context drift cannot be scored, since there is no stated territory to drift from |
| 6. Placement | `--expect` cannot be passed to the fetcher, so the on-page severity condition for a hub not linking its children cannot fire |
| 7. Proof | E-E-A-T findings can say a claim is unsupported but cannot say whether support exists and went unused, which is a much more actionable finding |

## How it feeds the run

Section 6 populates the fetcher's expected-links check directly:

```
node scripts/fetch-page.cjs <url> --out source.md \
  --expect "<parent>,<sibling>,<commercial page>"
```

That turns "should this page link its hub" from a judgment call into a lookup.

Which seats read what: the entity seat uses 1, 2 and 5; the intent readers use 3
and 4; on-page uses 6; E-E-A-T uses 7; strategic fit uses 4 and 6. Section 2 is
read by nearly everyone, which is why it is worth the most care.

## Worked example

Filled in for a fictional independent bike shop's e-bike servicing page. Ten
minutes of work, and enough to score conformance against.

```markdown
# Target brief: e-bike servicing

**URL or draft path:** https://example-cycles.test/servicing/e-bike/
**Target query:** e-bike service near me
**Vertical:** local
**Date:** 2026-08-17

## 1. The entity

**Name, written the way it should appear in copy:** Example Cycles
**Type:** service (e-bike servicing), offered by a local business
**Disambiguation:** "Example Cycles" collides with a national franchise of a
similar name. Copy should pair the name with the town on first use.

## 2. Attributes this page owns

| Attribute | Value |
|---|---|
| Price | Standard service from $95, full service from $180 |
| Turnaround | 3 to 5 working days, same-day for diagnostics |
| Brands serviced | Bosch, Shimano STEPS, Brose drive units |
| Battery diagnostics | Yes, including cell-level health report |
| Loan bikes | Two available, free, must be booked |
| Warranty | 90 days on labour |
| Booking | Online or by phone, no walk-ins for servicing |
| Certification | Bosch eBike Systems trained, recertified 2026 |

## 3. Questions this page must answer

- Do they service my drive unit brand?
- What does it cost and how long will I be without the bike?
- Can they test the battery, or do I have to replace it?
- Do I need an appointment?

## 4. Who is reading

- An owner whose e-bike has a fault and who needs it back this week
- A prospective buyer checking whether local servicing exists before purchasing
- An answer engine looking for a citable price, turnaround and brand list

## 5. Contextual boundary

**This page is about:** servicing and repair of electric bikes already owned.
**This page is NOT about:**
- Selling e-bikes, which belongs on the range pages
- General bike servicing for non-electric bikes, which has its own page
- Battery recycling, which belongs in the sustainability section

## 6. Placement

**Parent or hub page:** https://example-cycles.test/servicing/
**Sibling pages on adjacent topics:** /servicing/tune-up/, /servicing/wheel-building/
**Commercial page this should feed:** /book-a-service/

## 7. Proof available

- Bosch eBike Systems training certificate, recertified March 2026
- Serviced roughly 400 e-bikes in the last twelve months
- Two mechanics with named qualifications, willing to be listed
- NOT publishable: named customers, per the owner
```

Notice what that brief makes scoreable that inference could not. The boundary in
section 5 lets the entity seat call context drift if the page starts selling bikes.
The placement in section 6 lets the on-page seat check three specific links rather
than form an opinion. The proof in section 7 lets the E-E-A-T seat distinguish "no
evidence exists" from "evidence exists and the page did not use it", which are
different findings with different fixes. And the note that customer names are not
publishable stops the council recommending a fix the business has already refused.

## If you have a blueprint and a topical map

You do not need this file. Populate the same fields from the blueprint's attribute
and searcher-consideration columns and the map's placement, and the run is in
conformance mode with the fuller construct. This brief exists so that not having
them costs a smaller amount than it used to, not so that having them is optional.
