import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-06T04:00:00Z') });
  await page.goto('/home');
});

test('Home → Search → customer → partial payment → confirmation → persisted history', async ({
  page,
}) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search by name').fill('  mArIa  ');
  await page.getByRole('link', { name: /Maria Santos/ }).click();
  await expect(page.locator('.amount')).toHaveText('₱850.00');
  await page.getByRole('link', { name: 'Record Payment' }).click();
  await page.getByLabel('Payment amount').fill('200');
  await expect(page.getByText('₱650.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
  await expect(page.getByText('₱650.00', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View customer history' }).click();
  await page.reload();
  await expect(page.locator('.amount')).toHaveText('₱650.00');
  await expect(page.locator('article.record').first()).toContainText('−₱200.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱4,650.00');
});

test('Home → Add Utang → existing customer → save → updated balance', async ({ page }) => {
  await page.getByRole('link', { name: '+ Add Utang', exact: true }).click();
  await page.getByLabel('Customer', { exact: true }).selectOption('customer-0');
  await page.getByLabel('Amount', { exact: true }).fill('150');
  await page.getByLabel('Item / description (optional)').fill('Rice & canned goods');
  await page.getByRole('button', { name: 'Save utang', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Utang saved', exact: true })).toBeVisible();
  await expect(page.getByText('₱1,000.00', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱5,000.00');
});

test('creates a new customer within utang without losing the draft', async ({ page }) => {
  await page.getByRole('link', { name: '+ Add Utang', exact: true }).click();
  await page.getByLabel('Amount', { exact: true }).fill('150.25');
  await page.getByLabel('Item / description (optional)').fill('Milk & bread');
  await page.getByRole('button', { name: '+ Add a new customer' }).click();
  await page.getByRole('dialog').getByLabel('Customer name').fill('Rosa Garcia');
  await page.getByRole('dialog').getByLabel('Contact number (optional)').fill('0918 555 0124');
  await page.getByRole('button', { name: 'Save customer & add utang' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('150.25');
  await expect(page.getByLabel('Item / description (optional)')).toHaveValue('Milk & bread');
  await expect(
    page.getByLabel('Customer', { exact: true }).locator('option:checked'),
  ).toContainText('Rosa Garcia');
  await page.getByRole('button', { name: 'Save utang', exact: true }).click();
  await page.getByRole('link', { name: 'View customer history' }).click();
  await expect(page.locator('.amount')).toHaveText('₱150.25');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rosa Garcia' })).toBeVisible();
});

test('rejects invalid and excessive payments, then accepts a full payment', async ({ page }) => {
  await page.goto('/payments/new?customer=customer-0');
  await page.getByLabel('Payment amount').fill('0');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('alert')).toContainText('positive amount');
  await page.getByLabel('Payment amount').fill('850.001');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('alert')).toContainText('two decimals');
  await page.getByLabel('Payment amount').fill('851');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('alert')).toContainText('higher than');
  await page.getByLabel('Payment amount').fill('850');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await page.getByRole('link', { name: 'View customer history' }).click();
  await expect(page.locator('.amount')).toHaveText('₱0.00');
  await expect(page.getByRole('button', { name: 'Fully paid' })).toBeDisabled();
});

test('rejects a historically invalid payment and preserves fields for correction', async ({
  page,
}) => {
  await page.goto('/payments/new?customer=customer-0');
  await page.getByLabel('Payment amount').fill('100');
  await page.getByLabel('Date', { exact: true }).fill('2026-08-26');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('alert')).toContainText('available balance on this date');
  await expect(page.getByLabel('Payment amount')).toHaveValue('100');
  await page.getByLabel('Date', { exact: true }).fill('2026-09-06');
  await page.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible();
});

test('calendar shows historical totals and preserves the selected day when canceled', async ({
  page,
}) => {
  await page.getByRole('navigation').getByRole('link', { name: 'Daily Record' }).click();
  await expect(page.getByText('No transactions on this day.')).toBeVisible();
  await page.getByRole('button', { name: 'Choose record date' }).click();
  await page.getByLabel('Or choose a date').fill('2026-09-05');
  await page.getByRole('button', { name: 'View daily record', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5 transactions · latest first' })).toBeVisible();
  await expect(page.getByText('₱650.00', { exact: true })).toBeVisible();
  await expect(page.getByText('₱400.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose record date' }).click();
  await page.getByLabel('Or choose a date').fill('2026-09-04');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5 transactions · latest first' })).toBeVisible();
  await page.getByRole('button', { name: 'Choose record date' }).click();
  await page.getByLabel('Or choose a date').fill('2026-09-04');
  await page.getByRole('button', { name: 'View daily record', exact: true }).click();
  await expect(page.getByText('₱4,600.00', { exact: true })).toBeVisible();
});

test('empty notebook, no search results and customer creation without a phone', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Start an empty notebook' }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱0.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.getByText('Your customer notebook is empty.')).toBeVisible();
  await page.getByRole('link', { name: '+ Add customer', exact: true }).first().click();
  await page.getByLabel('Customer name').fill('Ana Reyes');
  await page.getByRole('button', { name: 'Save customer', exact: true }).click();
  await expect(page.locator('.amount')).toHaveText('₱0.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Search', exact: true }).click();
  await page.getByLabel('Search by name').fill('not here');
  await expect(page.getByText('No customers found. Try another name.')).toBeVisible();
});

test('failed browser save keeps the form and does not show confirmation', async ({ page }) => {
  await page.goto('/utang/new?customer=customer-0');
  await page.getByLabel('Amount', { exact: true }).fill('150');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage unavailable', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Save utang', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Couldn’t save');
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('150');
  await expect(page).toHaveURL(/utang\/new/);
});

test('core screens fit a narrow viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const route of [
    '/home',
    '/customers',
    '/customers/customer-0',
    '/utang/new',
    '/payments/new',
    '/daily-record',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('repeated submissions create one entry', async ({ page }) => {
  await page.goto('/utang/new?customer=customer-0');
  await page.getByLabel('Amount', { exact: true }).fill('150');
  await page.locator('form').evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(page.getByRole('heading', { name: 'Utang saved', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View customer history' }).click();
  await expect(page.locator('.amount')).toHaveText('₱1,000.00');
  await expect(page.locator('article.record')).toHaveCount(6);
});

test('simultaneous demo tabs cannot overpay a customer together', async ({ page, context }) => {
  await page.goto('/payments/new?customer=customer-0');
  const second = await context.newPage();
  await second.clock.install({ time: new Date('2026-09-06T04:00:00Z') });
  await second.goto('/payments/new?customer=customer-0');
  await page.getByLabel('Payment amount').fill('600');
  await second.getByLabel('Payment amount').fill('600');
  await Promise.all([
    page.getByRole('button', { name: 'Record payment' }).click(),
    second.getByRole('button', { name: 'Record payment' }).click(),
  ]);
  await expect
    .poll(async () => [page, second].filter((p) => p.url().includes('/confirmation')).length)
    .toBe(1);
  const failed = page.url().includes('/confirmation') ? second : page;
  await expect(failed.getByRole('alert')).toContainText(/balance/);
  await page.goto('/customers/customer-0');
  await expect(page.locator('.amount')).toHaveText('₱250.00');
  await second.close();
});

test('Home labels and duplicate customer selection preserve the existing notebook', async ({
  page,
}) => {
  await expect(page.getByText('TOTAL DEBT', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today’s Overview' })).toBeVisible();
  await page.goto('/customers/new');
  await page.getByLabel('Customer name').fill('Fictional Duplicate');
  await page.getByRole('button', { name: 'Save customer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional Duplicate', exact: true }),
  ).toBeVisible();
  const original = page.url();
  await page.goto('/customers/new');
  await page.getByLabel('Customer name').fill('  fictional   DUPLICATE ');
  await page.getByRole('button', { name: 'Save customer', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await page
    .getByRole('button', { name: 'Use existing: Fictional Duplicate', exact: true })
    .click();
  await expect(page).toHaveURL(original);
  await page.goto('/utang/new');
  await page.getByLabel('Amount', { exact: true }).fill('150');
  await page.getByRole('button', { name: /New customer/i }).click();
  await page.getByRole('dialog').getByLabel('Customer name').fill('Fictional Duplicate');
  await page
    .getByRole('button', { name: 'Use existing: Fictional Duplicate', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('150');
  await page.goto('/customers/new');
  await page.getByLabel('Customer name').fill('Fictional Duplicate');
  await page.getByLabel('Identifying note (optional)').fill('Different person near school');
  await page.getByRole('button', { name: 'Save customer', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fictional Duplicate', exact: true }),
  ).toBeVisible();
  expect(page.url()).not.toBe(original);
});
