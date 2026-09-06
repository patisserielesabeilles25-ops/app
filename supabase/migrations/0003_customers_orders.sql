-- 0003 — Customers & orders (operational data only; financials live in 0005)
-- Nahla Cake Panel

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_phone on public.customers(phone);
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Order-number allocation (atomic, per year): NC-<year>-<000001>
-- ---------------------------------------------------------------------------
create table public.order_number_counters (
  year       int primary key,
  last_value bigint not null default 0
);
alter table public.order_number_counters enable row level security;
-- No policies: reachable only via the SECURITY DEFINER function or service role.

create or replace function public.allocate_order_number(p_year int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.order_number_counters (year, last_value)
  values (p_year, 1)
  on conflict (year)
  do update set last_value = public.order_number_counters.last_value + 1
  returning last_value into v;

  return 'NC-' || p_year::text || '-' || lpad(v::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders (operational). Financial amounts are in public.order_financials.
-- ---------------------------------------------------------------------------
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text unique not null,
  customer_id          uuid references public.customers(id),
  customer_name        text not null,
  customer_phone       text not null,
  cake_size_cm         numeric not null check (cake_size_cm > 0),
  description          text,
  delivery_date        date not null,
  delivery_time        time not null,
  delivery_required    boolean not null default false,
  fulfillment          text not null default 'PICKUP'
                         check (fulfillment in ('PICKUP', 'DELIVERY')),
  production_status     text not null default 'NEW'
                         check (production_status in ('NEW', 'IN_PRODUCTION', 'READY')),
  delivery_status      text
                         check (delivery_status in ('READY', 'OUT_FOR_DELIVERY', 'DELIVERED')),
  collected_at_shop_at timestamptz,
  sent_to_lab_at       timestamptz,
  in_production_at     timestamptz,
  ready_at             timestamptz,
  out_for_delivery_at  timestamptz,
  delivered_at         timestamptz,
  created_by           uuid references public.profiles(id),
  updated_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_orders_delivery_date on public.orders(delivery_date);
create index idx_orders_prod_status   on public.orders(production_status);
create index idx_orders_deliv_status  on public.orders(delivery_status);
create index idx_orders_customer      on public.orders(customer_id);
create index idx_orders_day           on public.orders(delivery_date, delivery_time);
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Order status history (audit of state changes)
-- ---------------------------------------------------------------------------
create table public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  field      text not null check (field in ('production_status', 'delivery_status')),
  from_value text,
  to_value   text,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);
create index idx_order_history_order on public.order_status_history(order_id);

-- ---------------------------------------------------------------------------
-- Order reference images (metadata only; binaries live in Storage)
-- ---------------------------------------------------------------------------
create table public.order_images (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  bucket      text not null default 'order-images',
  object_path text not null,
  mime_type   text,
  size_bytes  int,
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_order_images_order on public.order_images(order_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.customers            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_images         enable row level security;

-- customers
create policy "customers_select" on public.customers
  for select to authenticated
  using (public.has_permission('orders.view') or public.has_permission('laboratory.view'));
create policy "customers_insert" on public.customers
  for insert to authenticated
  with check (public.has_permission('orders.create'));
create policy "customers_update" on public.customers
  for update to authenticated
  using (public.has_permission('orders.edit'))
  with check (public.has_permission('orders.edit'));

-- orders: shop (orders.view) and lab (laboratory.view) may read operational data.
create policy "orders_select" on public.orders
  for select to authenticated
  using (public.has_permission('orders.view') or public.has_permission('laboratory.view'));
create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (public.has_permission('orders.create'));
-- Update covers both shop edits and lab production/delivery updates.
create policy "orders_update" on public.orders
  for update to authenticated
  using (
    public.has_permission('orders.edit')
    or public.has_permission('production.update')
    or public.has_permission('delivery.update')
  )
  with check (
    public.has_permission('orders.edit')
    or public.has_permission('production.update')
    or public.has_permission('delivery.update')
  );
create policy "orders_delete" on public.orders
  for delete to authenticated
  using (public.has_permission('orders.delete'));

-- order_status_history: readable by anyone who can see orders; inserts via app.
create policy "order_history_select" on public.order_status_history
  for select to authenticated
  using (public.has_permission('orders.view') or public.has_permission('laboratory.view'));
create policy "order_history_insert" on public.order_status_history
  for insert to authenticated
  with check (
    public.has_permission('orders.edit')
    or public.has_permission('production.update')
    or public.has_permission('delivery.update')
  );

-- order_images: same visibility as orders.
create policy "order_images_select" on public.order_images
  for select to authenticated
  using (public.has_permission('orders.view') or public.has_permission('laboratory.view'));
create policy "order_images_insert" on public.order_images
  for insert to authenticated
  with check (public.has_permission('orders.create') or public.has_permission('orders.edit'));
create policy "order_images_delete" on public.order_images
  for delete to authenticated
  using (public.has_permission('orders.edit') or public.has_permission('orders.delete'));
