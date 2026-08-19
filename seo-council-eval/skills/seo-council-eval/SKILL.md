---
name: seo-council-eval
description: Convene a rubric-based council of named SEO experts to evaluate a piece of SEO copy (draft or live page) and return a scored report with a prioritized fix list. Experts score against an entity/attribute/value methodology if you have one (a blueprint or a filled target brief), live SERP data, and your brain's client context. USE WHEN someone says "seo council", "seo copy council", "score this page", "evaluate this copy for SEO", "run the copy past the SEO experts", "will this page rank", "is this copy AEO-ready", or wants a draft article, service page, product page, or landing page judged before it ships. Covers ecommerce, lead-gen/topical authority, local, and B2B copy. Do NOT use for writing new copy, rewriting for persuasion or clarity, or site-wide audits; those are separate tools.
version: 0.9.0
last_updated: 2026-08-18
maturity: live
---

# SEO Council

A panel of 6-8 analytical lenses evaluates one piece of copy. Each lens owns one rubric dimension, scores it as a whole number against written anchors, and writes findings from its practitioner's perspective. Search intent gets two readers, because it carries the most weight of any outcome dimension and a single reader there is thin. A chair produces a weighted **evaluation index** and a prioritized fix list. Evaluation only: rewriting hands off to a separate rewrite step (copy-council, if your brain has it).

**On what the lenses are.** Each seat is built from a named practitioner's published frameworks, and internally the persona files carry their voice because that is what makes the lenses notice genuinely different things. In anything a client sees, name them as lenses and carry the disclaimer in `references/report-template.md`. They are not consultations and the named individuals have not reviewed the page. `NOTICE.md` states this plainly for anyone browsing the skill, and `PERSONAS.md` is the roster and the removal route for any named practitioner who asks.

**On what the index is.** Ordinal expert judgments, weighted and averaged. It ranks pages and tracks one page over time. It is not a measurement, it is reported to one decimal, it always carries a confidence level, and cross-client comparability is not yet evidenced. `references/rubric-core.md` sets these rules and they are load-bearing.

## The one idea that makes this work

Your agency's codified methodology (for example AEO plus topical authority via entity-attribute-value semantics) is the **yardstick, not a seat**. The client's entity blueprint and topical map go into the context pack every expert reads. Koray's seat scores conformance to it directly; the other seats are adversarial checks that conformance produced a page that ranks, gets cited, and converts. They do not re-litigate the framework, which was settled at diagnostics. A blueprint-perfect page that fails the outcome judges still fails.

If your agency has not codified a methodology, the council still runs. The entity seat then scores inferred semantic coverage rather than conformance to an assigned model, at lower confidence, and the report says so. The target brief in `references/target-brief-template.md` is the ten-minute way to give the seat something real to score against without a full blueprint. See the three input states in Step 2.

Second idea, equally load-bearing: **findings render in each expert's voice, but scores come from the rubric anchors, never persona temperament.** A naturally harsh persona must not deflate scores run over run, or numbers stop being comparable across clients and across time.

## Step 1 — Setup (ask, don't assume)

Use AskUserQuestion where available; plain conversation otherwise.

1. **Which client?** Or standalone prospect mode (no client folder).
2. **Which vertical?** ecommerce / lead-gen and topical authority / local / B2B. This picks the overlay file and may swap the flex seats.
3. **Target query or topic.** One primary query or topic the page is meant to win. Without it, intent match cannot be scored — do not proceed without one.
4. **The copy.** A URL for a live page, or a file path for an unpublished draft. Either way it becomes a file in Step 2 and everything downstream works from that path; never carry the copy inline through prompts.
5. **Is there an entity blueprint?** If not, offer the target brief (`references/target-brief-template.md`) before the run rather than after. Ten minutes of the client's knowledge moves the heaviest-weighted dimension from inferring an assignment to scoring against a stated one. If they decline or cannot answer now, proceed; the run degrades gracefully and the report says which state it was in.
6. **Panel.** Default is the six anchors plus the vertical's flex seat, which is seven readers covering six dimensions. Offer the bench (see roster below) if the user wants substitutions, and say plainly that dropping the flex seat saves about 60k tokens but leaves intent single-read.

## Step 2 — Build the context pack

Gather into one pack that every expert receives. Write the pack to a file and pass its path to the scoring agents, since they run without your conversation context.

- **The copy itself. Extract it mechanically. This is not optional:**
  ```
  node .claude/skills/seo-council-eval/scripts/fetch-page.cjs <url> --out <source.md> \
    --expect "/hub-url/,/sibling-url/,/ticket-page/"
  ```
  Pass `--expect` the URLs the topical map says this page should link: its hub, its sibling spokes, and any commercial page it ought to feed. The script then reports each as linked or not linked, which turns the lead-gen red-flag condition from a judgment call into a lookup. It also emits a computed on-page section (heading tree, H1 presence, internal versus external link split, weak anchors, title-to-heading agreement) so the mechanics reader verifies counts instead of making them.
  **Never build the source file from a summarizing fetcher, and never retype it by hand.** A summarizer cannot establish absence, and most of this council's findings are absence claims: no link to the hub, no price stated, no byline, no date on the event. A live run learned this expensively. A fetcher silently dropped four of seven events and two of four press links; five of six independent readers then scored the page down for content that was on it the whole time, and the entire run had to be discarded and re-paid for. The script exists so that cannot happen again.

  For a draft that is not yet published, put the text in a file yourself and say in the source file that it is a draft. The rule is the same either way: the readers must see the complete text, because you are asking them to reason about what is missing from it.
- **Client context**: read `clients/<slug>/` context files. If `context.md` is still an unfilled template, note it in the report and, if your brain has a client-setup step, recommend it, because a council inferring business context it should have been handed is an accuracy risk.
- **The entity blueprint, if you have one**: an entity blueprint is often produced as an `.xlsx` (the entity-brand-blueprint skill does this, if your brain has it), which no text tool reads directly. Dump it first:
  ```
  node .claude/skills/seo-council-eval/scripts/read-xlsx.cjs <blueprint.xlsx> --list
  node .claude/skills/seo-council-eval/scripts/read-xlsx.cjs <blueprint.xlsx> --sheet Semantic
  ```
  The Semantic sheet carries the attribute and searcher-consideration columns Koray's seat scores against. Read the blueprint itself; never score conformance against a second-hand summary of it in another report.
- **The topical map**: `topical-map` outputs (brief.md, pillar-hub-pages.csv, spoke-articles.csv). Find this page's assignment, or establish that it has none.
- **The target brief, when there is no blueprint.** `references/target-brief-template.md` is a one-page form covering the entity and its disambiguation, the attributes this page owns with values, the questions it must answer, its contextual boundary, its placement, and what proof the business can actually evidence. It takes about ten minutes to fill and moves the entity seat from inferring an assignment to scoring against a stated one.

  Offer it in Step 1 whenever there is no blueprint, rather than discovering the gap mid-run. If the user cannot fill it now, proceed without: blanks are handled and each one's cost is documented in the template. What must not happen is filling it with guesses, because a wrong assignment sends seven readers to score against a target the business does not hold and nothing downstream will catch it.

  Section 6 of a filled brief populates `--expect` on the fetcher directly.
- **Search data**: GSC first if the property is connected, DataForSEO fallback. Pull the target query's SERP, volume, and intent classification. Read the SERP composition, not just the rankings: a service page in a SERP of DIY tutorials and product listings is a format mismatch no copy quality can fix.

  **How to actually reach GSC, because this went wrong once.** The house rule says "never Ahrefs for query data," and that rule is about Ahrefs *proprietary* metrics: site-explorer, keywords-explorer, their volume and difficulty estimates. It is not about the `gsc-*` endpoints, which are a passthrough to the client's own Google Search Console and return Google's data, not Ahrefs'. Reading the rule as a blanket ban is what caused a live run to report "no GSC export for this property" and score every dimension at moderate confidence while ninety days of connected, zero-cost query data sat one call away.

  So the check is two steps, and it is cheap:
  ```
  management-projects                          # find the project_id for the domain
  gsc-keywords  project_id=<id> date_from=<90d ago>   # what people typed
  gsc-pages     project_id=<id> date_from=<90d ago>   # what earned the impressions
  ```
  `management-projects` lists every connected property with `verified` status. If the domain is there and verified, GSC is available: pull it. The `gsc-*` calls have consistently returned zero API units, so cost is not a reason to skip them. If the domain is absent from that list, *then* the property genuinely is not connected, and you can say so in the pack and fall back to DataForSEO.

  If you do not have the Ahrefs MCP, the same data comes from a Search Console export: pull the query and page reports for the last 90 days from GSC directly and drop the CSVs in the client's `data/` folder, where the manifest will find them. The route differs; the discipline, which is to check before you write "no GSC data", does not.

  Watch for two things the export will tell you that a live SERP check cannot. First, **branded demand volume**: a brand query with ten impressions in ninety days is a different problem from a brand query with ten thousand, and only GSC distinguishes them. Second, **which brand name is actually earning**, which matters enormously for any client that has rebranded.

  Where a live SERP capture and GSC positions disagree, report both and resolve neither. A SERP pull is one observation from one location at one moment; GSC is a ninety-day average over every impression that fired. They answer different questions and a conflict between them is information, not an error to tidy away.
- **Paid data, when the client has any.** This is the only source in the brain that speaks to what *converts* rather than what ranks. Check `clients/<slug>/data/` for three things, in this order of usefulness:
  1. **The search terms export.** These are the strings people actually typed, and they outrank everything else here. In a gads-proxy export set that is usually `search80.csv`; yours may be named anything, which is why the manifest detects a search-terms file by its header column rather than its name. What it must not be treated as is `im_pmax_search_terms.csv`, which is PMax-only and is empty for most accounts.
  2. `keyword80.csv` or equivalent, which is what the platform *matched* those strings to. Lossier than the search terms, still useful.
  3. `pages.csv`, landing-page level clicks, cost, and conversions.

  **List the directory and read the row counts. Do not trust a filename.** Three times now a context pack has recorded query evidence as missing while it sat in that folder. The third time is the one to learn from, because the skill already carried this warning and the warning itself caused the error: it named `im_pmax_search_terms.csv` as the example, the assembler checked that one file, found it genuinely header-only, and wrote "the search terms export contains zero rows" while `search80.csv` sat beside it with 299 rows of exactly the evidence being declared absent. A named example becomes a blinder the moment it is treated as the definition.

  The cheap defence is a lookup. **Run this before writing a word of the context pack:**
  ```
  node .claude/skills/seo-council-eval/scripts/data-manifest.cjs <client-slug>
  ```
  It prints every file in `clients/<slug>/data/` with its row count, separates the populated from the header-only, calls out any search-terms export by name, reports whether a blueprint and topical map exist (so you know whether you are in conformance or fallback mode before you start), and reminds you to check GSC over MCP, which it cannot see itself. "Which files actually have data" becomes a lookup rather than a guess. An absence claim in the pack needs the same discipline the rubric demands of readers: check, then state.

  Note what did and did not survive this error. The council's *conclusion* about the paid account (no hospitality, winery, GEO or AI term anywhere in it) held up perfectly against the 299-row file: the account really is pointed at generic Houston agency terms. The conclusion was right and its evidence base was wrong, which is the most dangerous combination available, because nothing in the output looks wrong enough to prompt a check.

  If no export genuinely exists, say so. The intent lead treats that absence as a finding rather than working around it silently.

  Handle it with statistical discipline, because it is the easiest evidence on this list to over-read. **"Zero conversions" is not a finding until you check whether the sample could show anything else.** Work out what the account's typical conversion rate would predict for that click volume: at a 2 percent rate, 42 clicks expects 0.84 conversions, and seeing zero has roughly a 43 percent chance of happening on a perfectly average page. A live council run produced exactly this correction, where the paid table looked damning and turned out to be noise. Put the click volume and the account's baseline rate in the pack so the reader can judge, treat small samples as corroboration for the SERP read rather than proof on their own, and never let a recommendation rest on a number that cannot carry it.
- **Voice rules**: the brain's tone rules apply to the *report*, not the copy being judged.

**Three input states for the entity seat, and what each costs.** This dimension carries the heaviest weight on the board, and what it measures depends on what it is handed. `references/rubric-core.md` is authoritative; the short version:

1. **Conformance**, with an entity blueprint on file. The seat scores coverage of an assigned, researched attribute set. Strongest construct.
2. **Assigned**, with a filled target brief and no blueprint. The seat scores conformance against a smaller stated assignment, using the same anchors. Confidence caps at moderate.
3. **Inferred**, with neither. The seat scores raw semantic coverage from the copy, the target query and the SERP.

Be clear about what moving down that list does. **It changes the construct the dimension measures.** An earlier version of this skill said weights stay unchanged "so composites remain comparable," which was exactly backwards: holding the weight while swapping the construct makes two indexes less comparable, not more. Whichever state applies, name it in the report, set the entity seat's confidence accordingly, and state that comparison across states is unsafe.

State 3 is the one to avoid drifting into by default. It is the right answer for a prospect evaluation where nobody has ten minutes, and the wrong answer for a client page where somebody does. The flag doubles as the prompt to fill a brief, or to run diagnostics and the entity-brand-blueprint.

## Step 3 — Cost disclosure

A full run is one scoring agent per seated expert plus a chair synthesis you write yourself. **Measured across eight panels between 2026-08-08 and 2026-08-11, a correctly spawned, pre-briefed scoring agent costs 33k to 42k tokens and makes 3 tool calls.** Cost scales with the size of the source and context pack, so a short local page sits at the bottom of that range and a long product page with a big link inventory at the top.

Budget **250k to 290k for the default seven-reader panel**, plus data pulls and the synthesis. Six readers, dropping the flex seat, is roughly 215k to 250k.

For reference, this run cost about 490k before the agent-spawn and pre-briefing fixes. If a run is costing appreciably more than the figures above, check the spawn and check that briefs were built, rather than accepting the number.

That is down from about 70k per agent, a 55 percent cut, from two changes that touched no scoring rule: narrowing the agent tool surface (measured 44 percent on its own) and pre-briefing. Scores and findings were equal or better at every step, verified by re-running the same dimension on the same page. If a run is costing appreciably more than this, check the spawn and check that briefs were built, rather than accepting the number.

If a run comes in near 60-70k per agent, the agents were spawned as `general-purpose`. Fix the spawn rather than accepting the number.

That is the real price of independent scoring, and it is roughly six times what a single-reader inline pass costs. It buys scores that can contradict the orchestrator, which is the entire point, but say the number out loud: tell the user the panel size and the token estimate and get a yes before firing. One line is enough. Never launch first and explain after.

## Step 4 — Run the panel (independent scoring)

**If this page is already in `scores.jsonl`, use re-score mode instead** (see the section after Step 7): re-run only the dimensions whose inputs changed, at roughly a third of the cost.

**The scores must come from independent readers, not from one mind wearing several hats.** If you write all the experts yourself in one pass, the disagreements are authored rather than discovered: you know the conclusion before writing either side, and the panel produces a narrative about consensus instead of evidence of it. The scores are the client-facing claim, so this is the difference between a scoring instrument and a piece of theatre.

**Spawn them as `sonnet-worker` with the model overridden to a capable one** (`subagent_type: "sonnet-worker", model: "opus"`), not as `general-purpose`. A scoring agent needs exactly one capability, reading files, and `general-purpose` loads every tool in the environment (Ahrefs, DataForSEO, Gmail, Asana, Notion, Slack and the rest) into all seven of them. A controlled test on 2026-08-08 ran the same dimension, same prompt, same files, same model, changing only the agent type: **70,492 tokens on `general-purpose` versus 39,702 on `sonnet-worker`, a 44 percent cut with identical scores and equally good findings.** The override keeps the reasoning quality; only the unused tool definitions go away.

Do not drop to Sonnet to save tokens. The same test found Sonnet cost slightly *more* (43,459) than the capable model on the identical narrow tool surface, while producing noticeably thinner metadata findings. It is faster in wall-clock and cheaper per token, so it is a reasonable choice when dollar cost matters more than token count, but it is not a token saving and it does cost you some sharpness.

**Build each agent a brief first.** One command per seated expert:

```
node .claude/skills/seo-council-eval/scripts/build-brief.cjs \
  --dimension entity|geo|intent|eeat|onpage|fit \
  --persona <persona-file-name> --vertical <b2b|lead-gen|local|ecommerce> \
  --source <source.md> --context <context-pack.md> --out <brief-<dim>.md>
```

The brief carries the persona in full, the rubric's weights and verdict bands, that dimension's anchors and the scoring discipline, the vertical overlay's additions for that dimension, and the calibration material the reader needs: how to use it, the calibrated bands, the reference runs, that dimension's worked examples, and the statistical and drift cautions. It slices reference material only; the source copy and context pack always reach the agent whole.

This exists because seven readers were each consuming all of `rubric-core.md` to use a fraction of it. Briefing slices the rubric and overlay to the one dimension each reader owns and carries `calibration-method.md` whole, cutting a few thousand tokens of reading per agent and taking each from several file reads to three.

Spawn **one agent per seated expert, all in the same turn**, so none can see another's work. Give each agent only:

- its brief (`brief-<dim>.md`),
- the path to the copy and the path to the context pack, which it reads itself,
- **its own dimension only.** Do not tell an agent what any other expert concluded, and do not hint at the verdict you expect.

Tell each agent to find the nearest calibrated example in its brief and score by comparison to it. That comparison is what keeps scores comparable between clients and across months, since comparative judgment holds steady where absolute judgment drifts.

Ask each for exactly this, and nothing longer:

- **Score (1-10)** justified against the written anchors: what specifically places it at that number and not one higher.
- **Findings** (3-6) in the expert's voice, each tied to something quotable in the copy.
- **Fixes**, each tagged `quick-fix` or `structural`, with a one-line expected impact.

Then hold the line on what comes back. **Report the scores you receive.** Do not nudge a score to make the composite land somewhere tidy, to resolve a contradiction, or to match what you suspected before the run. If two experts read the same evidence differently, that disagreement is the most valuable output of the whole exercise and it goes in the report intact. If a returned score looks unjustified against the anchors, say so in the synthesis rather than quietly editing the number.

Voice comes from the persona's frameworks, known positions, and style, not from an accent painted on generic analysis. If an expert's findings could have been written by any of the others, the persona file wasn't used properly.

**If agents are unavailable** (Cowork, claude.ai, or any client without subagents), run the seats sequentially yourself, but score each dimension in a separate pass and commit to the number before moving to the next seat. Then say plainly in the report that scoring was single-reader, because a reader deciding how much to trust a 4.1 deserves to know where it came from.

## Step 5 — Chair synthesis

The chair (no persona; speaks as the agency's methodology) works from what the experts returned, and does not re-score them. Produce:

1. **Weighted evaluation index** using the dimension weights in `references/rubric-core.md` (vertical overlays may shift them; use the overlay's table if present). **One decimal, never two**, with an overall confidence level derived from the input sufficiency states in the rubric. The index ranks and tracks a page against itself; it does not measure, and it is not yet evidenced as comparable across clients. Say so in the report.
2. **Verdict**: ship / fix then ship / rework. Index ≥7.5 with no dimension below 5 is ship; a Fatal severity condition or any dimension at 2 or below forces rework; everything else is fix-then-ship. Where the fix list is rework-shaped despite landing in the middle band, say that plainly rather than letting the label undersell the work.
3. **Where the experts disagreed**, stated plainly — disagreement is signal, not noise to smooth over.
4. **Prioritized fix list**: all fixes merged, deduplicated, ranked by expected impact, quick-fixes surfaced first.

## Step 6 — Save the report

Use the template in `references/report-template.md`. Save to:

- Client mode: `clients/<slug>/reports/YYYY-MM-DD-seo-council-eval-<label>.md`
- Standalone mode: `data/councils/seo-council-eval/YYYY-MM-DD-<label>.md`

Metadata frontmatter records council, date, question/target query and experts. If your brain has an expert-followup step, that convention lets it work on the run afterward, so mention that option after saving.

The report is client-facing by default. Apply your brain's house voice rules to it if it has any; `references/house-style.md` carries an example set (one agency's conventions) that you can adopt or replace with your own. If your brain has an ai-check step, run it before the report goes to a client.

**Then run the attribution gate. This is not optional and it is not a style check.**

```
node .claude/skills/seo-council-eval/scripts/check-attribution.cjs <report-path>
```

It fails the report if the disclaimer is missing, or if any heading or table row attributes a score to a bare practitioner name, and it prints the correct lens phrase for every seat it flags. Fix what it reports and run it again until it passes.

The reason this is a gate rather than a reminder: the rule was already written plainly in the report template, and six of the first ten reports broke it anyway, five of them sitting in client folders. A named living professional appearing as "Lily Ray on E-E-A-T: 4/10" in a document a client reads is a misrepresentation of a real person, and no amount of good intent at the start of a long run reliably prevents it at the end of one. The audit that found this also found that the gate itself had a blind spot, matching only the persona's formal `Full Name` and so missing every "Mike King" heading while reporting those reports clean, which is worth remembering as the general lesson: **verify the check catches a case you know is broken before trusting a pass.**

Seat names come from each persona's `**Lens:**` line. Every persona carries one, so a new seat is covered the moment its file exists.

**Then record the run.** A prose report cannot be compared to another prose report, so every run also appends one line per scored panel to `data/councils/seo-council-eval/scores.jsonl`:

```
node .claude/skills/seo-council-eval/scripts/scores.cjs append '{"run_id":"...","date":"...","client":"...","url":"...","label":"...","vertical":"lead-gen","mode":"conformance","panels":1,"dimensions":{"entity":3,"geo":3,"intent":4.5,"eeat":5,"onpage":5,"fit":7},"weights":{"entity":0.30,"geo":0.20,"intent":0.15,"eeat":0.15,"onpage":0.10,"fit":0.10},"index_reported":"4.1","confidence":"moderate","verdict":"rework","report":"clients/.../file.md","notes":"..."}'
```

`append` recomputes the index from dimensions and weights, refuses the record if the stated index disagrees, if the weights do not sum to 1, or if the `run_id` is already taken, and warns if the weights do not match the declared vertical's overlay. Store the precise computed value in `index` and whatever the report published in `index_reported`; the report rounds to one decimal, the record does not.

Three fields carry more weight than they look:

- **`mode`** is `conformance` or `fallback`. Entity scores a different construct in each, so mixing them in an average is meaningless and the summary separates them.
- **`page_changed_since_prior`** must be set on any re-run of a URL already in the file. `false` means a corrected re-run on the same page state, which is repeatability evidence. `true` means the page actually changed, which is the only thing that can ever evidence sensitivity. Getting this wrong would let the skill claim its central promise on evidence that does not support it.
- **`superseded_by` / `supersedes`** link corrections to what they replace, so a bad run stays in the record as an audit trail without polluting the current set.

Then read the history back:

```
node .claude/skills/seo-council-eval/scripts/scores.cjs validate
node .claude/skills/seo-council-eval/scripts/scores.cjs summary
node .claude/skills/seo-council-eval/scripts/scores.cjs trend <client>
```

Backfilling the first ten runs earned this file its keep before it was finished. `validate` found that the Nexus run declared lead-gen but applied core weights, publishing 6.0 where the lead-gen overlay gives 5.9. `summary` found that strategic fit has never scored below 5 in ten runs, a 2-point range where every other dimension spans 4, which is a calibration problem in that dimension's anchors rather than a fact about the pages.

## Step 7 — Offer the rewrite handoff

If the verdict is "fix then ship" or "rework", offer to hand off to a rewrite step (**copy-council**, if your brain has one):

- The prioritized fix list becomes the brief.
- Sacred facts and the client's voice rules pass through as `sacred` and `voice`.
- Recommend the mode from what scored low: persuasion if strategic fit or conversion-adjacent dimensions dragged, clarity if the copy scored well on substance but reads foggy. Structural entity gaps need new copy, not a rewrite loop, which cannot add missing attribute coverage: route them to whatever content skill your brain has, or flag them for manual authoring.

If your brain tracks skill usage (the Agency Brain ships `tools/log-usage.cjs`), log the run: `node tools/log-usage.cjs seo-council-eval <client-slug>`. If that script is absent, skip this step.

## Re-score mode (re-running a page you have scored before)

When a URL is already in `scores.jsonl`, you rarely need a full panel again. Re-score mode re-runs only the dimensions whose **inputs** changed and carries the rest forward, which costs roughly 100k instead of 250k to 290k. Use it whenever you are scoring the same page a second time.

**First, decide which of two things you are doing, because they mean opposite things even though the mechanism is identical.**

1. **The page changed.** Someone acted on a fix list and the live page is genuinely different. Movement in the score is real signal, and this is the **only** case that can ever evidence sensitivity: whether the index actually moves when a page improves. That property is not yet evidenced, which is why this is a 0.9 release, so these are the runs worth capturing carefully.
2. **The page did not change, but your evidence did.** You found query data you had missed, or the first run scored on a source file that had dropped content. Movement here is a **correction, not progress**. Nothing about the page got better; you were scoring it on incomplete inputs.

Mistaking case 2 for case 1 would let this tool claim its central unproven promise on evidence that does not support it. The `page_changed_since_prior` field exists precisely to keep them apart, so set it honestly (see Step 6).

**The procedure:**

1. **Name what changed and map it to dimensions.** Ask which dimensions actually consumed the thing that moved. If new query evidence turned up, that is intent and usually strategic fit. If the page text changed, it is whichever dimensions read the changed sections. Dimensions read from inputs that did not change (often E-E-A-T and on-page, which score the page itself) do not need re-running.
2. **Re-run only those seats.** Build a brief and spawn a scoring agent for each changed dimension exactly as in Step 4, same independence rules. Do not re-run the unchanged seats.
3. **Carry the unchanged scores forward** from the prior record, unedited. They stay comparable to the original run precisely because they were not touched.
4. **Re-chair the index** from the new scores plus the carried ones, using the same weights. State in the report that it was a partial re-score and which dimensions were re-read.
5. **Record it** with `scores.cjs append`, setting `page_changed_since_prior` to `true` (case 1) or `false` (case 2), and linking the prior run with `supersedes` so the old record stays as an audit trail without polluting the current set. Both fields are described in Step 6.
6. **Read the movement back** with `scores.cjs trend <client>`. The summary keeps page-changed and corrected re-runs separate, so a correction can never be mistaken for progress on the page.

If you cannot tell which dimensions an input fed, run the full panel rather than guessing; a wrong partial re-score is worse than an expensive complete one.

## The roster

Anchor seats (default panel), persona files in `personas/`:

| Expert | Dimension | Weight |
|---|---|---|
| Koray Tugberk GUBUR | Entity and blueprint conformance | 25% |
| Mike King | GEO / AEO retrieval | 20% |
| Wil Reynolds | Search intent match (lead) | 20% |
| Lily Ray | E-E-A-T | 15% |
| Aleyda Solis | On-page mechanics | 10% |
| Kevin Indig | Strategic fit | 10% |

Six anchors, six dimensions, one owner each. Kevin Indig held both intent and strategic fit until 2026-08-08; those are close cousins, so his intent read came pre-shaped by his fit read. Wil Reynolds now leads intent from real query evidence, and Kevin keeps strategic fit alone. Weights did not change.

**The flex seat is the second reader on intent match**, which is why it is worth seating. Intent carries 20 percent and is the dimension where a single reader is thinnest. Wil Reynolds leads it from query evidence; the flex seat reads it second from its vertical's angle. **Always report both scores and take the mean at any gap size**; the gap sets confidence rather than deciding which reader wins, and at a gap of 3 or more the chair must classify the disagreement as target, format, execution, data, or lens. Full rule in `references/rubric-core.md`.

**Every persona below is built.** There is no unbuilt bench; pick the reader whose angle fits the page rather than defaulting to the first name.

Flex seats by vertical, second reader on intent:

| Vertical | Default | Alternates, and when to prefer them |
|---|---|---|
| ecommerce | Eli Schwartz | **Luke Carthy** when the question is catalogue architecture and where the revenue is hiding. **Kristina Azarenko** when it is technical: templates, facets, indexability, schema accuracy. |
| lead-gen / topical authority | Ross Hudgens | **Ryan Law** when the page may be decaying rather than mis-targeted, or when the issue is portfolio and internal competition. |
| local | Joy Hawkins | **Darren Shaw** when the problem is the local ecosystem: citations, categories, profile, proximity ceiling. **Claire Carlile** when it is the arriving customer and the practicality of the fix for a small business. |
| B2B | Eli Schwartz or Ross Hudgens | Eli reads intent from who types the query, Ross from what the competing pages deliver. Pick by whether the risk is targeting or execution. |
| conversion (optional 7th, any vertical) | Talia Wolf | Reuse from `../expert-council/personas/marketing/talia-wolf.md`. |

Anchor backups, for when a dimension's problem is a specialist one:

| Dimension | Anchor | Backups, and when to seat them |
|---|---|---|
| Entity | Koray Tugberk GUBUR | **Jason Barnard** for brand-entity clarity: rebrands, knowledge panels, same-name confusion. **Andrea Volpini** for machine-readability: schema accuracy, entity resolution, AI grounding. **Dawn Anderson** for how a retrieval system would read the page, especially on large or ambiguous sites. |
| GEO / AEO | Mike King | **Dan Petrovic** when there is observable citation evidence to measure rather than infer. **Bernard Huang** when the question is alignment with what the ranking set already covers. |
| E-E-A-T | Lily Ray | **Marie Haynes** for update-related situations and YMYL-heavy pages. **Glenn Gabe** when the problem is portfolio-level: templates repeating a defect thousands of times. |
| On-page | Aleyda Solis | **Cyrus Shepard** when the question is internal linking or titles specifically, and a data-grounded read helps. **Kristina Azarenko** when it is template and indexability. |
| Strategy | Kevin Indig | **Ryan Law** for content-portfolio economics: decay, maintenance cost, what to stop publishing. |

## References

- `references/rubric-core.md` — the six core dimensions, scoring anchors (what a 3 vs an 8 looks like), and default weights. Every run reads this.
- `references/calibration-method.md`: how to build your own scored anchors from `scores.jsonl` as runs accumulate, plus the process lessons that transfer without worked examples (statistical discipline, source fidelity, input verification, drift). Every scoring agent reads this. The skill ships no worked client examples; the written band anchors in `rubric-core.md` do the calibrating.
- `references/overlay-ecommerce.md`, `overlay-lead-gen.md`, `overlay-local.md`, `overlay-b2b.md` — vertical additions and weight shifts. Read only the selected one.
- `references/target-brief-template.md` — a one-page substitute for a blueprint and topical map, fillable in about ten minutes, with a worked example and a table of what each blank costs. Offer it whenever there is no blueprint.
- `references/report-template.md` — the exact report structure.
- `personas/` — anchor persona files with per-dimension scoring notes.
- `scripts/fetch-page.cjs` — captures a live page's real copy, complete link inventory, and computed on-page checks from raw HTML. **Required for every run on a published page.** Dependency-free Node. `--out <file>`, `--selector main|article|body`, `--expect <comma-separated URLs>`.
- `scripts/build-brief.cjs` — assembles one scoring agent's briefing (persona, rubric slice, overlay slice, calibration slice) into a single file. **Run once per seated expert before spawning.** `--dimension`, `--persona`, `--vertical`, `--source`, `--context`, `--out`.
- `scripts/read-xlsx.cjs` — dumps an `.xlsx` (the entity blueprint) to readable text. Dependency-free Node. `--list`, `--sheet "Name"`, `--max-rows N`.
