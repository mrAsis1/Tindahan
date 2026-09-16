import { expect, test } from '@playwright/test';

test('corrects customer spelling, keeps a visible history, and manages deleted customers', async ({
  page,
}) => {
  await page.goto('/customers/customer-0');
  const originalName = await page.locator('.customer-name').innerText();
  const originalBalance = await page.locator('.amount').innerText();
  await page.getByRole('link', { name: 'Edit customer', exact: true }).click();
  await page.getByLabel('Customer name', { exact: true }).fill('Corrected customer name');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.customer-name')).toHaveText('Corrected customer name');
  await expect(page.getByRole('region', { name: 'Customer changes' })).not.toBeVisible();
  await page.getByText('Show changes', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Customer changes' })).toContainText(originalName);
  await expect(page.getByRole('region', { name: 'Customer changes' })).not.toContainText('owner');
  await page.getByText('Hide changes', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Customer changes' })).not.toBeVisible();
  await expect(page.getByText('Show changes', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.amount')).toHaveText(originalBalance);
  await page.getByRole('button', { name: 'Delete customer', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('balance and history will be kept');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('link', { name: '+ New utang', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete customer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Deleted customer');
  await expect(page.locator('.amount')).toHaveText(originalBalance);
  for (const path of ['/utang/new', '/payments/new']) {
    await page.goto(path);
    await expect(
      page.getByRole('group', { name: 'Matching customers', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Corrected customer name', { exact: false })).toHaveCount(0);
    await page.getByLabel('Customer', { exact: true }).fill('Corrected customer name');
    await expect(page.getByText('No existing customer found.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('group', { name: 'Matching customers', exact: true }),
    ).not.toBeVisible();
  }
  await page.goto('/customers');
  await expect(page.getByRole('link').filter({ hasText: 'Corrected customer name' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Deleted', exact: true }).click();
  await page.getByRole('link').filter({ hasText: 'Corrected customer name' }).click();
  await page.getByRole('button', { name: 'Restore customer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm restore', exact: true }).click();
  await page.reload();
  const changes = page.getByRole('region', { name: 'Customer changes' });
  await expect(changes).not.toBeVisible();
  await page.getByText('Show changes', { exact: true }).click();
  await expect(changes.getByText('Customer deleted', { exact: true })).toHaveCount(1);
  await expect(changes.getByText('Customer restored', { exact: true })).toHaveCount(1);
  await expect(page.locator('.amount')).toHaveText(originalBalance);
  await expect(page.getByRole('link', { name: '+ New utang', exact: true })).toBeVisible();
});
