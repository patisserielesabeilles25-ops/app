-- 0011 — Atomic delivery-status transitions
-- Nahla Cake Panel
--
-- READY -> OUT_FOR_DELIVERY -> DELIVERED. Validates the order is a READY delivery
-- order, stamps timestamps on orders, upserts the deliveries record, and writes
-- status history + audit. SECURITY DEFINER with an explicit permission check.

create or replace function public.set_order_delivery_status(
  p_order_id uuid,
  p_to       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_from text;
  v_prod text;
  v_fulfillment text;
begin
  if v_uid is null or not public.has_permission('delivery.update') then
    raise exception 'forbidden: delivery.update required';
  end if;

  if p_to not in ('READY', 'OUT_FOR_DELIVERY', 'DELIVERED') then
    raise exception 'invalid delivery status: %', p_to;
  end if;

  select delivery_status, production_status, fulfillment
    into v_from, v_prod, v_fulfillment
  from public.orders
  where id = p_order_id
  for update;

  if v_prod is null then
    raise exception 'order not found';
  end if;
  if v_fulfillment <> 'DELIVERY' then
    raise exception 'order is not a delivery order';
  end if;
  if v_prod <> 'READY' then
    raise exception 'order is not ready for delivery';
  end if;

  v_from := coalesce(v_from, 'READY');
  if not (
    (v_from = 'READY' and p_to = 'OUT_FOR_DELIVERY') or
    (v_from = 'OUT_FOR_DELIVERY' and p_to = 'DELIVERED')
  ) then
    raise exception 'illegal delivery transition % -> %', v_from, p_to;
  end if;

  update public.orders set
    delivery_status     = p_to,
    out_for_delivery_at = case when p_to = 'OUT_FOR_DELIVERY' then now() else out_for_delivery_at end,
    delivered_at        = case when p_to = 'DELIVERED' then now() else delivered_at end,
    updated_by = v_uid
  where id = p_order_id;

  insert into public.deliveries (order_id, status, out_for_delivery_at, delivered_at, created_by, updated_by)
  values (
    p_order_id, p_to,
    case when p_to = 'OUT_FOR_DELIVERY' then now() else null end,
    case when p_to = 'DELIVERED' then now() else null end,
    v_uid, v_uid
  )
  on conflict (order_id) do update set
    status              = excluded.status,
    out_for_delivery_at = case when p_to = 'OUT_FOR_DELIVERY' then now() else public.deliveries.out_for_delivery_at end,
    delivered_at        = case when p_to = 'DELIVERED' then now() else public.deliveries.delivered_at end,
    updated_by = v_uid;

  insert into public.order_status_history (order_id, field, from_value, to_value, changed_by)
  values (p_order_id, 'delivery_status', v_from, p_to, v_uid);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.status_change', 'order', p_order_id,
          jsonb_build_object('field', 'delivery_status', 'from', v_from, 'to', p_to));
end;
$$;
