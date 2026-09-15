import { afterEach, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { authOptions } from '../../src/lib/api/authOptions';

afterEach(() => vi.unstubAllGlobals());

it('restores an expired saved login, refreshes it, and forgets it only after sign-out', async () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    },
  });
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    email: 'owner@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
  };
  const grants: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    expect(url.pathname).toBe('/auth/v1/token');
    const grant = url.searchParams.get('grant_type')!;
    grants.push(grant);
    if (grant === 'refresh_token')
      expect(JSON.parse(String(init?.body)).refresh_token).toBe('saved-refresh-token');
    return new Response(
      JSON.stringify({
        access_token: 'fictional-access-token',
        refresh_token: grant === 'password' ? 'saved-refresh-token' : 'rotated-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  const clients: { auth: { stopAutoRefresh: () => Promise<void> } }[] = [];
  const open = () => {
    const client = createClient('https://session-test.supabase.co', 'sb_publishable_fixture', {
      auth: authOptions,
      global: { fetch },
    });
    clients.push(client);
    return client;
  };
  try {
    const first = open();
    expect((await first.auth.getSession()).data.session).toBeNull();
    expect(
      (await first.auth.signInWithPassword({ email: user.email, password: 'fictional-password' }))
        .error,
    ).toBeNull();
    await first.auth.stopAutoRefresh();
    const key = 'sb-session-test-auth-token';
    const stored = JSON.parse(saved.get(key)!);
    expect(saved.get(key)).not.toContain('fictional-password');
    // Simulate reopening hours after the access token expired.
    saved.set(key, JSON.stringify({ ...stored, expires_at: Math.floor(Date.now() / 1000) - 7200 }));
    const reopened = open();
    const restored = await reopened.auth.getSession();
    expect(restored.error).toBeNull();
    expect(restored.data.session?.user.id).toBe(user.id);
    expect(grants).toEqual(['password', 'refresh_token']);
    expect(JSON.parse(saved.get(key)!).refresh_token).toBe('rotated-refresh-token');
    expect((await reopened.auth.signOut({ scope: 'local' })).error).toBeNull();
    expect(saved.has(key)).toBe(false);
    expect((await open().auth.getSession()).data.session).toBeNull();
  } finally {
    for (const client of clients) await client.auth.stopAutoRefresh();
  }
});

it('explains when browser storage cannot remember the login', () => {
  vi.stubGlobal('window', {
    localStorage: {
      setItem: () => {
        throw new Error('Storage blocked');
      },
    },
  });
  expect(() => authOptions.storage.setItem('session', 'fixture')).toThrow(
    'This browser could not save your sign-in',
  );
});
