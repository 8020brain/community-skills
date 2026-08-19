# Vertical overlay: B2B

For B2B service pages, solution pages, comparison pages, and thought-leadership content aimed at buying committees. Flex seat: Eli Schwartz or Ross Hudgens; add Talia Wolf's conversion seat for solution and pricing pages.

## Weight shifts

| Dimension | Core | B2B |
|---|---|---|
| Entity and blueprint conformance | 25% | 20% |
| GEO / AEO retrieval | 20% | 20% |
| Search intent match | 20% | 20% |
| E-E-A-T | 15% | 20% |
| On-page mechanics | 10% | 10% |
| Strategic fit | 10% | 10% |

Rationale: B2B deals are trust-gated and multi-stakeholder; proof density (E-E-A-T) does more work than in any other vertical.

## Dimension additions

**E-E-A-T** also checks: proof density calibrated to deal size (case studies with numbers, named or credibly anonymized clients, methodology shown); claims a procurement reviewer could challenge are pre-answered; the author would survive a LinkedIn lookup by the buyer.

**Intent match** also checks: sales-cycle stage match — problem-aware, solution-aware, and vendor-comparison queries each demand different pages, and this page knows which it is; the buying committee's silent members (finance, IT, legal) find their objections addressed or linked.

**Strategic fit** also checks: the CTA matches deal motion (a demo ask on a problem-aware page scores down); the page feeds the pipeline stage the map assigns it; gated-versus-ungated choices make sense for where the buyer is.

**GEO / AEO** also checks: the page survives "what tools do X" and "vendor A vs vendor B" assistant queries — the comparison facts an assistant needs are stated on the brand's own page, in the brand's framing, before a third-party roundup frames them instead.

**Entity coverage** also checks: the solution entity's attributes are completed as facts (integrations, compliance, deployment model, pricing model) rather than benefit prose.

## B2B severity conditions

Each condition names the **one dimension that scores it**. If it matters to your
dimension too, say so in your findings, but do not take the numeric hit unless
the tag is yours. One defect should move one number.

- **[eeat] Major (subtract 1 to 2):** Benefits copy with zero verifiable claims: no numbers, no names, no methodology.
- **[eeat] Fatal (forces rework):** A comparison page that misrepresents competitors. This is trust suicide the moment the buyer checks, and it is a factual problem rather than a quality one.
- **[intent] Moderate (prevents an 8):** Stage mismatch, meaning a hard sell on educational intent, or education where a comparison was asked for.
