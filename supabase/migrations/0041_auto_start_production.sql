-- 0041 — Date-driven automatic production start
-- Nahla Cake Panel
--
-- Rule (business tz Africa/Algiers):
--   * delivery in 3+ days  -> order stays NOUVEAU and shows as REPORTED (parked).
--   * delivery in <= 2 days -> production auto-starts (EN_PREPARATION / IN_PRODUCTION),
--     so the lab can begin. Happens immediately at creation when already due,
--     otherwise a daily job promotes orders as they reach the 2-day mark.
-- The canonical-status display threshold is aligned in src/lib/statuses/derive.ts.

-- ---------------------------------------------------------------------------
-- create_order: auto-start production when the order is already due (<= 2 days).
-- (Keeps the montage/delivery/agent behaviour from 0038-0040.)
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
    case when v_due then 'EN_PREPARATION' else 'NOUVEAU' end,
    case when v_due then now() else null end,
    case when v_due then now() else null end,
    v_uid, v_uid
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
-- Daily promoter: start production for not-yet-started orders due in <= 2 days.
-- Idempotent (only touches NOUVEAU orders). Returns the number promoted.
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
  update public.orders o set
    production_stage  = 'EN_PREPARATION',
    production_status = 'IN_PRODUCTION',
    sent_to_lab_at    = coalesce(o.sent_to_lab_at, now()),
    in_production_at  = coalesce(o.in_production_at, now())
  where o.production_stage = 'NOUVEAU'
    and o.returned_at is null
    and (o.delivery_status is null or o.delivery_status <> 'DELIVERED')
    and (o.delivery_date - v_today) <= 2;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedule the promoter once a day (00:10 Africa/Algiers = 23:10 UTC).
-- pg_cron runs in the database's timezone (UTC on Supabase).
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('auto-start-due-orders');
exception when others then
  null; -- job did not exist yet
end $$;

select cron.schedule(
  'auto-start-due-orders',
  '10 23 * * *',
  $cron$ select public.auto_start_due_orders(); $cron$
);
