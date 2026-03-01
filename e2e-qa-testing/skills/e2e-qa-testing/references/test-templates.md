# Test Templates — E2E QA Testing Skill

Boilerplate templates organised by app type. Use these as starting points during Phase 4 (test generation), then customise based on interview answers and discovery findings.

---

## Common: Smoke Tests (All App Types)

Always generated as `phase-01-smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 1: Smoke Tests', () => {

  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/); // Has a title
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const realErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('Download the React DevTools')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('key pages are accessible', async ({ page }) => {
    // CUSTOMISE: Replace with actual routes from discovery
    const pages = ['/', '/about', '/contact'];

    for (const path of pages) {
      const response = await page.goto(path);
      expect.soft(response?.status(), `${path} should return 2xx/3xx`).toBeLessThan(400);
    }
  });

  test('no broken images on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      const src = await img.getAttribute('src');
      expect.soft(naturalWidth, `Image ${src} should load`).toBeGreaterThan(0);
    }
  });

  test('meta tags are present', async ({ page }) => {
    await page.goto('/');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect.soft(description, 'Meta description should exist').toBeTruthy();
  });

});
```

---

## Common: Security Tests (All App Types)

Always generated as `phase-10-security.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 10: Security Tests', () => {

  test('XSS via URL parameters is sanitised', async ({ page }) => {
    // Test common injection points
    const xssParam = '<script>alert("xss")</script>';
    await page.goto(`/?q=${encodeURIComponent(xssParam)}`);

    const content = await page.content();
    expect(content).not.toContain('<script>alert');
  });

  test('XSS via search input is sanitised', async ({ page }) => {
    // CUSTOMISE: Update selector if search exists
    await page.goto('/');
    const searchInput = page.getByRole('searchbox').or(page.getByPlaceholder(/search/i));

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('<img src=x onerror=alert("xss")>');
      await searchInput.press('Enter');
      const content = await page.content();
      expect(content).not.toContain('onerror=alert');
    }
  });

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() || {};

    // Soft assertions — report all missing headers
    expect.soft(headers['x-frame-options'] || headers['content-security-policy'],
      'Should have X-Frame-Options or CSP frame-ancestors').toBeTruthy();
    expect.soft(headers['x-content-type-options'],
      'Should have X-Content-Type-Options').toBe('nosniff');
  });

  test('sensitive routes require authentication', async ({ page }) => {
    // CUSTOMISE: Replace with actual protected routes from discovery
    const protectedRoutes = ['/dashboard', '/settings', '/admin'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login or show 401/403
      const url = page.url();
      const isRedirected = url.includes('login') || url.includes('sign-in') || url.includes('auth');
      expect.soft(isRedirected, `${route} should require auth`).toBe(true);
    }
  });

  test('API routes return proper error codes for unauthenticated requests', async ({ page }) => {
    // CUSTOMISE: Replace with actual API routes from discovery
    const apiRoutes = ['/api/user', '/api/data'];

    for (const route of apiRoutes) {
      const response = await page.request.get(route);
      expect.soft(
        [401, 403].includes(response.status()),
        `${route} should return 401/403 for unauthenticated requests`
      ).toBe(true);
    }
  });

});
```

---

## SaaS with Auth

### Auth Tests — `phase-02-auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
// CUSTOMISE: Import login helper for the detected auth provider
// import { loginAsTestUser } from './helpers';

test.describe('Phase 2: Authentication', () => {

  test('login page is accessible', async ({ page }) => {
    // CUSTOMISE: Update login route
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    // CUSTOMISE: Update selectors based on discovery
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should redirect to dashboard/home
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/login|sign-in/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByText(/invalid|incorrect|error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('protected route redirects when not authenticated', async ({ page }) => {
    // CUSTOMISE: Update protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|sign-in/);
  });

  test('logout clears session', async ({ page }) => {
    // CUSTOMISE: Login first using helper
    // await loginAsTestUser(page);

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });

    // Find and click logout
    // CUSTOMISE: Update logout selector
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should redirect to login or homepage
    await page.waitForURL(/\/(login|sign-in|$)/, { timeout: 10000 });

    // Verify session is cleared — protected route should redirect
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login|sign-in/);
  });

  test('signup flow works', async ({ page }) => {
    // CUSTOMISE: Update signup route and selectors
    await page.goto('/signup');
    // NOTE: Use a unique email to avoid conflicts
    const testEmail = `test-${Date.now()}@example.com`;
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).first().fill('TestPassword123!');

    // CUSTOMISE: Some forms have confirm password
    const confirmPassword = page.getByLabel(/confirm password/i);
    if (await confirmPassword.isVisible().catch(() => false)) {
      await confirmPassword.fill('TestPassword123!');
    }

    await page.getByRole('button', { name: /sign up|create account|register/i }).click();

    // CUSTOMISE: Check for success state (redirect, confirmation message, etc.)
    await page.waitForTimeout(3000);
    const url = page.url();
    const pageContent = await page.textContent('body');
    const isSuccess =
      !url.includes('signup') ||
      pageContent?.match(/welcome|verify|check your email|success/i);
    expect(isSuccess).toBeTruthy();
  });

});
```

### CRUD Tests — `phase-03-crud.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
// CUSTOMISE: Import login helper
// import { loginAsTestUser } from './helpers';

test.describe('Phase 3: CRUD Operations', () => {

  // CUSTOMISE: Login before each test
  test.beforeEach(async ({ page }) => {
    // await loginAsTestUser(page);
    // For now, login via UI
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  // CUSTOMISE: Replace "item" with the app's main entity (project, document, record, etc.)

  test('create new item', async ({ page }) => {
    // CUSTOMISE: Navigate to creation page/modal
    await page.getByRole('button', { name: /new|create|add/i }).click();

    // CUSTOMISE: Fill in required fields
    await page.getByLabel(/name|title/i).fill(`Test Item ${Date.now()}`);

    // Save
    await page.getByRole('button', { name: /save|create|submit/i }).click();

    // Verify item appears
    // CUSTOMISE: Update success assertion
    await expect(page.getByText(/created|saved|success/i)).toBeVisible({ timeout: 10000 });
  });

  test('read/view item', async ({ page }) => {
    // CUSTOMISE: Navigate to list page
    await page.goto('/dashboard');

    // CUSTOMISE: Click on an existing item
    const firstItem = page.getByRole('link').filter({ hasText: /test|item|project/i }).first();
    if (await firstItem.isVisible().catch(() => false)) {
      await firstItem.click();
      await page.waitForLoadState('networkidle');
      // Verify detail view loads
      expect(page.url()).not.toBe('/dashboard');
    }
  });

  test('update item', async ({ page }) => {
    // CUSTOMISE: Navigate to an existing item's edit page
    await page.goto('/dashboard');

    const firstItem = page.getByRole('link').filter({ hasText: /test|item|project/i }).first();
    if (await firstItem.isVisible().catch(() => false)) {
      await firstItem.click();
      await page.waitForLoadState('networkidle');

      // CUSTOMISE: Click edit, modify a field
      const editButton = page.getByRole('button', { name: /edit/i });
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        const nameField = page.getByLabel(/name|title/i);
        await nameField.clear();
        await nameField.fill(`Updated Item ${Date.now()}`);
        await page.getByRole('button', { name: /save|update/i }).click();
        await expect(page.getByText(/updated|saved/i)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('delete item', async ({ page }) => {
    // CUSTOMISE: Navigate to an item and delete it
    await page.goto('/dashboard');

    const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();

      // Handle confirmation dialog
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }

      await expect(page.getByText(/deleted|removed/i)).toBeVisible({ timeout: 10000 });
    }
  });

});
```

### Billing Tests — `phase-04-billing.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 4: Billing & Payments', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login as test user
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  test('pricing page displays plans', async ({ page }) => {
    // CUSTOMISE: Update pricing route
    await page.goto('/pricing');
    // Should show at least 2 plan options
    const plans = page.getByRole('heading').filter({ hasText: /free|starter|pro|enterprise|basic|premium/i });
    expect(await plans.count()).toBeGreaterThanOrEqual(2);
  });

  test('billing page is accessible', async ({ page }) => {
    // CUSTOMISE: Update billing route
    const response = await page.goto('/settings/billing');
    expect(response?.status()).toBeLessThan(400);
  });

  test('upgrade button redirects to checkout', async ({ page }) => {
    // CUSTOMISE: Update route and selectors
    await page.goto('/pricing');

    const upgradeButton = page.getByRole('button', { name: /upgrade|subscribe|get started/i }).first();
    if (await upgradeButton.isVisible().catch(() => false)) {
      // NOTE: Do NOT proceed past the Stripe checkout boundary
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('stripe') || resp.url().includes('checkout'),
        { timeout: 10000 }
      ).catch(() => null);

      await upgradeButton.click();
      await page.waitForTimeout(3000);

      // Verify it redirects to Stripe or internal checkout
      const url = page.url();
      const isCheckout = url.includes('stripe') || url.includes('checkout') || url.includes('billing');
      expect(isCheckout).toBe(true);
    }
  });

  test('current plan is displayed correctly', async ({ page }) => {
    await page.goto('/settings/billing');
    // CUSTOMISE: Check that current plan name is visible
    const planText = page.getByText(/free|starter|pro|current plan/i);
    await expect(planText.first()).toBeVisible();
  });

});
```

---

## Marketing / Static Site

### Public Pages Tests — `phase-08-public.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Phase 8: Public Pages', () => {

  test('all navigation links work', async ({ page }) => {
    await page.goto('/');
    const navLinks = page.getByRole('navigation').first().getByRole('link');
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        const response = await page.goto(href);
        expect.soft(response?.status(), `${href} should be accessible`).toBeLessThan(400);
      }
    }
  });

  test('no broken links on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const links = page.locator('a[href]');
    const count = await links.count();
    const brokenLinks: string[] = [];

    for (let i = 0; i < Math.min(count, 50); i++) { // Limit to 50 links
      const href = await links.nth(i).getAttribute('href');
      if (href && href.startsWith('/')) {
        const response = await page.request.get(href);
        if (response.status() >= 400) {
          brokenLinks.push(`${href} (${response.status()})`);
        }
      }
    }

    expect(brokenLinks, 'Broken links found').toHaveLength(0);
  });

  test('SEO meta tags on key pages', async ({ page }) => {
    // CUSTOMISE: Replace with actual pages from discovery
    const pages = ['/', '/about', '/services', '/contact'];

    for (const path of pages) {
      await page.goto(path);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');

      expect.soft(title, `${path} should have title`).toBeTruthy();
      expect.soft(description, `${path} should have meta description`).toBeTruthy();
      expect.soft(ogTitle, `${path} should have og:title`).toBeTruthy();
    }
  });

  test('contact form submits successfully', async ({ page }) => {
    // CUSTOMISE: Update route and selectors
    await page.goto('/contact');

    const form = page.locator('form');
    if (await form.isVisible().catch(() => false)) {
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('test@example.com');

      const messageField = page.getByLabel(/message/i).or(page.locator('textarea'));
      if (await messageField.isVisible()) {
        await messageField.fill('This is a test message from automated testing.');
      }

      await page.getByRole('button', { name: /send|submit|contact/i }).click();
      await page.waitForTimeout(3000);

      // Check for success message or redirect
      const body = await page.textContent('body');
      const isSuccess = body?.match(/thank|success|sent|received/i);
      expect.soft(isSuccess, 'Form should show success state').toBeTruthy();
    }
  });

  test('responsive layout on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThan(500);

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect.soft(bodyWidth, 'No horizontal scroll on mobile').toBeLessThanOrEqual(viewport!.width + 5);

    // Check mobile menu exists
    const menuButton = page.getByRole('button', { name: /menu|hamburger/i })
      .or(page.locator('[class*="hamburger"]'))
      .or(page.locator('[class*="mobile-menu"]'));

    if (await menuButton.first().isVisible().catch(() => false)) {
      await menuButton.first().click();
      await expect(page.getByRole('navigation')).toBeVisible();
    }

    await context.close();
  });

  test('footer links and content', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Check for common footer elements
    const footerLinks = footer.getByRole('link');
    expect.soft(await footerLinks.count(), 'Footer should have links').toBeGreaterThan(0);
  });

});
```

---

## E-commerce

### Product & Cart Tests — `phase-03-crud.spec.ts` (e-commerce variant)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 3: Products & Cart', () => {

  test('product listing page loads', async ({ page }) => {
    // CUSTOMISE: Update route
    await page.goto('/products');
    const products = page.locator('[class*="product"], [data-testid*="product"]');
    expect(await products.count()).toBeGreaterThan(0);
  });

  test('product detail page loads', async ({ page }) => {
    await page.goto('/products');

    // Click first product
    const firstProduct = page.getByRole('link').filter({ hasText: /.+/ }).first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');

    // Should have product details
    await expect(page.getByRole('heading').first()).toBeVisible();
    // Should have an add to cart button
    const addToCart = page.getByRole('button', { name: /add to cart|buy/i });
    await expect(addToCart).toBeVisible();
  });

  test('add product to cart', async ({ page }) => {
    // CUSTOMISE: Navigate to a product
    await page.goto('/products');
    const firstProduct = page.getByRole('link').filter({ hasText: /.+/ }).first();
    await firstProduct.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add to cart|buy/i }).click();

    // Verify cart updated (badge, notification, or redirect)
    await page.waitForTimeout(2000);
    const cartIndicator = page.locator('[class*="cart"] [class*="badge"], [data-testid="cart-count"]');
    if (await cartIndicator.isVisible().catch(() => false)) {
      const count = await cartIndicator.textContent();
      expect(Number(count)).toBeGreaterThan(0);
    }
  });

  test('view cart', async ({ page }) => {
    // CUSTOMISE: Update cart route
    const response = await page.goto('/cart');
    expect(response?.status()).toBeLessThan(400);
  });

  test('remove item from cart', async ({ page }) => {
    // Add an item first, then remove it
    // CUSTOMISE: This flow depends on the app's cart implementation
    await page.goto('/cart');

    const removeButton = page.getByRole('button', { name: /remove|delete|×/i }).first();
    if (await removeButton.isVisible().catch(() => false)) {
      await removeButton.click();
      await page.waitForTimeout(2000);
      // Verify removal
      const emptyMessage = page.getByText(/empty|no items/i);
      const itemCount = await page.locator('[class*="cart-item"]').count();
      const isRemoved = await emptyMessage.isVisible().catch(() => false) || itemCount === 0;
      expect(isRemoved).toBe(true);
    }
  });

  test('checkout button redirects to checkout', async ({ page }) => {
    await page.goto('/cart');
    const checkoutButton = page.getByRole('button', { name: /checkout|proceed/i })
      .or(page.getByRole('link', { name: /checkout|proceed/i }));

    if (await checkoutButton.isVisible().catch(() => false)) {
      await checkoutButton.click();
      await page.waitForTimeout(3000);
      // Should be at checkout or Stripe
      const url = page.url();
      expect(url).toMatch(/checkout|stripe|billing|payment/);
    }
  });

});
```

---

## Dashboard

### Dashboard Tests — `phase-03-crud.spec.ts` (dashboard variant)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 3: Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  test('dashboard loads with data', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should have some content (not just a loading spinner)
    await page.waitForTimeout(3000);
    const loadingSpinner = page.locator('[class*="spinner"], [class*="loading"]');
    const isStillLoading = await loadingSpinner.isVisible().catch(() => false);
    expect(isStillLoading, 'Dashboard should finish loading').toBe(false);
  });

  test('data tables render', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const table = page.getByRole('table').or(page.locator('[class*="table"], [class*="grid"]'));
    if (await table.first().isVisible().catch(() => false)) {
      const rows = table.first().locator('tr, [class*="row"]');
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });

  test('filters work', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // CUSTOMISE: Find filter controls
    const filterInput = page.getByRole('combobox').or(page.getByRole('searchbox')).first();
    if (await filterInput.isVisible().catch(() => false)) {
      const initialContent = await page.textContent('main');
      await filterInput.click();

      // Select first option or type a filter
      const option = page.getByRole('option').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }

      await page.waitForTimeout(2000);
      // Content should change (or at least not error)
      const response = await page.goto(page.url());
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test('export/download works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const exportButton = page.getByRole('button', { name: /export|download|csv/i }).first();
    if (await exportButton.isVisible().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await exportButton.click();
      const download = await downloadPromise;

      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf)$/);
      }
    }
  });

  test('pagination works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const nextButton = page.getByRole('button', { name: /next|→|>/i }).first();
    if (await nextButton.isVisible().catch(() => false) && await nextButton.isEnabled()) {
      const currentUrl = page.url();
      await nextButton.click();
      await page.waitForTimeout(2000);

      // URL should change or content should update
      const newUrl = page.url();
      const response = await page.goto(newUrl);
      expect(response?.status()).toBeLessThan(400);
    }
  });

});
```

### Search & Filtering — `phase-06-search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 6: Search & Filtering', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  test('search returns results for valid query', async ({ page }) => {
    // CUSTOMISE: Navigate to page with search
    await page.goto('/dashboard');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first();

    if (await searchInput.isVisible().catch(() => false)) {
      // CUSTOMISE: Use a term that should return results
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);

      // Should show results or "no results" message
      const body = await page.textContent('body');
      expect(body?.length).toBeGreaterThan(0);
    }
  });

  test('search handles empty query gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first();

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);

      // Should not error
      const response = await page.goto(page.url());
      expect(response?.status()).toBeLessThan(400);
    }
  });

  test('search handles no results gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    const searchInput = page.getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first();

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('zzznonexistentqueryzzzz');
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);

      // Should show a "no results" type message, not an error
      const content = await page.content();
      expect(content).not.toContain('500');
      expect(content).not.toContain('Internal Server Error');
    }
  });

});
```

---

## File Upload Tests — `phase-05-uploads.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Phase 5: File Uploads', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  test('file upload accepts valid file', async ({ page }) => {
    // CUSTOMISE: Navigate to upload page
    await page.goto('/dashboard');

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      // Create a temporary test file
      await fileInput.setInputFiles({
        name: 'test-upload.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test file content for upload testing'),
      });

      // CUSTOMISE: Click upload button if separate from file input
      const uploadButton = page.getByRole('button', { name: /upload|submit/i });
      if (await uploadButton.isVisible().catch(() => false)) {
        await uploadButton.click();
      }

      await page.waitForTimeout(5000);
      // Check for success indicator
      const body = await page.textContent('body');
      expect.soft(body).toMatch(/uploaded|success|complete/i);
    }
  });

  test('file upload rejects invalid file type', async ({ page }) => {
    // CUSTOMISE: Navigate to upload page
    await page.goto('/dashboard');

    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      // Try uploading an invalid file type
      await fileInput.setInputFiles({
        name: 'test.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake executable content'),
      });

      await page.waitForTimeout(2000);
      // Should show error or reject
      const body = await page.textContent('body');
      const hasError = body?.match(/invalid|not allowed|unsupported|error/i);
      // Soft assertion — some apps may not validate client-side
      expect.soft(hasError, 'Should reject invalid file type').toBeTruthy();
    }
  });

});
```

---

## Admin Panel Tests — `phase-07-admin.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 7: Admin Panel', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login as admin user
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app|admin)/, { timeout: 10000 });
  });

  test('admin page is accessible', async ({ page }) => {
    // CUSTOMISE: Update admin route
    const response = await page.goto('/admin');
    expect(response?.status()).toBeLessThan(400);
  });

  test('admin page shows user management', async ({ page }) => {
    // CUSTOMISE: Update admin route and selectors
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Look for user management section
    const userSection = page.getByText(/users|members|accounts/i).first();
    expect.soft(await userSection.isVisible()).toBe(true);
  });

  test('non-admin user cannot access admin panel', async ({ page, context }) => {
    // Create new context with non-admin user
    // CUSTOMISE: This test requires a non-admin test account
    const newContext = await page.context().browser()!.newContext();
    const newPage = await newContext.newPage();

    await newPage.goto('/login');
    await newPage.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await newPage.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await newPage.getByRole('button', { name: /sign in|log in/i }).click();
    await newPage.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });

    // Try to access admin
    await newPage.goto('/admin');
    const url = newPage.url();
    const isBlocked = url.includes('login') || url.includes('403') || url.includes('unauthorized');
    expect(isBlocked, 'Non-admin should not access /admin').toBe(true);

    await newContext.close();
  });

});
```

---

## API Integration Tests — `phase-09-api.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Phase 9: API Integrations', () => {

  test.beforeEach(async ({ page }) => {
    // CUSTOMISE: Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 10000 });
  });

  test('API-dependent feature loads data', async ({ page }) => {
    // CUSTOMISE: Navigate to a page that fetches external data
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait for API data to load (look for content, not loading state)
    await page.waitForTimeout(5000);
    const loadingIndicator = page.locator('[class*="spinner"], [class*="skeleton"]');
    const isStillLoading = await loadingIndicator.first().isVisible().catch(() => false);
    expect.soft(isStillLoading, 'API data should finish loading').toBe(false);
  });

  test('API error is handled gracefully', async ({ page }) => {
    // CUSTOMISE: Intercept an API call to simulate failure
    await page.route('**/api/**', route => {
      route.fulfill({ status: 500, body: '{"error":"test"}' });
    });

    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Should show error message, not crash
    const content = await page.content();
    expect(content).not.toContain('Unhandled Runtime Error');
    expect(content).not.toContain('Application error');
  });

});
```

---

## Helpers Template — `helpers.ts`

```typescript
import { Page } from '@playwright/test';

/**
 * Login as the test user.
 * CUSTOMISE: This helper is adapted based on the auth provider detected during discovery.
 */
export async function loginAsTestUser(page: Page) {
  // REPLACE with auth-provider-specific helper from playwright-patterns.md
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 15000 });
}

/**
 * Login as admin user (if different from test user).
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(process.env.TEST_ADMIN_EMAIL || process.env.TEST_USER_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.TEST_ADMIN_PASSWORD || process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|home|app|admin)/, { timeout: 15000 });
}

/**
 * Wait for an async operation to complete (AI processing, background jobs, etc.)
 */
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

/**
 * Navigate and wait for full page load including network idle.
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
```

---

## Playwright Config Template — `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential for E2E to avoid state conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for E2E reliability
  reporter: [['html'], ['list']],

  use: {
    // CUSTOMISE: Update base URL from interview
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for cross-browser testing:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // CUSTOMISE: Update command and port from interview
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```
