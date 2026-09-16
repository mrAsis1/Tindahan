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
      const available = state.entries
        .filter((entry) => entry.customerId === input.p_customer_id)
        .reduce(
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

for (const failure of ['lost', 'refresh'] as const) {
  test(`customer edits survive a ${failure} response without a second change`, async ({
    page,
    context,
  }) => {
    const { state, calls } = await cloud(context, failure);
    let firstInput: unknown;
    await context.route(
      'https://auth-test.supabase.co/rest/v1/rpc/change_customer',
      async (route) => {
        const input = route.request().postDataJSON();
        calls.ids.push(input.p_request_id);
        if (!firstInput) {
          firstInput = input;
          expect(input).toMatchObject({
            p_customer_id: customer,
            p_expected_revision: 0,
            p_deleted: false,
            p_details: { name: 'Corrected cloud name', contactNumber: '', identifyingNote: '' },
          });
          const original = state.customers[0];
          state.customers[0] = {
            ...original,
            ...input.p_details,
            revision: 1,
            deleted: false,
            changes: [
              {
                customerId: customer,
                expectedRevision: 0,
                details: input.p_details,
                deleted: false,
                requestId: input.p_request_id,
                before: {
                  name: original.name,
                  contactNumber: '',
                  identifyingNote: '',
                  deleted: false,
                },
                after: { ...input.p_details, deleted: false },
                createdAt: '2026-09-16T00:00:00Z',
                createdBy: owner.id,
              },
            ],
          };
          if (failure === 'lost') return route.abort('connectionreset');
        } else expect(input).toEqual(firstInput);
        return route.fulfill({ status: 204 });
      },
    );
    await page.goto(`/customers/${customer}/edit`);
    await page.getByLabel('Customer name', { exact: true }).fill('Corrected cloud name');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('alert').last()).toBeVisible();
    await expect(page.getByLabel('Customer name', { exact: true })).toHaveValue(
      'Corrected cloud name',
    );
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('.customer-name')).toHaveText('Corrected cloud name');
    await page.reload();
    await page.getByText('Show changes', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Customer changes' })).not.toContainText(
      'Store owner',
    );
    await expect(page.getByRole('region', { name: 'Customer changes' })).toContainText(
      'Fictional customer',
    );
    await expect(page.getByText('Customer details edited', { exact: true })).toHaveCount(1);
    await expect(page.locator('.amount')).toHaveText('₱100.00');
    expect(calls.ids).toHaveLength(failure === 'lost' ? 2 : 1);
  });
}

test('scoped form balances and confirmation history refresh after a payment', async ({
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
  expect(calls.fullReads).toBe(0);
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱50.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.locator('.customer-row')).toContainText('₱50.00');
  await page.locator('.customer-row').click();
  await expect(page.locator('article.record')).toHaveCount(2);
  await expect(page.locator('.amount')).toHaveText('₱50.00');
  expect(calls.fullReads).toBe(0);
  expect(calls.views).toEqual(expect.arrayContaining(['home', 'directory', 'customer']));
  expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
});

test('payment selection uses each customer balance and confirms the selected history', async ({
  page,
  context,
}) => {
  const { state, calls } = await cloud(context, 'none');
  const second = '55555555-5555-4555-8555-555555555555';
  state.customers.push({ ...state.customers[0], id: second, name: 'Second fictional customer' });
  state.entries.push({
    ...state.entries[0],
    id: '66666666-6666-4666-8666-666666666666',
    requestId: '66666666-6666-4666-8666-666666666666',
    customerId: second,
    amountCentavos: 20000,
  });
  await payment(page, '150');
  await expect(page.getByText('Payment is higher than the remaining balance.')).toBeVisible();
  await page.getByLabel('Customer', { exact: true }).fill('Second fictional');
  await page.getByRole('button', { name: 'Second fictional customer', exact: true }).click();
  await expect(page.locator('.summary-row').filter({ hasText: 'Current utang' })).toContainText(
    '₱200.00',
  );
  await expect(page.locator('.summary-row').filter({ hasText: 'Remaining utang' })).toContainText(
    '₱50.00',
  );
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`confirmation\\?customer=${second}$`));
  await expect(
    page.locator('.summary-row').filter({ hasText: 'Balance after this entry' }),
  ).toContainText('₱50.00');
  expect(state.entries.at(-1)?.customerId).toBe(second);
  expect(calls.fullReads).toBe(0);
});

test('scoped confirmations reload safely while legacy and mismatched links remain clear', async ({
  page,
  context,
}) => {
  const { state, calls } = await cloud(context, 'none');
  await payment(page, '50');
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  const confirmation = page.url();
  await page.reload();
  await expect(page.locator('.summary-row').filter({ hasText: 'Previous balance' })).toContainText(
    '₱100.00',
  );
  await expect(
    page.locator('.summary-row').filter({ hasText: 'Balance after this entry' }),
  ).toContainText('₱50.00');
  expect(calls.fullReads).toBe(0);
  const legacy = confirmation.split('?')[0];
  await page.goto(`${legacy}?customer=55555555-5555-4555-8555-555555555555`);
  await expect(page.getByRole('heading', { name: 'Entry not found' })).toBeVisible();
  expect(calls.fullReads).toBe(0);
  await page.goto(legacy);
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  expect(calls.fullReads).toBe(1);
  state.entries.at(-1)!.status = 'voided';
  state.entries.at(-1)!.voidReason = 'Fictional correction';
  await page.goto(confirmation);
  await expect(page.getByRole('heading', { name: 'Voided entry' })).toBeVisible();
  await expect(page.getByText('Reason: Fictional correction')).toBeVisible();
  expect(calls.fullReads).toBe(1);
});

test('failed confirmation history keeps the saved form and retries without another write', async ({
  page,
  context,
}) => {
  const { calls } = await cloud(context, 'none');
  // Cache the old history before saving, then fail its confirmation refresh.
  await page.goto(`/customers/${customer}`);
  await expect(page.locator('.amount')).toHaveText('₱100.00');
  await page.getByRole('link', { name: 'Record Payment' }).click();
  await page.getByLabel('Payment amount').fill('100');
  let failHistory = true;
  let releaseHistory!: () => void;
  const pendingHistory = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  await context.route('**/rest/v1/rpc/read_notebook', async (route) => {
    if (route.request().postDataJSON().p_view === 'customer' && failHistory) {
      failHistory = false;
      await pendingHistory;
      return route.fulfill({
        status: 503,
        json: { message: 'Fictional history refresh failure', code: '503' },
      });
    }
    return route.fallback();
  });
  try {
    await page.getByRole('button', { name: 'Record payment', exact: true }).click();
    await expect(page.locator('.summary-row').filter({ hasText: 'Current utang' })).toContainText(
      '₱0.00',
    );
    await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
    await expect(page.getByText('Payment is higher than the remaining balance.')).toHaveCount(0);
    await expect(page).toHaveURL(/\/payments\/new/);
  } finally {
    releaseHistory();
  }
  await expect(page.getByRole('alert')).toContainText('Your entry was saved');
  await expect(page).toHaveURL(/\/payments\/new/);
  await expect(page.getByLabel('Payment amount')).toHaveValue('100');
  expect(calls.ids).toHaveLength(1);
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  await expect(
    page.locator('.summary-row').filter({ hasText: 'Balance after this entry' }),
  ).toContainText('₱0.00');
  expect(calls.ids).toHaveLength(1);
  expect(calls.fullReads).toBe(0);
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
