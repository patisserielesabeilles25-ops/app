-- 0040 — Record which agent took the order / received the advance
-- Nahla Cake Panel
--
-- Adds an optional p_received_by (employee id) to create_order. When an advance
-- is collected at order creation, the ORDER_ADVANCE ledger entry is now stamped
-- with that employee_id and classified like a normal order payment
-- (source=ORDER, dept=SHOP, category=ORDER_PAYMENT), and the agent's name is
-- appended to the description ("— reçu par <name>") so it appears in the Magasin
-- "Today's sales" section, consistent with record_order_payment.

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

  -- Record the advance as income only when money was actually received,
  -- attributed to the agent who collected it (shows in Magasin today's sales).
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
          jsonb_build_object('order_number', v_number, 'received_by', p_received_by));

  return query select v_order_id, v_number;
end;
$$;
