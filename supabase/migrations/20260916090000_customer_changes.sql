-- Preserve customer IDs and all ledger entries; append changes to the existing audit trail.
begin;

alter table public.customers
  add column deleted boolean not null default false,
  add column revision integer not null default 0 check (revision >= 0);

alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events
  add constraint audit_events_action_check check (action in ('store.created', 'customer.created', 'entry.created', 'entry.voided', 'customer.edited', 'customer.deleted', 'customer.restored')),
  add column customer_id uuid,
  add column customer_change jsonb,
  add constraint audit_customer_fk foreign key (store_id, customer_id) references public.customers(store_id, id) on delete restrict,
  add constraint audit_customer_details check (action not in ('customer.edited', 'customer.deleted', 'customer.restored') or (customer_id is not null and request_id is not null and customer_change is not null));
create index audit_customer_history_idx on public.audit_events(store_id, customer_id, created_at, id) where customer_id is not null;

create or replace function private.customer_json(c public.customers) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'contactNumber', c.contact_number,
    'identifyingNote', c.identifying_note, 'createdAt', to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'deleted', c.deleted, 'revision', c.revision,
    'changes', coalesce((select jsonb_agg(a.customer_change || jsonb_build_object(
      'requestId', a.request_id, 'createdBy', a.actor_id,
      'createdAt', to_char(a.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by a.created_at, a.id)
      from public.audit_events a where a.store_id = c.store_id and a.customer_id = c.id), '[]'::jsonb));
$$;

create function public.change_customer(p_request_id uuid, p_customer_id uuid, p_expected_revision integer, p_details jsonb, p_deleted boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare store public.stores; original public.customers; prior public.audit_events;
  payload jsonb; before_details jsonb; after_details jsonb;
begin
  store := private.owned_store();
  if p_request_id is null or p_customer_id is null then raise exception 'A customer and save ID are required.'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_deleted is null then raise exception 'Invalid customer change.'; end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then raise exception 'Invalid customer details.'; end if;
  if not (p_details ?& array['name', 'contactNumber', 'identifyingNote'])
    or (select count(*) from jsonb_object_keys(p_details)) <> 3
    or jsonb_typeof(p_details->'name') <> 'string'
    or jsonb_typeof(p_details->'contactNumber') <> 'string'
    or jsonb_typeof(p_details->'identifyingNote') <> 'string' then raise exception 'Invalid customer details.'; end if;
  p_details := jsonb_build_object('name', btrim(p_details->>'name'), 'contactNumber', btrim(p_details->>'contactNumber'), 'identifyingNote', btrim(p_details->>'identifyingNote'));
  if char_length(p_details->>'name') not between 1 and 100 then raise exception 'Enter a customer name with 1–100 characters.'; end if;
  if char_length(p_details->>'contactNumber') > 40 or char_length(p_details->>'identifyingNote') > 160 then raise exception 'Customer details are too long.'; end if;
  payload := jsonb_build_object('customerId', p_customer_id, 'expectedRevision', p_expected_revision, 'details', p_details, 'deleted', p_deleted);
  perform pg_advisory_xact_lock(hashtextextended(store.owner_id::text, 0));
  select * into original from public.customers where store_id = store.id and id = p_customer_id for update;
  if not found then raise exception 'Customer not found in your store.' using errcode = '42501'; end if;
  select * into prior from public.audit_events where store_id = store.id and request_id = p_request_id;
  if found then
    if prior.customer_change is null or (prior.customer_change - 'before' - 'after') is distinct from payload then
      raise exception 'This save ID was already used for different customer changes.';
    end if;
    return;
  end if;
  if exists (select 1 from public.ledger_entries where store_id = store.id and request_id = p_request_id)
    or exists (select 1 from public.customers where store_id = store.id and id = p_request_id) then
    raise exception 'This save ID was already used.';
  end if;
  if original.revision <> p_expected_revision then raise exception 'This customer changed since you opened the form. Reopen it to see the latest details.'; end if;
  if p_details is distinct from jsonb_build_object('name', original.name, 'contactNumber', original.contact_number, 'identifyingNote', original.identifying_note) and exists (
    select 1 from public.customers c where c.store_id = store.id and c.id <> original.id
      and lower(btrim(regexp_replace(c.name, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_details->>'name', '\s+', ' ', 'g')))
      and lower(btrim(regexp_replace(c.contact_number, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_details->>'contactNumber', '\s+', ' ', 'g')))
      and lower(btrim(regexp_replace(c.identifying_note, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_details->>'identifyingNote', '\s+', ' ', 'g')))
  ) then raise exception 'This customer already exists. Use the existing customer, or add different contact details or an identifying note for a different person.'; end if;
  before_details := jsonb_build_object('name', original.name, 'contactNumber', original.contact_number, 'identifyingNote', original.identifying_note, 'deleted', original.deleted);
  after_details := p_details || jsonb_build_object('deleted', p_deleted);
  if before_details = after_details then return; end if;
  update public.customers set name = p_details->>'name', contact_number = p_details->>'contactNumber', identifying_note = p_details->>'identifyingNote', deleted = p_deleted, revision = revision + 1
    where store_id = store.id and id = original.id;
  insert into public.audit_events(store_id, actor_id, action, request_id, customer_id, customer_change)
    values (store.id, auth.uid(), case when original.deleted <> p_deleted then case when p_deleted then 'customer.deleted' else 'customer.restored' end else 'customer.edited' end,
      p_request_id, original.id, payload || jsonb_build_object('before', before_details, 'after', after_details));
end;
$$;
revoke all on function public.change_customer(uuid, uuid, integer, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.change_customer(uuid, uuid, integer, jsonb, boolean) to authenticated;

-- Keep original retries valid after deletion. New entries require a restored customer.
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
    raise exception 'This save ID was already used for a correction or customer change.';
  end if;
  select * into result from public.ledger_entries where store_id = store.id and request_id = p_request_id;
  if found then
    if result.customer_id is distinct from p_customer_id or result.type is distinct from p_type or result.amount_centavos is distinct from p_amount_centavos or result.effective_date is distinct from p_effective_date or result.description is distinct from p_description then
      raise exception 'This save ID was already used for different transaction details.';
    end if;
    return private.entry_json(result);
  end if;
  if exists (select 1 from public.customers where store_id = store.id and id = p_customer_id and deleted) then
    raise exception 'Restore this deleted customer before recording new entries.';
  end if;
  insert into public.ledger_entries(id, request_id, store_id, customer_id, type, amount_centavos, description, effective_date, effective_time, created_by)
    values (p_request_id, p_request_id, store.id, p_customer_id, p_type, p_amount_centavos, p_description, p_effective_date, date_trunc('second', clock_timestamp() at time zone store.timezone)::time, auth.uid()) returning * into result;
  perform private.assert_customer_ledger(store.id, p_customer_id);
  insert into public.audit_events(store_id, actor_id, entry_id, action) values (store.id, auth.uid(), result.id, 'entry.created');
  return private.entry_json(result);
end;
$$;
commit;
