---
name: e2e-qa-testing
description: >
  Automated E2E QA testing for Next.js web applications using Playwright.
  Runs a discovery interview to understand the app, then custom-builds
  and executes a full test suite. AUTO-ACTIVATE when user mentions:
  "test the app", "QA testing", "e2e tests", "write playwright tests",
  "run tests", "find bugs", "test all features", "qa checklist"
---

# E2E QA Testing Skill

Automated end-to-end testing for Next.js apps. Interviews you about your app, discovers the codebase, builds a custom Playwright test suite, runs it, and reports results.

---

## Getting Started

### What This Skill Does

1. **Interviews you** (5-8 questions) to understand your app type, auth, features
2. **Discovers your codebase** — reads routes, components, config files automatically
3. **Builds a test plan** — shows you what it will test before writing any code
4. **Generates Playwright tests** — custom spec files tailored to YOUR app
5. **Runs and reports** — executes tests, fixes failures, produces a checklist with results

### Installation

If you're using the **8020brain template**, install via:

```
/plugin install e2e-qa-testing@a2ai-community
```

Then say **"test my app"** or **"run e2e tests"** — the skill activates automatically.

### Prerequisites

- **Claude Code** installed (Max or Team plan — requires tool use + long context)
- **Node.js 18+** installed
- **A Next.js project** with `npm run dev` (or equivalent) working
- **Playwright** — already included in the 8020brain root `package.json`. For standalone use: `npm install playwright && npx playwright install chromium`
- **Test user account** created in your app (if it has auth) — email + password you can share with the test runner
- **`.env.local`** with your app's environment variables configured

### What You DON'T Need

- No prior testing experience
- No existing test files
- No CI/CD setup
- No manual test plan — the skill builds one for you

### Claude Code Requirements

This skill uses:
- **Bash** — to run Playwright and install dependencies
- **Write** — to generate test files
- **Read/Glob/Grep** — to discover your codebase
- **AskUserQuestion** — for the interview phase

---

## Out of Scope

This skill does **not** cover:

- Visual regression / screenshot comparison
- Unit tests or component tests (E2E only)
- CI/CD pipeline setup (generates tests, doesn't configure pipelines)
- Load/stress testing or concurrent user simulation
- Accessibility (a11y) / WCAG auditing
- API-only testing (this tests through the browser)
- Cross-origin third-party flows (Stripe checkout, OAuth provider login pages)
- Database seeding or migration management
- Non-Next.js frameworks (React Router, Remix, etc.)
- Ongoing monitoring (one-time test suite generation)

---

## Phase 0: Preflight Check

Before starting the interview, verify the environment is ready. Run these checks silently and report any issues:

```
1. Check Node.js is installed: `node --version` (require 18+)
2. Check the project has a package.json
3. Check `next` is listed in dependencies or devDependencies
4. Check if Playwright is already installed: look for @playwright/test in package.json
5. Check if a dev server is already running: `lsof -i :3000 :3001`
```

**If any check fails**, tell the user what's missing before proceeding:
- No Node.js → "Install Node.js 18+ before continuing"
- No package.json → "This doesn't appear to be a Node.js project"
- No `next` dependency → "This skill is designed for Next.js apps. Your project doesn't have `next` as a dependency."
- No Playwright → Note it, will install in Phase 4

**If all checks pass**, proceed directly to Phase 1. Don't ask the user to confirm — just move on.

---

## Phase 1: Interview

Run 3 rounds of structured questions using AskUserQuestion. Load `references/interview-questions.md` for the full question bank.

### Round 1 — App Type & Stack

Ask these together in a single AskUserQuestion call:

1. **App type** — SaaS with auth / Marketing site / E-commerce / Dashboard / Other
2. **Auth provider** — Supabase / NextAuth / Clerk / Firebase / None
3. **Database** — Supabase / Prisma+Postgres / Drizzle / None (static site)
3b. **Router** — App Router / Pages Router / Both (ask if not obvious from discovery)

### Round 2 — Features & Flows

4. **Key user flows to test** (multi-select): Signup/Login, CRUD operations, Payments/billing, File uploads, API integrations, Search/filtering, Admin panel, Public pages
5. **AI or async processing features?** — Yes (describe) / No

### Round 3 — Environment & Scope

6. **Existing test setup** — None / Playwright already configured / Jest/Vitest only
7. **Dev server command and port** — e.g. `npm run dev` on port 3000
8. **What's out of scope?** — freeform (e.g. "Stripe checkout", "OAuth providers")

**After interview:** Summarise the answers back to the user in a compact table before proceeding.

---

## Phase 2: Discovery

After the interview, automatically analyse the project:

### 2.1 Read Project Structure
```
- package.json (dependencies, scripts)
- next.config.js / next.config.ts / next.config.mjs
- tsconfig.json
- app/ or pages/ directory tree (routes)
- middleware.ts (auth redirects, protected routes)
- .env.example or .env.local (variable names only, not values)
```

### 2.2 Map Routes
- List all page routes from the `app/` or `pages/` directory
- Identify dynamic routes (`[id]`, `[slug]`, `[...catch]`)
- Identify API routes (`app/api/` or `pages/api/`)
- Note route groups `(group)` and layouts

### 2.3 Identify Patterns
- **Auth pattern**: How login/signup works (form action, API call, redirect)
- **Data fetching**: Server components, client fetch, SWR/React Query
- **Forms**: Server actions, client-side submission, form libraries
- **Protected routes**: Middleware redirects, layout-level auth checks
- **State management**: Context, Zustand, Redux, URL state

### 2.4 Check Existing Test Setup
- Look for `playwright.config.ts`, `tests/` or `e2e/` directories
- Check for `jest.config.*`, `vitest.config.*`
- Note any existing test helpers or fixtures

---

## Phase 3: Test Plan

Generate a **Test Plan Summary** and present it to the user for approval before writing any code.

### Plan Format

```markdown
## Test Plan Summary

**App:** [name from package.json]
**Type:** [from interview]
**Auth:** [provider] | **DB:** [type]
**Base URL:** http://localhost:[port]

### Test Phases

| Phase | Tests | Description |
|-------|-------|-------------|
| 1. Smoke | ~5 | Homepage loads, key pages accessible, no console errors |
| 2. Auth | ~8 | Login, signup, logout, protected route redirect |
| 3. CRUD | ~10 | Create, read, update, delete for main entities |
| ... | ... | ... |

### Out of Scope (per interview)
- [items user excluded]

### Test User Required
- Email: [from .env or ask user]
- Password: [ask user to provide]

**Approve this plan to proceed with test generation.**
```

Wait for explicit user approval before moving to Phase 4.

---

## Phase 4: Generate Tests

Based on the approved plan, generate these files:

### 4.1 Playwright Config (if not existing)

Create `playwright.config.ts` with:
- Base URL from interview
- Chromium-only (default, fast)
- Timeout: 30s per test, 60s for navigation
- Screenshot on failure
- HTML reporter
- Web server config to auto-start dev server

### 4.2 Environment File

If `.env.local` doesn't already contain test variables, create `tests/e2e/.env.example` showing what's needed:

```env
# Required — test user credentials
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-test-password

# Optional — admin user (only if admin tests are generated)
TEST_ADMIN_EMAIL=your-admin@example.com
TEST_ADMIN_PASSWORD=your-admin-password

# Required if auth_provider == "Supabase"
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# The dev server URL (matches playwright.config.ts)
BASE_URL=http://localhost:3000
```

Tell the user to copy these into their `.env.local` with real values before running tests.

### 4.3 Test Helpers

Create `tests/e2e/helpers.ts` with:
- **Login helper** adapted to the auth provider (see `references/playwright-patterns.md`)
- **Navigation helper** with waiting strategies
- **API helper** for direct data manipulation (if applicable)
- **Cleanup helper** for test data

### 4.4 Spec Files

Generate ONLY the phases relevant to this app (from interview answers):

| Spec File | When Generated |
|-----------|----------------|
| `phase-01-smoke.spec.ts` | Always |
| `phase-02-auth.spec.ts` | Auth provider !== "None" |
| `phase-03-crud.spec.ts` | CRUD selected in flows |
| `phase-04-billing.spec.ts` | Payments selected in flows |
| `phase-05-uploads.spec.ts` | File uploads selected |
| `phase-06-search.spec.ts` | Search/filtering selected |
| `phase-07-admin.spec.ts` | Admin panel selected |
| `phase-08-public.spec.ts` | Public pages selected or Marketing site |
| `phase-09-api.spec.ts` | API integrations selected |
| `phase-10-security.spec.ts` | Always (basic XSS, CSRF checks) |

Load `references/test-templates.md` for boilerplate per app type.

### 4.5 Testing Checklist

Create `tests/e2e/TESTING-CHECKLIST.md`:

```markdown
# E2E Testing Checklist

| # | Test | Phase | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Homepage loads | Smoke | ⬜ | |
| 2 | Login with valid credentials | Auth | ⬜ | |
| ... | ... | ... | ... | ... |
```

Status legend: ✅ Pass | ❌ Fail | 🟡 Flaky | ⬜ Not run | ⏭️ Skipped

---

## Phase 5: Execute & Report

### 5.1 Run Tests Phase by Phase

```bash
npx playwright test tests/e2e/phase-01-smoke.spec.ts --reporter=list
```

Run each phase sequentially. After each phase:
- Update the checklist with results
- If failures occur, attempt to fix (up to 2 retries per test)
- Common fixes: locator updates, timeout increases, strict mode violations

### 5.2 Fix Common Failures

Load `references/playwright-patterns.md` when encountering:
- Strict mode violations (multiple matching elements)
- Hydration timing issues
- Server action form submissions not completing
- Download handling
- ISR/cached page issues

### 5.3 Final Report

After all phases complete, produce:

```markdown
## Test Results Summary

**Total:** X tests | ✅ X passed | ❌ X failed | 🟡 X flaky | ⏭️ X skipped

### Bugs Found

| # | Severity | Description | Phase | File:Line |
|---|----------|-------------|-------|-----------|
| 1 | 🔴 High | Login fails with valid credentials | Auth | phase-02:L45 |
| 2 | 🟡 Medium | Search results slow (>3s) | Search | phase-06:L23 |

### Recommendations
- [Prioritised list of fixes]

### Test Data Cleanup
- Signup tests may create orphan accounts (e.g. `test-{timestamp}@example.com`)
- CRUD tests may leave behind test items
- **Recommend** the user periodically cleans up test data, or add a cleanup step to the test helpers
```

---

## Adaptive Rules

These rules control what gets generated based on interview answers:

```
IF app_type == "Marketing site" THEN
  SKIP: auth, crud, billing, uploads, admin
  FOCUS: smoke, public pages, SEO meta, forms, responsive, links

IF app_type == "SaaS with auth" THEN
  INCLUDE: auth, crud, security
  CONDITIONAL: billing (if payments selected), admin (if admin selected)

IF auth_provider == "None" THEN
  SKIP: all auth tests
  SKIP: protected route tests
  ADJUST: no login helper needed

IF auth_provider == "Supabase" THEN
  USE: Supabase login helper (email/password via supabase-js)

IF auth_provider == "NextAuth" THEN
  USE: NextAuth login helper (credentials provider or direct session)

IF auth_provider == "Clerk" THEN
  USE: Clerk login helper (clerk-js testing utilities)

IF auth_provider == "Firebase" THEN
  USE: Firebase login helper (signInWithEmailAndPassword)

IF existing_tests == "Playwright already configured" THEN
  READ: existing playwright.config.ts
  EXTEND: don't overwrite, add new spec files alongside existing ones
  REUSE: existing helpers if compatible

IF existing_tests == "Jest/Vitest only" THEN
  CREATE: playwright.config.ts from scratch
  NOTE: existing unit tests won't conflict

IF "File uploads" IN selected_flows THEN
  INCLUDE: upload tests with inline Buffer.from() test files
  NOTE: No fixtures directory needed — test files are created inline in the spec

IF "AI/async" == true THEN
  USE: polling/retry patterns for async operations
  INCREASE: timeouts for AI processing steps
```

---

## Reference Loading

Load reference files on demand to keep context lean:

| Reference File | Load When |
|---------------|-----------|
| `references/interview-questions.md` | Phase 1 — before asking questions |
| `references/playwright-patterns.md` | Phase 4 (generating tests) and Phase 5 (fixing failures) |
| `references/test-templates.md` | Phase 4 — before generating spec files |

**Do not load all references at once.** Read them only when entering the relevant phase.

---

## Quick Reference: File Structure Generated

```
your-repo/
├── playwright.config.ts          (created if not existing)
├── tests/
│   └── e2e/
│       ├── .env.example          (test environment variables template)
│       ├── helpers.ts            (login, nav, API, cleanup helpers)
│       ├── phase-01-smoke.spec.ts
│       ├── phase-02-auth.spec.ts
│       ├── phase-03-crud.spec.ts
│       ├── ...                   (only phases relevant to app)
│       ├── phase-10-security.spec.ts
│       └── TESTING-CHECKLIST.md
```
