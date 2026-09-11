// Opt-in, read-only development verification. No fixtures, tokens or notebook
// contents are persisted. Requires the existing authenticated Supabase CLI.
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const equal = (actual, expected) =>
  assert.ok(
    isDeepStrictEqual(actual, expected),
    'Hosted read comparison failed; notebook contents omitted.',
  );
const project = 'bzkbndvmspnyjkuyaudr';
assert.equal(process.argv[2], '--development-read-only');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), project);
const execute = promisify(execFile);
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
    { timeout: 90000, maxBuffer: 8 * 1024 * 1024 },
  );
  return JSON.parse(stdout.slice(stdout.indexOf('{'))).rows;
}
const stores = await query('select owner_id from public.stores');
assert.equal(stores.length, 1, 'This rehearsal expects the existing single development store.');
const owner = stores[0].owner_id;
assert.match(owner, /^[a-f0-9-]{36}$/);
// Every view is compared within one read-only, repeatable-read transaction.
const [result] = await query(`
  begin isolation level repeatable read read only;
  set local role authenticated;
  select set_config('request.jwt.claim.sub','${owner}',true);
  select public.get_notebook() as full,
    public.read_notebook('directory') as directory,
    public.read_notebook('home',(now() at time zone 'Asia/Manila')::date) as home,
    (now() at time zone 'Asia/Manila')::date::text as today,
    (select jsonb_agg(jsonb_build_object('id',id,'view',public.read_notebook('customer',null,id))) from public.customers) as customers,
    (select jsonb_agg(jsonb_build_object('day',day,'view',public.read_notebook('day',day))) from (select distinct effective_date as day from public.ledger_entries) days) as days;
  commit;
`);
const full = result.full;
const active = (e) => e.status !== 'voided';
const signed = (e) =>
  active(e) ? (e.type === 'payment' ? -e.amountCentavos : e.amountCentavos) : 0;
const total = (entries) => entries.reduce((sum, e) => sum + signed(e), 0);
const sorted = (rows) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
const outstanding = total(full.entries);
const withBalance = full.customers.filter(
  (c) => total(full.entries.filter((e) => e.customerId === c.id)) > 0,
).length;
const checkSummary = (view, day) => {
  assert.equal(view.totals.outstanding, outstanding);
  assert.equal(view.totals.withBalance, withBalance);
  for (const [field, type] of [
    ['utang', 'utang'],
    ['payments', 'payment'],
    ['opening', 'opening_balance'],
  ])
    assert.equal(
      view.totals[field],
      full.entries
        .filter((e) => active(e) && e.type === type && e.effectiveDate === day)
        .reduce((sum, e) => sum + e.amountCentavos, 0),
    );
  assert.equal(
    view.totals.closing,
    day ? total(full.entries.filter((e) => e.effectiveDate <= day)) : 0,
  );
  equal(view.notebook.store, full.store);
};
equal(sorted(result.directory.notebook.customers), sorted(full.customers));
equal(result.directory.notebook.entries, []);
assert.equal(result.directory.totals.balances.length, full.customers.length);
for (const c of full.customers)
  assert.equal(
    result.directory.totals.balances.find((b) => b.customerId === c.id)?.amount,
    total(full.entries.filter((e) => e.customerId === c.id)),
  );
checkSummary(result.directory);
checkSummary(result.home, result.today);
equal(result.home.notebook.entries, full.entries.slice(-3).reverse());
equal(
  sorted(result.home.notebook.customers),
  sorted(
    full.customers.filter((c) => result.home.notebook.entries.some((e) => e.customerId === c.id)),
  ),
);
for (const { id, view } of result.customers ?? []) {
  checkSummary(view);
  equal(sorted(view.notebook.entries), sorted(full.entries.filter((e) => e.customerId === id)));
  equal(
    view.notebook.customers,
    full.customers.filter((c) => c.id === id),
  );
}
for (const { day, view } of result.days ?? []) {
  checkSummary(view, day);
  equal(sorted(view.notebook.entries), sorted(full.entries.filter((e) => e.effectiveDate === day)));
  equal(
    sorted(view.notebook.customers),
    sorted(full.customers.filter((c) => view.notebook.entries.some((e) => e.customerId === c.id))),
  );
}
const [permissions] = await query(
  "select has_function_privilege('anon','public.read_notebook(text,date,uuid)','execute') as anon, has_function_privilege('authenticated','public.read_notebook(text,date,uuid)','execute') as authenticated",
);
equal(permissions, { anon: false, authenticated: true });
await assert.rejects(
  query(
    "begin read only; set local role anon; select public.read_notebook('directory'); rollback;",
  ),
  (error) =>
    typeof error.stdout === 'string' &&
    error.stdout.includes('permission denied for function read_notebook'),
);
await assert.rejects(
  query(
    "begin read only; set local role authenticated; select set_config('request.jwt.claim.sub','',true); select public.read_notebook('directory'); rollback;",
  ),
  (error) =>
    typeof error.stdout === 'string' && error.stdout.includes('Sign in to open your notebook'),
);
const fingerprints = await query(`
  select 'customers' as kind,count(*) as count,md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) as fingerprint from public.customers t
  union all select 'ledger_entries',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.ledger_entries t
  union all select 'audit_events',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.audit_events t
`);
console.log(
  JSON.stringify(
    {
      project,
      result: 'passed',
      customerViews: result.customers?.length ?? 0,
      dayViews: result.days?.length ?? 0,
      outstandingCentavos: outstanding,
      permissions,
      fingerprints,
    },
    null,
    2,
  ),
);
