-- 0009 — Atomic production-status transitions
-- Nahla Cake Panel
--
-- Validates the transition against the allowed state machine, stamps the right
-- timestamps, records status history and an audit entry, and (when an order
-- becomes READY) opens the delivery queue entry for delivery orders — all in one
-- transaction. SECURITY DEFINER with an explicit permission check.

create or replace function public.set_order_production_status(
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
  v_fulfillment text;
begin
  if v_uid is null
     or not (public.has_permission('production.update') or public.has_permission('orders.edit')) then
    raise exception 'forbidden: production.update or orders.edit required';
  end if;

  if p_to not in ('NEW', 'IN_PRODUCTION', 'READY') then
    raise exception 'invalid production status: %', p_to;
  end if;

  select production_status, fulfillment
    into v_from, v_fulfillment
  from public.orders
  where id = p_order_id
  for update;

  if v_from is null then
    raise exception 'order not found';
  end if;

  if not (
    (v_from = 'NEW' and p_to = 'IN_PRODUCTION') or
    (v_from = 'IN_PRODUCTION' and p_to = 'READY')
  ) then
    raise exception 'illegal transition % -> %', v_from, p_to;
  end if;

  update public.orders set
    production_status = p_to,
    sent_to_lab_at   = case when p_to = 'IN_PRODUCTION' then now() else sent_to_lab_at end,
    in_production_at  = case when p_to = 'IN_PRODUCTION' then now() else in_production_at end,
    ready_at         = case when p_to = 'READY' then now() else ready_at end,
    delivery_status  = case
                         when p_to = 'READY' and fulfillment = 'DELIVERY' then 'READY'
                         else delivery_status
                       end,
    updated_by = v_uid
  where id = p_order_id;

  insert into public.order_status_history (order_id, field, from_value, to_value, changed_by)
  values (p_order_id, 'production_status', v_from, p_to, v_uid);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.status_change', 'order', p_order_id,
          jsonb_build_object('field', 'production_status', 'from', v_from, 'to', p_to));
end;
$$;
