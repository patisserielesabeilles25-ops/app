-- 0047 — Production always begins at Maskage (Preparation auto-passed)
-- Nahla Cake Panel
--
-- Preparation is no longer a manual step: whenever production starts — at order
-- creation (due <= 2 days), by the daily promoter, or via the Start button — the
-- order goes straight to EN_MASKAGE and Preparation is auto-passed (recorded
-- done, no worker, no piece-work). Masking and Finition are still validated per
-- worker. Migration 0046 already handled the manual Start button
-- (start_production_auto); this aligns create_order + the cron, and backfills
-- orders currently parked in EN_PREPARATION.

-- ---------------------------------------------------------------------------
-- create_order: auto-start straight to EN_MASKAGE when the order is due.
-- ---------------------------------------------------------------------------
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
  p_received_by      uuid default null,
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
  v_agent    text;
  v_cat      uuid;
  v_due      boolean := (p_delivery_date - (now() at time zone 'Africa/Algiers')::date) <= 2;
begin
  if v_uid is null or not public.has_permission('orders.create') then
    raise exception 'forbidden: orders.create required';
  end if;

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

  select c.id into v_customer from public.customers c where c.phone = p_customer_phone limit 1;
  if v_customer is null then
    insert into public.customers (name, phone)
    values (p_customer_name, p_customer_phone)
    returning customers.id into v_customer;
  end if;

  v_number := public.allocate_order_number(extract(year from now())::int);

  insert into public.orders (
    order_number, customer_id, customer_name, customer_phone,
    cake_size_cm, description, delivery_date, delivery_time,
    delivery_required, fulfillment,
    production_status, production_stage, sent_to_lab_at, in_production_at,
    created_by, updated_by
  ) values (
    v_number, v_customer, p_customer_name, p_customer_phone,
    p_cake_size_cm, p_description, p_delivery_date, p_delivery_time,
    coalesce(p_delivery_required, false), p_fulfillment,
    case when v_due then 'IN_PRODUCTION' else 'NEW' end,
    case when v_due then 'EN_MASKAGE' else 'NOUVEAU' end,
    case when v_due then now() else null end,
    case when v_due then now() else null end,
    v_uid, v_uid
  )
  returning orders.id into v_order_id;

  -- Auto-pass Preparation for orders that start immediately.
  if v_due then
    insert into public.order_stages (order_id, stage, employee_id, piece_work_id, done_by)
    values (v_order_id, 'PREPARATION', null, null, v_uid)
    on conflict (order_id, stage) do nothing;
  end if;

  insert into public.order_financials (
    order_id, total_amount, advance_payment, delivery_amount, montage_amount, created_by, updated_by
  ) values (
    v_order_id, p_total_amount, p_advance_payment, v_delivery, v_montage, v_uid, v_uid
  );

  if p_image_path is not null then
    insert into public.order_images (order_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_order_id, coalesce(p_image_bucket, 'order-images'), p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  if p_advance_payment > 0 then
    if p_received_by is not null then
      select e.full_name into v_agent from public.employees e where e.id = p_received_by;
    end if;
    select fc.id into v_cat from public.financial_categories fc where fc.key = 'ORDER_PAYMENT';

    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, order_id, employee_id, description, created_by)
    values
      ('INCOME', 'ORDER_ADVANCE', p_advance_payment, now(), 'ORDER', 'SHOP', v_cat, v_order_id, p_received_by,
       'Advance payment for ' || v_number || case when v_agent is not null then ' — reçu par ' || v_agent else '' end, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.create', 'order', v_order_id,
          jsonb_build_object('order_number', v_number, 'received_by', p_received_by, 'auto_started', v_due));

  return query select v_order_id, v_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily promoter: start due orders straight into EN_MASKAGE (prep auto-passed).
-- ---------------------------------------------------------------------------
create or replace function public.auto_start_due_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_today date := (now() at time zone 'Africa/Algiers')::date;
begin
  with promoted as (
    update public.orders o set
      production_stage  = 'EN_MASKAGE',
      production_status = 'IN_PRODUCTION',
      sent_to_lab_at    = coalesce(o.sent_to_lab_at, now()),
      in_production_at  = coalesce(o.in_production_at, now())
    where o.production_stage = 'NOUVEAU'
      and o.returned_at is null
      and (o.delivery_status is null or o.delivery_status <> 'DELIVERED')
      and (o.delivery_date - v_today) <= 2
    returning o.id
  ), passed as (
    insert into public.order_stages (order_id, stage, employee_id, piece_work_id, done_by)
    select id, 'PREPARATION', null, null, null from promoted
    on conflict (order_id, stage) do nothing
    returning 1
  )
  select count(*) into v_count from promoted;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: move orders currently parked in EN_PREPARATION to EN_MASKAGE and
-- auto-pass their Preparation.
-- ---------------------------------------------------------------------------
with fixed as (
  update public.orders set
    production_stage  = 'EN_MASKAGE',
    production_status = 'IN_PRODUCTION',
    sent_to_lab_at    = coalesce(sent_to_lab_at, now()),
    in_production_at  = coalesce(in_production_at, now())
  where production_stage = 'EN_PREPARATION'
    and returned_at is null
  returning id
)
insert into public.order_stages (order_id, stage, employee_id, piece_work_id, done_by)
select id, 'PREPARATION', null, null, null from fixed
on conflict (order_id, stage) do nothing;
