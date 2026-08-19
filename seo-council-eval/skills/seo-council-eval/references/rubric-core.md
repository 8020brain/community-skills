# Core rubric

Six dimensions, each scored as a **whole number from 1 to 10**. Every score must be justified against these anchors: name what places the copy at that number and not one higher. The anchors describe 3 (failing), 5-6 (serviceable), and 8 (strong); 10 is reserved for copy the expert would hold up as a teaching example, and 1-2 for copy that actively harms the client.

## What the composite is, and what it is not

The weighted total is an **evaluation index**, not a measurement. These are ordinal expert judgments, so a 6 is not demonstrably one unit better than a 5 the way six dollars is one dollar more than five. Averaging them produces a number that is useful for ranking pages and tracking one page over time, and that is all it is licensed to do.

Three rules follow, and they are not optional:

1. **Report the index to one decimal at most.** Never two. A "6.25" claims precision this method cannot support.
2. **Always attach a confidence level** (see input sufficiency below). An index without confidence invites the reader to treat it as a measurement.
3. **Do not claim cross-client comparability** until repeatability has been tested. Comparing the same page across time is sound. Comparing a winery spoke to an industrial service page is not yet evidenced.

Verdict bands, applied to the index: **ship** at 7.5 or above with no dimension below 5; **rework** if any dimension carries a Fatal condition or scores 2 or below; **fix then ship** otherwise. Say plainly in the report when a fix list is rework-shaped even though the band says fix-then-ship.

## Input sufficiency, which governs confidence

Score what the evidence supports and no more. A missing dataset is a limitation of the research, **not a defect in the page**, and must never depress a page's score. Say what was missing and what you would have checked.

| Evidence state | How to score |
|---|---|
| Required evidence present | Score normally. Confidence: high. |
| Partial evidence | Score, and state what is missing. Confidence: moderate. |
| Critical evidence absent | Mark the dimension **provisional** or N/A. Do not invent a number to fill the slot. |
| Evidence contradicts itself | Score only the supported portion and flag the conflict explicitly. |

**When a dimension changes construct, say so.** The clearest case is the entity seat: with a blueprint on file it measures conformance to an assigned attribute set; without one it measures inferred semantic coverage. Those are related but different things. Holding the weight constant does not make the two indexes comparable, and an earlier version of this rubric wrongly claimed it did. Flag the substitution in the report and treat any comparison across it as unsafe.

## Severity conditions

Vertical overlays define conditions tagged to exactly one dimension. Graded, so that a strong page with one omission does not land on the same number as a badly built page with several:

| Severity | Effect |
|---|---|
| Fatal | Forces a rework verdict. Reserved for policy risk or factual misrepresentation. |
| Major | Subtract 1 to 2 points from that dimension. |
| Moderate | Prevents an 8 or above. |
| Minor | Prevents a 9 or 10. |

Blunt caps are retired. They destroyed information: two very different pages both landed on exactly 4 while the reader announced each would have been a 6 uncapped.

## Dimension ownership, so one defect moves one number

Dimensions overlap in what they notice. Without boundaries, a single missing hub link depresses entity conformance, on-page mechanics and strategic fit at once, and the index counts one defect three times. It has happened in a live run.

| Defect type | Scored by | May be mentioned by |
|---|---|---|
| Internal links, anchors, hierarchy, cannibalization | On-page mechanics | Entity, strategic fit |
| Attribute coverage, entity naming, contextual vector | Entity | GEO, E-E-A-T |
| Passage liftability, chunk survival, citability | GEO / AEO | Entity, E-E-A-T |
| Query-to-page match, SERP format fit | Search intent | Strategic fit |
| Evidence, sourcing, authorship, experience | E-E-A-T | Entity, strategic fit |
| Business value, portfolio position, conversion path | Strategic fit | Search intent |

Mention anything in your findings when it matters to your dimension. Take the numeric hit only for defects you own.

## Weights and index

Default weights (vertical overlays may shift them; the overlay's table wins):

| Dimension | Owner | Weight |
|---|---|---|
| Entity and blueprint conformance | Koray Tugberk GUBUR | 25% |
| GEO / AEO retrieval | Mike King | 20% |
| Search intent match | Wil Reynolds (lead) + flex seat | 20% |
| E-E-A-T | Lily Ray | 15% |
| On-page mechanics | Aleyda Solis | 10% |
| Strategic fit | Kevin Indig | 10% |

Index = weighted mean of the six dimension scores, reported to one decimal.

## 1. Entity and blueprint conformance (25%)

This dimension has **three input states**, and they measure progressively weaker
constructs. Say which one you are in, every time.

**1. Conformance (blueprint on file).** Does the copy cover the attributes the
blueprint assigns to this page, hold its contextual vector, and stay inside its
topical map placement. The strongest construct, and the one the anchors below are
written for.

**2. Assigned (target brief on file, no blueprint).** A filled
`references/target-brief-template.md` supplies the entity and its disambiguation,
the attributes this page owns with their values, and a stated contextual boundary.
Score conformance against that assignment exactly as in state 1, using the same
anchors. It is a smaller assignment than a blueprint, not a different kind of one.
Confidence is capped at moderate, because the brief is one person's account of what
the page should cover rather than a researched attribute set, and the report says
"Target brief on file, no blueprint."

**3. Inferred (neither).** Score raw semantic coverage: entities named and
disambiguated, attributes covered with values (EAV triples completed, not just
topics mentioned), query network the copy can plausibly serve. Report must flag
"No blueprint or brief on file: entity score measures coverage, not conformance."

**What changes between states is the construct, not the weights.** Do not adjust
weights to compensate; that makes two indexes less comparable rather than more.
State the input state in the report and treat comparisons across states as unsafe.

One clause applies only in state 3: without a stated boundary there is no territory
to drift from, so context drift and cannibalisation cannot be scored and should be
reported as unscoreable rather than as absent.

- **3**: Topic-level writing. Entities mentioned but attributes unaddressed; claims without values ("great service" instead of hours, price, capacity, process). Or the page drifts off its map placement into a sibling page's territory (cannibalization risk).
- **5-6**: Main entity covered with several completed attribute-value pairs, but predictable gaps against the blueprint (or against what the SERP shows searchers expect). Contextual vector wobbles: sections that belong to a different page in the map.
- **8**: Attribute coverage matches the blueprint's assignment for this page; values are specific and consistent; the page's context stays on its vector start to finish; adjacent map pages are referenced, not duplicated.

## 2. GEO / AEO retrieval (20%)

Would an answer engine retrieve, quote, and cite this page. Judged at the passage level.

- **3**: No passage answers any question in one lift. Key facts are spread across paragraphs, buried in narrative, or phrased so a quote would need surgery. Headings don't match how anyone asks.
- **5-6**: Some liftable passages, but the best answers arrive mid-paragraph after throat-clearing; question-shaped headings are inconsistent; facts appear once, phrased once, with no redundancy for chunk boundaries.
- **8**: Every important question this page should win has a self-contained, quotable passage under a heading that matches the ask; facts survive being chunked out of context (entities re-named, not pronoun-dependent); the copy implies obvious structured data.

## 3. Search intent match (20%)

Does the page answer the target query's actual intent class, at the depth and in the format the SERP demands. Scored jointly: Wil Reynolds leads, reading from real query evidence; the flex seat gives a second read from its vertical's angle.

**Resolving the two readings.** Always report both scores. **Take the mean, at every gap size.** An earlier rule averaged small gaps but switched to the lower score above a gap of 2, which created an unjustified cliff where 5 and 7 became 6 while 5 and 8 became 5. Nothing makes the pessimistic reader correct at that threshold.

The gap is information about confidence, not about which reader to believe:

| Gap | Treatment |
|---|---|
| 0 to 1 | Mean. Confidence: high. |
| 2 | Mean. Confidence: moderate. Report both positions in full. |
| 3 or more | Mean. Confidence: **low**, and the dimension is flagged provisional. The chair must classify the disagreement. |

When the gap is 3 or more, the chair names which kind it is: **target** (they disagree about which query the page should serve), **format** (about what the SERP rewards), **execution** (about whether the copy delivers), **data** (about what the evidence shows), or **lens** (an artifact of the two readers' different vertical angles). That classification tells the client what to actually do, which a lower number never does.

The lead reader's first move is to hunt for a search terms export in the client's data before scoring, since what people typed beats what a keyword tool grouped. If none exists, that absence goes in the report.

- **3**: Format mismatch with the ranking SERP (an essay where the SERP rewards comparison tables; a category page where searchers get guides), or the copy answers a different question than the query asks.
- **5-6**: Right intent class, wrong depth — thinner than what ranks, or padded past what the searcher wants; secondary intents (price, proof, next step) unaddressed.
- **8**: Intent class, depth, and format match what the SERP shows winning; the searcher's next question is anticipated on-page; a first-time searcher would not need to pogo back to the results.

## 4. E-E-A-T (15%)

Are the claims carried by evidence and identity. An EAV triple asserted without support is a liability, not coverage.

- **3**: Anonymous copy; expertise claimed, never shown; statistics and superlatives with no source; no first-hand experience markers anywhere.
- **5-6**: Author or brand identity present but generic; some claims sourced, others floating; experience implied ("we've seen many cases") but never specific.
- **8**: Visible, verifiable author or brand identity with relevant credentials; claims cited or grounded in named first-hand experience (specific clients, dates, numbers, outcomes); trust markers a quality rater could point at.

## 5. On-page mechanics (10%)

Do the mechanics carry the semantics.

- **3**: Heading hierarchy broken or decorative; no internal-link targets to the hub or siblings; title/H1 misses the target query; obvious cannibalization with an existing page.
- **5-6**: Sound hierarchy, but headings are labels rather than claims; internal links exist but point generically (naked "click here", or all to the homepage); metadata implied by the copy is serviceable, not sharpened.
- **8**: Headings form an outline that answers the query on its own; internal links target the right hub and spoke pages with descriptive anchors; title/H1/opening align on the target query without stuffing; no overlap with existing pages' assignments.

## 6. Strategic fit (10%)

Does this page deserve to exist, and does it earn its keep.

- **3**: Completeness for its own sake — a page the map may list but no business case supports; no conversion path; competes with a stronger existing asset.
- **5-6**: Legitimate slot in the map and a plausible business purpose, but the commercial connection is bolted on (a generic CTA on an informational page) or unclear what the page moves.
- **8**: Clear line from this page to business value (revenue, pipeline, authority the money pages inherit); the conversion or next-step path fits the intent stage; the effort matches the prize.

## Scoring discipline

- **Score by the written anchors below, and read `calibration-method.md`.** This skill ships no worked scored examples; the anchors in this file are what keep scores comparable within your own history. As you accumulate runs, build your own worked anchors from `scores.jsonl` and score new pages by comparison to them, because comparative judgment holds steady where absolute judgment drifts.
- Score against the anchors, not against the expert's temperament. The persona shapes the findings' voice and what gets noticed first, never the number.
- Every score cites at least one quote from the copy as evidence.
- If context is missing (no SERP data, no blueprint), score what is scoreable and say what was assumed — do not silently guess the missing context.
- Before any score rests on a statistic, check whether the sample could have shown anything else. Small samples corroborate other evidence; they do not prove things on their own. See the worked example in the calibration file.
