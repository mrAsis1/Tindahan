import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import type { StoreData, LedgerEntry } from '../../src/types';
import { fixtureRead } from '../fixtures/notebookReads';

// UI/network failure checks only. Hosted PostgreSQL locking is checked separately
// by tests/hosted/verify-saves.mjs, never by this in-memory API fixture.
const customer = '33333333-3333-4333-8333-333333333333';
const owner = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.test',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-01T00:00:00Z',
};
async function cloud(context: BrowserContext, failure: 'lost' | 'before' | 'refresh' | 'none') {
  const state: StoreData = {
    version: 1,
    store: { id: '22222222-2222-4222-8222-222222222222', name: 'Fictional test store' },
    customers: [
      {
        id: customer,
        name: 'Fictional customer',
        contactNumber: '',
        identifyingNote: '',
        createdAt: '2026-09-01T00:00:00Z',
      },
    ],
    entries: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        requestId: '44444444-4444-4444-8444-444444444444',
        customerId: customer,
        type: 'utang',
        amountCentavos: 10000,
        description: 'Fixture',
        effectiveDate: '2026-09-01',
        effectiveTime: '08:00:00',
        createdAt: '2026-09-01T00:00:00Z',
        status: 'active',
      },
    ],
  };
  const calls = {
    ids: [] as string[],
    failed: false,
    reads: 0,
    fullReads: 0,
    views: [] as string[],
  };
  await context.addInitScript((user) => {
    localStorage.setItem(
      'sb-auth-test-auth-token',
      JSON.stringify({
        access_token: 'fictional-token',
        refresh_token: 'fictional-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user,
      }),
    );
  }, owner);
  await context.route('https://auth-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/v1/user') return json(owner);
    if (path === '/rest/v1/rpc/get_notebook' || path === '/rest/v1/rpc/read_notebook') {
      calls.reads++;
      if (path.endsWith('/get_notebook')) calls.fullReads++;
      else calls.views.push(route.request().postDataJSON().p_view);
      if (failure === 'refresh' && calls.ids.length && !calls.failed) {
        calls.failed = true;
        return json({ message: 'Temporary refresh failure', code: '503' }, 503);
      }
      return json(
        path.endsWith('/read_notebook')
          ? fixtureRead(state, route.request().postDataJSON())
          : state,
      );
    }
    if (path === '/rest/v1/rpc/record_entry') {
      const input = route.request().postDataJSON();
      calls.ids.push(input.p_request_id);
      if (failure === 'before' && !calls.failed) {
        calls.failed = true;
        return route.abort('connectionfailed');
      }
      const existing = state.entries.find((entry) => entry.id === input.p_request_id);
      if (existing) return json(existing);
      const available = state.entries.reduce(
        (sum, entry) => sum + (entry.type === 'payment' ? -1 : 1) * entry.amountCentavos,
        0,
      );
      if (input.p_type === 'payment' && input.p_amount_centavos > available)
        return json({ message: 'Payment exceeds the available balance.', code: 'P0001' }, 400);
      const entry: LedgerEntry = {
        id: input.p_request_id,
        requestId: input.p_request_id,
        customerId: input.p_customer_id,
        type: input.p_type,
        amountCentavos: input.p_amount_centavos,
        description: input.p_description,
        effectiveDate: input.p_effective_date,
        effectiveTime: '12:00:00',
        createdAt: new Date().toISOString(),
        status: 'active',
      };
      state.entries.push(entry);
      if (failure === 'lost' && !calls.failed) {
        calls.failed = true;
        return route.abort('connectionreset');
      }
      return json(entry);
    }
    return json({ message: 'Unexpected fixture request' }, 400);
  });
  return { state, calls };
}
async function payment(page: Page, amount = '100') {
  await page.goto(`/payments/new?customer=${customer}`);
  await page.getByLabel('Payment amount').fill(amount);
}

test('scoped read caches refresh after a payment without using partial history for writes', async ({
  page,
  context,
}) => {
  const { calls } = await cloud(context, 'none');
  await page.goto('/home');
  await expect(page.locator('.hero .amount')).toHaveText('₱100.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.locator('.customer-row')).toContainText('₱100.00');
  await page.locator('.customer-row').click();
  await expect(page.locator('.amount')).toHaveText('₱100.00');
  expect(calls.fullReads).toBe(0);
  await page.getByRole('link', { name: 'Record Payment' }).click();
  await page.getByLabel('Payment amount').fill('50');
  expect(calls.fullReads).toBe(1);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱50.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.locator('.customer-row')).toContainText('₱50.00');
  await page.locator('.customer-row').click();
  await expect(page.locator('article.record')).toHaveCount(2);
  await expect(page.locator('.amount')).toHaveText('₱50.00');
  expect(calls.views).toEqual(['home', 'directory', 'customer', 'home', 'directory', 'customer']);
  expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
});

test('a failed scoped read retries without borrowing another screen’s cached totals', async ({
  page,
  context,
}) => {
  const { calls } = await cloud(context, 'none');
  await page.goto('/home');
  await expect(page.locator('.hero .amount')).toHaveText('₱100.00');
  let reject = true;
  await context.route('**/rest/v1/rpc/read_notebook', async (route) => {
    if (route.request().postDataJSON().p_view === 'directory' && reject) {
      reject = false;
      return route.fulfill({ status: 503, json: { message: 'Fictional read failure' } });
    }
    return route.fallback();
  });
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notebook unavailable' })).toBeVisible();
  await expect(page.locator('.customer-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.customer-row')).toContainText('₱100.00');
  expect(calls.fullReads).toBe(0);
});

test('an unapplied scoped-read migration reports setup failure without a full-read fallback', async ({
  page,
  context,
}) => {
  const { calls } = await cloud(context, 'none');
  await context.route('**/rest/v1/rpc/read_notebook', (route) =>
    route.fulfill({ status: 404, json: { code: 'PGRST202', message: 'Function missing' } }),
  );
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Notebook unavailable' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('database setup has not been applied');
  expect(calls.fullReads).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
});

test('retries a committed full payment after a lost response and zero-balance refresh', async ({
  page,
  context,
}) => {
  const { state, calls } = await cloud(context, 'lost');
  await payment(page);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  await page.getByLabel('Payment amount').fill('99');
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('alert')).toContainText('Keep the original details');
  expect(calls.ids).toHaveLength(1);
  await page.getByLabel('Payment amount').fill('100');
  // Let the cached snapshot become stale, then trigger normal visibility refetch.
  await page.clock.setFixedTime(Date.now() + 16000);
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('This customer is fully paid.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Saved', exact: true })).toBeVisible();
  expect(new Set(calls.ids).size).toBe(1);
  expect(calls.ids).toHaveLength(2);
  expect(state.entries).toHaveLength(2);
});

test('retains a saved form on refresh failure and retries the read without another write', async ({
  page,
  context,
}) => {
  const { state, calls } = await cloud(context, 'refresh');
  await payment(page);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(
    page.getByText('Your entry was saved, but the notebook could not refresh.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Payment amount')).toHaveValue('100');
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Saved', exact: true })).toBeVisible();
  expect(calls.ids).toHaveLength(1);
  expect(state.entries).toHaveLength(2);
});

test('retries a request that never reached the server with the original save ID', async ({
  page,
  context,
}) => {
  const { state, calls } = await cloud(context, 'before');
  await payment(page);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
  expect(state.entries).toHaveLength(1);
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('heading', { name: 'Payment Saved', exact: true })).toBeVisible();
  expect(new Set(calls.ids).size).toBe(1);
  expect(state.entries).toHaveLength(2);
});

test('two stale tabs show one successful payment and one rejected payment', async ({
  page,
  context,
}) => {
  const { state } = await cloud(context, 'none');
  const other = await context.newPage();
  await payment(page, '80');
  await payment(other, '80');
  await Promise.all([
    page.getByRole('button', { name: 'Record payment' }).click(),
    other.getByRole('button', { name: 'Record payment' }).click(),
  ]);
  await expect
    .poll(
      async () =>
        (await page.getByRole('heading', { name: 'Payment Saved', exact: true }).count()) +
        (await other.getByRole('heading', { name: 'Payment Saved', exact: true }).count()),
    )
    .toBe(1);
  const loser = (await page.getByRole('heading', { name: 'Payment Saved', exact: true }).count())
    ? other
    : page;
  await expect(loser.getByRole('alert')).toContainText('available balance');
  await expect(loser.getByLabel('Payment amount')).toHaveValue('80');
  expect(state.entries).toHaveLength(2);
  await loser.getByLabel('Payment amount').fill('20');
  await loser.getByRole('button', { name: 'Record payment' }).click();
  await expect(loser.getByRole('heading', { name: 'Payment Saved', exact: true })).toBeVisible();
  expect(state.entries).toHaveLength(3);
});
