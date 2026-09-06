-- 0030 — REPORTED (postponed / rescheduled) order status
-- Nahla Cake Panel
--
-- A "reported" order is one whose delivery has been postponed to a new date/time
-- (and delivery-or-pickup may change). The new date shows on the Calendar. This
-- adds the marker columns, a rescheduling function, and extends the custom-status
-- link constraint to allow the new REPORTED canonical key.

alter table public.orders
  add column if not exists reported_at   timestamptz,
  add column if not exists report_reason text;
create index if not exists idx_orders_reported_at on public.orders(reported_at);

-- Allow custom statuses to link to REPORTED as well.
alter table public.custom_statuses drop constraint if exists custom_statuses_canonical_check;
alter table public.custom_statuses add constraint custom_statuses_canonical_check
  check (canonical in (
    'NOUVEAU', 'EN_PREPARATION', 'EN_MASKAGE', 'EN_FINITION',
    'READY', 'REPORTED', 'DELIVERED', 'RETURNED'
  ));

-- Report (postpone / reschedule) an order: set a new delivery date, time and
-- delivery/pickup, and mark it reported. SECURITY DEFINER with a permission check.
create or replace function public.report_order(
  p_order_id          uuid,
  p_delivery_date     date,
  p_delivery_time     time,
  p_delivery_required boolean,
  p_reason            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
begin
  if v_uid is null
     or not (public.has_permission('orders.edit') or public.has_permission('delivery.update')) then
    raise exception 'forbidden: orders.edit or delivery.update required';
  end if;
  if p_delivery_date is null or p_delivery_time is null then
    raise exception 'new delivery date and time are required';
  end if;

  update public.orders set
    delivery_date     = p_delivery_date,
    delivery_time     = p_delivery_time,
    delivery_required = coalesce(p_delivery_required, delivery_required),
    fulfillment       = case when p_delivery_required then 'DELIVERY' else 'PICKUP' end,
    reported_at       = now(),
    report_reason     = p_reason,
    updated_by        = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.reported', 'order', p_order_id,
          jsonb_build_object('order_number', v_num,
                             'delivery_date', p_delivery_date,
                             'delivery_time', p_delivery_time,
                             'reason', p_reason));
end;
$$;

create or replace function public.unreport_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
begin
  if v_uid is null
     or not (public.has_permission('orders.edit') or public.has_permission('delivery.update')) then
    raise exception 'forbidden: orders.edit or delivery.update required';
  end if;

  update public.orders set
    reported_at   = null,
    report_reason = null,
    updated_by    = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.report_cleared', 'order', p_order_id,
          jsonb_build_object('order_number', v_num));
end;
$$;
