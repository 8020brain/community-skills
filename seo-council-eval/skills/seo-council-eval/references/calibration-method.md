# Calibration method

This skill ships the written scoring anchors (in `rubric-core.md`) but no worked
scored examples. This file explains why, how to build your own, and the lessons
that transfer without them.

## Why no worked examples ship

The evaluation index ranks and tracks one page over time within one agency. It is
not evidenced as comparable across agencies, and it was never claimed to be. A
worked example scored by another agency on another client is therefore not a valid
anchor for your pages: reading it as one imports a comparability that does not
exist. So the scored examples do not ship, and the anchors that actually keep your
scores comparable, the written bands in `rubric-core.md` (what a 3 looks like, what
a 7 looks like, the severity conditions, the intent-gap rule), do.

One honest consequence: without worked examples, your first several runs will vary
more than they will once you have your own history to compare against. That is
expected. Build the history, and the variance settles.

## Build your own anchors

1. **Record every run.** Every scored panel appends one line to `scores.jsonl` via
   `scripts/scores.cjs append`. The command recomputes the index and refuses a
   record whose stated index, weights, or run id do not check out, so the file
   cannot quietly drift from the rubric.
2. **Read the distribution back.** `scripts/scores.cjs summary` prints each
   dimension's spread across your runs. This says something no single report can.
3. **Watch for a dimension that barely moves.** If one dimension returns roughly
   the same number regardless of the page while the others range widely, it is not
   contributing to the ranking, it is adding a constant. The cause is usually that
   its anchors are too generous at one end, or that the seat is reading an easier
   question than the anchors intend. In this rubric's early development, strategic
   fit and on-page mechanics both showed this tendency, so watch those two first,
   but confirm against your own runs rather than trusting that note.
4. **Capture the extremes.** New anchors are worth the most where your scale is
   compressed. A genuinely excellent page and a genuinely disposable one are the
   two most valuable anchors to write down, because the middle calibrates itself.

Re-run this analysis after any batch of new runs rather than trusting a snapshot,
especially while your set is small or several runs share a client.

## Lessons that transfer regardless of examples

These are the process failures that cost real reruns during this skill's
development. Each one produced output that looked completely fine, which is why
they are worth carrying.

### Check whether a small sample could have shown anything else

A run once treated a paid table (42 clicks, zero conversions) as decisive evidence
of intent failure. It was not: at a 2 percent conversion rate, 42 clicks expects
0.84 conversions, and observing zero has roughly a 43 percent chance on a perfectly
average page. Before any score rests on a number, check whether the sample could
have shown anything else. Small samples corroborate; they do not prove.

### A warning label does not make unreliable evidence usable

A run once built its source file from a summarizing fetcher, which silently dropped
several of the page's events and press links. Independent readers then scored the
page down for content that was live the whole time, and several built their
headline finding on the phantom absence. Each reader saw the fidelity caveat in the
source file and scored on it anyway. Most of this council's findings are absence
claims (no hub link, no price, no byline, no date), and absence is exactly what a
summarizer cannot establish. Capture the source mechanically with
`scripts/fetch-page.cjs`. If you are hand-transcribing a page into a source file,
stop: you are rebuilding the failure.

### Verify inputs, not just outputs

A run was once scored twice: once on a context pack that reported no query evidence,
and again after that evidence turned out to have been there all along. The index
moved, and one dimension moved a full two points. Two causes, both worth carrying,
and neither a reasoning failure.

- **A named example becomes a definition.** An instruction warned about a missing
  export and named one file as the example. The assembler checked that file, found
  it genuinely empty, and wrote "the export contains zero rows" while a populated
  export sat beside it. The warning caused the error it was written to prevent.
  Where an instruction names a file, a field, or a tool as an example, assume some
  reader will treat it as the complete list, and give them a lookup instead:
  `scripts/data-manifest.cjs` prints the real inventory.
- **A rule about one thing reads as a ban on everything near it.** A house rule
  excluding one data source was read as excluding a whole tool, and a run scored
  every dimension at reduced confidence while the data it needed sat one call away.
  When a rule excludes a source, state what it excludes and what it does not,
  because the person applying it will not carry the context that motivated it.

The part to be uneasy about: in that run the council's conclusion was right, reached
from the wrong evidence, and nothing in the output looked wrong enough to prompt a
check. That is the failure mode that survives review, and the only defence is
verifying inputs rather than sanity-checking outputs.

### Two readers on intent catch framing disagreements

Intent carries the most weight of any outcome dimension, and a single reader there
is thin. When the evidence for one run changed, the lead intent reader moved down a
point and the second moved up a point: opposite directions, same new facts, joint
score unchanged. A single reader would have reported that as a real one-point swing
in whichever direction it happened to land. Where two readers move oppositely, the
disagreement is about framing rather than about the page, and the joint number is
the more trustworthy object. The rule for reading an intent gap (take the mean at
every gap size, let the gap set confidence, classify a gap of 3 or more) is in
`rubric-core.md`.

### Re-score only the dimensions whose evidence changed

When correcting a run, ask which dimensions actually consumed the bad input. If
only intent and fit rested on the evidence that changed, re-score those and leave
the dimensions that were read from the page itself alone. The untouched scores stay
comparable to the original run, and the rerun costs a few agents instead of a full
panel.

### Name drift rather than absorbing it

When a run's scores feel systematically higher or lower than your own history, say
so in the report rather than quietly absorbing it. Drift creeps in two ways: a
harsh persona pulling numbers down across a run, and a sympathetic reading of a
client you like pulling them up. Both break comparability, which is the only reason
to score at all.
