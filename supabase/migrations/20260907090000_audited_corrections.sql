-- Additive migration: preserve existing ledger values and append an audit trail.
begin;

alter table public.ledger_entries
  add column status text not null default 'active' check (status in ('active', 'voided')),
  add column voided_at timestamptz,
  add column voided_by uuid references public.owner_profiles(id) on delete restrict,
  add column void_reason text,
  add column replaces_entry_id uuid,
  add column order_created_at timestamptz,
  add column order_id uuid,
  add constraint ledger_void_metadata check (
    (status = 'active' and voided_at is null and voided_by is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null
        and void_reason is not null and char_length(btrim(void_reason)) between 1 and 300)
  ),
  add constraint ledger_replacement_metadata check (
    (replaces_entry_id is null and order_created_at is null and order_id is null)
    or (replaces_entry_id is not null and order_created_at is not null and order_id is not null)
  ),
  add constraint ledger_replaces_fk foreign key (store_id, replaces_entry_id)
    references public.ledger_entries(store_id, id) on delete restrict,
  add constraint ledger_order_fk foreign key (store_id, order_id)
    references public.ledger_entries(store_id, id) on delete restrict,
  add constraint ledger_one_replacement unique (replaces_entry_id);

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check check (action in ('store.created', 'customer.created', 'entry.created', 'entry.voided')),
  add column request_id uuid,
  add column correction_reason text,
  add column correction_payload jsonb,
  add column replacement_entry_id uuid,
  add constraint audit_request_unique unique (store_id, request_id),
  add constraint audit_replacement_fk foreign key (store_id, replacement_entry_id)
    references public.ledger_entries(store_id, id) on delete restrict,
  add constraint audit_correction_details check (action <> 'entry.voided' or (
    request_id is not null and entry_id is not null and correction_reason is not null
    and char_length(btrim(correction_reason)) between 1 and 300 and correction_payload is not null
  ));

create or replace function private.entry_json(e public.ledger_entries) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', e.id, 'requestId', e.request_id, 'customerId', e.customer_id,
    'type', e.type, 'amountCentavos', e.amount_centavos, 'description', e.description,
    'effectiveDate', e.effective_date, 'effectiveTime', to_char(e.effective_time, 'HH24:MI:SS'),
    'createdAt', to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'status', e.status, 'voidReason', e.void_reason, 'voidedBy', e.voided_by,
    'voidedAt', to_char(e.voided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'replacesEntryId', e.replaces_entry_id, 'orderId', e.order_id,
    'orderCreatedAt', to_char(e.order_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
$$;

-- Shared authoritative check for normal writes and corrections. Replacement order
-- inherits its original slot even when entries were recorded in the same second.
create function private.assert_customer_ledger(p_store uuid, p_customer uuid) returns void
language plpgsql set search_path = '' as $$
declare lowest numeric; highest numeric; total numeric;
begin
  select min(running), max(running) into lowest, highest from (
    select sum(case when type = 'payment' then -amount_centavos else amount_centavos end) over (
      order by effective_date, effective_time, coalesce(order_created_at, created_at), coalesce(order_id, id)
      rows unbounded preceding
    ) as running from public.ledger_entries
    where store_id = p_store and customer_id = p_customer and status = 'active'
  ) balances;
  if lowest < 0 then raise exception 'Payment exceeds the available balance on this date. This change would make the historical balance negative.'; end if;
  select sum(case when type = 'payment' then -amount_centavos else amount_centavos end) into total
    from public.ledger_entries where store_id = p_store and status = 'active';
  if highest > 9007199254740991 or total > 9007199254740991 then raise exception 'Balance is too large to store safely.'; end if;
end;
$$;
revoke all on function private.assert_customer_ledger(uuid, uuid) from public, anon, authenticated;

create or replace function public.record_entry(p_request_id uuid, p_customer_id uuid, p_type text, p_amount_centavos bigint, p_effective_date date, p_description text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare store public.stores; result public.ledger_entries;
begin
  store := private.owned_store();
  if p_request_id is null or p_customer_id is null then raise exception 'Select a customer and supply a save ID.'; end if;
  if p_type is null or p_type not in ('utang', 'payment', 'opening_balance') then raise exception 'Invalid entry type.'; end if;
  if p_amount_centavos is null or p_amount_centavos not between 1 and 999999999 then raise exception 'Enter a positive amount up to ₱9,999,999.99.'; end if;
  if p_effective_date is null or p_effective_date < date '1900-01-01' or p_effective_date > (now() at time zone store.timezone)::date then raise exception 'Choose today or an earlier valid date.'; end if;
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_description) > 300 then raise exception 'Use 300 characters or fewer for the description.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(store.owner_id::text, 0));
  perform 1 from public.customers where store_id = store.id and id = p_customer_id for update;
  if not found then raise exception 'Customer not found in your store.' using errcode = '42501'; end if;
  if exists (select 1 from public.audit_events where store_id = store.id and request_id = p_request_id) then
    raise exception 'This save ID was already used for a correction.';
  end if;
  select * into result from public.ledger_entries where store_id = store.id and request_id = p_request_id;
  if found then
    if result.customer_id is distinct from p_customer_id or result.type is distinct from p_type or result.amount_centavos is distinct from p_amount_centavos or result.effective_date is distinct from p_effective_date or result.description is distinct from p_description then
      raise exception 'This save ID was already used for different transaction details.';
    end if;
    return private.entry_json(result);
  end if;
  insert into public.ledger_entries(id, request_id, store_id, customer_id, type, amount_centavos, description, effective_date, effective_time, created_by)
    values (p_request_id, p_request_id, store.id, p_customer_id, p_type, p_amount_centavos, p_description, p_effective_date, date_trunc('second', clock_timestamp() at time zone store.timezone)::time, auth.uid()) returning * into result;
  perform private.assert_customer_ledger(store.id, p_customer_id);
  insert into public.audit_events(store_id, actor_id, entry_id, action) values (store.id, auth.uid(), result.id, 'entry.created');
  return private.entry_json(result);
end;
$$;

create function public.correct_entry(p_request_id uuid, p_entry_id uuid, p_reason text, p_replacement jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare store public.stores; original public.ledger_entries; prior public.audit_events;
  payload jsonb; replacement_id uuid; amount bigint; effective_date date; description text;
begin
  store := private.owned_store();
  if p_request_id is null or p_entry_id is null then raise exception 'An entry and save ID are required.'; end if;
  p_reason := btrim(p_reason);
  if p_reason is null or char_length(p_reason) not between 1 and 300 then raise exception 'Enter a correction reason with 1–300 characters.'; end if;
  if p_replacement is not null then
    if jsonb_typeof(p_replacement) <> 'object' then raise exception 'Invalid replacement details.'; end if;
    if not (p_replacement ?& array['amountCentavos', 'description', 'effectiveDate'])
      or (select count(*) from jsonb_object_keys(p_replacement)) <> 3
      or jsonb_typeof(p_replacement->'amountCentavos') <> 'number'
      or jsonb_typeof(p_replacement->'description') <> 'string'
      or jsonb_typeof(p_replacement->'effectiveDate') <> 'string' then raise exception 'Invalid replacement details.'; end if;
    if (p_replacement->>'amountCentavos') !~ '^[0-9]{1,9}$' then raise exception 'Enter a positive amount up to ₱9,999,999.99.'; end if;
    amount := (p_replacement->>'amountCentavos')::bigint;
    if amount < 1 then raise exception 'Enter a positive amount up to ₱9,999,999.99.'; end if;
    if (p_replacement->>'effectiveDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Choose today or an earlier valid date.'; end if;
    effective_date := (p_replacement->>'effectiveDate')::date;
    if effective_date < date '1900-01-01' or effective_date > (now() at time zone store.timezone)::date then raise exception 'Choose today or an earlier valid date.'; end if;
    description := btrim(p_replacement->>'description');
    if char_length(description) > 300 then raise exception 'Use 300 characters or fewer for the description.'; end if;
    p_replacement := jsonb_build_object('amountCentavos', amount, 'description', description, 'effectiveDate', effective_date);
  end if;
  payload := jsonb_build_object('entryId', p_entry_id, 'reason', p_reason, 'replacement', p_replacement);
  perform pg_advisory_xact_lock(hashtextextended(store.owner_id::text, 0));
  select * into prior from public.audit_events where store_id = store.id and request_id = p_request_id;
  if found then
    if prior.correction_payload is distinct from payload then raise exception 'This save ID was already used for different correction details.'; end if;
    return;
  end if;
  if exists (select 1 from public.ledger_entries where id = p_request_id and store_id = store.id) then
    raise exception 'This save ID was already used for a transaction.';
  end if;
  select * into original from public.ledger_entries where store_id = store.id and id = p_entry_id for update;
  if not found then raise exception 'Entry not found in your store.' using errcode = '42501'; end if;
  if original.status <> 'active' then raise exception 'This entry has already been voided. Refresh its history.'; end if;
  perform 1 from public.customers where store_id = store.id and id = original.customer_id for update;
  update public.ledger_entries set status = 'voided', voided_at = clock_timestamp(), voided_by = auth.uid(), void_reason = p_reason
    where id = original.id and store_id = store.id;
  if p_replacement is not null then
    replacement_id := p_request_id;
    insert into public.ledger_entries(id, request_id, store_id, customer_id, type, amount_centavos, description, effective_date, effective_time, created_by, replaces_entry_id, order_created_at, order_id)
      values (replacement_id, p_request_id, store.id, original.customer_id, original.type, amount, description, effective_date,
        original.effective_time, auth.uid(), original.id, coalesce(original.order_created_at, original.created_at), coalesce(original.order_id, original.id));
  end if;
  perform private.assert_customer_ledger(store.id, original.customer_id);
  insert into public.audit_events(store_id, actor_id, entry_id, action, request_id, correction_reason, correction_payload, replacement_entry_id)
    values (store.id, auth.uid(), original.id, 'entry.voided', p_request_id, p_reason, payload, replacement_id);
  if replacement_id is not null then
    insert into public.audit_events(store_id, actor_id, entry_id, action) values (store.id, auth.uid(), replacement_id, 'entry.created');
  end if;
end;
$$;
revoke all on function public.correct_entry(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.correct_entry(uuid, uuid, text, jsonb) to authenticated;

-- The read RPC keeps returning every original, including voided entries.
-- Clients sort replacement entries using the inherited order fields.
commit;
