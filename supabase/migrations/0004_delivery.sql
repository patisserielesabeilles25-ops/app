-- 0004 — Delivery records
-- Nahla Cake Panel

create table public.deliveries (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.orders(id) on delete cascade,
  status              text not null default 'READY'
                        check (status in ('READY', 'OUT_FOR_DELIVERY', 'DELIVERED')),
  driver              text,
  out_for_delivery_at timestamptz,
  delivered_at        timestamptz,
  created_by          uuid references public.profiles(id),
  updated_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_deliveries_status on public.deliveries(status);
create trigger trg_deliveries_updated
  before update on public.deliveries
  for each row execute function public.set_updated_at();

alter table public.deliveries enable row level security;

create policy "deliveries_select" on public.deliveries
  for select to authenticated
  using (public.has_permission('delivery.view') or public.has_permission('orders.view'));
create policy "deliveries_insert" on public.deliveries
  for insert to authenticated
  with check (public.has_permission('delivery.update') or public.has_permission('orders.edit'));
create policy "deliveries_update" on public.deliveries
  for update to authenticated
  using (public.has_permission('delivery.update'))
  with check (public.has_permission('delivery.update'));
