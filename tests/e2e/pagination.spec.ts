import { test, expect } from '@playwright/test';
import type { StoreData } from '../../src/types';

function notebook(): StoreData {
  const data: StoreData = { version: 1, customers: [], entries: [] };
  for (let i = 0; i < 121; i++) {
    const id = `page-customer-${i}`;
    data.customers.push({
      id,
      name: `Fictional customer ${String(i + 1).padStart(3, '0')}`,
      contactNumber: '',
      identifyingNote: 'Fictional pagination check',
      createdAt: '2026-08-01T00:00:00Z',
    });
    data.entries.push({
      id: `initial-${i}`,
      requestId: `initial-${i}`,
      customerId: id,
      type: 'utang',
      amountCentavos: 10000,
      description: 'Fictional initial utang',
      effectiveDate: '2026-08-01',
      effectiveTime: '08:00:00',
      createdAt: '2026-08-01T00:00:00Z',
    });
  }
  for (let pair = 0; pair < 52; pair++) {
    for (const type of ['utang', 'payment'] as const) {
      const id = `${type}-${pair}`;
      data.entries.push({
        id,
        requestId: id,
        customerId: 'page-customer-0',
        type,
        amountCentavos: type === 'utang' ? 10000 : 5000,
        description: `Fictional ${type} ${pair}`,
        effectiveDate: '2026-08-02',
        effectiveTime: `08:${String(pair).padStart(2, '0')}:${type === 'utang' ? '00' : '30'}`,
        createdAt: '2026-08-02T00:00:00Z',
      });
    }
  }
  return data;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-06T04:00:00Z') });
  await page.addInitScript((data) => {
    if (localStorage.getItem('tindahan.local-demo.v1') === null)
      localStorage.setItem('tindahan.local-demo.v1', JSON.stringify(data));
  }, notebook());
});

test('pages customers without hiding matches and resets to page one after search', async ({
  page,
}) => {
  await page.goto('/customers');
  const controls = page.getByRole('group', { name: 'Customers pages', exact: true });
  await expect(page.getByRole('heading', { name: '121 customers · 121 with utang' })).toBeVisible();
  await expect(page.locator('.customer-row')).toHaveCount(50);
  await expect(controls.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.customer-row').first()).toContainText('Fictional customer 051');
  await expect(page.getByRole('group', { name: 'Customers', exact: true })).toBeFocused();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('.customer-row')).toHaveCount(21);
  await expect(controls.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByLabel('Search by name').fill('customer 121');
  await expect(page.locator('.customer-row')).toHaveCount(1);
  await expect(page.locator('.customer-row')).toContainText('Fictional customer 121');
  await page.getByLabel('Search by name').fill('');
  await expect(page.getByText('Showing 1–50 of 121', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
});

test('paged history retains full running balances, filters, and corrections to older entries', async ({
  page,
}) => {
  await page.goto('/customers/page-customer-0');
  const controls = page.getByRole('group', { name: 'Customer history pages', exact: true });
  await expect(page.locator('.amount')).toHaveText('₱2,700.00');
  await expect(page.locator('article.record')).toHaveCount(50);
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article.record').first()).toContainText('Balance: ₱1,450.00');
  await page.getByRole('button', { name: 'Payments', exact: true }).click();
  await expect(page.getByText('Showing 1–50 of 52', { exact: true })).toBeVisible();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article.record')).toHaveCount(2);
  await expect(page.locator('article.record').last()).toContainText('Balance: ₱150.00');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByText('Showing 1–50 of 105', { exact: true })).toBeVisible();
  await controls.getByRole('button', { name: 'Next' }).click();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('article.record')).toHaveCount(5);
  await page
    .locator('article.record')
    .last()
    .getByRole('link', { name: 'Correct entry', exact: true })
    .click();
  await page.getByLabel('Correct amount').fill('120');
  await page.getByLabel('Reason for correction').fill('Fictional old-entry correction');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await page.getByRole('button', { name: 'Confirm correction', exact: true }).click();
  await expect(page.locator('.amount')).toHaveText('₱2,720.00');
  await expect(page.getByText('Showing 1–50 of 106', { exact: true })).toBeVisible();
  await controls.getByRole('button', { name: 'Next' }).click();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Voided · excluded from balances')).toBeVisible();
  await expect(
    page.getByText('Reason: Fictional old-entry correction', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('.amount')).toHaveText('₱2,720.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.locator('.hero .amount')).toHaveText('₱14,720.00');
  await page.getByRole('navigation').getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.locator('.customer-row').first()).toContainText('₱2,720.00');
});

test('daily pages retain whole-day totals and changing the date resets the page', async ({
  page,
}) => {
  await page.goto('/daily-record?date=2026-08-02');
  const controls = page.getByRole('group', { name: 'Daily transactions pages', exact: true });
  await expect(
    page.getByRole('heading', { name: '104 transactions · latest first' }),
  ).toBeVisible();
  await expect(page.locator('.summary-row').filter({ hasText: 'Utang given' })).toContainText(
    '₱5,200.00',
  );
  await expect(
    page.locator('.summary-row').filter({ hasText: 'Payments collected' }),
  ).toContainText('₱2,600.00');
  await controls.getByRole('button', { name: 'Next' }).click();
  await controls.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('a.record')).toHaveCount(4);
  await expect(page.locator('.summary-row').filter({ hasText: 'Total outstanding' })).toContainText(
    '₱14,700.00',
  );
  await page.getByRole('button', { name: 'Choose record date' }).click();
  await page.getByLabel('Or choose a date').fill('2026-08-01');
  await page.getByRole('button', { name: 'View daily record', exact: true }).click();
  await expect(page.getByText('Showing 1–50 of 121', { exact: true })).toBeVisible();
  await expect(page.locator('.summary-row').filter({ hasText: 'Total outstanding' })).toContainText(
    '₱12,100.00',
  );
});
