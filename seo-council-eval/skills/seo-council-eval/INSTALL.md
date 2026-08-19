# Install

This is a Claude skill, distributed as a plugin. Install it into your brain the
same way you install any skill from the marketplace it is published in, then start
a session and say "run the SEO council on this page" with a URL and a target query.

Once installed, the skill activates on its own when you ask to score or evaluate a
page for SEO. Read `SKILL.md` for the full workflow, `README.md` for a sixty-second
overview and the honest limits, and `NOTICE.md` for how the named lenses work.

It needs Node (for its bundled scripts) and, for the independent-scoring step, a
Claude client that can spawn subagents. Without subagents it still runs, scoring
each dimension in a separate pass; the report says which mode was used.
