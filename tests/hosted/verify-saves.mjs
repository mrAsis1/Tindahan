// Explicit, opt-in development check. Never run from CI or against production.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const project = 'bzkbndvmspnyjkuyaudr';
assert.equal(
  process.argv[2],
  '--development-fixtures',
  'Pass --development-fixtures to create fictional records in Tindahan Development.',
);
const execute = promisify(execFile);
const runId = randomUUID();
const reportPath = `.local-checks/hosted-saves-${runId}.json`;
const report = { runId, project, startedAt: new Date().toISOString(), checks: [], fixtures: [] };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir('.local-checks', { recursive: true });

async function query(sql) {
  const { stdout } = await execute(
    process.execPath,
    [
      'node_modules/supabase/dist/supabase.js',
      'db',
      'query',
      '--linked',
      '--project-ref',
      project,
      '--output-format',
      'json',
      sql,
    ],
    { timeout: 90000, maxBuffer: 1024 * 1024 },
  ).catch((error) => {
    error.stderr = `${error.stderr ?? ''}\n${error.stdout ?? ''}`;
    throw error;
  });
  const start = stdout.indexOf('{');
  return JSON.parse(stdout.slice(start)).rows;
}
const stores = await query('select id, owner_id from public.stores');
assert.equal(
  stores.length,
  1,
  'Expected exactly one development store; select fixtures manually if this changes.',
);
const owner = stores[0].owner_id;
assert.match(owner, /^[a-f0-9-]{36}$/);
const asOwner = (sql, label = 'tindahan-validation') =>
  query(
    `begin; set local statement_timeout='70s'; set local application_name='${label}'; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); ${sql}; commit;`,
  );
const date = "(now() at time zone 'Asia/Manila')::date";
const record = (customer, id, type, cents) =>
  `select public.record_entry('${id}','${customer}','${type}',${cents},${date},'Fictional hosted save validation') as entry`;

async function fixture(label) {
  const id = randomUUID();
  report.fixtures.push({ id, label });
  // Persist the IDs before any write so interrupted runs can be inspected.
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await asOwner(
    `select public.create_customer('${id}','Validation ${label} ${runId.slice(0, 8)}','','Fictional test only; no real debt or payment.'); ${record(id, randomUUID(), 'utang', 10000)}`,
  );
  return id;
}
async function snapshot(customer) {
  const [row] = await asOwner(
    `select coalesce(sum(case when type='payment' then -amount_centavos else amount_centavos end) filter (where status='active'),0)::int as balance, count(*)::int as entries, (select count(*)::int from public.audit_events a join public.ledger_entries e on e.id=a.entry_id where e.customer_id='${customer}' and a.action='entry.created') as audits from public.ledger_entries where customer_id='${customer}'`,
  );
  return row;
}
async function overlap(customer, firstId, secondId, cents) {
  const prefix = `tv-${randomUUID().slice(0, 8)}`;
  const firstLabel = `${prefix}-first`;
  const secondLabel = `${prefix}-second`;
  // Hold the first committed-to-be RPC write in a transaction to prove the
  // second backend waits on its lock, rather than merely sending a quick burst.
  const first = asOwner(
    `${record(customer, firstId, 'payment', cents)}; select pg_sleep(45)`,
    firstLabel,
  ).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  let ready = false;
  for (let i = 0; i < 8; i++) {
    const rows = await query(
      `select pid from pg_stat_activity where application_name='${firstLabel}' and wait_event='PgSleep'`,
    );
    if (rows.length) {
      ready = true;
      break;
    }
    await pause(250);
  }
  assert.ok(ready, 'First backend did not reach the held transaction.');
  const second = asOwner(record(customer, secondId, 'payment', cents), secondLabel).then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error }),
  );
  let observed = [];
  for (let i = 0; i < 6; i++) {
    observed = await query(
      `select pid, application_name, wait_event_type, wait_event from pg_stat_activity where application_name in ('${firstLabel}','${secondLabel}')`,
    );
    if (observed.some((r) => r.application_name === secondLabel && r.wait_event_type === 'Lock'))
      break;
    await pause(250);
  }
  const results = await Promise.all([first, second]);
  assert.equal(
    new Set(observed.map((r) => r.pid)).size,
    2,
    'Expected distinct PostgreSQL backends.',
  );
  assert.ok(
    observed.some((r) => r.application_name === secondLabel && r.wait_event_type === 'Lock'),
    'Did not observe the competing write waiting on a database lock.',
  );
  return results;
}
async function check(name, work) {
  await work();
  report.checks.push({ name, passed: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`PASS: ${name}`);
}
try {
  await check('competing payments serialize and cannot overpay', async () => {
    const customer = await fixture('competing payments');
    const results = await overlap(customer, randomUUID(), randomUUID(), 8000);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.match(String(results.find((r) => !r.ok).error.stderr), /available balance/);
    assert.deepEqual(await snapshot(customer), { balance: 2000, entries: 2, audits: 2 });
    await asOwner(record(customer, randomUUID(), 'payment', 2000));
    assert.equal((await snapshot(customer)).balance, 0);
  });
  await check('simultaneous identical save IDs create one entry and one audit', async () => {
    const customer = await fixture('duplicate requests');
    const id = randomUUID();
    const results = await overlap(customer, id, id, 10000);
    assert.ok(results.every((r) => r.ok));
    assert.deepEqual(await snapshot(customer), { balance: 0, entries: 2, audits: 2 });
  });
  await check(
    'retry after discarded committed response returns the original; changed payload is rejected',
    async () => {
      const customer = await fixture('lost response');
      const id = randomUUID();
      // Deliberately discard a successful response, then repeat the exact request.
      await asOwner(record(customer, id, 'payment', 10000));
      const [retry] = await asOwner(record(customer, id, 'payment', 10000));
      assert.equal(retry.entry.id, id);
      await assert.rejects(asOwner(record(customer, id, 'payment', 9000)), (error) =>
        /different transaction details/.test(error.stderr),
      );
      assert.deepEqual(await snapshot(customer), { balance: 0, entries: 2, audits: 2 });
    },
  );
  report.finishedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `All hosted SQL checks passed. Fictional fixtures remain at zero balance; report: ${reportPath}`,
  );
} catch (error) {
  report.failed = true;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.error(
    'Hosted check failed. Inspect the recorded fixture IDs; no cleanup or deletion was performed.',
  );
  throw error;
}
