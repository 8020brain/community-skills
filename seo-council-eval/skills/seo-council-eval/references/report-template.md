# Report template

House style applies throughout: no emojis, no em dashes, no horizontal rules, complete sentences. Run ai-check before the report goes to a client.

## Attribution: lenses, not consultations

**Never present a seat as though the named person reviewed the client's page.** They did not. Each seat is an analytical lens built from that practitioner's published frameworks, and a client reading "Lily Ray on E-E-A-T: 4/10" could reasonably conclude Lily Ray was consulted. That would be a misrepresentation.

In any report, name seats in lens form and carry the disclaimer below verbatim:

**Every persona file carries its own `**Lens:**` line. Use that phrasing verbatim rather than inventing one.** This list used to be hardcoded here and covered only the six anchors, which left sixteen bench seats with no approved phrasing and meant any run seating them had to improvise. Read the seat's persona file instead:

```
grep -h "^\*\*Lens:\*\*" .claude/skills/seo-council-eval/personas/<slug>.md
```

For example, `koray-tugberk-gubur.md` gives "Entity and semantic lens, informed by Koray Tugberk GUBUR's published topical authority frameworks", and `dan-petrovic.md` gives "Retrieval experiment lens, informed by Dan Petrovic's published research".

**Two places the name must not appear bare.** In a findings heading, put the dimension in the heading and the lens on an italic line beneath it:

```
### GEO and AEO retrieval: 7/10

*Retrieval lens, informed by Mike King's relevance engineering work.*
```

In the scorecard table, the Lens column takes the short form, `Retrieval lens (Mike King)`, not the bare name.

**Verify before the report ships:**

```
node .claude/skills/seo-council-eval/scripts/check-attribution.cjs <report-path>
```

It exits non-zero on a missing disclaimer or a bare name in any heading or table row, and prints the correct lens phrase for each seat it flags. This is a script rather than a reminder because the reminder failed: the rule was stated plainly here and ignored in six of the first ten reports, five of which sat in client folders.

Required disclaimer, near the top of every report:

> The lenses below are analytical perspectives built from each practitioner's published work. They are not consultations, endorsements, or opinions given by the named individuals, none of whom has reviewed this page.

The persona files and their voices stay internal. They exist because they make the lenses notice genuinely different things, which is the point of running more than one reader. What changes is the label on the output, not the machinery behind it.

```markdown
---
council: seo-council-eval
date: YYYY-MM-DD HH:MM
client: <slug or "standalone">
vertical: <ecommerce | lead-gen | local | b2b>
target_query: <the query>
page: <path or URL>
blueprint_on_file: <true | false>
experts: <comma-separated names>
index: <n.n>
confidence: <high | moderate | low>
verdict: <ship | fix then ship | rework>
---

# SEO Council: <page label>

**Verdict: <verdict>. Evaluation index <n.n>/10, confidence <level>.**

> The lenses below are analytical perspectives built from each practitioner's
> published work. They are not consultations, endorsements, or opinions given by
> the named individuals, none of whom has reviewed this page.

The index ranks and tracks; it does not measure. It is reliable for comparing
this page against itself over time. Treat comparisons to a different client's
page as indicative only.

<If no blueprint: **No blueprint on file.** The entity score below measures raw
semantic coverage, not conformance to a blueprint. Running diagnostics and the
entity brand blueprint would let the next evaluation score against the client's
actual framework.>

One-paragraph summary: what the page is trying to win, what the council
concluded, and the single highest-impact fix.

## Scorecard

| Dimension | Lens | Score | Confidence | Weight | Weighted |
| ... one row per dimension, then the index row ... |

Scores are whole numbers. The index is reported to one decimal, never two.
Where a dimension is provisional because critical evidence was absent, mark it
so in the confidence column and say what was missing rather than filling the
slot with a guess.

### Evidence register

What the scoring rested on, and what it could not: extraction confidence from
the fetch script, whether a blueprint and topical map were on file, whether
query evidence existed, and anything that was checked and found unavailable.
State plainly where a dimension changed construct, for example an entity seat
scoring inferred coverage rather than blueprint conformance.

## Where the experts disagreed

Plain statement of any real disagreements, including a joint intent score
that split by more than 2. If the panel broadly agreed, one line saying so.

## Expert findings

### <Expert name> on <dimension>: <score>/10

Findings in the expert's voice, each anchored to a quote from the copy.
3-6 findings. Then their fixes, tagged quick-fix or structural.

(repeat per expert)

## Prioritized fix list

Merged and deduplicated, ranked by expected impact. Quick-fixes first.

1. **[quick-fix]** <fix> (raised by <expert(s)>; expected impact: <one line>)
2. **[structural]** ...

## Next step

<The chair's recommendation: ship as is / hand the fix list to copy-council
(state which mode and why) / send structural entity gaps back to
seo-content-creator / run diagnostics and the blueprint first.>

Want to dig deeper? Use /expert-followup <expert-name> to continue the
conversation with any expert on this panel.
```
