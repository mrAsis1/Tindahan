import { test, expect } from '@playwright/test';
import { createPilotFixture } from '../fixtures/pilot';

for (const concentrated of [false, true]) {
  test(`pilot reads: ${concentrated ? 'concentrated history' : 'even distribution'}`, async ({
    page,
    context,
  }, testInfo) => {
    const data = createPilotFixture(concentrated);
    const body = JSON.stringify(data);
    const owner = {
      id: '11111111-1111-4111-8111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'owner@example.test',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-08-01T00:00:00Z',
    };
    const cpuRate = testInfo.project.name === 'pilot-mobile' ? 4 : 1;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
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
    let reads = 0;
    const unexpected: string[] = [];
    // Allow only the isolated static server and our intercepted, read-only API.
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4180') return route.continue();
      if (url.origin === 'https://pilot-test.supabase.co') {
        if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET')
          return route.fulfill({ json: owner });
        if (url.pathname === '/rest/v1/rpc/get_notebook' && route.request().method() === 'POST') {
          reads++;
          await new Promise((resolve) => setTimeout(resolve, 150));
          return route.fulfill({ contentType: 'application/json', body });
        }
      }
      unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const timings: Record<string, number[]> = {};
    async function measure(name: string, action: () => Promise<void>) {
      const start = performance.now();
      await action();
      // Include a paint opportunity after the expected content is present.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      (timings[name] ??= []).push(Math.round(performance.now() - start));
    }
    const nav = page.getByRole('navigation');
    for (let sample = 0; sample < 3; sample++) {
      await measure('home-reload', async () => {
        await page.goto('/home');
        await expect(page.locator('.hero .amount')).toHaveText('₱1,000,000.00');
        await expect(page.getByText('500 customers with a balance', { exact: true })).toBeVisible();
      });
      await measure('customers-navigation', async () => {
        await nav.getByRole('link', { name: 'Customers', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
        await expect(page.locator('.customer-row')).toHaveCount(50);
        await expect(page.getByText('Showing 1–50 of 500', { exact: true })).toBeVisible();
      });
      await nav.getByRole('link', { name: 'Search', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
      await expect(page.locator('.customer-row')).toHaveCount(50);
      await measure('search-exact', async () => {
        await page.getByLabel('Search by name').fill('Fictional customer 001');
        await expect(page.locator('.customer-row')).toHaveCount(1);
        await expect(page.locator('.customer-row')).toContainText(
          concentrated ? '₱200,000.00' : '₱2,000.00',
        );
      });
      await measure('customer-history', async () => {
        await page.locator('.customer-row').click();
        await expect(page.locator('article.record')).toHaveCount(concentrated ? 50 : 40);
        if (concentrated)
          await expect(page.getByText('Showing 1–50 of 4000', { exact: true })).toBeVisible();
        await expect(page.locator('.amount')).toHaveText(
          concentrated ? '₱200,000.00' : '₱2,000.00',
        );
      });
      await measure('daily-reload', async () => {
        await page.goto('/daily-record?date=2026-08-20');
        await expect(page.locator('a.record')).toHaveCount(50);
        await expect(page.getByText('Showing 1–50 of 1000', { exact: true })).toBeVisible();
        await expect(
          page.locator('.summary-row').filter({ hasText: 'Total outstanding' }),
        ).toContainText('₱1,000,000.00');
      });
      console.log(
        `${testInfo.project.name}: ${concentrated ? 'concentrated' : 'even'} sample ${sample + 1}/3 complete`,
      );
    }
    const results = Object.fromEntries(
      Object.entries(timings).map(([name, samples]) => {
        const sorted = [...samples].sort((a, b) => a - b);
        return [
          name,
          {
            samplesMs: samples,
            medianMs: sorted[1],
            maxMs: sorted[2],
            aboveTwoSeconds: samples.filter((ms) => ms > 2_000).length,
          },
        ];
      }),
    );
    const report = {
      project: testInfo.project.name,
      concentrated,
      browser: context.browser()?.version(),
      cpuRate,
      responseDelayMs: 150,
      snapshotBytes: Buffer.byteLength(body),
      reads,
      results,
    };
    console.log(JSON.stringify(report));
    await testInfo.attach('pilot-measurements', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    expect(reads).toBeGreaterThanOrEqual(6);
    expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
  });
}
