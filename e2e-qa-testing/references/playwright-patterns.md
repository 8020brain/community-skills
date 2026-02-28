# Playwright Patterns — E2E QA Testing Skill

Battle-tested patterns for common Playwright challenges in Next.js apps. Load this reference during Phase 4 (test generation) and Phase 5 (fixing failures).

---

## A Note on `networkidle`

Several patterns in this file use `waitForLoadState('networkidle')`. This waits until there are no network connections for 500ms, which can be **flaky** in apps with:
- WebSocket connections (stay open indefinitely)
- Polling/heartbeat requests (never truly idle)
- Analytics scripts that fire periodically

**Prefer specific locator waits where possible:**
```typescript
// BETTER — wait for a specific element that proves the page is ready
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

// FALLBACK — use networkidle only when you don't know what to wait for
await page.waitForLoadState('networkidle');
```

Use `networkidle` as a fallback during discovery/debugging, then replace with specific assertions once you know the app's behaviour.

---

## Strict Mode Violations

Playwright's strict mode throws when a locator matches multiple elements. This is the #1 failure in Next.js apps.

### Problem
```typescript
// FAILS — matches header nav AND footer nav
await page.getByRole('link', { name: 'Home' }).click();
```

### Solutions

**Option 1: Scope to a container**
```typescript
const nav = page.getByRole('navigation').first();
await nav.getByRole('link', { name: 'Home' }).click();
```

**Option 2: Use `.first()` or `.nth()`**
```typescript
await page.getByRole('link', { name: 'Home' }).first().click();
```

**Option 3: Use a more specific locator**
```typescript
await page.getByRole('link', { name: 'Home', exact: true }).click();
// Or use test IDs
await page.getByTestId('nav-home-link').click();
```

**Option 4: Filter by visibility**
```typescript
// Check visibility before clicking
const links = page.getByRole('link', { name: 'Home' });
const count = await links.count();
for (let i = 0; i < count; i++) {
  if (await links.nth(i).isVisible()) {
    await links.nth(i).click();
    break;
  }
}
```

> **Note:** Playwright's `filter()` only accepts `{ has, hasText, hasNotText, hasNot }` — there is no `visible` option. Use `isVisible()` checks or scope to a visible container instead.

### Prevention
- Always scope interactions to the nearest meaningful container
- Prefer `getByRole` with `exact: true` over loose text matching
- Use `data-testid` for ambiguous elements
- Check with `await locator.count()` during debugging

---

## Server Action Form Submissions

Next.js server actions use form submissions that don't trigger standard navigation events.

### Pattern: Wait for Server Action Response
```typescript
// Submit form and wait for response
await Promise.all([
  page.waitForResponse(resp =>
    resp.url().includes('/api/') || resp.request().method() === 'POST'
  ),
  page.getByRole('button', { name: 'Save' }).click(),
]);

// Or wait for URL change after server action redirect
const currentUrl = page.url();
await page.getByRole('button', { name: 'Save' }).click();
await page.waitForURL(url => url.toString() !== currentUrl, { timeout: 10000 });
```

### Pattern: Server Action with Loading State
```typescript
await page.getByRole('button', { name: 'Submit' }).click();
// Wait for loading state to appear and disappear
await page.getByText('Loading...').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
await page.getByText('Loading...').waitFor({ state: 'hidden', timeout: 15000 });
// Now check for success
await expect(page.getByText('Saved successfully')).toBeVisible();
```

### Pattern: Form with Validation Errors
```typescript
// Submit empty form
await page.getByRole('button', { name: 'Submit' }).click();
// Check for validation messages
await expect(page.getByText('Email is required')).toBeVisible();
// Fill and retry
await page.getByLabel('Email').fill('test@example.com');
await page.getByRole('button', { name: 'Submit' }).click();
```

---

## File Download Testing

### Pattern: Trigger and Verify Download
```typescript
const downloadPromise = page.waitForEvent('download');
await page.getByRole('link', { name: 'Download Report' }).click();
const download = await downloadPromise;

// Verify filename
expect(download.suggestedFilename()).toMatch(/report.*\.pdf$/);

// Verify file is not empty
const path = await download.path();
const fs = require('fs');
const stats = fs.statSync(path!);
expect(stats.size).toBeGreaterThan(0);
```

### Pattern: CSV/Excel Export
```typescript
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export CSV' }).click();
const download = await downloadPromise;

expect(download.suggestedFilename()).toContain('.csv');
const content = await (await download.createReadStream()).toArray();
const text = Buffer.concat(content).toString();
expect(text).toContain('Name,Email'); // Check headers
```

---

## ISR / RSC Cache Handling

Next.js ISR and React Server Components can serve stale content during tests.

### Pattern: Force Fresh Content
```typescript
// Add cache-busting query param
await page.goto(`/products?_t=${Date.now()}`);

// Or set headers to bypass cache
await page.route('**/*', route => {
  route.continue({
    headers: {
      ...route.request().headers(),
      'Cache-Control': 'no-cache',
      'x-no-cache': '1',
    },
  });
});
```

### Pattern: Wait for Hydration
```typescript
// Wait for Next.js hydration to complete
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');
// Extra safety: wait for a known client-side element
await page.waitForSelector('[data-hydrated="true"]', { timeout: 10000 }).catch(() => {});
```

---

## XSS Testing via Input Fields

### Pattern: Basic XSS Check
```typescript
const xssPayloads = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  '"><svg onload=alert("xss")>',
];

// SQL injection payloads (separate concern — tests server-side query safety)
const sqlInjectionPayloads = [
  "'; DROP TABLE users; --",
  "' OR '1'='1",
];

// Register dialog listener BEFORE submitting any payloads
let alertFired = false;
page.on('dialog', async (dialog) => {
  alertFired = true;
  await dialog.dismiss();
});

for (const payload of [...xssPayloads, ...sqlInjectionPayloads]) {
  alertFired = false;
  await page.getByLabel('Name').fill(payload);
  await page.getByRole('button', { name: 'Save' }).click();

  // Verify XSS payload is escaped/sanitised in output
  const content = await page.content();
  expect(content).not.toContain('<script>alert');
  expect(content).not.toContain('onerror=alert');

  // Check no alert dialog appeared
  await page.waitForTimeout(500);
  expect(alertFired).toBe(false);
}
```

### Pattern: XSS via URL Parameters
```typescript
await page.goto('/search?q=<script>alert("xss")</script>');
const content = await page.content();
expect(content).not.toContain('<script>alert');
```

---

## Soft Bug Assertions

Use soft assertions for non-critical checks so tests continue running and report all issues.

### Pattern: Soft Assertions
```typescript
import { test, expect } from '@playwright/test';

test('dashboard displays all widgets', async ({ page }) => {
  await page.goto('/dashboard');

  // Hard assertion — must pass
  await expect(page).toHaveTitle(/Dashboard/);

  // Soft assertions — report failures but continue
  await expect.soft(page.getByTestId('revenue-widget')).toBeVisible();
  await expect.soft(page.getByTestId('users-widget')).toBeVisible();
  await expect.soft(page.getByTestId('orders-widget')).toBeVisible();

  // Check for console errors (soft)
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect.soft(errors).toHaveLength(0);
});
```

---

## External Service Boundaries

Never test beyond the boundary of third-party services. Test up to the redirect/handoff point.

### Pattern: Stripe Checkout Boundary
```typescript
test('checkout redirects to Stripe', async ({ page }) => {
  // Add item to cart
  await page.goto('/products/test-product');
  await page.getByRole('button', { name: 'Add to cart' }).click();

  // Go to checkout
  await page.getByRole('link', { name: 'Checkout' }).click();

  // Click pay — expect redirect to Stripe
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('checkout.stripe.com') || resp.status() === 303),
    page.getByRole('button', { name: 'Pay' }).click(),
  ]);

  // Verify redirect URL contains Stripe
  const url = page.url();
  expect(url).toMatch(/checkout\.stripe\.com|\/api\/checkout/);
  // DO NOT interact with the Stripe checkout page
});
```

### Pattern: OAuth Provider Boundary
```typescript
test('OAuth login redirects to provider', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();

  // Verify redirect to OAuth provider
  await page.waitForURL(/accounts\.google\.com|\/api\/auth\/signin/, { timeout: 10000 });
  // DO NOT interact with the provider login page
});
```

---

## Mobile Device Emulation

### Pattern: Responsive Testing
```typescript
import { devices } from '@playwright/test';

// In playwright.config.ts — add mobile project
{
  name: 'mobile-chrome',
  use: { ...devices['Pixel 5'] },
}

// In test — check mobile-specific behaviour
test('mobile menu toggles', async ({ page, isMobile }) => {
  await page.goto('/');

  if (isMobile) {
    // Hamburger menu should be visible
    const menuButton = page.getByRole('button', { name: /menu/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole('navigation')).toBeVisible();
  } else {
    // Desktop nav should be visible without toggle
    await expect(page.getByRole('navigation')).toBeVisible();
  }
});
```

---

## Auth Helper Patterns by Provider

### Supabase Auth Helper

> **Important:** Modern Supabase SSR (`@supabase/ssr`) uses a single chunked cookie named
> `sb-<project-ref>-auth-token` (e.g. `sb-abcdefghij-auth-token`). The project ref is the
> subdomain of your Supabase URL. Setting individual `sb-access-token` / `sb-refresh-token`
> cookies will **not** work with `@supabase/ssr`. The helper below uses the correct format.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role for test user management
);

// Extract project ref from Supabase URL (e.g. "abcdefghij" from "https://abcdefghij.supabase.co")
const PROJECT_REF = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];

export async function loginAsTestUser(page: Page) {
  // Sign in via Supabase API
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL!,
    password: process.env.TEST_USER_PASSWORD!,
  });

  if (error) throw new Error(`Login failed: ${error.message}`);

  // Build the session payload that @supabase/ssr expects
  const sessionPayload = JSON.stringify({
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token,
    expires_at: data.session!.expires_at,
    expires_in: data.session!.expires_in,
    token_type: data.session!.token_type,
  });

  // Set the chunked auth cookie (single cookie for small sessions,
  // chunked into .0, .1, etc. for larger ones)
  const cookieName = `sb-${PROJECT_REF}-auth-token`;
  const CHUNK_SIZE = 3180; // Supabase SSR chunk size

  if (sessionPayload.length <= CHUNK_SIZE) {
    await page.context().addCookies([
      {
        name: cookieName,
        value: sessionPayload,
        domain: 'localhost',
        path: '/',
      },
    ]);
  } else {
    // Split into chunks for large sessions
    const chunks: string[] = [];
    for (let i = 0; i < sessionPayload.length; i += CHUNK_SIZE) {
      chunks.push(sessionPayload.slice(i, i + CHUNK_SIZE));
    }
    const cookies = chunks.map((chunk, i) => ({
      name: `${cookieName}.${i}`,
      value: chunk,
      domain: 'localhost',
      path: '/',
    }));
    await page.context().addCookies(cookies);
  }

  // Navigate to trigger session pickup
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
```

### NextAuth (Auth.js) Helper
```typescript
export async function loginAsTestUser(page: Page) {
  // Option 1: Use credentials provider via form
  await page.goto('/api/auth/signin');
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/', { timeout: 10000 });

  // Option 2: Direct CSRF + POST (faster, no UI)
  const csrfResponse = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();

  await page.request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    },
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
```

### Clerk Auth Helper
```typescript
export async function loginAsTestUser(page: Page) {
  // Clerk exposes testing utilities when CLERK_TESTING=1
  await page.goto('/sign-in');

  // Wait for Clerk components to load
  await page.waitForSelector('.cl-signIn-root', { timeout: 10000 });

  // Fill credentials
  await page.getByLabel('Email address').fill(process.env.TEST_USER_EMAIL!);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Wait for redirect after login
  await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 15000 });
}
```

### Firebase Auth Helper
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
});

export async function loginAsTestUser(page: Page) {
  const auth = getAuth(app);
  const credential = await signInWithEmailAndPassword(
    auth,
    process.env.TEST_USER_EMAIL!,
    process.env.TEST_USER_PASSWORD!
  );

  const token = await credential.user.getIdToken();

  // Set the session cookie
  await page.context().addCookies([
    {
      name: 'firebase-auth-token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
}
```

---

## Async / Polling Patterns

For AI features and background jobs that take variable time to complete.

### Pattern: Poll for Completion
```typescript
export async function waitForAsyncResult(
  page: Page,
  selector: string,
  options: { timeout?: number; interval?: number } = {}
) {
  const { timeout = 60000, interval = 2000 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const element = page.locator(selector);
    if (await element.isVisible().catch(() => false)) {
      return element;
    }
    await page.waitForTimeout(interval);
  }

  throw new Error(`Timed out waiting for ${selector} after ${timeout}ms`);
}

// Usage
test('AI generates summary', async ({ page }) => {
  await page.getByRole('button', { name: 'Generate Summary' }).click();

  // Wait for loading indicator
  await expect(page.getByText(/generating|processing/i)).toBeVisible({ timeout: 5000 });

  // Poll for result (up to 60s for AI processing)
  const result = await waitForAsyncResult(page, '[data-testid="ai-summary"]', {
    timeout: 60000,
  });
  await expect(result).not.toBeEmpty();
});
```

---

## Console Error Monitoring

### Pattern: Capture and Assert Console Errors
```typescript
test.beforeEach(async ({ page }) => {
  // Collect console errors throughout the test
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Store on page for access in tests
  (page as any).__consoleErrors = errors;
});

test.afterEach(async ({ page }) => {
  const errors = (page as any).__consoleErrors || [];
  // Filter out known benign errors
  const realErrors = errors.filter(e =>
    !e.includes('favicon.ico') &&
    !e.includes('hydration') // React hydration warnings in dev
  );
  expect.soft(realErrors).toHaveLength(0);
});
```

---

## Multi-Tab / New Window Handling

### Pattern: Handle Links Opening in New Tab
```typescript
test('external link opens in new tab', async ({ page, context }) => {
  await page.goto('/resources');

  // Wait for new page (tab) to open
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: 'Documentation' }).click(),
  ]);

  await newPage.waitForLoadState();
  expect(newPage.url()).toContain('docs.example.com');
  await newPage.close();
});
```

---

## Network Interception

### Pattern: Mock API Response
```typescript
test('handles API error gracefully', async ({ page }) => {
  // Intercept API call and return error
  await page.route('/api/data', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  await page.goto('/dashboard');
  await expect(page.getByText(/error|something went wrong/i)).toBeVisible();
});
```

### Pattern: Wait for Specific API Call
```typescript
test('saves data successfully', async ({ page }) => {
  await page.goto('/editor');
  await page.getByLabel('Title').fill('Test Document');

  // Wait for the save API call
  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/api/documents') && resp.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Save' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
});
```
