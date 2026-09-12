-- Preserve existing customers and same-request retries. Serialize duplicate checks
-- with the existing owner lock; identical names with distinct details remain valid.
begin;

create or replace function public.create_customer(p_request_id uuid, p_name text, p_contact_number text default '', p_identifying_note text default '') returns jsonb
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
  if exists (
    select 1 from public.customers c where c.store_id = store.id
      and lower(btrim(regexp_replace(c.name, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_name, '\s+', ' ', 'g')))
      and lower(btrim(regexp_replace(c.contact_number, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_contact_number, '\s+', ' ', 'g')))
      and lower(btrim(regexp_replace(c.identifying_note, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_identifying_note, '\s+', ' ', 'g')))
  ) then
    raise exception 'This customer already exists. Use the existing customer, or add different contact details or an identifying note for a different person.';
  end if;
  insert into public.customers(id, store_id, name, contact_number, identifying_note)
    values (p_request_id, store.id, p_name, p_contact_number, p_identifying_note) returning * into result;
  insert into public.audit_events(store_id, actor_id, action) values (store.id, auth.uid(), 'customer.created');
  return private.customer_json(result);
end;
$$;

commit;
