import { test, expect, type Page } from '@playwright/test';

// Exercise the real Supabase SDK with deterministic HTTP responses. This hostname,
// publishable key, account and tokens are fictional; every request is intercepted.
const host = 'https://auth-test.supabase.co';
const owner = {
  id: '11111111-1111-4111-8111-111111111111',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-09-01T00:00:00Z',
};
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fictional-signature`;
const session = () => ({
  access_token: token,
  refresh_token: 'fictional-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: owner,
});
const callback = (path = '/auth/reset-password') =>
  `${path}#type=recovery&access_token=${token}&refresh_token=fictional-refresh-token&expires_in=3600&token_type=bearer`;

async function fakeAuth(
  page: Page,
  options: {
    requestStatus?: number;
    updateStatus?: number;
    failLogoutOnce?: boolean;
    rejectToken?: boolean;
  } = {},
) {
  const calls = {
    requests: [] as { email: string; redirect: string | null }[],
    updates: 0,
    logouts: 0,
    notebookReads: 0,
    password: 'Old-fictional-password',
  };
  await page.route(`${host}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/recover') {
      calls.requests.push({
        email: request.postDataJSON().email,
        redirect: url.searchParams.get('redirect_to'),
      });
      return options.requestStatus
        ? json({ code: 'over_email_send_rate_limit', msg: 'Limited' }, options.requestStatus)
        : json({});
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET')
      return options.rejectToken
        ? json({ code: 'bad_jwt', msg: 'Invalid token' }, 401)
        : json(owner);
    if (url.pathname === '/auth/v1/user' && request.method() === 'PUT') {
      calls.updates++;
      if (options.updateStatus)
        return json({ code: 'session_expired', msg: 'Expired' }, options.updateStatus);
      calls.password = request.postDataJSON().password;
      return json(owner);
    }
    if (url.pathname === '/auth/v1/logout') {
      calls.logouts++;
      expect(url.searchParams.get('scope')).toBe('global');
      if (options.failLogoutOnce && calls.logouts === 1)
        return json({ msg: 'Temporary failure' }, 500);
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === '/auth/v1/token') {
      if (
        url.searchParams.get('grant_type') === 'password' &&
        request.postDataJSON().password !== calls.password
      )
        return json({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return json(session());
    }
    if (url.pathname === '/rest/v1/rpc/get_notebook') {
      calls.notebookReads++;
      return json({
        version: 1,
        store: { id: '22222222-2222-4222-8222-222222222222', name: 'Test store' },
        customers: [],
        entries: [],
      });
    }
    return json({ message: 'Unexpected fixture request' }, 400);
  });
  return calls;
}

test('requests a reset with the exact app redirect and a generic confirmation', async ({
  page,
}) => {
  const calls = await fakeAuth(page);
  await page.goto('/home');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.getByLabel('Owner email').fill('owner@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an owner account exists');
  expect(calls.requests).toEqual([
    { email: 'owner@example.test', redirect: 'http://127.0.0.1:4179/auth/reset-password' },
  ]);
  await page.getByRole('button', { name: 'Use a different email' }).click();
  await page.getByLabel('Owner email').fill('unknown@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If an owner account exists');
  expect(calls.notebookReads).toBe(0);
});

test('handles rate limits without claiming an email was sent', async ({ page }) => {
  await fakeAuth(page, { requestStatus: 429 });
  await page.goto('/auth/forgot-password');
  await page.getByLabel('Owner email').fill('owner@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('alert')).toContainText('Too many requests');
  await expect(page.getByLabel('Owner email')).toHaveValue('owner@example.test');
  await expect(page.getByRole('heading', { name: 'Check your email' })).not.toBeVisible();
});

test('blocks missing and expired links, clears callback parameters, and offers another request', async ({
  page,
}) => {
  const calls = await fakeAuth(page);
  await page.goto('/auth/reset-password');
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await page.goto(
    '/auth/reset-password#error=access_denied&error_code=otp_expired&error_description=UNTRUSTED',
  );
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4179/auth/reset-password');
  await expect(page.getByText('UNTRUSTED')).not.toBeVisible();
  await page.getByRole('link', { name: 'Request a new link' }).click();
  await expect(page.getByLabel('Owner email')).toBeVisible();
  expect(calls.updates).toBe(0);
  expect(calls.notebookReads).toBe(0);
});

test('validates passwords, survives reload, updates once, signs out and accepts the new password', async ({
  page,
}) => {
  const calls = await fakeAuth(page);
  await page.goto(callback());
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4179/auth/reset-password');
  expect(calls.notebookReads).toBe(0);
  await page.reload();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('short');
  await page.getByLabel('Confirm new password').fill('short');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('8 characters');
  await page.getByLabel('New password', { exact: true }).fill('New-fictional-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  expect(calls.updates).toBe(0);
  await page.getByLabel('Confirm new password').fill('New-fictional-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  expect(calls.updates).toBe(1);
  expect(calls.logouts).toBe(1);
  expect(calls.notebookReads).toBe(0);
  await page.getByLabel('Email', { exact: true }).fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill('Old-fictional-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid login');
  await page.getByLabel('Password', { exact: true }).fill('New-fictional-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Magandang araw!' })).toBeVisible();
  expect(calls.notebookReads).toBeGreaterThan(0);
});

test('does not enter the notebook when recovery falls back to the home URL', async ({ page }) => {
  const calls = await fakeAuth(page);
  await page.goto(callback('/home'));
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4179/auth/reset-password');
  expect(calls.notebookReads).toBe(0);
});

test('rejects an invalid recovery link even with an existing persisted session', async ({
  page,
}) => {
  const calls = await fakeAuth(page);
  await page.goto(callback());
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.goto('/auth/reset-password#error_code=otp_expired&error=access_denied');
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).not.toBeVisible();
  expect(calls.notebookReads).toBe(0);
});

test('rejects tokens that fail server verification', async ({ page }) => {
  const calls = await fakeAuth(page, { rejectToken: true });
  await page.goto(callback());
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4179/auth/reset-password');
  expect(calls.updates).toBe(0);
});

test('requires a new link if the recovery session expires during password entry', async ({
  page,
}) => {
  const calls = await fakeAuth(page, { updateStatus: 401 });
  await page.goto(callback());
  await page.getByLabel('New password', { exact: true }).fill('New-fictional-password');
  await page.getByLabel('Confirm new password').fill('New-fictional-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Reset link unavailable' })).toBeVisible();
  expect(calls.updates).toBe(1);
  expect(calls.notebookReads).toBe(0);
});

test('retries failed sign-out without changing the password twice', async ({ page }) => {
  const calls = await fakeAuth(page, { failLogoutOnce: true });
  await page.goto(callback());
  await page.getByLabel('New password', { exact: true }).fill('New-fictional-password');
  await page.getByLabel('Confirm new password').fill('New-fictional-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText('password was updated');
  await page.getByRole('button', { name: 'Finish signing out' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
  expect(calls.updates).toBe(1);
  expect(calls.logouts).toBe(2);
});
