import { PGlite } from '@electric-sql/pglite';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { notebookReadSchema } from '../../src/lib/notebookReads';
import { balance } from '../../src/lib/ledger';

const owner = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const customer = 'cccccccc-0000-4000-8000-000000000001';
const id = (n: number) => `dddddddd-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tables = ['owner_profiles', 'stores', 'customers', 'ledger_entries', 'audit_events'];

async function asOwner(db: PGlite, who: string, sql: string, args: unknown[] = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [who]);
  return db.query<Record<string, unknown>>(sql, args);
}

async function records(db: PGlite) {
  await db.exec('reset role');
  const result: Record<string, unknown> = {};
  for (const table of tables)
    result[table] = (await db.query(`select * from public.${table} order by id`)).rows;
  return result;
}

const payment = 'select public.record_entry($1::uuid, $2::uuid, $3, $4::bigint, $5::date)';
const correction = 'select public.correct_entry($1::uuid, $2::uuid, $3, $4::jsonb)';
const replacement = JSON.stringify({
  amountCentavos: 12000,
  effectiveDate: '2026-09-01',
  description: 'Fictional corrected purchase',
});

test('serialized database backup restores records, audit, access and retry identity', async () => {
  const source = new PGlite();
  let restored: PGlite | undefined;
  let sourceClosed = false;
  const file = join(tmpdir(), `tindahan-fictional-restore-${randomUUID()}.tar`);
  let fileCreated = false;
  try {
    // Only the Auth identity contract is stubbed; no credentials or hosted data.
    await source.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${owner}'), ('${other}');
    `);
    const migrations = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const migration of migrations)
      await source.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
    for (const who of [owner, other])
      await asOwner(source, who, "select public.create_store('Fictional restore rehearsal')");
    await asOwner(
      source,
      owner,
      "select public.create_customer($1::uuid, 'Fictional Recovery Customer')",
      [customer],
    );
    await asOwner(source, owner, payment, [id(1), customer, 'opening_balance', 2000, '2026-08-31']);
    await asOwner(source, owner, payment, [id(2), customer, 'utang', 15000, '2026-09-01']);
    await asOwner(source, owner, payment, [id(3), customer, 'payment', 5000, '2026-09-02']);
    await asOwner(source, owner, correction, [
      id(4),
      id(2),
      'Fictional amount correction',
      replacement,
    ]);
    await asOwner(source, owner, payment, [id(5), customer, 'utang', 1000, '2026-09-03']);
    await asOwner(source, owner, correction, [id(6), id(5), 'Fictional duplicate purchase', null]);

    const before = await records(source);
    const beforeRead = await asOwner(source, owner, 'select public.get_notebook() as value');
    await source.exec('reset role');
    const started = performance.now();
    const dump = Buffer.from(await (await source.dumpDataDir()).arrayBuffer());
    const checksum = createHash('sha256').update(dump).digest('hex');
    writeFileSync(file, dump, { flag: 'wx' });
    fileCreated = true;

    // A later write is deliberately absent from the backup: recovery has a cutoff.
    await asOwner(source, owner, payment, [id(7), customer, 'utang', 100, '2026-09-04']);
    await source.close();
    sourceClosed = true;
    const bytes = readFileSync(file);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(checksum);
    restored = new PGlite({ loadDataDir: new Blob([bytes]) });
    await restored.waitReady;
    expect(await records(restored)).toEqual(before);
    expect((await asOwner(restored, owner, 'select public.get_notebook() as value')).rows).toEqual(
      beforeRead.rows,
    );
    const read = await asOwner(
      restored,
      owner,
      "select public.read_notebook('customer', null, $1::uuid) as value",
      [customer],
    );
    const notebook = notebookReadSchema.parse(read.rows[0].value).notebook;
    expect(balance(notebook.entries)).toBe(9000);
    expect(notebook.entries).toHaveLength(5);
    expect(notebook.entries.filter((e) => e.status === 'voided')).toHaveLength(2);
    expect(notebook.entries.some((e) => e.requestId === id(7))).toBe(false);

    // Restored request IDs must prevent duplicate entries AND audit records.
    await asOwner(restored, owner, payment, [id(3), customer, 'payment', 5000, '2026-09-02']);
    await asOwner(restored, owner, correction, [
      id(4),
      id(2),
      'Fictional amount correction',
      replacement,
    ]);
    expect(await records(restored)).toEqual(before);
    await expect(
      asOwner(restored, owner, payment, [id(3), customer, 'payment', 4000, '2026-09-02']),
    ).rejects.toThrow('different transaction details');
    await expect(
      asOwner(restored, owner, payment, [id(8), customer, 'payment', 9001, '2026-09-04']),
    ).rejects.toThrow('available balance');
    for (const table of ['customers', 'ledger_entries'])
      expect((await asOwner(restored, other, `select * from public.${table}`)).rows).toEqual([]);
    await expect(
      asOwner(restored, other, payment, [id(9), customer, 'payment', 100, '2026-09-04']),
    ).rejects.toThrow('Customer not found');
    await expect(asOwner(restored, owner, 'delete from public.ledger_entries')).rejects.toThrow(
      'permission denied',
    );
    await restored.exec('set role anon');
    await expect(restored.query('select public.get_notebook()')).rejects.toThrow(
      'permission denied',
    );
    await expect(restored.query('select * from public.customers')).rejects.toThrow(
      'permission denied',
    );
    expect(await records(restored)).toEqual(before);
    await asOwner(restored, owner, payment, [id(10), customer, 'payment', 9000, '2026-09-04']);
    const paid = await asOwner(
      restored,
      owner,
      "select public.read_notebook('directory') as value",
    );
    expect(
      notebookReadSchema
        .parse(paid.rows[0].value)
        .totals.balances.find((b) => b.customerId === customer)?.amount,
    ).toBe(0);
    console.info(
      'Fictional PGlite restore rehearsal:',
      JSON.stringify({
        migrations,
        bytes: bytes.length,
        checksum,
        elapsedMs: Math.round(performance.now() - started),
        restoredEntries: 5,
        restoredBalanceCentavos: 9000,
        finalBalanceCentavos: 0,
      }),
    );
  } finally {
    if (restored) await restored.close();
    if (!sourceClosed) await source.close();
    if (fileCreated) unlinkSync(file);
  }
}, 60000);
