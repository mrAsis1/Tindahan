import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-06T04:00:00Z') });
  await page.goto('/home');
});

test('reviews a replacement, preserves the original and reason, and recalculates after reload', async ({
  page,
}) => {
  await page.goto('/customers/customer-0');
  await page
    .locator('article.record')
    .first()
    .getByRole('link', { name: 'Correct entry', exact: true })
    .click();
  await page.getByLabel('Correct amount').fill('250');
  await page.getByLabel('Correct description (optional)').fill('Corrected groceries');
  await page.getByLabel('Reason for correction').fill('Receipt was 250, not 150');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await expect(page.getByRole('dialog')).toContainText('₱950.00');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Correct amount')).toHaveValue('250');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await page.getByRole('button', { name: 'Confirm correction', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Correction saved');
  await page.reload();
  await expect(page.locator('.amount')).toHaveText('₱950.00');
  await expect(page.getByText('Reason: Receipt was 250, not 150', { exact: true })).toBeVisible();
  await expect(page.getByText('Voided · excluded from balances')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Replaces earlier entry' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('corrected-history.png'), fullPage: true });
  await page.goto('/transactions/seed-15/confirmation');
  await expect(page.getByRole('heading', { name: 'Voided entry', exact: true })).toBeVisible();
  await page.goto('/home');
  await expect(page.locator('.hero .amount')).toHaveText('₱4,950.00');
});

test('voids a payment without a replacement and retains its audit in history', async ({ page }) => {
  await page.goto('/transactions/seed-3/correct');
  await page.getByLabel('Correction action').selectOption('void');
  await expect(page.getByLabel('Correct amount')).not.toBeVisible();
  await page.getByLabel('Reason for correction').fill('Payment entered twice');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await expect(page.getByRole('dialog')).toContainText('without a replacement');
  await page.getByRole('button', { name: 'Confirm correction', exact: true }).click();
  await expect(page.locator('.amount')).toHaveText('₱1,150.00');
  await page.getByRole('button', { name: 'Payments', exact: true }).click();
  await expect(page.getByText('Reason: Payment entered twice', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.amount')).toHaveText('₱1,150.00');
});

test('rejects a historically invalid correction and preserves the form on cancellation', async ({
  page,
}) => {
  await page.goto('/transactions/seed-0/correct');
  await page.getByLabel('Correction action').selectOption('void');
  await page.getByLabel('Reason for correction').fill('Wrong purchase');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await expect(page.getByRole('alert')).toContainText('available balance');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.amount')).toHaveText('₱850.00');
  await expect(page.getByText('Voided · excluded from balances')).not.toBeVisible();
});

test('retains a failed correction and retries without creating duplicates', async ({ page }) => {
  await page.goto('/transactions/seed-15/correct');
  await page.getByLabel('Correct amount').fill('200');
  await page.getByLabel('Reason for correction').fill('Receipt mismatch');
  await page.getByRole('button', { name: 'Review correction' }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tindahan.local-demo.v1') {
        Storage.prototype.setItem = original;
        throw new Error('Unavailable');
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Confirm correction', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Couldn’t save');
  await expect(page.getByRole('dialog')).toContainText('Receipt mismatch');
  await page.getByRole('button', { name: 'Confirm correction', exact: true }).click();
  await expect(page.locator('.amount')).toHaveText('₱900.00');
  await expect(page.getByRole('link', { name: 'Replaces earlier entry' })).toHaveCount(1);
  await expect(page.getByText('Reason: Receipt mismatch', { exact: true })).toHaveCount(1);
});
