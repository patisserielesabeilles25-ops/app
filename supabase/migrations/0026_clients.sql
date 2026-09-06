-- 0026 — Clients page: date of birth, returned-order tracking, client overview
-- Nahla Cake Panel
--
-- Adds the data the Clients page needs on top of the existing `customers` table
-- (which is already populated/deduped by phone on every order via create_order):
--   * customers.date_of_birth        — editable birthday (BOD)
--   * orders.returned_at / return_reason — a returned/refused order marker
--   * mark_order_returned / unmark_order_returned — auditable state changes
--   * client_overview view           — per-customer aggregates for the badges
--
-- "Delivered" for the green badge counts completed orders of either type:
--   delivery orders that reached DELIVERED, plus pickup orders that reached READY
--   (ready-for-pickup is the terminal operational state for pickups; there is no
--   separate pickup-collection flag in the system). Returned orders are excluded.

-- ---------------------------------------------------------------------------
-- Customer birthday
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists date_of_birth date;

-- ---------------------------------------------------------------------------
-- Returned-order marker (orthogonal to production/delivery status; works for
-- both pickup and delivery orders)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists returned_at   timestamptz,
  add column if not exists return_reason text;
create index if not exists idx_orders_returned_at on public.orders(returned_at);

-- ---------------------------------------------------------------------------
-- Mark an order returned / undo. SECURITY DEFINER with an explicit permission
-- check; actor comes from auth.uid() (not a forgeable parameter).
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_returned(
  p_order_id uuid,
  p_reason   text default null
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

  update public.orders set
    returned_at   = coalesce(returned_at, now()),
    return_reason = p_reason,
    updated_by    = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.returned', 'order', p_order_id,
          jsonb_build_object('order_number', v_num, 'reason', p_reason));
end;
$$;

create or replace function public.unmark_order_returned(
  p_order_id uuid
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

  update public.orders set
    returned_at   = null,
    return_reason = null,
    updated_by    = v_uid
  where id = p_order_id
  returning order_number into v_num;

  if v_num is null then
    raise exception 'order not found';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'order.return_cleared', 'order', p_order_id,
          jsonb_build_object('order_number', v_num));
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-customer overview for the Clients page. security_invoker so the caller's
-- RLS on customers/orders applies (page is gated on orders.view).
-- ---------------------------------------------------------------------------
create or replace view public.client_overview
with (security_invoker = on) as
select
  c.id,
  c.name,
  c.phone,
  c.date_of_birth,
  c.notes,
  c.created_at,
  count(o.id)                                   as total_orders,
  count(o.id) filter (
    where o.returned_at is null and (
      o.delivery_status = 'DELIVERED'
      or (o.fulfillment = 'PICKUP' and o.production_status = 'READY')
    )
  )                                             as delivered_count,
  count(o.id) filter (where o.returned_at is not null) as returned_count,
  max(o.delivery_date)                          as last_order_date
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id, c.name, c.phone, c.date_of_birth, c.notes, c.created_at;

grant select on public.client_overview to authenticated;
