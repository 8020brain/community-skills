# Writing a persona

How to add a seat to this council. A seat is a persona file in `personas/`; the
skill reads that directory, so a new file is a new available reader with no other
wiring.

## A seat is not a prompt

A prompt tells an agent what to do. A seat encodes *how a particular expert
notices things* so that, given the same page, it sees what the others miss. The
value of the council is the disagreement between seats, and disagreement only
happens if each seat reasons from a genuinely different frame. So the work of
writing a seat is not describing a job; it is capturing a lens: the frameworks a
practitioner is known for, the questions they ask first, the evidence they trust.

If your new seat would reach the same findings as an existing one, it is not worth
seating. Add it only when it brings an angle the panel does not already have.

## The rule that matters most: no invented quotes

This skill names living professionals. You are writing analytical commentary on
their **published** work, which is fair, not speaking for them, which is not.

**Never put a first-person quotation in a persona's mouth.** Do not write a "voice
tell" as a sentence in quotation marks in their idiom, however plausible. A
disclaimer elsewhere does not travel with a quotation, and a fabricated quote is
the single item most likely to cause a real person genuine offence. Describe how
the lens reasons, in the third person, instead:

- Wrong: `**Voice tell:** "I don't argue about whether a passage is liftable. Google is already quoting it."`
- Right: `**Voice tell:** reaches for the measurement rather than the argument; where a SERP feature already quotes a passage, treats that as settling whether it is liftable.`

Conceptual quoting ("asks what the page can rank for") and real book or framework
titles are fine. Invented speech is not.

## Required structure

Copy an existing file in `personas/` and keep its shape. Two lines are load-bearing
and are checked mechanically:

- **`**Lens:** ...`** near the top. This is how a report names the seat without
  naming the person ("Retrieval experiment lens, informed by published research").
  The attribution gate reads this line to serve the correct phrasing, so a seat
  without it cannot be attributed correctly.
- **`## Sources`** section. List the published work the lens derives from: books,
  talks, posts, the practitioner's own company or publication. This is what makes
  the file commentary on identifiable public material rather than an assertion of
  what someone thinks. Close it with the standing note that the scoring notes are
  this council's application, not statements the practitioner has made, and that no
  named individual has reviewed or endorsed the file.

The other sections (Identity, Expertise Profile, Core Philosophy, Key Frameworks,
Communication Style, Known Positions) give the lens its texture. Fill them from the
practitioner's public record. **Do not fabricate a citation or a position.** If you
cannot source something, drop it or mark it as inference in the file.

## How the gate reads your seat

`scripts/check-attribution.cjs` builds its roster by reading every file in
`personas/`. It collects each seat's names from the file's H1, its `Full Name`
field, and its filename, so a report is caught whether it writes "Michael King" or
"Mike King". You do not register a new seat anywhere; adding the file is enough, and
the gate will thereafter refuse any report that attributes a bare score to your
seat's person instead of to its lens. Run `check-attribution.cjs --personas` after
adding a file to confirm it satisfies the structural rules.

Add the seat to `PERSONAS.md` as well. The release gate checks that every named
seat appears there, because the removal process cannot honour a seat it does not
list.

## Per-dimension scoring notes: make them discriminate

The `## Per-dimension scoring notes (this council)` section is where the seat earns
its place. It should say what this lens looks at *in addition to* the shared anchors
for its dimension, in a way that would change the score. Vague notes ("cares about
quality") produce a reader indistinguishable from the others. Good notes name
specific evidence the lens privileges and the order it asks its questions in.

A strong scoring note also states the seat's discipline: what it does when it
cannot tell from the material provided. The best seats lower confidence and say so
rather than substituting a confident guess.

## Pick a dimension the seat actually sharpens

A seat is seated for one dimension. Choose the dimension where this practitioner's
frame is sharpest, not the one that is currently short a backup. A retrieval
experimentalist belongs on GEO / AEO; a local-search specialist belongs on the
local overlay's intent seat. The roster in `SKILL.md` shows which dimensions have
which anchors and backups; slot your seat where its angle is missing.

## A worked seat, in miniature

Say you want a seat for a practitioner known for measuring how answer engines cite
sources. You would:

1. Choose the dimension: GEO / AEO retrieval, as a bench backup to the anchor.
2. Write the `**Lens:**` line: "Citation-measurement lens, informed by published
   research on how generative systems select sources."
3. Fill Identity, Frameworks and Known Positions from their public work, with
   nothing invented.
4. Write the scoring note: it scores the dimension like the anchor and adds, in
   order, what is observably being cited now, how far each key passage sits from the
   query it should serve, and what experiment would settle the question. It labels
   measured versus inferred and lowers confidence where it cannot measure.
5. Write the voice tell in the third person, describing that habit, with no quote.
6. Add `## Sources` naming the research, and the standing disclaimer.
7. Add the seat to `PERSONAS.md`, then run `check-attribution.cjs --personas`.

That is a seat: a lens, sourced, gate-safe, and sharp on one dimension.
