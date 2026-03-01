# Interview Questions — E2E QA Testing Skill

Full question bank for the discovery interview. Questions are grouped into 3 rounds and designed to be asked via `AskUserQuestion`.

---

## Round 1 — App Type & Stack

### Q1: What type of app is this?

**Purpose:** Determines which test phases are relevant. A marketing site needs zero auth/CRUD tests; a SaaS app needs them all.

**AskUserQuestion config:**
```
question: "What type of app is this?"
header: "App type"
multiSelect: false
options:
  - label: "SaaS with auth"
    description: "Users sign up, log in, and use features behind authentication"
  - label: "Marketing site"
    description: "Public-facing website with pages, blog, contact forms — no user accounts"
  - label: "E-commerce"
    description: "Product listings, cart, checkout — may or may not have user accounts"
  - label: "Dashboard"
    description: "Internal tool or data dashboard — usually behind auth"
```

**Maps to:**
| Answer | Phases Included |
|--------|----------------|
| SaaS with auth | Smoke, Auth, CRUD, Security + conditionals |
| Marketing site | Smoke, Public pages, Security |
| E-commerce | Smoke, Public pages, CRUD (products/cart), Security + conditionals |
| Dashboard | Smoke, Auth, CRUD, Search/filtering, Security |

**Default if skipped:** SaaS with auth (most comprehensive)

---

### Q2: What auth provider does the app use?

**Purpose:** Determines which login helper pattern to generate. Each provider has a different programmatic login approach.

**AskUserQuestion config:**
```
question: "What auth provider does the app use?"
header: "Auth"
multiSelect: false
options:
  - label: "Supabase"
    description: "Supabase Auth with email/password, magic link, or OAuth"
  - label: "NextAuth (Auth.js)"
    description: "NextAuth.js / Auth.js with credentials, OAuth, or magic link providers"
  - label: "Clerk"
    description: "Clerk authentication with pre-built components"
  - label: "Firebase"
    description: "Firebase Authentication"
```

**Maps to:**
| Answer | Helper Pattern |
|--------|---------------|
| Supabase | `supabase.auth.signInWithPassword()` via API, set session cookie |
| NextAuth | POST to `/api/auth/callback/credentials` or direct session manipulation |
| Clerk | `clerk-js` testing utilities or cookie-based session |
| Firebase | `signInWithEmailAndPassword()` via Firebase SDK |
| None / Other | Skip auth helper entirely |

**Default if skipped:** None (no auth tests generated)

---

### Q3: What database does the app use?

**Purpose:** Determines data cleanup strategy and whether we can use direct DB access for test setup/teardown.

**AskUserQuestion config:**
```
question: "What database does the app use?"
header: "Database"
multiSelect: false
options:
  - label: "Supabase (Postgres)"
    description: "Supabase with its Postgres database and client library"
  - label: "Prisma + Postgres"
    description: "Prisma ORM with PostgreSQL"
  - label: "Drizzle"
    description: "Drizzle ORM with any SQL database"
  - label: "None (static)"
    description: "No database — static site or external API only"
```

**Maps to:**
| Answer | Cleanup Strategy |
|--------|-----------------|
| Supabase | Use Supabase service role key for direct cleanup |
| Prisma + Postgres | Use Prisma client in test helpers |
| Drizzle | Use Drizzle client in test helpers |
| None | No cleanup needed — UI-only tests |

**Default if skipped:** None (no direct DB manipulation in tests)

---

### Q3b: App Router or Pages Router?

**Purpose:** Determines route discovery paths, server action testing, and middleware patterns. Only ask if Q1 answer includes Next.js.

**AskUserQuestion config:**
```
question: "Does your Next.js app use the App Router (app/ directory) or Pages Router (pages/ directory)?"
header: "Router"
multiSelect: false
options:
  - label: "App Router (Recommended)"
    description: "Uses the app/ directory with layouts, server components, and server actions"
  - label: "Pages Router"
    description: "Uses the pages/ directory with getServerSideProps/getStaticProps"
  - label: "Both (hybrid)"
    description: "Mix of app/ and pages/ directories — some routes use each"
```

**Maps to:**
| Answer | Test Adjustments |
|--------|-----------------|
| App Router | Discover routes from `app/`, test server actions, expect RSC patterns |
| Pages Router | Discover routes from `pages/`, expect traditional form submissions, getServerSideProps data fetching |
| Both | Check both directories, test patterns from each |

> **Note:** If unsure, the discovery phase (2.2) will auto-detect by checking which directories exist. This question helps prioritise patterns.

**Default if skipped:** App Router (auto-detected during discovery)

---

## Round 2 — Features & Flows

### Q4: Which user flows should we test?

**Purpose:** Directly determines which spec files get generated. Only selected flows produce test phases.

**AskUserQuestion config:**
```
question: "Which key user flows should we test?"
header: "Flows"
multiSelect: true
options:
  - label: "Signup & Login"
    description: "User registration, login, logout, password reset, session management"
  - label: "CRUD operations"
    description: "Creating, reading, updating, and deleting the app's main data (e.g. projects, posts, records)"
  - label: "Payments / billing"
    description: "Subscription management, plan upgrades, billing pages (Stripe boundary only)"
  - label: "File uploads"
    description: "Uploading files, images, documents — processing and display"
```

**Additional options (shown as second question if needed):**
```
question: "Any other flows to test?"
header: "More flows"
multiSelect: true
options:
  - label: "Search & filtering"
    description: "Search functionality, filters, sorting, pagination"
  - label: "Admin panel"
    description: "Admin-only pages, user management, settings, configuration"
  - label: "Public pages"
    description: "Marketing pages, blog, about, pricing — SEO meta, links, responsive"
  - label: "API integrations"
    description: "Features that call external APIs (AI processing, email sending, etc.)"
```

**Maps to:**
| Selection | Spec File Generated |
|-----------|-------------------|
| Signup & Login | `phase-02-auth.spec.ts` |
| CRUD operations | `phase-03-crud.spec.ts` |
| Payments / billing | `phase-04-billing.spec.ts` |
| File uploads | `phase-05-uploads.spec.ts` |
| Search & filtering | `phase-06-search.spec.ts` |
| Admin panel | `phase-07-admin.spec.ts` |
| Public pages | `phase-08-public.spec.ts` |
| API integrations | `phase-09-api.spec.ts` |

**Always generated regardless of selection:**
- `phase-01-smoke.spec.ts` (basic app health)
- `phase-10-security.spec.ts` (basic XSS/CSRF checks)

**Default if skipped:** All flows selected

---

### Q5: Does the app have AI or async processing features?

**Purpose:** AI features and long-running async tasks need special timeout and polling patterns.

**AskUserQuestion config:**
```
question: "Does the app have AI or async processing features (e.g. AI text generation, background jobs, email sending)?"
header: "Async"
multiSelect: false
options:
  - label: "Yes"
    description: "Some features involve AI processing, background jobs, or async operations that take time"
  - label: "No"
    description: "All operations complete synchronously or near-instantly"
```

**Maps to:**
| Answer | Test Adjustment |
|--------|----------------|
| Yes | Add polling helpers, increase timeouts to 60s for async steps, add retry logic |
| No | Standard 30s timeouts, no polling patterns needed |

**If Yes:** Follow up by asking what the async features are (freeform) so tests can target them specifically.

**Default if skipped:** No

---

## Round 3 — Environment & Scope

### Q6: Do you have an existing test setup?

**Purpose:** Determines whether to create playwright.config.ts from scratch or extend existing setup.

**AskUserQuestion config:**
```
question: "Do you have any existing test setup?"
header: "Tests"
multiSelect: false
options:
  - label: "None"
    description: "No testing framework configured — starting fresh"
  - label: "Playwright already configured"
    description: "playwright.config.ts exists with some tests already written"
  - label: "Jest or Vitest only"
    description: "Unit/integration tests exist but no E2E testing setup"
```

**Maps to:**
| Answer | Action |
|--------|--------|
| None | Create playwright.config.ts, install dependencies |
| Playwright configured | Read existing config, extend with new specs, reuse helpers |
| Jest/Vitest only | Create playwright.config.ts (won't conflict with existing unit tests) |

**Default if skipped:** None

---

### Q7: What's your dev server command and port?

**Purpose:** Configures the `webServer` block in playwright.config.ts and sets the base URL.

**AskUserQuestion config:**
```
question: "What command starts your dev server and what port does it run on?"
header: "Dev server"
multiSelect: false
options:
  - label: "npm run dev on 3000 (Recommended)"
    description: "Standard Next.js dev server — npm run dev on http://localhost:3000"
  - label: "npm run dev --turbo on 3000"
    description: "Next.js with Turbopack — npm run dev --turbo on http://localhost:3000"
  - label: "pnpm dev on 3000"
    description: "Using pnpm — pnpm dev on http://localhost:3000"
  - label: "bun dev on 3000"
    description: "Using Bun — bun dev on http://localhost:3000"
```

> **Note:** If the user selects "Other", also accept `yarn dev` and custom port numbers. Extract the command and port from their freeform response.

**Maps to:**
- `playwright.config.ts` → `webServer.command` and `use.baseURL`

**Default if skipped:** `npm run dev` on port 3000

---

### Q8: What's out of scope for testing?

**Purpose:** Prevents generating tests for features the user wants to exclude (third-party services, incomplete features, etc.)

**AskUserQuestion config:**
```
question: "Anything you want to exclude from testing? (e.g. Stripe checkout, OAuth login, incomplete features)"
header: "Exclusions"
multiSelect: false
options:
  - label: "Nothing — test everything"
    description: "No exclusions, test all selected flows"
  - label: "Third-party checkout (Stripe, PayPal)"
    description: "Skip payment processing — test up to the checkout boundary only"
  - label: "OAuth provider login pages"
    description: "Skip Google/GitHub/etc. login — test email/password auth only"
```

The "Other" option (always available in AskUserQuestion) handles custom exclusions via freeform text.

**Maps to:**
- Exclusion list in the Test Plan Summary
- Conditional skips in spec generation
- Comments in spec files explaining why certain tests are excluded

**Default if skipped:** Nothing excluded

---

## Post-Interview Summary

After all 3 rounds, present a compact summary table:

```markdown
## Interview Summary

| Setting | Value |
|---------|-------|
| App Type | SaaS with auth |
| Auth Provider | Supabase |
| Database | Supabase (Postgres) |
| Flows | Signup/Login, CRUD, Search |
| Async Features | No |
| Existing Tests | None |
| Dev Server | npm run dev :3000 |
| Exclusions | Stripe checkout |
```

Then proceed to Phase 2 (Discovery).
