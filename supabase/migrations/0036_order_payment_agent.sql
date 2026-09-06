-- 0036 — Record which agent received an order payment
-- Nahla Cake Panel
--
-- Extends record_order_payment with an optional p_received_by (employee id),
-- stored as the transaction's employee_id so the Magasin "Today's sales" can
-- show who received the money for the order.

drop function if exists public.record_order_payment(uuid, numeric, text);

create or replace function public.record_order_payment(
  p_order_id    uuid,
  p_amount      numeric,
  p_kind        text,          -- 'ADVANCE' | 'FINAL' | 'PAYMENT'
  p_received_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_num      text;
  v_total    numeric;
  v_received numeric;
  v_cat      uuid;
  v_tx       uuid;
  v_agent    text;
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_kind not in ('ADVANCE', 'FINAL', 'PAYMENT') then raise exception 'invalid payment kind'; end if;

  select o.order_number, f.total_amount, f.advance_payment
    into v_num, v_total, v_received
  from public.orders o
  join public.order_financials f on f.order_id = o.id
  where o.id = p_order_id
  for update;

  if v_num is null then raise exception 'order not found'; end if;
  if v_received + p_amount > v_total then
    raise exception 'payment exceeds the remaining amount';
  end if;

  if p_received_by is not null then
    select full_name into v_agent from public.employees where id = p_received_by;
  end if;

  select id into v_cat from public.financial_categories where key = 'ORDER_PAYMENT';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, employee_id, description, created_by)
  values
    ('INCOME', 'ORDER_' || p_kind, p_amount, now(), 'ORDER', 'SHOP', v_cat, p_order_id, p_received_by,
     initcap(p_kind) || ' payment for ' || v_num || case when v_agent is not null then ' — reçu par ' || v_agent else '' end, v_uid)
  returning id into v_tx;

  update public.order_financials
    set advance_payment = advance_payment + p_amount, updated_by = v_uid
  where order_id = p_order_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.order_payment', 'order', p_order_id,
          jsonb_build_object('amount', p_amount, 'kind', p_kind, 'order', v_num, 'received_by', p_received_by));

  return v_tx;
end;
$$;
