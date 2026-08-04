# Auction Insights report columns

What the parser expects to find, and what to do when it does not.

## How matching works

`FIELD_MATCHERS` in `scripts/lib/ai-parse.cjs` (mirrored in
`scripts/consolidate-from-folder.gs`) holds a list of canonical fields and the
header fragments that identify each one. A header is lowercased, stripped of
accents and punctuation, then tested against the list **top to bottom, first match
wins**. Matching is on substrings, so capitalisation, trailing full stops and small
wording differences do not matter.

Order is load-bearing:

- `abs` is tested before `top`, because "Abs. Top of page rate" also contains
  "top of page".
- `ot` is tested before `imp`, because "Outranking share" also contains "share".

Change the order only if you know why it is that way.

## Expected columns

### Search network report

| Field | Google Ads (English) | Google Ads (Italian) |
|-------|----------------------|----------------------|
| `week` | Week ✅ | Settimana |
| `entity` | Display URL domain ✅ | Dominio dell'URL di visualizzazione |
| `imp` | Impression share ✅ | Quota impressioni |
| `ov` | Overlap rate ✅ | Tasso di sovrapposizione |
| `pos` | Position above rate ✅ | Tasso posizionamento superiore |
| `top` | Top of page rate ✅ | Tasso in alto nella pagina |
| `abs` | Abs. Top of page rate ✅ | Tasso in cima alla pagina |
| `ot` | Outranking share ✅ | Quota superamento target |

✅ = verified 28 Jul 2026 against a real UK manual download (one search ad group,
1 Apr - 27 Jul 2026). All seven mapped with nothing left unrecognised. Note the
metric is **"Impression share"** in the download, not
the "Impr. share" the interface shows in some views; the matcher accepts both.

`week` was verified separately on **29 Jul 2026**, from the first real UK scheduled
report file (one search campaign, daily 08:00, 1 Apr - 27 Jul 2026, 18 weeks).
Google writes it as plain **`Week`** in **column 1**, with
ISO dates (`2026-04-13`) marking the Monday of each week. `--inspect` mapped all
eight columns with nothing unrecognised. It could not be confirmed any earlier
because a manual download from the Auction Insights view has no week column at
all: it is a single snapshot of the whole date range.

The scheduled file carries a **two-row preamble** above the header (the report
name, then the date range in quotes), so the header is on line 3. `findHeaderRow`
scans for it, but note the preamble rows contain **no delimiter at all** — that is
why `detectDelimiter` counts delimiters across the first several lines rather than
reading line 1 only.

### Shopping report

| Field | Google Ads (English) | Google Ads (Italian) |
|-------|----------------------|----------------------|
| `week` | Week | Settimana |
| `entity` | Store name | Nome visualizzato negozio |
| `imp` | Impr. share | Quota impressioni |
| `ov` | Overlap rate | Tasso di sovrapposizione |
| `ot` | Outranking share | Quota superamento target |

The Italian column names are taken from a real Italian report (Andrea Lombardi's
original). The English names are verified as marked above.

Values also confirmed against that download: UK dot decimals (`9.64%`), `< 10%`
for a suppressed share, and `" --"` **with a leading space** for not applicable.
The parser trims, so the leading space is harmless, but do not "tidy" it out of a
test fixture: it is what Google actually writes.

## Report type

Type is decided from the columns present, not from the file name: a report with at
least two of `pos`, `top`, `abs` is a search network report, otherwise it is
treated as Shopping. A Manifest entry that declares its type overrides this.

## Adding a column name

1. Run `--inspect` and note the exact header text that came back as `(not found)`
   or landed in the wrong field.
2. Add a lowercase fragment of it to the right entry in `FIELD_MATCHERS`, in
   **both** `scripts/lib/ai-parse.cjs` and `scripts/consolidate-from-folder.gs`.
   Pick a fragment specific enough not to collide with another field.
3. Add a case to `scripts/lib/ai-parse.test.cjs`.
4. Run `node scripts/lib/ai-parse.test.cjs`.
5. Run `--inspect` again and confirm the mapping.

## Value formats

| In the report | Parsed as |
|---------------|-----------|
| `46.75%` (UK) | `46.75` |
| `46,75%` (IT) | `46.75` |
| `< 10%` | `5` (midpoint of the 0-10% band; flagged on the dashboard) |
| `--` | `null` (not applicable, e.g. overlap on your own row) |
| empty, `n/a` | `null` |

The decimal separator is worked out per value: when both a dot and a comma appear,
the rightmost is the decimal separator; a lone separator is always a decimal point,
because these metrics are percentages between 0 and 100 and cannot carry thousands
grouping.

## The "You" row

Recognised in any report language: you, tu, tú, sie, vous, você, voce, du, usted.
Always normalised to `You`. Add to `YOU_LABELS` in both files if another language
turns up.
