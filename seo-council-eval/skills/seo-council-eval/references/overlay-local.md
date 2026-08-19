# Vertical overlay: local

For location pages, service-area pages, and local landing pages (the winery, hotel, venue, and local-service work). Flex seat: Joy Hawkins, Darren Shaw, or Claire Carlile.

## Weight shifts

| Dimension | Core | Local |
|---|---|---|
| Entity and blueprint conformance | 25% | 25% |
| GEO / AEO retrieval | 20% | 15% |
| Search intent match | 20% | 20% |
| E-E-A-T | 15% | 15% |
| On-page mechanics | 10% | 15% |
| Strategic fit | 10% | 10% |

Rationale: local rankings lean on consistency signals (NAP, GBP alignment, schema) that live in on-page mechanics, so mechanics gain weight; pure AEO citation matters slightly less than proximity-driven discovery.

## Dimension additions

**Entity coverage** also checks: the location entity is fully attributed (address, hours, service area, parking, booking method, price range as EAV facts in the copy, not just a footer widget); local landmarks and neighborhoods used as disambiguation; "near me" semantics carried by real geography, not the phrase "near me".

**On-page mechanics** also checks: NAP in copy matches the GBP listing exactly; localized title/H1 without city-stuffing; schema implied by the copy (LocalBusiness fields present as visible text); one location per page, no doorway-page patterns.

**Intent match** also checks: the local intent split — directions/hours seekers, comparison shoppers, and bookers each get their answer without scrolling past the others' content.

**E-E-A-T** also checks: review evidence is local and specific (named platforms, counts, recency); the humans behind the location are visible (staff, owner, winemaker); community ties that a rater could verify.

**GEO / AEO** also checks: the page answers the questions assistants get about the place ("does X take walk-ins", "is X kid-friendly", "how much is a tasting at X") in liftable passages.

## Local severity conditions

Each condition names the **one dimension that scores it**. If it matters to your
dimension too, say so in your findings, but do not take the numeric hit unless
the tag is yours. One defect should move one number.

- **[onpage] Major (subtract 1 to 2):** NAP in the copy conflicts with the GBP listing. The fetch script captures footer text, so check there before concluding NAP is absent.
- **[onpage] Major (subtract 1 to 2):** The GBP website or appointment field points at a different domain or URL than the page under review. Added 2026-08-12 after a live run where this was the single largest defect on the page and the NAP condition above did not catch it, because name, address and phone all matched exactly while the website field sent every review and booking to another property. Check the Knowledge Panel's website and appointment links against the page's own domain, not just the address block.
- **[entity] Major (subtract 1 to 2):** City-swapped template copy, meaning the page works if you find-and-replace the city name.
- **[eeat] Fatal (forces rework):** Service-area page for a place the business has no real presence in, written as if it does. This is a doorway page and a policy risk, not a quality problem.
