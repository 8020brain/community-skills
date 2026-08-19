# Vertical overlay: ecommerce

For product pages, category pages, collection pages, and buying guides. Flex seat: Eli Schwartz, Luke Carthy, or Kristina Azarenko.

## Weight shifts

| Dimension | Core | Ecommerce |
|---|---|---|
| Entity and blueprint conformance | 25% | 20% |
| GEO / AEO retrieval | 20% | 20% |
| Search intent match | 20% | 25% |
| E-E-A-T | 15% | 10% |
| On-page mechanics | 10% | 10% |
| Strategic fit | 10% | 15% |

Rationale: transactional queries punish intent mismatch harder than anything else, and a product page that doesn't convert has no strategic excuse.

## Dimension additions

**Intent match** also checks: commercial modifiers handled (best, cheap, vs, near me, size/color/spec variants); the page type matches the query type (category for plural/broad, PDP for specific); price and availability visible where the SERP shows shopping results.

**Entity coverage** also checks: product attributes completed as specs, not prose (dimensions, materials, compatibility, care); brand and product entities disambiguated from lookalikes; category pages carry real category copy, not boilerplate above a grid.

**GEO / AEO** also checks: the answer an assistant gives for "is X good for Y" or "X vs Y" is liftable from this page; spec facts are stated in text, not locked in images or tables an extractor mangles.

**E-E-A-T** also checks: review evidence is specific (counts, ratings, quoted reviews), returns/guarantee/shipping facts stated plainly.

**Strategic fit** also checks: the page's job in the funnel is coherent (a buying guide links to the category and PDPs it feeds); no orphan products; margin-worthy products get the depth.

## Ask first: are you scoring a page or a template?

Most ecommerce URLs are one record in a catalogue of thousands, rendered by a shared template from a product feed. A live run on a product detail page found that almost every defect was a template or feed defect rather than a page defect: the brand field was wrong in the PIM, the heading structure was a CMS field list, the related-products module was populated by product code, and the missing reviews were a platform capability.

Establish this early, because it changes what your findings mean. If the page is one of many:

- Say so in your findings, and phrase fixes at the level they actually apply. "Correct the brand field across the oil catalogue" is useful; "correct the brand field on this page" is close to worthless.
- Expect the page's genuinely unique content to be thin, and do not mistake template furniture for the product's own coverage. A body that is 90 percent related-product cards has less product coverage than its word count suggests.
- One field fixed at source can move every page on the storefront, which usually makes feed-level fixes the highest-leverage items on the list even when they look small.

## Ecommerce severity conditions

Each condition names the **one dimension that scores it**. If it matters to your
dimension too, say so in your findings, but do not take the numeric hit unless
the tag is yours. One defect should move one number.

- **[entity] Major (subtract 1 to 2):** Manufacturer boilerplate as the product description, duplicated across the web.
- **[entity] Moderate (prevents an 8):** Category page whose copy could describe any competitor's category.
- **[fit] Major (subtract 1 to 2):** Buying guide that never links to a purchasable page.
