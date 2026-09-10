import { test, expect } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { createPilotFixture } from '../fixtures/pilot';
import type { LedgerEntry } from '../../src/types';

for (const slow of [false, true]) {
  test(`pilot transaction forms: ${slow ? 'constrained JSON connection' : 'baseline connection'}`, async ({
    page,
    context,
  }, testInfo) => {
    // Worst existing customer-history fixture: 500 customers, 20,000 entries,
    // including 4,000 entries and a ₱200,000 balance for customer 001.
    const data = createPilotFixture(true);
    const customerId = data.customers[0].id;
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
    const latencyMs = slow ? 400 : 150;
    const downloadBytesPerSecond = slow ? 125000 : null; // 1 Mbit/s, JSON responses only.
    const responses: { path: string; rawBytes: number; gzipBytes: number; delayMs: number }[] = [];
    const attempts: Record<string, unknown>[] = [];
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let failNextSave = false;
    let releaseSave: (() => void) | undefined;
    let saveGate: Promise<void> | undefined;
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://127.0.0.1:4180') return route.continue();
      if (url.origin === 'https://pilot-test.supabase.co') {
        const json = async (value: unknown) => {
          const raw = JSON.stringify(value);
          const compressed = gzipSync(raw);
          const delayMs =
            latencyMs +
            (downloadBytesPerSecond
              ? Math.ceil((compressed.length / downloadBytesPerSecond) * 1000)
              : 0);
          responses.push({
            path: url.pathname,
            rawBytes: Buffer.byteLength(raw),
            gzipBytes: compressed.length,
            delayMs,
          });
          // Deterministic transfer-duration model assuming gzip compression.
          // This does not emulate packet loss, shared bandwidth or real server execution.
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          return route.fulfill({
            body: raw,
            headers: {
              'content-type': 'application/json',
            },
          });
        };
        if (url.pathname === '/auth/v1/user' && route.request().method() === 'GET')
          return json(owner);
        if (url.pathname === '/rest/v1/rpc/get_notebook' && route.request().method() === 'POST')
          return json(data);
        if (url.pathname === '/rest/v1/rpc/record_entry' && route.request().method() === 'POST') {
          const input = route.request().postDataJSON();
          attempts.push(input);
          await saveGate;
          if (failNextSave) {
            failNextSave = false;
            return route.abort('connectionfailed');
          }
          // In-memory UI fixture only; PostgreSQL write validation has separate tests.
          let entry = data.entries.find((entry) => entry.requestId === input.p_request_id);
          if (!entry) {
            entry = {
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
            } satisfies LedgerEntry;
            data.entries.push(entry);
          }
          return json(entry);
        }
      }
      unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });
    const timings: { flow: string; openMs: number; inputMs: number; confirmedSaveMs: number }[] =
      [];
    for (const payment of [false, true]) {
      const opened = performance.now();
      await page.goto(`/${payment ? 'payments' : 'utang'}/new?customer=${customerId}`);
      const amount = page.getByLabel(payment ? 'Payment amount' : 'Amount', { exact: true });
      await expect(amount).toBeVisible();
      await expect(page.getByLabel('Customer', { exact: true })).toHaveValue(customerId);
      await expect(page.locator('#customer option')).toHaveCount(501);
      await expect(page.locator('.summary-row').filter({ hasText: 'Current utang' })).toContainText(
        payment ? '₱200,150.00' : '₱200,000.00',
      );
      const openMs = Math.round(performance.now() - opened);
      const inputStart = performance.now();
      await amount.fill(payment ? '50' : '150');
      await expect(amount).toHaveValue(payment ? '50' : '150');
      if (payment)
        await expect(
          page.locator('.summary-row').filter({ hasText: 'Remaining utang' }),
        ).toContainText('₱200,100.00');
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const inputMs = Math.round(performance.now() - inputStart);
      const save = page.getByRole('button', {
        name: payment ? 'Record payment' : 'Save utang',
        exact: true,
      });
      await save.scrollIntoViewIfNeeded();
      await expect(save).toBeInViewport();
      if (payment) {
        failNextSave = true;
        await save.click();
        await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
        await expect(amount).toHaveValue('50');
        await expect(page).toHaveURL(/\/payments\/new/);
        expect(data.entries).toHaveLength(20001);
      }
      saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const started = performance.now();
      try {
        await (payment ? page.getByRole('button', { name: 'Retry save' }) : save).click();
        await expect.poll(() => attempts.length).toBe(payment ? 3 : 1);
        await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
        await expect(page).toHaveURL(payment ? /\/payments\/new/ : /\/utang\/new/);
      } finally {
        releaseSave?.();
        saveGate = undefined;
      }
      await expect(page).toHaveURL(/\/transactions\/[^/]+\/confirmation/);
      await expect(
        page.getByRole('heading', {
          name: payment ? 'Payment recorded' : 'Utang saved',
          level: 2,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator('.summary-row').filter({ hasText: 'Balance after this entry' }),
      ).toContainText(payment ? '₱200,100.00' : '₱200,150.00');
      timings.push({
        flow: payment ? 'payment' : 'utang',
        openMs,
        inputMs,
        confirmedSaveMs: Math.round(performance.now() - started),
      });
    }
    expect(attempts).toHaveLength(3);
    expect(attempts[1]).toEqual(attempts[2]);
    expect(attempts[0].p_request_id).not.toBe(attempts[1].p_request_id);
    expect(data.entries).toHaveLength(20002);
    expect(data.entries.slice(-2).map((e) => [e.type, e.amountCentavos, e.customerId])).toEqual([
      ['utang', 15000, customerId],
      ['payment', 5000, customerId],
    ]);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    expect(responses.filter((response) => response.path.endsWith('/get_notebook'))).toHaveLength(4);
    expect(await page.evaluate(() => localStorage.getItem('tindahan.local-demo.v1'))).toBeNull();
    const report = {
      project: testInfo.project.name,
      browser: context.browser()?.version(),
      cpuRate,
      latencyMs,
      downloadBytesPerSecond,
      model:
        'assumed gzip JSON transfer duration, delivered as plain JSON; static assets unthrottled; no real backend',
      timings,
      responses,
      attempts: attempts.length,
    };
    console.log(JSON.stringify(report));
    await testInfo.attach('pilot-form-measurements', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
  });
}
