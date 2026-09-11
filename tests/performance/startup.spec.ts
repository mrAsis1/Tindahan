import { test, expect, type BrowserContext } from '@playwright/test';
import { fixtureRead } from '../fixtures/notebookReads';
import type { StoreData } from '../../src/types';

async function notebook(context: BrowserContext) {
  const owner = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-08-01T00:00:00Z',
  };
  const data: StoreData = {
    version: 1,
    store: { id: '22222222-2222-4222-8222-222222222222', name: 'Fictional startup check' },
    customers: [],
    entries: [],
  };
  await context.addInitScript((user) => {
    localStorage.setItem(
      'sb-pilot-test-auth-token',
      JSON.stringify({
        access_token: 'fictional-token',
        refresh_token: 'fictional-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user,
      }),
    );
  }, owner);
  const unexpected: string[] = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:4180') return route.continue();
    if (url.origin === 'https://pilot-test.supabase.co') {
      if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET')
        return route.fulfill({ json: owner });
      if (url.pathname === '/rest/v1/rpc/read_notebook' && route.request().method() === 'POST')
        return route.fulfill({ json: fixtureRead(data, route.request().postDataJSON()) });
      if (url.pathname === '/rest/v1/rpc/get_notebook' && route.request().method() === 'POST')
        return route.fulfill({ json: data });
    }
    unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.abort();
  });
  return unexpected;
}

test('Home defers form code and loads it when a form is opened', async ({ page, context }) => {
  const unexpected = await notebook(context);
  const scripts: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.js')) scripts.push(request.url());
  });
  await page.goto('/home');
  await expect(page.locator('.hero .amount')).toHaveText('₱0.00');
  expect(
    scripts.some((url) =>
      /\/(CustomerForm|TransactionForm|CorrectionForm|Confirmation)-/.test(url),
    ),
  ).toBe(false);
  const scriptBytes = await page.evaluate(() =>
    (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((r) => new URL(r.name).pathname.endsWith('.js'))
      .reduce((sum, r) => sum + r.decodedBodySize, 0),
  );
  // Non-timing budget: baseline was 641 KB. Leave room above the ~597 KB result.
  expect(scriptBytes).toBeGreaterThan(0);
  expect(scriptBytes).toBeLessThan(620000);
  await page.getByRole('link', { name: '+ Add Utang', exact: true }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
  expect(scripts.some((url) => /\/TransactionForm-/.test(url))).toBe(true);
  expect(scripts.some((url) => /\/CustomerForm-/.test(url))).toBe(true);
  await page.getByLabel('Amount', { exact: true }).fill('50');
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('50');
  await page.reload();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
});

test('failed page download offers a manual reload that recovers when connected', async ({
  page,
  context,
}) => {
  const unexpected = await notebook(context);
  let blocked = true;
  let attempts = 0;
  await context.route('**/assets/TransactionForm-*.js', (route) => {
    attempts++;
    return blocked ? route.abort('connectionfailed') : route.fallback();
  });
  await page.goto('/home');
  await page.getByRole('link', { name: '+ Add Utang', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Page unavailable' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  await expect(page.getByRole('link', { name: 'Return to Home' })).toBeVisible();
  expect(attempts).toBe(1);
  blocked = false;
  await page.getByRole('button', { name: 'Reload page', exact: true }).click();
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(unexpected).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
});
