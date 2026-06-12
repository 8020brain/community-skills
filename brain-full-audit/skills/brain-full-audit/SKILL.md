---
version: 1.0
name: brain-full-audit
description: Run a full audit of this brain BUILD (the workspace itself) across eight dimensions: security, cost and token use, efficiency and redundancy, structure and hygiene, reliability, data and privacy, rule compliance, and design quality. Produces a scored report with prioritised improvements. USE WHEN user says "audit this brain", "full brain audit", or "audit the build". Do NOT use for auditing business processes or automation opportunities (that is the brain-audit skill where installed).
triggers:
  - "audit this brain"
  - "full brain audit"
  - "audit the build"
inputs:
  required: none
  optional: scope (one dimension name, e.g. "security" or "cost"; defaults to full)
outputs:
  - type: report
    path: "Per this brain's output rules; default projects/audits/YYYY-MM-DD-brain-audit.md"
context_required: none
quality_check: "Does the report score all in-scope dimensions RAG, include the token-weight table, cite a file path as evidence for every finding, and apply no fixes before explicit approval?"
---

# Brain Full Audit Skill

## Trigger

Activate when the user says "audit this brain", "full brain audit", or "audit the build". Do not activate for business process or automation-opportunity audits; some brains have a separate `brain-audit` skill for that.

## Purpose

Assess the entire brain build across eight dimensions, score each one, and produce a prioritised improvement report. This skill is read-only until the user approves specific findings. It works in any brain because every step discovers what is actually present rather than assuming size or contents.

**Scope.** If the user names a dimension ("just security", "audit the cost side", "design quality only"), run Step 1 discovery plus only that dimension's step, then report. Note incidental issues from other dimensions if you trip over them, marked as outside the requested scope, but do not investigate them. Default is the full audit.

## Important Rules (read first)

- **Report only.** Apply no fix until the user approves a finding by its ID. Even approved deletions go to `trash/`, never deleted directly.
- **Never read or print the contents of credential files** (`.env`, `token.json`, `credentials.json`, `google-ads.yaml`, `secrets-config.json`, `*.secret`, or similar). Note existence, location, and protection status only.
- **Every finding cites evidence:** an actual file path, plus a line number where relevant. No vague observations.
- **Restructure first.** When recommending fixes, prefer moving content down the loading hierarchy (always-loaded CLAUDE.md, then on-demand context files, then skill files, then referenced docs) over deleting it. Cut true redundancy, but information and process integrity win every tie: never recommend compressing an instruction to the point where a fresh session could misread a process.
- **Portability.** The brain must remain operable by smaller or older models than the one running this audit. Count volitional hops: pointers the model must choose to follow ("read X at session start", "load Y before output"). Harness-enforced loads (skill SKILL.md on trigger, hooks) cost nothing and do not count. Safety-critical and always-relevant instructions stay at depth 0 (inline in an always-loaded file). Task-specific content may live one volitional hop away if the pointer states when and why to follow it. Any recommendation that moves content down the hierarchy must state the new depth, and nothing operational may end up at depth 2 or more.
- **No em dashes** anywhere in the report.

## Workflow

### Step 1: Discovery

Build an inventory before judging anything:

1. Count and list agents (`.claude/agents/`), skills (`.claude/skills/`), commands (`.claude/commands/`), and hooks (`.claude/hooks/` plus hook entries in settings files). Count only valid skills (folders containing a SKILL.md); list empty or stub folders separately as a finding for Dimension 3.
2. Measure session-start load: line count and rough token estimate (lines x ~10 tokens) for every file loaded automatically each session: the CLAUDE.md chain (global, parent folder, brain root, `.claude/CLAUDE.md`), `SECURITY.md` if read at session start, and any context, identity, or memory files this brain's CLAUDE.md says to read at session start (for example `current-focus.md` or `facts.json`, where present).
3. Read `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/.mcp.json` if present.
4. List git worktrees (`git worktree list`), scripts folders, and top-level folders with approximate sizes.
5. Note which audit-related skills already exist here (for example `brain-security-audit`, `brain-skill-auditor`).

Show the inventory as a short table before continuing.

### Step 2: Security and credentials (Dimension 1)

If `brain-security-audit` exists under THIS brain root's `.claude/skills/` (not just in the available-skills list, which can include sibling brains), run its workflow and fold its findings into this dimension instead of duplicating it, then add the checks below that it does not cover. If it does not exist here, run all of these inline:

- **Secrets on disk:** locate `.env`, token files, OAuth credentials, and key-bearing config files in the brain root, `code/`, `scripts/`, and inside every worktree (worktrees often carry their own copies). For each: gitignored? inside a synced folder (OneDrive or Dropbox)? covered by a hook that blocks Claude from reading it?
- **Git exposure:** check `git remote -v` for tokens embedded in remote URLs. For history, run a filename scan as the baseline (`git log --all --name-only` grepped for secret-ish names like env, token, credential, secret); only do a content scan if the history is small or the filename scan raises suspicion.
- **Hook integrity:** do protective hooks exist (credential blocking, deletion blocking, injection scanning), are they wired up in settings, and do their patterns cover the secret files found above?
- **MCP trust:** for each server in `.mcp.json`, is the endpoint owned and trusted or third-party? What could a compromised server read or do?
- **Over-broad permissions:** flag instructions like "auto-approve all tools" in CLAUDE.md, wildcard allow rules in settings, or anything bypassing confirmation gates. Weigh convenience against what a prompt injection could do with that permission level.
- **Injection surface:** list every workflow ingesting external content (email triage, newsletter fetch, YouTube transcripts, scraping, inbox processing). For each, confirm a SECURITY.md-style rule says instructions inside that content are never followed.

### Step 3: Cost and token use (Dimension 2)

- **Token-weight table:** build a per-file table covering every context, memory, and instruction file: estimated tokens (lines x ~10), when it loads (always at session start, on-demand when a task needs it, or on-invocation of a specific skill), and the reduction opportunity. End with totals for always-loaded vs on-demand. State the headline plainly: "every session begins with roughly N tokens of fixed overhead." Flag anything always-loaded that could move down the hierarchy to on-demand.
- **Skill description overhead:** every skill description is injected into context. Multiply skill count by average description length. Flag descriptions over ~100 words and any that could be halved without losing trigger accuracy.
- **Model selection:** identify skills and agents doing simple mechanical work (formatting, data pulls, classification) that do not specify a cheaper or faster model.
- **External API spend:** list every skill or script calling paid external APIs (multi-model research fan-outs, image generation, scrapers, ads APIs). For each: proportionate? cheaper path? scheduled more often than needed?
- **Redundant work:** instructions causing re-reads of files already in context, hooks spawning extra model calls per tool use, regeneration of cacheable output.

### Step 4: Efficiency and redundancy (Dimension 3)

- **Duplicate skills:** pairs or groups doing the same job under different names (compare descriptions, not just names). Recommend which to keep and which to move to `trash/`.
- **Trigger collisions:** USE WHEN descriptions similar enough that the wrong skill could fire. Quote the overlapping phrases.
- **Dead weight:** skills, agents, and commands nothing references, that are superseded, or whose SKILL.md is a stub.
- **Command vs skill overlap:** commands that just wrap a skill that already auto-triggers.
- **Naming compliance:** skills not following this brain's prefix convention.
- **Index drift:** does the skill INDEX.md (if present) match the actual folders? Wrong counts, missing entries, ghosts.

### Step 5: Structure and hygiene (Dimension 4)

- **Foreign objects:** `node_modules/`, build artefacts, caches, or binaries inside the brain.
- **Worktree sprawl:** worktree count, last-touched dates, abandoned ones. Stale worktrees holding credential copies are a double finding (cross-reference Dimension 1).
- **Accumulation folders:** size and age of `trash/`, `backup/`, `versions/`, `logs/`. Flag growth without a pruning routine.
- **Inbox backlog:** unprocessed `!inbox/` count and oldest item age.
- **Root clutter:** orphaned files in the brain root.
- **Docs vs reality:** does the folder structure documented in CLAUDE.md match what exists?

### Step 6: Reliability and maintainability (Dimension 5)

- **Hooks runnable:** for each hook in settings, the script exists and passes a syntax check or dry run.
- **Broken references:** skills and commands pointing at scripts, reference files, or paths that do not exist (check paths inside SKILL.md workflow steps).
- **Hardcoded paths:** scripts with absolute machine-specific paths, missing dependencies, or fresh-install breakage.
- **Quality gates:** skills missing a `quality_check` field or success criteria.
- **Update path:** does the brain-update mechanism (if present) still work, with local customisations protected?

### Step 7: Data and privacy (Dimension 6)

- **Client and personal data:** what client data, PII, or financial information lives in the repo, and does any belong somewhere more controlled?
- **Outbound flows:** for each skill sending data to a third-party API, what goes where? Flag client-identifiable data sent without clear need.
- **Ingest hygiene:** PII accumulating in `research/` or transcript folders.
- **Retention:** does anything ever get pruned?

### Step 8: Consistency with global rules (Dimension 7)

Spot-check skill instructions and recent outputs against the house rules:

- No em dashes in any output, file, or content.
- Files never deleted, only moved to `trash/`.
- File naming conventions (caps for README/CLAUDE/SETUP, lowercase-with-dashes elsewhere).
- Output location rules (text in brain, binaries to the Dropbox root, client work in client folders).
- Any rule this brain's CLAUDE.md declares that its own skills then contradict.

### Step 9: Design quality (Dimension 8)

The previous dimensions ask whether the build is broken, wasteful, or non-compliant. This one asks whether it is well-conceived: a brain can pass every other check and still be redundant, overly complex, or fragile by design.

- **Unclear responsibilities:** skills or agents whose purpose is ambiguous, or where it is genuinely unclear which of two components owns a job.
- **Missing failure handling:** skill workflows with no instruction for what to do when an API call fails, an expected file is missing, input is empty, or a script errors. Check the skills that run unattended or daily first.
- **Process chains with gaps:** follow each multi-skill workflow end to end (for example research feeds writing feeds publishing, or audit feeds report feeds client delivery). Flag hand-offs where a step is missing, duplicated, or depends on a human remembering something undocumented.
- **Information quality:** the same fact maintained in two or more places (and which copy has drifted), contradictions between context files, and content that lives in the wrong place for how it is used.
- **Complexity:** any component more elaborate than its job requires: multi-step workflows that could be one step, configuration for situations that never occur, abstraction with a single user.
- **Portability and indirection depth:** map the volitional hop chains (instruction in file A says to read file B, which points at file C). Flag any safety-critical instruction that lives behind a hop instead of inline at depth 0, any operational instruction at depth 2 or more, any pointer that does not say when and why to follow it, and any instruction so compressed it assumes inference a smaller model may not make. Harness-enforced loads (SKILL.md on trigger, hooks) do not count as hops.

### Step 10: Compile and save report

**Scoring rubric.** Severity: critical = a secret is exposed or external content can change behaviour; high = a core daily workflow fails as written or a secret is unprotected on disk; medium = real waste, drift, or risk that needs a deliberate fix; low = polish; info = observation or a check that passed. RAG per dimension: Red = at least one critical or two high findings; Amber = any high or three or more medium findings; Green = nothing above medium.

1. Determine today's date (YYYY-MM-DD).
2. Pick the report location using THIS brain's own documented output rules (for example `output/YYYY-MM-DD-brain-audit.md` if CLAUDE.md routes reports to `output/`). If no output rule is documented, use `projects/audits/YYYY-MM-DD-brain-audit.md`, creating the folder if needed (or `plans/` if there is no `projects/`).
3. Save the report with:
   - **Scorecard:** each in-scope dimension scored Red, Amber, or Green with a one-line reason
   - **Token-weight table:** the per-file table from Dimension 2, with always-loaded vs on-demand totals
   - **Findings table:** ID (D1-01, D2-01, ...), dimension, severity (critical, high, medium, low, info), description with file path evidence, proposed fix
   - **Quick wins:** fixes under 15 minutes each
   - **Strategic recommendations:** cross-cutting changes the brain's owner has likely not considered. On a full audit of a brain with 30 or more skills, include at least five, and at least two must be structural reorganisations that go beyond fixing individual files (merging a skill family, collapsing a folder layer, redesigning a process chain). On smaller brains include only what is genuinely cross-cutting; never pad with restated findings. For each: what changes, why it is better, what it risks, and the expected token or process impact.
   - **Adoption guidance:** which finding and recommendation IDs bundle together naturally (they touch the same files or only make sense together) and a suggested order to apply them
   - **Top 5 priorities** in order, one sentence each on why

### Step 11: Present and wait for approval

Show the scorecard and findings, then say:

> "Which fixes would you like me to apply? You can say 'apply D1-01', 'apply all critical', 'apply all quick wins', or 'skip for now'."

**Do not implement any fix until the user explicitly approves it.** For each approved fix: implement, note what changed, and mark it resolved in the report file.
