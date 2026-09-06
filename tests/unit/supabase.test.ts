import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

// Runs the real SQL against embedded PostgreSQL. Only Supabase Auth's users/uid
// contract is stubbed; RLS, roles, constraints, functions and rollback are real.
const db = new PGlite();
const ownerA = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ownerB = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const customerA = 'aaaaaaaa-0000-4000-8000-000000000001';
const customerB = 'bbbbbbbb-0000-4000-8000-000000000001';
const entryId = (last: number) => `cccccccc-0000-4000-8000-${String(last).padStart(12, '0')}`;

async function asOwner<T>(owner: string, sql: string, args: unknown[] = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner]);
  return db.query<T>(sql, args);
}
async function record(
  id: number,
  type: string,
  cents: number,
  date = '2026-09-01',
  customer = customerA,
) {
  return asOwner<{ value: { id: string } }>(
    ownerA,
    'select public.record_entry($1::uuid, $2::uuid, $3, $4::bigint, $5::date) as value',
    [entryId(id), customer, type, cents, date],
  );
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${ownerA}'), ('${ownerB}');
  `);
  await db.exec(readFileSync('supabase/migrations/20260906090000_create_tindahan.sql', 'utf8'));
}, 30000);
afterAll(async () => db.close());

describe('Supabase migration and access boundaries', () => {
  it('creates exactly one store per owner and distinct customers with identical names', async () => {
    for (const [owner, id] of [
      [ownerA, customerA],
      [ownerB, customerB],
    ]) {
      await asOwner(owner, "select public.create_store('Test Store')");
      await asOwner(owner, "select public.create_store('Retry')");
      await asOwner(owner, "select public.create_customer($1::uuid, 'Maria Santos')", [id]);
      expect((await asOwner(owner, 'select * from public.stores')).rows).toHaveLength(1);
    }
  });
  it('denies anonymous reads and function execution', async () => {
    await db.exec('set role anon');
    await expect(db.query('select * from public.customers')).rejects.toThrow(/permission denied/);
    await expect(db.query('select public.get_notebook()')).rejects.toThrow(/permission denied/);
  });
  it('isolates every owner-visible table and rejects cross-store financial writes', async () => {
    const rows = await asOwner<{ id: string }>(ownerB, 'select id from public.customers');
    expect(rows.rows.map((r) => r.id)).toEqual([customerB]);
    await expect(record(1, 'utang', 100, '2026-09-01', customerB)).rejects.toThrow(
      'Customer not found',
    );
    expect((await asOwner(ownerB, 'select * from public.owner_profiles')).rows).toHaveLength(1);
    expect((await asOwner(ownerB, 'select * from public.audit_events')).rows).toHaveLength(2);
  });
  it('forbids direct writes that would bypass the ledger and audit functions', async () => {
    await expect(asOwner(ownerA, 'delete from public.customers')).rejects.toThrow(
      /permission denied/,
    );
    await expect(asOwner(ownerA, "update public.stores set name = 'Changed'")).rejects.toThrow(
      /permission denied/,
    );
    await expect(asOwner(ownerA, 'delete from public.ledger_entries')).rejects.toThrow(
      /permission denied/,
    );
    await expect(asOwner(ownerA, 'delete from public.audit_events')).rejects.toThrow(
      /permission denied/,
    );
    await expect(asOwner(ownerA, 'select private.owned_store()')).rejects.toThrow(
      /permission denied/,
    );
  });
  it('saves positive entries and retries once without duplicating their audit events', async () => {
    const first = await record(2, 'utang', 85000);
    expect((await record(2, 'utang', 85000)).rows).toEqual(first.rows);
    await expect(record(2, 'utang', 10000)).rejects.toThrow('different transaction details');
    expect((await asOwner(ownerA, 'select * from public.ledger_entries')).rows).toHaveLength(1);
    expect(
      (await asOwner(ownerA, "select * from public.audit_events where action = 'entry.created'"))
        .rows,
    ).toHaveLength(1);
  });
  it('rolls back excessive and historically invalid payments', async () => {
    await expect(record(3, 'payment', 85001)).rejects.toThrow('available balance');
    await expect(record(3, 'payment', 100, '2026-08-31')).rejects.toThrow('available balance');
    expect((await asOwner(ownerA, 'select * from public.ledger_entries')).rows).toHaveLength(1);
    await record(3, 'payment', 20000, '2026-09-02');
    await record(4, 'payment', 65000, '2026-09-03');
    await expect(record(5, 'payment', 1, '2026-09-02')).rejects.toThrow('available balance');
  });
  it('rejects invalid amounts, future dates and unauthenticated callers', async () => {
    await expect(record(6, 'utang', 0)).rejects.toThrow('positive amount');
    await expect(record(6, 'utang', 1, '2999-01-01')).rejects.toThrow('earlier valid date');
    await expect(asOwner('', 'select public.get_notebook()')).rejects.toThrow('Sign in');
  });
  it('returns a consistent camel-case snapshot scoped to the owner', async () => {
    const result = await asOwner<{
      value: {
        version: number;
        entries: { amountCentavos: number; createdAt: string }[];
        customers: { id: string }[];
      };
    }>(ownerA, 'select public.get_notebook() as value');
    const snapshot = result.rows[0].value;
    expect(snapshot.version).toBe(1);
    expect(snapshot.customers.map((c) => c.id)).toEqual([customerA]);
    expect(snapshot.entries.map((e) => e.amountCentavos)).toEqual([85000, 20000, 65000]);
    expect(snapshot.entries[0].createdAt).toMatch(/Z$/);
    expect(
      (
        await asOwner<{ value: { entries: unknown[] } }>(
          ownerB,
          'select public.get_notebook() as value',
        )
      ).rows[0].value.entries,
    ).toHaveLength(0);
  });
});
