-- 0039 — Delivery price counts toward the order total (like montage)
-- Nahla Cake Panel
--
-- Delivery is no longer a separately-collected fee: the delivery amount now
-- counts toward what the customer owes, so the order grand total is
--   total_amount + montage_amount + delivery_amount
-- and remaining_amount / advance / over-payment guards all include it.
--
-- Self-contained: also (re)creates the montage_amount column from 0038, so this
-- migration alone brings order_financials + create_order + record_order_payment
-- to their final state whether or not 0038 was applied.

-- ---------------------------------------------------------------------------
-- order_financials: ensure montage_amount, re-derive remaining, widen guard.
-- ---------------------------------------------------------------------------
alter table public.order_financials
  add column if not exists montage_amount numeric(12,2) not null default 0
    check (montage_amount >= 0);

alter table public.order_financials
  drop constraint if exists advance_not_over_total;

alter table public.order_financials
  drop column if exists remaining_amount;

alter table public.order_financials
  add column remaining_amount numeric(12,2)
    generated always as (total_amount + montage_amount + delivery_amount - advance_payment) stored;

alter table public.order_financials
  add constraint advance_not_over_total
    check (advance_payment <= total_amount + montage_amount + delivery_amount);

-- ---------------------------------------------------------------------------
-- create_order: grand total = total + montage + delivery.
-- ---------------------------------------------------------------------------
drop function if exists public.create_order(
  text, text, numeric, text, date, time, boolean, text,
  numeric, numeric, numeric, text, text, text, int
);
drop function if exists public.create_order(
  text, text, numeric, text, date, time, boolean, text,
  numeric, numeric, numeric, numeric, text, text, text, int
);

create or replace function public.create_order(
  p_customer_name    text,
  p_customer_phone   text,
  p_cake_size_cm     numeric,
  p_description      text,
  p_delivery_date    date,
  p_delivery_time    time,
  p_delivery_required boolean,
  p_fulfillment      text,
  p_total_amount     numeric,
  p_advance_payment  numeric,
  p_delivery_amount  numeric,
  p_montage_amount   numeric default 0,
  p_image_bucket     text default null,
  p_image_path       text default null,
  p_image_mime       text default null,
  p_image_size       int  default null
)
returns table (id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_customer uuid;
  v_order_id uuid;
  v_number   text;
  v_montage  numeric := coalesce(p_montage_amount, 0);
  v_delivery numeric := coalesce(p_delivery_amount, 0);
begin
  if v_uid is null or not public.has_permission('orders.create') then
    raise exception 'forbidden: orders.create required';
  end if;

  -- Validation (mirrors the client + DB CHECK constraints)
  if p_cake_size_cm is null or p_cake_size_cm <= 0 then
    raise exception 'invalid cake size';
  end if;
  if p_total_amount < 0 or p_advance_payment < 0 or v_delivery < 0 or v_montage < 0 then
    raise exception 'amounts cannot be negative';
  end if;
  if p_advance_payment > p_total_amount + v_montage + v_delivery then
    raise exception 'advance cannot exceed total';
  end if;
  if p_fulfillment not in ('PICKUP', 'DELIVERY') then
    raise exception 'invalid fulfillment';
  end if;

  -- Customer (dedupe by phone)
  select c.id into v_customer from public.customers c where c.phone = p_customer_phone limit 1;
  if v_customer is null then
    insert into public.customers (name, phone)
    values (p_customer_name, p_customer_phone)
    returning customers.id into v_customer;
  end if;

  -- Atomic order number (by current calendar year)
  v_number := public.allocate_order_number(extract(year from now())::int);

  insert into public.orders (
    order_number, customer_id, customer_name, customer_phone,
    cake_size_cm, description, delivery_date, delivery_time,
    delivery_required, fulfillment, production_status, created_by, updated_by
  ) values (
    v_number, v_customer, p_customer_name, p_customer_phone,
    p_cake_size_cm, p_description, p_delivery_date, p_delivery_time,
    coalesce(p_delivery_required, false), p_fulfillment, 'NEW', v_uid, v_uid
  )
  returning orders.id into v_order_id;

  insert into public.order_financials (
    order_id, total_amount, advance_payment, delivery_amount, montage_amount, created_by, updated_by
  ) values (
    v_order_id, p_total_amount, p_advance_payment, v_delivery, v_montage, v_uid, v_uid
  );

  if p_image_path is not null then
    insert into public.order_images (order_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_order_id, coalesce(p_image_bucket, 'order-images'), p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  -- Record the advance as income only when money was actually received.
  if p_advance_payment > 0 then
    insert into public.financial_transactions (type, category, amount, order_id, description, created_by)
    values ('INCOME', 'ORDER_ADVANCE', p_advance_payment, v_order_id,
            'Advance payment for ' || v_number, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.create', 'order', v_order_id,
          jsonb_build_object('order_number', v_number));

  return query select v_order_id, v_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_order_payment: over-payment guard uses total + montage + delivery.
-- ---------------------------------------------------------------------------
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

  select o.order_number, f.total_amount + f.montage_amount + f.delivery_amount, f.advance_payment
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
