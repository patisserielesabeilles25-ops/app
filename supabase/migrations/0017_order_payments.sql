-- 0017 — Order payment integration
-- Nahla Cake Panel — Finance expansion Phase 5
--
-- record_order_payment posts INCOME (source=ORDER) for money ACTUALLY received
-- and advances order_financials.advance_payment (= total received to date).
-- record_delivery_fee posts the delivery fee as its own INCOME (source=DELIVERY),
-- once per order. Both SECURITY DEFINER + permission-checked; over-payment and
-- duplicate delivery-fee are prevented.

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount   numeric,
  p_kind     text  -- 'ADVANCE' | 'FINAL' | 'PAYMENT'
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

  select id into v_cat from public.financial_categories where key = 'ORDER_PAYMENT';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, created_by)
  values
    ('INCOME', 'ORDER_' || p_kind, p_amount, now(), 'ORDER', 'SHOP', v_cat, p_order_id,
     initcap(p_kind) || ' payment for ' || v_num, v_uid)
  returning id into v_tx;

  update public.order_financials
    set advance_payment = advance_payment + p_amount, updated_by = v_uid
  where order_id = p_order_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.order_payment', 'order', p_order_id,
          jsonb_build_object('amount', p_amount, 'kind', p_kind, 'order', v_num));

  return v_tx;
end;
$$;

create or replace function public.record_delivery_fee(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
  v_fee numeric;
  v_cat uuid;
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;

  select o.order_number, f.delivery_amount into v_num, v_fee
  from public.orders o
  join public.order_financials f on f.order_id = o.id
  where o.id = p_order_id;

  if v_num is null then raise exception 'order not found'; end if;
  if coalesce(v_fee, 0) <= 0 then raise exception 'no delivery fee on this order'; end if;
  if exists (
    select 1 from public.financial_transactions
    where order_id = p_order_id and source = 'DELIVERY'
  ) then
    raise exception 'delivery fee already recorded';
  end if;

  select id into v_cat from public.financial_categories where key = 'DELIVERY_FEE';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, created_by)
  values
    ('INCOME', 'DELIVERY_FEE', v_fee, now(), 'DELIVERY', 'DELIVERY', v_cat, p_order_id,
     'Delivery fee for ' || v_num, v_uid)
  returning id into v_tx;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.delivery_fee', 'order', p_order_id,
          jsonb_build_object('amount', v_fee, 'order', v_num));

  return v_tx;
end;
$$;
