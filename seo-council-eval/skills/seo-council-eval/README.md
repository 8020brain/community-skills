# SEO Council (eval)

A council of named-lens SEO experts scores one page against a six-dimension rubric
and returns a numbered fix list. It evaluates copy; it does not rewrite it.

> **Notice.** The lenses are analytical perspectives built from named practitioners'
> published work. They are **not** those people. No named individual has reviewed,
> endorsed, contributed to, or is affiliated with this skill, and none has seen any
> page it scores. A run's scores and findings are the output of this tool, never the
> opinions or advice of the named practitioners, and must never be shown to a client
> as though a named person reviewed their page. See `NOTICE.md` and `PERSONAS.md`
> (which is also the removal route for anyone named here).

## Sixty seconds on what it does

You give it a page (a URL or a draft) and the query that page is meant to win. It
captures the page mechanically, assembles a briefing for each of six or seven
independent readers, and each reader scores one dimension only:

- **Entity and semantic coverage** (does the page cover the right attributes)
- **GEO / AEO retrieval** (is it built to be quoted by answer engines)
- **Search intent match** (two readers, because it carries the most weight)
- **E-E-A-T** (experience, expertise, authority, trust signals)
- **On-page mechanics** (headings, links, titles, structure)
- **Strategic fit** (does this page earn its place)

A chair weights the six into one **evaluation index** (one decimal, with a
confidence level), states where the readers disagreed, and merges every fix into
one ranked list with quick wins first. Verdict is ship, fix-then-ship, or rework.

## What it costs

A run is not cheap, and you should know before you start. A seven-reader panel is
roughly **250k to 290k tokens**, because each reader is a separate agent that can
genuinely disagree with the others rather than one mind wearing several hats. That
independence is the point of the tool. Cheaper configurations are documented in
`SKILL.md`: six readers is about 215k to 250k, and a re-score of only the
dimensions whose evidence changed is roughly 100k.

## The one required step

Every run must pass the attribution gate before its report is shared:

```
node scripts/check-attribution.cjs <report-path>
```

It refuses a report that presents a named practitioner as if they reviewed the
page. This is not a style check; it is what keeps the named lenses honest, and it
is mandatory, not a suggestion.

## Honest limits

Read these before you trust a number.

- **The index is ordinal, not a measurement.** It ranks pages and tracks one page
  over time. It is reported to one decimal because a decimal helps comparison, not
  because it is that precise.
- **Cross-agency comparability is unevidenced.** Your 6.2 and someone else's 6.2
  were not calibrated against each other. The index is for tracking your own pages,
  not for league tables.
- **Sensitivity is untested.** The instrument is proven to read the same twice on
  the same page. Nothing yet proves it moves when a page genuinely improves. That
  is the main reason this is a 0.9 release. The way to find out is to score a page,
  ship some fixes, and score it again.
- **It ships no worked scored examples.** Those were one agency's client pages. You
  get the full written anchors in `references/rubric-core.md` and the method for
  building your own anchors from your run history in `references/calibration-method.md`.
  Your first few runs will vary more than they will once you have a history.

## Where to go next

- `SKILL.md`: the full workflow, step by step.
- `INSTALL.md`: how to install and start a run.
- `references/target-brief-template.md`: a ten-minute substitute for an entity
  blueprint, which moves the heaviest-weighted dimension from guessing to scoring.
- `references/writing-a-persona.md`: how to add your own seat to the council.
- `NOTICE.md` and `PERSONAS.md`: the named-lens disclaimer and the removal route.
- `LICENSE`: MIT.
