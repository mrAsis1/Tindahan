-- Additive read API. Preserve get_notebook and every existing write/audit function.
begin;

create function public.read_notebook(p_view text, p_day date default null, p_customer_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare store public.stores;
begin
  if auth.uid() is null then raise exception 'Sign in to open your notebook.' using errcode = '42501'; end if;
  if p_view is null or p_view not in ('home', 'directory', 'day', 'customer') then raise exception 'Invalid notebook view.'; end if;
  select * into store from public.stores where owner_id = auth.uid();
  if p_view in ('home', 'day') and (p_day is null or p_day < date '1900-01-01' or p_day > (now() at time zone 'Asia/Manila')::date) then
    raise exception 'Choose today or an earlier valid date.';
  end if;
  if p_view = 'customer' and p_customer_id is null then raise exception 'Select a customer.'; end if;

  -- STABLE keeps summary and detail reads on the calling statement's snapshot.
  -- Scope every table explicitly: SECURITY DEFINER only exists for JSON helpers.
  return (
    with ledger as materialized (
      select e.* from public.ledger_entries e where e.store_id = store.id
    ), selected_entries as materialized (
      select e.* from ledger e
      where p_view = 'home'
        or (p_view = 'day' and e.effective_date = p_day)
        or (p_view = 'customer' and e.customer_id = p_customer_id)
      order by e.effective_date desc, e.effective_time desc,
        coalesce(e.order_created_at, e.created_at) desc, coalesce(e.order_id, e.id) desc,
        e.created_at desc, e.id desc
      limit case when p_view = 'home' then 3 else 2147483647 end
    ), customer_balances as (
      select e.customer_id, sum(case when e.status = 'voided' then 0
        when e.type = 'payment' then -e.amount_centavos else e.amount_centavos end) as amount
      from ledger e group by e.customer_id
    ), summary as (
      select
        coalesce(sum(case when e.status = 'voided' then 0 when e.type = 'payment' then -e.amount_centavos else e.amount_centavos end), 0) as outstanding,
        coalesce(sum(e.amount_centavos) filter (where e.status = 'active' and e.type = 'utang' and e.effective_date = p_day), 0) as utang,
        coalesce(sum(e.amount_centavos) filter (where e.status = 'active' and e.type = 'payment' and e.effective_date = p_day), 0) as payments,
        coalesce(sum(e.amount_centavos) filter (where e.status = 'active' and e.type = 'opening_balance' and e.effective_date = p_day), 0) as opening,
        coalesce(sum(case when e.status = 'voided' then 0 when e.type = 'payment' then -e.amount_centavos else e.amount_centavos end) filter (where e.effective_date <= p_day), 0) as closing
      from ledger e
    )
    select jsonb_build_object(
      'notebook', jsonb_build_object('version', 1,
        'store', case when store.id is null then null else jsonb_build_object('id', store.id, 'name', store.name) end,
        'customers', coalesce((select jsonb_agg(private.customer_json(c) order by c.created_at, c.id)
          from public.customers c where c.store_id = store.id and (
            p_view = 'directory' or (p_view = 'customer' and c.id = p_customer_id)
            or (p_view in ('home', 'day') and c.id in (select e.customer_id from selected_entries e))
          )), '[]'::jsonb),
        'entries', coalesce((select jsonb_agg(private.entry_json(e::public.ledger_entries) order by e.effective_date desc, e.effective_time desc,
          coalesce(e.order_created_at, e.created_at) desc, coalesce(e.order_id, e.id) desc, e.created_at desc, e.id desc)
          from selected_entries e), '[]'::jsonb)),
      'totals', jsonb_build_object(
        'outstanding', s.outstanding,
        'withBalance', (select count(*) from customer_balances b where b.amount > 0),
        'balances', case when p_view = 'directory' then coalesce((select jsonb_agg(jsonb_build_object('customerId', c.id, 'amount', coalesce(b.amount, 0)) order by c.created_at, c.id)
          from public.customers c left join customer_balances b on b.customer_id = c.id where c.store_id = store.id), '[]'::jsonb) else '[]'::jsonb end,
        'utang', s.utang, 'payments', s.payments, 'opening', s.opening, 'closing', s.closing)
    ) from summary s
  );
end;
$$;

revoke all on function public.read_notebook(text, date, uuid) from public, anon, authenticated;
grant execute on function public.read_notebook(text, date, uuid) to authenticated;
commit;
