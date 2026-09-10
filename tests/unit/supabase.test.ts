import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  notebookReadSchema,
  projectNotebook,
  type NotebookView,
} from '../../src/lib/notebookReads';
import type { StoreData } from '../../src/types';

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
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
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

describe('Audited corrections in PostgreSQL', () => {
  const replacement = (amountCentavos: number, effectiveDate = '2026-09-01') => ({
    amountCentavos,
    effectiveDate,
    description: 'Corrected amount',
  });
  const correct = (
    request: number,
    entry: number,
    value: unknown = null,
    reason = 'Amount was entered incorrectly',
    owner = ownerA,
  ) =>
    asOwner(owner, 'select public.correct_entry($1::uuid, $2::uuid, $3, $4::jsonb)', [
      entryId(request),
      entryId(entry),
      reason,
      value === null ? null : JSON.stringify(value),
    ]);
  it('rejects cross-owner, anonymous and direct correction writes', async () => {
    await expect(correct(20, 2, null, 'Wrong entry', ownerB)).rejects.toThrow('Entry not found');
    await db.exec('set role anon');
    await expect(
      db.query("select public.correct_entry($1::uuid, $2::uuid, 'Wrong entry')", [
        entryId(20),
        entryId(2),
      ]),
    ).rejects.toThrow('permission denied');
    await expect(
      asOwner(ownerA, "update public.ledger_entries set status = 'voided'"),
    ).rejects.toThrow('permission denied');
  });
  it('rolls back a void or replacement that invalidates a later payment, including its audit', async () => {
    const before = (await asOwner(ownerA, 'select * from public.audit_events order by id')).rows;
    await expect(correct(20, 2)).rejects.toThrow('historical balance');
    await expect(correct(20, 2, replacement(80000))).rejects.toThrow('historical balance');
    await expect(correct(20, 2, replacement(90000, '2026-09-04'))).rejects.toThrow(
      'historical balance',
    );
    expect((await asOwner(ownerA, 'select * from public.audit_events order by id')).rows).toEqual(
      before,
    );
    expect(
      (
        await asOwner<{ status: string }>(
          ownerA,
          'select status from public.ledger_entries where id=$1',
          [entryId(2)],
        )
      ).rows[0].status,
    ).toBe('active');
  });
  it('atomically preserves the original and records owner, reason, request and replacement', async () => {
    await correct(20, 2, replacement(90000));
    const original = (
      await asOwner<{
        status: string;
        amount_centavos: number;
        voided_by: string;
        void_reason: string;
      }>(ownerA, 'select * from public.ledger_entries where id=$1', [entryId(2)])
    ).rows[0];
    expect(original).toMatchObject({
      status: 'voided',
      amount_centavos: 85000,
      voided_by: ownerA,
      void_reason: 'Amount was entered incorrectly',
    });
    const audit = (
      await asOwner<{ replacement_entry_id: string }>(
        ownerA,
        'select * from public.audit_events where request_id=$1',
        [entryId(20)],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].replacement_entry_id).toBe(entryId(20));
    expect((await asOwner(ownerB, 'select * from public.ledger_entries')).rows).toHaveLength(0);
    await correct(20, 2, replacement(90000));
    await expect(correct(20, 2, replacement(91000))).rejects.toThrow(
      'different correction details',
    );
    await expect(correct(21, 2)).rejects.toThrow('already been voided');
    await expect(record(20, 'utang', 90000)).rejects.toThrow('used for a correction');
    await expect(record(21, 'payment', 5001, '2026-09-05')).rejects.toThrow('available balance');
    await record(21, 'payment', 5000, '2026-09-05');
  });
  it('can correct a replacement and void a payment without losing the chain', async () => {
    await correct(22, 20, replacement(95000));
    await correct(23, 21);
    await correct(23, 21);
    await expect(record(23, 'utang', 1)).rejects.toThrow('used for a correction');
    const snapshot = (
      await asOwner<{
        value: {
          entries: { id: string; status: string; replacesEntryId: string; orderId: string }[];
        };
      }>(ownerA, 'select public.get_notebook() as value')
    ).rows[0].value;
    expect(snapshot.entries.find((e) => e.id === entryId(22))).toMatchObject({
      status: 'active',
      replacesEntryId: entryId(20),
      orderId: entryId(2),
    });
    expect(snapshot.entries.find((e) => e.id === entryId(21))?.status).toBe('voided');
  });
  it('rejects blank reasons, malformed or overlarge amounts, future dates, and cross-type payloads', async () => {
    await expect(correct(24, 22, null, '  ')).rejects.toThrow('correction reason');
    for (const value of [
      replacement(0),
      replacement(9999999999),
      replacement(1.5),
      { ...replacement(95000), type: 'payment' },
      replacement(95000, '2999-01-01'),
    ])
      await expect(correct(24, 22, value)).rejects.toThrow();
  });
  it('preserves within-second order when replacing the utang that funded a payment', async () => {
    await record(30, 'utang', 10000, '2026-09-01', customerA);
    await record(31, 'payment', 10000, '2026-09-01', customerA);
    // Set a deterministic same-second fixture; browser callers cannot perform this update.
    await db.exec('reset role');
    await db.query(
      "update public.ledger_entries set effective_time='00:00:00', created_at=$2::timestamptz where id=$1",
      [entryId(30), '2026-09-01T00:00:00.000001Z'],
    );
    await db.query(
      "update public.ledger_entries set effective_time='00:00:00', created_at=$2::timestamptz where id=$1",
      [entryId(31), '2026-09-01T00:00:00.000002Z'],
    );
    await correct(32, 30, replacement(10000));
    const order = (
      await asOwner<{ id: string }>(
        ownerA,
        "select id from public.ledger_entries where status='active' order by effective_date, effective_time, coalesce(order_created_at,created_at), coalesce(order_id,id)",
      )
    ).rows;
    expect(order.slice(0, 2).map((e) => e.id)).toEqual([entryId(32), entryId(31)]);
  });
});

describe('Scoped notebook reads', () => {
  async function read(
    owner: string,
    view: string,
    day: string | null = null,
    customer: string | null = null,
  ) {
    return (
      await asOwner<{ value: unknown }>(
        owner,
        'select public.read_notebook($1, $2::date, $3::uuid) as value',
        [view, day, customer],
      )
    ).rows[0].value;
  }
  it('matches the complete ledger after replacement chains and voided payments', async () => {
    const otherCustomer = 'aaaaaaaa-0000-4000-8000-000000000002';
    await asOwner(ownerA, "select public.create_customer($1::uuid, 'Fictional second customer')", [
      otherCustomer,
    ]);
    await record(40, 'opening_balance', 10000, '2026-08-01', otherCustomer);
    await asOwner(ownerA, "select public.create_customer($1::uuid, 'Fictional empty customer')", [
      'aaaaaaaa-0000-4000-8000-000000000003',
    ]);
    const full = (
      await asOwner<{ value: StoreData }>(ownerA, 'select public.get_notebook() as value')
    ).rows[0].value;
    const views: NotebookView[] = [
      { kind: 'home', day: '2026-09-01' },
      { kind: 'directory' },
      { kind: 'day', day: '2026-09-01' },
      { kind: 'day', day: '2026-09-05' },
      { kind: 'day', day: '2026-08-01' },
      { kind: 'customer', customerId: customerA },
      { kind: 'customer', customerId: otherCustomer },
    ];
    for (const view of views) {
      const actual = notebookReadSchema.parse(
        await read(
          ownerA,
          view.kind,
          'day' in view ? view.day : null,
          'customerId' in view ? view.customerId : null,
        ),
      );
      expect(actual).toEqual(projectNotebook(full, view));
    }
    expect(full.entries.some((e) => e.status === 'voided')).toBe(true);
    expect(full.entries.some((e) => e.orderId)).toBe(true);
  });
  it('returns empty scoped histories for another owner and never leaks their customers', async () => {
    const result = notebookReadSchema.parse(await read(ownerB, 'customer', null, customerA));
    expect(result.notebook.customers).toEqual([]);
    expect(result.notebook.entries).toEqual([]);
    expect(result.totals.outstanding).toBe(0);
    const directory = notebookReadSchema.parse(await read(ownerB, 'directory'));
    expect(directory.notebook.customers.map((c) => c.id)).toEqual([customerB]);
    expect(directory.notebook.entries).toEqual([]);
    expect(directory.totals.balances).toEqual([{ customerId: customerB, amount: 0 }]);
  });
  it('supports an authenticated owner without a store', async () => {
    const value = notebookReadSchema.parse(
      await read('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'home', '2026-09-01'),
    );
    expect(value.notebook.store).toBeNull();
    expect(value.notebook.customers).toEqual([]);
    expect(value.notebook.entries).toEqual([]);
    expect(value.totals.outstanding).toBe(0);
  });
  it('denies anonymous access and invalid views, dates, or missing customers', async () => {
    await db.exec('set role anon');
    await expect(db.query("select public.read_notebook('directory')")).rejects.toThrow(
      /permission denied/,
    );
    await expect(read('', 'directory')).rejects.toThrow('Sign in');
    await expect(read(ownerA, 'full')).rejects.toThrow('Invalid notebook view');
    await expect(read(ownerA, 'home')).rejects.toThrow('earlier valid date');
    await expect(read(ownerA, 'day', '2999-01-01')).rejects.toThrow('earlier valid date');
    await expect(read(ownerA, 'customer')).rejects.toThrow('Select a customer');
  });
  it('returns small, reconciled SQL responses at 500 customers and 20000 entries', async () => {
    const pilotOwner = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    await db.exec('reset role');
    await db.query('insert into auth.users values ($1)', [pilotOwner]);
    await asOwner(pilotOwner, "select public.create_store('Fictional SQL volume check')");
    // Bulk fixtures in this disposable embedded database only. Normal browser
    // roles still cannot insert directly; write/audit behavior has separate tests.
    await db.exec('reset role');
    await db.query(
      `insert into public.customers(id, store_id, name)
      select ('eeeeeeee-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, s.id,
        'Fictional SQL customer ' || i from public.stores s cross join generate_series(0,499) i
      where s.owner_id = $1`,
      [pilotOwner],
    );
    await db.query(
      `insert into public.ledger_entries(id,request_id,store_id,customer_id,type,amount_centavos,description,effective_date,effective_time,created_by)
      select ('ffffffff-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
        ('ffffffff-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, s.id,
        ('eeeeeeee-0000-4000-8000-' || lpad(((i/2)%500)::text,12,'0'))::uuid,
        case when i%2=0 then 'utang' else 'payment' end,
        case when i%2=0 then 15000 else 5000 end, 'Fictional SQL volume entry',
        date '2026-08-01' + i/1000, time '08:00:00' + (i%1000) * interval '1 second', s.owner_id
      from public.stores s cross join generate_series(0,19999) i where s.owner_id = $1`,
      [pilotOwner],
    );
    const full = (
      await asOwner<{ bytes: number }>(
        pilotOwner,
        'select octet_length(public.get_notebook()::text) as bytes',
      )
    ).rows[0].bytes;
    const home = notebookReadSchema.parse(await read(pilotOwner, 'home', '2026-08-20'));
    expect(home.notebook.entries).toHaveLength(3);
    expect(home.totals).toMatchObject({
      outstanding: 100000000,
      withBalance: 500,
      utang: 7500000,
      payments: 2500000,
    });
    expect(Buffer.byteLength(JSON.stringify(home))).toBeLessThan(full / 100);
    const directory = notebookReadSchema.parse(await read(pilotOwner, 'directory'));
    expect(directory.notebook.customers).toHaveLength(500);
    expect(directory.notebook.entries).toHaveLength(0);
    expect(directory.totals.balances.every((b) => b.amount === 200000)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(directory))).toBeLessThan(full / 10);
    const day = notebookReadSchema.parse(await read(pilotOwner, 'day', '2026-08-20'));
    expect(day.notebook.entries).toHaveLength(1000);
    expect(day.totals.closing).toBe(100000000);
    expect(Buffer.byteLength(JSON.stringify(day))).toBeLessThan(full / 5);
    const customer = notebookReadSchema.parse(
      await read(pilotOwner, 'customer', null, 'eeeeeeee-0000-4000-8000-000000000000'),
    );
    expect(customer.notebook.entries).toHaveLength(40);
    expect(customer.notebook.customers).toHaveLength(1);
  }, 30000);
});
