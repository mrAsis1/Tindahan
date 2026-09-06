-- Tindahan: one owner per store. Apply to a new development project.
-- Browser roles may read their own rows; all writes go through the RPCs below.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.owner_profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.owner_profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  currency text not null default 'PHP' check (currency = 'PHP'),
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  contact_number text not null default '' check (char_length(contact_number) <= 40),
  identifying_note text not null default '' check (char_length(identifying_note) <= 160),
  created_at timestamptz not null default now(),
  unique (store_id, id)
);

create table public.ledger_entries (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete restrict,
  customer_id uuid not null,
  request_id uuid not null,
  type text not null check (type in ('opening_balance', 'utang', 'payment')),
  amount_centavos bigint not null check (amount_centavos between 1 and 999999999),
  description text not null default '' check (char_length(description) <= 300),
  effective_date date not null check (effective_date >= date '1900-01-01'),
  effective_time time(0) not null,
  created_by uuid not null references public.owner_profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (store_id, request_id),
  unique (store_id, id),
  foreign key (store_id, customer_id) references public.customers(store_id, id) on delete restrict
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  actor_id uuid not null references public.owner_profiles(id) on delete restrict,
  entry_id uuid,
  action text not null check (action in ('store.created', 'customer.created', 'entry.created')),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (store_id, entry_id) references public.ledger_entries(store_id, id) on delete restrict
);

create index customers_store_name_idx on public.customers(store_id, lower(name));
create index ledger_customer_order_idx on public.ledger_entries(store_id, customer_id, effective_date, effective_time, created_at, id);
create index ledger_store_day_idx on public.ledger_entries(store_id, effective_date);
create index audit_store_idx on public.audit_events(store_id, created_at);

alter table public.owner_profiles enable row level security;
alter table public.stores enable row level security;
alter table public.customers enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_events enable row level security;

create policy owner_reads_profile on public.owner_profiles for select to authenticated using (id = (select auth.uid()));
create policy owner_reads_store on public.stores for select to authenticated using (owner_id = (select auth.uid()));
create policy owner_reads_customers on public.customers for select to authenticated using (
  store_id in (select id from public.stores where owner_id = (select auth.uid()))
);
create policy owner_reads_entries on public.ledger_entries for select to authenticated using (
  store_id in (select id from public.stores where owner_id = (select auth.uid()))
);
create policy owner_reads_audit on public.audit_events for select to authenticated using (
  store_id in (select id from public.stores where owner_id = (select auth.uid()))
);

revoke all on public.owner_profiles, public.stores, public.customers, public.ledger_entries, public.audit_events from public, anon, authenticated;
grant select on public.owner_profiles, public.stores, public.customers, public.ledger_entries, public.audit_events to authenticated;

-- Internal helpers have no browser EXECUTE grant and live outside the exposed API schema.
create function private.owned_store() returns public.stores
language plpgsql set search_path = '' as $$
declare result public.stores;
begin
  if auth.uid() is null then raise exception 'Sign in to open your notebook.' using errcode = '42501'; end if;
  select * into result from public.stores where owner_id = auth.uid();
  if not found then raise exception 'Create your store notebook first.' using errcode = 'P0001'; end if;
  return result;
end;
$$;

create function private.customer_json(c public.customers) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'contactNumber', c.contact_number,
    'identifyingNote', c.identifying_note, 'createdAt', to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
$$;

create function private.entry_json(e public.ledger_entries) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', e.id, 'requestId', e.request_id, 'customerId', e.customer_id,
    'type', e.type, 'amountCentavos', e.amount_centavos, 'description', e.description,
    'effectiveDate', e.effective_date, 'effectiveTime', to_char(e.effective_time, 'HH24:MI:SS'),
    'createdAt', to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
$$;

create function public.create_store(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result public.stores;
begin
  if auth.uid() is null then raise exception 'Sign in to create your notebook.' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then
    raise exception 'Enter a store name with 1–100 characters.';
  end if;
  -- Owner-level serialization handles retries and two tabs creating the same notebook.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into result from public.stores where owner_id = auth.uid();
  if found then return jsonb_build_object('id', result.id, 'name', result.name); end if;
  insert into public.owner_profiles(id) values (auth.uid()) on conflict do nothing;
  insert into public.stores(owner_id, name) values (auth.uid(), btrim(p_name)) returning * into result;
  insert into public.audit_events(store_id, actor_id, action) values (result.id, auth.uid(), 'store.created');
  return jsonb_build_object('id', result.id, 'name', result.name);
end;
$$;

create function public.create_customer(p_request_id uuid, p_name text, p_contact_number text default '', p_identifying_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare store public.stores; result public.customers;
begin
  store := private.owned_store();
  if p_request_id is null then raise exception 'A save ID is required.'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then raise exception 'Enter a customer name with 1–100 characters.'; end if;
  if char_length(coalesce(p_contact_number, '')) > 40 or char_length(coalesce(p_identifying_note, '')) > 160 then raise exception 'Customer details are too long.'; end if;
  p_name := btrim(p_name); p_contact_number := btrim(coalesce(p_contact_number, '')); p_identifying_note := btrim(coalesce(p_identifying_note, ''));
  -- Same owner lock is used by every mutation so snapshots and totals remain bounded.
  perform pg_advisory_xact_lock(hashtextextended(store.owner_id::text, 0));
  select * into result from public.customers where store_id = store.id and id = p_request_id;
  if found then
    if result.name is distinct from p_name or result.contact_number is distinct from p_contact_number or result.identifying_note is distinct from p_identifying_note then
      raise exception 'This save ID was already used for different customer details.';
    end if;
    return private.customer_json(result);
  end if;
  insert into public.customers(id, store_id, name, contact_number, identifying_note)
    values (p_request_id, store.id, p_name, p_contact_number, p_identifying_note) returning * into result;
  insert into public.audit_events(store_id, actor_id, action) values (store.id, auth.uid(), 'customer.created');
  return private.customer_json(result);
end;
$$;

create function public.record_entry(p_request_id uuid, p_customer_id uuid, p_type text, p_amount_centavos bigint, p_effective_date date, p_description text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare store public.stores; result public.ledger_entries; lowest numeric; highest numeric; total numeric;
begin
  store := private.owned_store();
  if p_request_id is null or p_customer_id is null then raise exception 'Select a customer and supply a save ID.'; end if;
  if p_type is null or p_type not in ('utang', 'payment', 'opening_balance') then raise exception 'Invalid entry type.'; end if;
  if p_amount_centavos is null or p_amount_centavos not between 1 and 999999999 then raise exception 'Enter a positive amount up to ₱9,999,999.99.'; end if;
  if p_effective_date is null or p_effective_date < date '1900-01-01' or p_effective_date > (now() at time zone store.timezone)::date then raise exception 'Choose today or an earlier valid date.'; end if;
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_description) > 300 then raise exception 'Use 300 characters or fewer for the description.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(store.owner_id::text, 0));
  -- Explicit customer lock also protects this ledger if future functions use finer-grained locking.
  perform 1 from public.customers where store_id = store.id and id = p_customer_id for update;
  if not found then raise exception 'Customer not found in your store.' using errcode = '42501'; end if;
  select * into result from public.ledger_entries where store_id = store.id and request_id = p_request_id;
  if found then
    if result.customer_id is distinct from p_customer_id or result.type is distinct from p_type or result.amount_centavos is distinct from p_amount_centavos or result.effective_date is distinct from p_effective_date or result.description is distinct from p_description then
      raise exception 'This save ID was already used for different transaction details.';
    end if;
    return private.entry_json(result);
  end if;

  insert into public.ledger_entries(id, request_id, store_id, customer_id, type, amount_centavos, description, effective_date, effective_time, created_by)
    values (p_request_id, p_request_id, store.id, p_customer_id, p_type, p_amount_centavos, p_description, p_effective_date, date_trunc('second', clock_timestamp() at time zone store.timezone)::time, auth.uid()) returning * into result;

  select min(running), max(running) into lowest, highest from (
    select sum(case when type = 'payment' then -amount_centavos else amount_centavos end) over (
      order by effective_date, effective_time, created_at, id rows unbounded preceding
    ) as running from public.ledger_entries where store_id = store.id and customer_id = p_customer_id
  ) balances;
  if lowest < 0 then raise exception 'Payment exceeds the available balance on this date. Choose a later date or a smaller amount.'; end if;
  select sum(case when type = 'payment' then -amount_centavos else amount_centavos end) into total from public.ledger_entries where store_id = store.id;
  if highest > 9007199254740991 or total > 9007199254740991 then raise exception 'Balance is too large to store safely.'; end if;

  insert into public.audit_events(store_id, actor_id, entry_id, action) values (store.id, auth.uid(), result.id, 'entry.created');
  return private.entry_json(result);
  -- Any exception rolls back both the financial write and its audit event.
end;
$$;

-- One statement gives the application a consistent ledger snapshot. Every table is
-- scoped explicitly even though SECURITY DEFINER is used for private JSON helpers.
create function public.get_notebook() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare store public.stores;
begin
  if auth.uid() is null then raise exception 'Sign in to open your notebook.' using errcode = '42501'; end if;
  select * into store from public.stores where owner_id = auth.uid();
  return jsonb_build_object('version', 1,
    'store', case when store.id is null then null else jsonb_build_object('id', store.id, 'name', store.name) end,
    'customers', coalesce((select jsonb_agg(private.customer_json(c) order by c.created_at, c.id) from public.customers c where c.store_id = store.id), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(private.entry_json(e) order by e.effective_date, e.effective_time, e.created_at, e.id) from public.ledger_entries e where e.store_id = store.id), '[]'::jsonb));
end;
$$;

revoke all on function private.owned_store(), private.customer_json(public.customers), private.entry_json(public.ledger_entries) from public, anon, authenticated;
revoke all on function public.create_store(text), public.create_customer(uuid, text, text, text), public.record_entry(uuid, uuid, text, bigint, date, text), public.get_notebook() from public, anon, authenticated;
grant execute on function public.create_store(text), public.create_customer(uuid, text, text, text), public.record_entry(uuid, uuid, text, bigint, date, text), public.get_notebook() to authenticated;

commit;
