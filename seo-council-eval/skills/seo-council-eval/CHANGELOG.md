# Changelog

## 0.9.0 - 2026-08-18

First public release. Version 0.9 rather than 1.0 for one honest reason: the
evaluation index is proven repeatable (it reads the same twice on the same page)
but its sensitivity, whether it moves when a page genuinely improves, is not yet
evidenced. See the README's "Honest limits" section.

- Six-dimension rubric with written band anchors, four vertical overlays
  (ecommerce, lead-gen, local, B2B), and a two-reader design on search intent.
- Independent per-dimension scoring by separate agents, so disagreements are
  discovered rather than authored.
- A mandatory attribution gate that keeps named practitioners represented as
  analytical lenses, never as if they reviewed a page.
- A scores log and the method for building your own calibration anchors over time.
- Re-score mode: when re-scoring a page already in the log, re-run only the
  dimensions whose inputs changed (roughly a third of the cost), with an explicit
  distinction between a page that genuinely changed and a corrected re-run.
- Works from nothing but a URL and a target query; every other input is optional
  with a stated cost.
