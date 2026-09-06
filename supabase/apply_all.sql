-- ============================================================
-- Nahla Cake Panel — COMPLETE schema + functions + seed
-- Run once on a fresh Supabase database (SQL Editor or CLI).
-- Includes all migrations 0001-0025 (core app + finance module)
-- followed by the roles/permissions seed.
-- ============================================================

-- >>> 0001_init_extensions_helpers.sql

-- 0001 — Extensions & generic helper functions
-- Nahla Cake Panel

-- Generic trigger to maintain updated_at on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Convenience accessor for the current authenticated user id.
create or replace function public.auth_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- >>> 0002_rbac.sql

-- 0002 — Identity & RBAC (profiles, roles, permissions, mappings)
-- Nahla Cake Panel

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);
create index idx_user_roles_user on public.user_roles(user_id);

-- ---------------------------------------------------------------------------
-- Authorization helper: does the current user hold `perm`?
-- SECURITY DEFINER so it can read the RBAC tables regardless of their RLS.
-- ---------------------------------------------------------------------------
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key = perm
  );
$$;

-- ---------------------------------------------------------------------------
-- Returns the permission keys held by the current user.
-- SECURITY DEFINER so a plain user (who cannot read the RBAC join tables under
-- RLS) can still resolve their own effective permissions.
-- ---------------------------------------------------------------------------
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.key
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Create a profile automatically for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles       enable row level security;

-- profiles: a user always sees/edits self; managers see/edit others.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('users.view'));

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (public.has_permission('users.create'));

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_permission('users.edit'))
  with check (id = auth.uid() or public.has_permission('users.edit'));

create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (public.has_permission('users.delete'));

-- roles
create policy "roles_select" on public.roles
  for select to authenticated
  using (public.has_permission('roles.view') or public.has_permission('permissions.manage'));
create policy "roles_insert" on public.roles
  for insert to authenticated
  with check (public.has_permission('roles.create'));
create policy "roles_update" on public.roles
  for update to authenticated
  using (public.has_permission('roles.edit'))
  with check (public.has_permission('roles.edit'));
create policy "roles_delete" on public.roles
  for delete to authenticated
  using (public.has_permission('roles.edit') and is_system = false);

-- permissions (catalog managed by admins)
create policy "permissions_select" on public.permissions
  for select to authenticated
  using (public.has_permission('roles.view') or public.has_permission('permissions.manage'));
create policy "permissions_write" on public.permissions
  for all to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

-- role_permissions
create policy "role_permissions_select" on public.role_permissions
  for select to authenticated
  using (public.has_permission('roles.view') or public.has_permission('permissions.manage'));
create policy "role_permissions_write" on public.role_permissions
  for all to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

-- user_roles
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.view'));
create policy "user_roles_write" on public.user_roles
  for all to authenticated
  using (public.has_permission('users.edit'))
  with check (public.has_permission('users.edit'));

-- >>> 0003_customers_orders.sql

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

-- >>> 0004_delivery.sql

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

-- >>> 0005_finance.sql

-- 0005 — Finance: order financials (split for data-layer protection) + ledger
-- Nahla Cake Panel
--
-- DESIGN NOTE: financial amounts for an order live here, NOT on public.orders,
-- so RLS can deny them to operational/lab users (all signed-in users share the
-- `authenticated` role, so per-column RLS on `orders` is not possible).

-- ---------------------------------------------------------------------------
-- Per-order financial amounts (1:1 with orders)
-- ---------------------------------------------------------------------------
create table public.order_financials (
  order_id         uuid primary key references public.orders(id) on delete cascade,
  total_amount     numeric(12,2) not null default 0 check (total_amount >= 0),
  advance_payment  numeric(12,2) not null default 0 check (advance_payment >= 0),
  delivery_amount  numeric(12,2) not null default 0 check (delivery_amount >= 0),
  remaining_amount numeric(12,2) generated always as (total_amount - advance_payment) stored,
  created_by       uuid references public.profiles(id),
  updated_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint advance_not_over_total check (advance_payment <= total_amount)
);
create trigger trg_order_financials_updated
  before update on public.order_financials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Append-only financial ledger. Balance is derived, never stored mutably.
-- ---------------------------------------------------------------------------
create table public.financial_transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('INCOME', 'EXPENSE')),
  category    text not null,           -- ORDER_ADVANCE | ORDER_FINAL | PURCHASE | SERVICE | OTHER ...
  amount      numeric(12,2) not null check (amount > 0),  -- sign implied by `type`
  occurred_at timestamptz not null default now(),
  order_id    uuid references public.orders(id),
  item_name   text,
  description text,
  reverses_transaction_id uuid references public.financial_transactions(id),
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index idx_fin_tx_occurred on public.financial_transactions(occurred_at);
create index idx_fin_tx_type     on public.financial_transactions(type);
create index idx_fin_tx_category on public.financial_transactions(category);
create index idx_fin_tx_order    on public.financial_transactions(order_id);

-- ---------------------------------------------------------------------------
-- Sensitive attachments (receipts / invoices). Metadata only.
-- ---------------------------------------------------------------------------
create table public.financial_attachments (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.financial_transactions(id) on delete restrict,
  bucket         text not null default 'finance-attachments',
  object_path    text not null,
  mime_type      text,
  size_bytes     int,
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index idx_fin_att_tx on public.financial_attachments(transaction_id);

-- ---------------------------------------------------------------------------
-- Derived balance — guarded function (raises for non-finance users).
-- ---------------------------------------------------------------------------
create or replace function public.current_balance()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('finance.transactions.view') then
    raise exception 'forbidden: finance.transactions.view required';
  end if;

  return (
    select coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0)
    from public.financial_transactions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.order_financials        enable row level security;
alter table public.financial_transactions  enable row level security;
alter table public.financial_attachments   enable row level security;

-- order_financials: only finance users may READ; order creators/editors may WRITE
-- (so amounts can be captured at order creation) but cannot read back without finance perms.
create policy "order_financials_select" on public.order_financials
  for select to authenticated
  using (public.has_permission('finance.view') or public.has_permission('finance.transactions.view'));
create policy "order_financials_insert" on public.order_financials
  for insert to authenticated
  with check (public.has_permission('orders.create') or public.has_permission('finance.view'));
create policy "order_financials_update" on public.order_financials
  for update to authenticated
  using (public.has_permission('orders.edit') or public.has_permission('finance.view'))
  with check (public.has_permission('orders.edit') or public.has_permission('finance.view'));

-- financial_transactions: append-only. No UPDATE/DELETE policies => denied for all
-- (corrections are reversing rows inserted via server actions / service role).
create policy "fin_tx_select" on public.financial_transactions
  for select to authenticated
  using (public.has_permission('finance.transactions.view'));
create policy "fin_tx_insert" on public.financial_transactions
  for insert to authenticated
  with check (
    public.has_permission('finance.income.create')
    or public.has_permission('finance.expense.create')
  );

-- financial_attachments: strictly finance-gated.
create policy "fin_att_select" on public.financial_attachments
  for select to authenticated
  using (public.has_permission('finance.attachments.view'));
create policy "fin_att_insert" on public.financial_attachments
  for insert to authenticated
  with check (
    public.has_permission('finance.income.create')
    or public.has_permission('finance.expense.create')
  );

-- >>> 0006_ready_made_audit.sql

-- 0006 — Ready-made daily production & generic audit log
-- Nahla Cake Panel

-- ---------------------------------------------------------------------------
-- Daily ready-made cake production (one row per date; extensible for sizes)
-- ---------------------------------------------------------------------------
create table public.ready_made_daily_production (
  id              uuid primary key default gen_random_uuid(),
  production_date date not null unique,
  small_qty       int not null default 0 check (small_qty >= 0),
  medium_qty      int not null default 0 check (medium_qty >= 0),
  large_qty       int not null default 0 check (large_qty >= 0),
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_ready_made_updated
  before update on public.ready_made_daily_production
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Generic append-only audit log for important actions
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,       -- e.g. order.create, order.status_change, finance.transaction.create
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index idx_audit_action on public.audit_log(action);
create index idx_audit_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_created on public.audit_log(created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ready_made_daily_production enable row level security;
alter table public.audit_log                   enable row level security;

-- ready-made: viewable by lab/dashboard; writable with production.update.
create policy "ready_made_select" on public.ready_made_daily_production
  for select to authenticated
  using (public.has_permission('laboratory.view') or public.has_permission('dashboard.view'));
create policy "ready_made_insert" on public.ready_made_daily_production
  for insert to authenticated
  with check (public.has_permission('production.update'));
create policy "ready_made_update" on public.ready_made_daily_production
  for update to authenticated
  using (public.has_permission('production.update'))
  with check (public.has_permission('production.update'));

-- audit_log: admins read; inserts happen via server actions / service role.
create policy "audit_select" on public.audit_log
  for select to authenticated
  using (public.has_permission('settings.manage'));

-- >>> 0007_storage_order_images.sql

-- 0007 — Storage bucket for order reference images
-- Nahla Cake Panel
--
-- Private bucket. The browser never touches storage directly: uploads go through
-- a server action using the service role, and downloads use short-lived signed
-- URLs generated server-side after a permission check. With the bucket private
-- and no storage.objects policies for anon/authenticated, only the service role
-- (which bypasses RLS) can access objects — exactly the intended model.

insert into storage.buckets (id, name, public)
values ('order-images', 'order-images', false)
on conflict (id) do nothing;

-- >>> 0008_create_order_fn.sql

-- 0008 — Atomic order creation
-- Nahla Cake Panel
--
-- Creates the customer (deduped by phone), the order, its financials, an
-- optional reference-image record, an ORDER_ADVANCE income ledger entry (only
-- when an advance was actually received), and an audit entry — all in one
-- transaction. SECURITY DEFINER with an explicit permission check so callers
-- cannot bypass authorization, and created_by is taken from auth.uid() (not a
-- forgeable parameter).

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
begin
  if v_uid is null or not public.has_permission('orders.create') then
    raise exception 'forbidden: orders.create required';
  end if;

  -- Validation (mirrors the client + DB CHECK constraints)
  if p_cake_size_cm is null or p_cake_size_cm <= 0 then
    raise exception 'invalid cake size';
  end if;
  if p_total_amount < 0 or p_advance_payment < 0 or coalesce(p_delivery_amount, 0) < 0 then
    raise exception 'amounts cannot be negative';
  end if;
  if p_advance_payment > p_total_amount then
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
    order_id, total_amount, advance_payment, delivery_amount, created_by, updated_by
  ) values (
    v_order_id, p_total_amount, p_advance_payment, coalesce(p_delivery_amount, 0), v_uid, v_uid
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

-- >>> 0009_order_status_fn.sql

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

-- >>> 0010_tighten_financial_policies.sql

-- 0010 — Restrict direct financial writes to finance users
-- Nahla Cake Panel
--
-- order_financials rows are created atomically by create_order (SECURITY DEFINER,
-- bypasses RLS), so we can safely restrict DIRECT insert/update on the table to
-- finance users only. This prevents an operational (non-finance) user from
-- altering amounts through the edit flow, matching the spec's finance boundary.

drop policy if exists "order_financials_insert" on public.order_financials;
drop policy if exists "order_financials_update" on public.order_financials;

create policy "order_financials_insert" on public.order_financials
  for insert to authenticated
  with check (public.has_permission('finance.view'));

create policy "order_financials_update" on public.order_financials
  for update to authenticated
  using (public.has_permission('finance.view'))
  with check (public.has_permission('finance.view'));

-- >>> 0011_delivery_status_fn.sql

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

-- >>> 0012_finance_fns.sql

-- 0012 — Finance: private attachments bucket + atomic ledger write functions
-- Nahla Cake Panel
--
-- record_income / record_expense append to the immutable ledger and optionally
-- link a private attachment, all in one transaction. SECURITY DEFINER with an
-- explicit permission check; created_by is auth.uid() (not forgeable). Balance
-- stays derived (never mutated).

insert into storage.buckets (id, name, public)
values ('finance-attachments', 'finance-attachments', false)
on conflict (id) do nothing;

create or replace function public.record_income(
  p_amount      numeric,
  p_category    text,
  p_occurred_at timestamptz,
  p_description text,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.financial_transactions (type, category, amount, occurred_at, description, created_by)
  values ('INCOME', coalesce(nullif(p_category, ''), 'OTHER'), p_amount, coalesce(p_occurred_at, now()), p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', 'INCOME', 'amount', p_amount, 'category', p_category));

  return v_tx;
end;
$$;

create or replace function public.record_expense(
  p_amount      numeric,
  p_category    text,
  p_item_name   text,
  p_occurred_at timestamptz,
  p_description text,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.expense.create') then
    raise exception 'forbidden: finance.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.financial_transactions (type, category, amount, occurred_at, item_name, description, created_by)
  values ('EXPENSE', coalesce(nullif(p_category, ''), 'OTHER'), p_amount, coalesce(p_occurred_at, now()), p_item_name, p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', 'EXPENSE', 'amount', p_amount, 'category', p_category));

  return v_tx;
end;
$$;

-- >>> 0013_realtime_orders.sql

-- 0013 — Enable Realtime on the orders table
-- Nahla Cake Panel
--
-- Adds public.orders to the supabase_realtime publication so status changes are
-- broadcast to subscribed clients. Realtime still honors RLS: a client only
-- receives rows its SELECT policy allows. The orders table carries no financial
-- columns (those live in order_financials, which is NOT published), so nothing
-- sensitive is broadcast. Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- >>> 0014_finance_categories_departments.sql

-- 0014 — Finance module: departments, categories, permissions, shop_magasin role
-- Nahla Cake Panel — Finance expansion Phase 2

-- ---------------------------------------------------------------------------
-- Departments (configurable; seeds the fixed list)
-- ---------------------------------------------------------------------------
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text not null,
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.departments (key, name, sort) values
  ('SHOP',           'Shop / Magasin', 1),
  ('LABORATORY',     'Laboratory',     2),
  ('DELIVERY',       'Delivery',       3),
  ('ADMINISTRATION', 'Administration', 4),
  ('GENERAL',        'General',        5),
  ('INVESTMENT',     'Investment',     6)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Financial categories (configurable; subcategory tree)
-- ---------------------------------------------------------------------------
create table public.financial_categories (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  name       text not null,
  direction  text not null check (direction in ('INCOME', 'EXPENSE', 'BOTH')),
  parent_id  uuid references public.financial_categories(id) on delete set null,
  is_system  boolean not null default false,
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_fin_categories_parent on public.financial_categories(parent_id);

insert into public.financial_categories (key, name, direction, is_system, sort) values
  -- income
  ('ORDER_PAYMENT', 'Order payment',  'INCOME', true, 1),
  ('MAGASIN_SALE',  'Magasin sale',   'INCOME', true, 2),
  ('DELIVERY_FEE',  'Delivery fee',   'INCOME', true, 3),
  ('ASSET_SALE',    'Machine / asset sale', 'INCOME', true, 4),
  ('OTHER_INCOME',  'Other income',   'INCOME', true, 5),
  -- expense
  ('SHOP_RENT',     'Shop rent',        'EXPENSE', true, 10),
  ('LAB_RENT',      'Laboratory rent',  'EXPENSE', true, 11),
  ('ELECTRICITY',   'Electricity',      'EXPENSE', true, 12),
  ('GAS',           'Gas',              'EXPENSE', true, 13),
  ('WATER',         'Water',            'EXPENSE', true, 14),
  ('GOODS',         'Goods / supplies', 'EXPENSE', true, 15),
  ('MACHINES',      'Machines / equipment', 'EXPENSE', true, 16),
  ('CAR',           'Car expenses',     'EXPENSE', true, 17),
  ('PERSONAL',      'Daily personal expenses', 'EXPENSE', true, 18),
  ('INSURANCE',     'Insurance',        'EXPENSE', true, 19),
  ('TAXES',         'Taxes',            'EXPENSE', true, 20),
  ('PAYROLL',       'Employee payroll', 'EXPENSE', true, 21),
  -- both
  ('INVESTMENT',    'Investment',       'BOTH', true, 30),
  ('OTHER',         'Other',            'BOTH', true, 40)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- New permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('finance.reports.view',      'View financial reports'),
  ('finance.reverse',           'Reverse / correct transactions'),
  ('finance.categories.manage', 'Manage finance categories and departments'),
  ('magasin.view',              'Access the Magasin (shop) operational finance area'),
  ('magasin.sale.create',       'Record Magasin sales'),
  ('magasin.expense.create',    'Record Magasin expenses'),
  ('employees.view',            'View employees'),
  ('employees.manage',          'Manage employees'),
  ('payroll.view',              'View payroll and salary data'),
  ('payroll.manage',            'Manage payroll (rates, work records, periods)'),
  ('payroll.pay',               'Record advances and salary payments')
on conflict (key) do nothing;

-- Grant every new permission to the "main" role.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'finance.reports.view', 'finance.reverse', 'finance.categories.manage',
  'magasin.view', 'magasin.sale.create', 'magasin.expense.create',
  'employees.view', 'employees.manage',
  'payroll.view', 'payroll.manage', 'payroll.pay'
)
where r.key = 'main'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- shop_magasin role: RETIRED. Superseded by the "vendeur" role (seeded at the
-- end of this file). Intentionally not created here.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.departments          enable row level security;
alter table public.financial_categories enable row level security;

create policy "departments_select" on public.departments
  for select to authenticated
  using (
    public.has_permission('finance.view')
    or public.has_permission('finance.transactions.view')
    or public.has_permission('magasin.view')
  );
create policy "departments_write" on public.departments
  for all to authenticated
  using (public.has_permission('finance.categories.manage'))
  with check (public.has_permission('finance.categories.manage'));

create policy "financial_categories_select" on public.financial_categories
  for select to authenticated
  using (
    public.has_permission('finance.view')
    or public.has_permission('finance.transactions.view')
    or public.has_permission('magasin.view')
  );
create policy "financial_categories_write" on public.financial_categories
  for all to authenticated
  using (public.has_permission('finance.categories.manage'))
  with check (public.has_permission('finance.categories.manage'));

-- >>> 0015_ledger_extension.sql

-- 0015 — Central ledger extension: classification, balance, opening balance,
--        atomic post + reverse. Nahla Cake Panel — Finance expansion Phase 3.
--
-- financial_transactions stays append-only. Link columns to employees /
-- magasin_sales / payroll_* are added in their own later migrations (the tables
-- don't exist yet). Here we add classification + generic posting/reversal.

-- ---------------------------------------------------------------------------
-- New classification columns
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists department  text not null default 'GENERAL',
  add column if not exists source       text not null default 'OTHER',
  add column if not exists category_id  uuid references public.financial_categories(id),
  add column if not exists notes        text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fin_tx_source_chk'
  ) then
    alter table public.financial_transactions
      add constraint fin_tx_source_chk check (source in (
        'ORDER','MAGASIN','PAYROLL','PURCHASE','MACHINE','DELIVERY',
        'INVESTMENT','OPENING_BALANCE','REVERSAL','OTHER'
      ));
  end if;
end $$;

create index if not exists idx_fin_tx_category_id on public.financial_transactions(category_id);
create index if not exists idx_fin_tx_department  on public.financial_transactions(department);
create index if not exists idx_fin_tx_source      on public.financial_transactions(source);

-- Only ONE opening-balance row ever.
create unique index if not exists uq_fin_tx_opening_balance
  on public.financial_transactions ((source)) where source = 'OPENING_BALANCE';

-- ---------------------------------------------------------------------------
-- Backfill existing rows from the legacy `category` text
-- ---------------------------------------------------------------------------
update public.financial_transactions t set
  source = 'ORDER', department = 'SHOP',
  category_id = (select id from public.financial_categories where key = 'ORDER_PAYMENT')
where t.category in ('ORDER_ADVANCE', 'ORDER_FINAL');

update public.financial_transactions t set
  source = 'PURCHASE', department = 'SHOP',
  category_id = (select id from public.financial_categories where key = 'GOODS')
where t.category = 'PURCHASE';

update public.financial_transactions t set
  category_id = (select id from public.financial_categories where key = 'OTHER')
where t.category_id is null and t.type = 'EXPENSE';

update public.financial_transactions t set
  category_id = (select id from public.financial_categories where key = 'OTHER_INCOME')
where t.category_id is null and t.type = 'INCOME' and t.source <> 'OPENING_BALANCE';

-- ---------------------------------------------------------------------------
-- Derived balance (guarded)
-- ---------------------------------------------------------------------------
create or replace function public.finance_balance()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('finance.transactions.view') then
    raise exception 'forbidden: finance.transactions.view required';
  end if;
  return (
    select coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0)
    from public.financial_transactions
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Opening balance: single dedicated event. 0 clears it (removes the row).
-- ---------------------------------------------------------------------------
create or replace function public.set_opening_balance(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or not public.has_permission('finance.categories.manage') then
    raise exception 'forbidden: finance.categories.manage required';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'opening balance cannot be negative';
  end if;

  select id into v_id from public.financial_transactions where source = 'OPENING_BALANCE';

  if p_amount = 0 then
    if v_id is not null then delete from public.financial_transactions where id = v_id; end if;
  elsif v_id is null then
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, description, created_by)
    values
      ('INCOME', 'OPENING_BALANCE', p_amount, now(), 'OPENING_BALANCE', 'GENERAL', 'Opening balance', v_uid);
  else
    update public.financial_transactions set amount = p_amount where id = v_id;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, metadata)
  values (v_uid, 'finance.opening_balance.set', 'financial_transaction', jsonb_build_object('amount', p_amount));
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic atomic posting (income/expense with full classification + attachment)
-- ---------------------------------------------------------------------------
create or replace function public.post_transaction(
  p_type        text,
  p_amount      numeric,
  p_category_id uuid,
  p_department  text,
  p_source      text,
  p_occurred_at timestamptz,
  p_description text,
  p_order_id    uuid default null,
  p_notes       text default null,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
  v_key text;
begin
  if v_uid is null then raise exception 'forbidden'; end if;
  if p_type not in ('INCOME', 'EXPENSE') then raise exception 'invalid type: %', p_type; end if;
  if p_type = 'INCOME' and not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_type = 'EXPENSE' and not public.has_permission('finance.expense.create') then
    raise exception 'forbidden: finance.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select key into v_key from public.financial_categories where id = p_category_id;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, notes, created_by)
  values
    (p_type, coalesce(v_key, 'OTHER'), p_amount, coalesce(p_occurred_at, now()),
     coalesce(p_source, 'OTHER'), coalesce(p_department, 'GENERAL'), p_category_id, p_order_id,
     p_description, p_notes, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', p_type, 'amount', p_amount, 'source', p_source, 'department', p_department));

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reversal / correction (never edits/deletes the original)
-- ---------------------------------------------------------------------------
create or replace function public.reverse_transaction(p_txn_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  o     public.financial_transactions%rowtype;
  v_new uuid;
begin
  if v_uid is null or not public.has_permission('finance.reverse') then
    raise exception 'forbidden: finance.reverse required';
  end if;

  select * into o from public.financial_transactions where id = p_txn_id;
  if o.id is null then raise exception 'transaction not found'; end if;
  if o.source = 'REVERSAL' then raise exception 'cannot reverse a reversal'; end if;
  if o.source = 'OPENING_BALANCE' then raise exception 'cannot reverse the opening balance'; end if;
  if exists (select 1 from public.financial_transactions where reverses_transaction_id = p_txn_id) then
    raise exception 'transaction already reversed';
  end if;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id,
     description, reverses_transaction_id, created_by)
  values
    (case when o.type = 'INCOME' then 'EXPENSE' else 'INCOME' end,
     o.category, o.amount, now(), 'REVERSAL', o.department, o.category_id, o.order_id,
     'Reversal of transaction ' || p_txn_id::text, p_txn_id, v_uid)
  returning id into v_new;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.reverse', 'financial_transaction', v_new,
          jsonb_build_object('reverses', p_txn_id, 'amount', o.amount));

  return v_new;
end;
$$;

-- >>> 0016_finance_reports.sql

-- 0016 — Finance reporting: server-side aggregation RPCs
-- Nahla Cake Panel — Finance expansion Phase 4
--
-- All guarded by finance.transactions.view OR finance.reports.view. Period bounds
-- are [p_from, p_to) timestamptz (caller computes them in the business timezone).
-- OPENING_BALANCE rows are excluded from period income/expense (they belong to
-- the running balance, not to a period's activity). Reversal rows are included
-- (they are real opposite movements, keeping net consistent with the balance).

create or replace function public._finance_can_report()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('finance.transactions.view')
      or public.has_permission('finance.reports.view');
$$;

create or replace function public.finance_summary(p_from timestamptz, p_to timestamptz)
returns table (income numeric, expense numeric, net numeric, income_count int, expense_count int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      coalesce(sum(amount) filter (where type = 'INCOME'), 0),
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0),
      coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0),
      coalesce(count(*) filter (where type = 'INCOME'), 0)::int,
      coalesce(count(*) filter (where type = 'EXPENSE'), 0)::int
    from public.financial_transactions
    where source <> 'OPENING_BALANCE'
      and occurred_at >= p_from and occurred_at < p_to;
end;
$$;

create or replace function public.finance_by_category(p_from timestamptz, p_to timestamptz)
returns table (category_key text, category_name text, income numeric, expense numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      coalesce(fc.key, 'OTHER'),
      coalesce(fc.name, 'Other'),
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0)
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by fc.key, fc.name
    order by coalesce(sum(t.amount), 0) desc;
end;
$$;

create or replace function public.finance_by_department(p_from timestamptz, p_to timestamptz)
returns table (department text, income numeric, expense numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      t.department,
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0),
      coalesce(sum(case when t.type = 'INCOME' then t.amount else -t.amount end), 0)
    from public.financial_transactions t
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by t.department
    order by 4 desc;
end;
$$;

create or replace function public.finance_by_source(p_from timestamptz, p_to timestamptz)
returns table (source text, income numeric, expense numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      t.source,
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0),
      coalesce(sum(case when t.type = 'INCOME' then t.amount else -t.amount end), 0)
    from public.financial_transactions t
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by t.source
    order by 4 desc;
end;
$$;

-- >>> 0017_order_payments.sql

-- 0017 — Order payment integration
-- Nahla Cake Panel — Finance expansion Phase 5
--
-- record_order_payment posts INCOME (source=ORDER) for money ACTUALLY received
-- and advances order_financials.advance_payment (= total received to date).
-- record_delivery_fee posts the delivery fee as its own INCOME (source=DELIVERY),
-- once per order. Both SECURITY DEFINER + permission-checked; over-payment and
-- duplicate delivery-fee are prevented.

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount   numeric,
  p_kind     text  -- 'ADVANCE' | 'FINAL' | 'PAYMENT'
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
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_kind not in ('ADVANCE', 'FINAL', 'PAYMENT') then raise exception 'invalid payment kind'; end if;

  select o.order_number, f.total_amount, f.advance_payment
    into v_num, v_total, v_received
  from public.orders o
  join public.order_financials f on f.order_id = o.id
  where o.id = p_order_id
  for update;

  if v_num is null then raise exception 'order not found'; end if;
  if v_received + p_amount > v_total then
    raise exception 'payment exceeds the remaining amount';
  end if;

  select id into v_cat from public.financial_categories where key = 'ORDER_PAYMENT';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, created_by)
  values
    ('INCOME', 'ORDER_' || p_kind, p_amount, now(), 'ORDER', 'SHOP', v_cat, p_order_id,
     initcap(p_kind) || ' payment for ' || v_num, v_uid)
  returning id into v_tx;

  update public.order_financials
    set advance_payment = advance_payment + p_amount, updated_by = v_uid
  where order_id = p_order_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.order_payment', 'order', p_order_id,
          jsonb_build_object('amount', p_amount, 'kind', p_kind, 'order', v_num));

  return v_tx;
end;
$$;

create or replace function public.record_delivery_fee(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_num text;
  v_fee numeric;
  v_cat uuid;
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;

  select o.order_number, f.delivery_amount into v_num, v_fee
  from public.orders o
  join public.order_financials f on f.order_id = o.id
  where o.id = p_order_id;

  if v_num is null then raise exception 'order not found'; end if;
  if coalesce(v_fee, 0) <= 0 then raise exception 'no delivery fee on this order'; end if;
  if exists (
    select 1 from public.financial_transactions
    where order_id = p_order_id and source = 'DELIVERY'
  ) then
    raise exception 'delivery fee already recorded';
  end if;

  select id into v_cat from public.financial_categories where key = 'DELIVERY_FEE';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, order_id, description, created_by)
  values
    ('INCOME', 'DELIVERY_FEE', v_fee, now(), 'DELIVERY', 'DELIVERY', v_cat, p_order_id,
     'Delivery fee for ' || v_num, v_uid)
  returning id into v_tx;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.delivery_fee', 'order', p_order_id,
          jsonb_build_object('amount', v_fee, 'order', v_num));

  return v_tx;
end;
$$;

-- >>> 0018_magasin_sales.sql

-- 0018 — MAGASIN sales (operational shop entry → central ledger)
-- Nahla Cake Panel — Finance expansion Phase 6
--
-- Shop staff (magasin.sale.create) record sales; the SECURITY DEFINER function
-- recomputes totals and posts ONE INCOME row to the central ledger. The ledger
-- SELECT policy still requires finance.transactions.view, so shop staff can
-- write without reading the treasury. Their daily summary comes from a scoped
-- SECURITY DEFINER function.

create table public.magasin_sales (
  id           uuid primary key default gen_random_uuid(),
  sale_date    date not null,
  department   text not null default 'SHOP',
  total_amount numeric(12,2) not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index idx_magasin_sales_date on public.magasin_sales(sale_date);

create table public.magasin_sale_lines (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.magasin_sales(id) on delete cascade,
  product_name text not null,
  quantity     numeric(12,3) not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  line_total   numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored
);
create index idx_magasin_sale_lines_sale on public.magasin_sale_lines(sale_id);

-- Link ledger rows to the originating sale
alter table public.financial_transactions
  add column if not exists magasin_sale_id uuid references public.magasin_sales(id);
create index if not exists idx_fin_tx_magasin_sale on public.financial_transactions(magasin_sale_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.magasin_sales      enable row level security;
alter table public.magasin_sale_lines enable row level security;

create policy "magasin_sales_select" on public.magasin_sales
  for select to authenticated
  using (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view'));
create policy "magasin_sales_insert" on public.magasin_sales
  for insert to authenticated
  with check (public.has_permission('magasin.sale.create'));

create policy "magasin_sale_lines_select" on public.magasin_sale_lines
  for select to authenticated
  using (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view'));
create policy "magasin_sale_lines_insert" on public.magasin_sale_lines
  for insert to authenticated
  with check (public.has_permission('magasin.sale.create'));

-- ---------------------------------------------------------------------------
-- Record a sale: recompute totals server-side, post one INCOME to the ledger
-- ---------------------------------------------------------------------------
create or replace function public.record_magasin_sale(p_sale_date date, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_sale  uuid;
  v_total numeric(12,2);
  v_cat   uuid;
  v_line  jsonb;
begin
  if v_uid is null or not public.has_permission('magasin.sale.create') then
    raise exception 'forbidden: magasin.sale.create required';
  end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'at least one product line is required';
  end if;

  insert into public.magasin_sales (sale_date, department, total_amount, created_by)
  values (coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'SHOP', 0, v_uid)
  returning id into v_sale;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    if coalesce((v_line->>'quantity')::numeric, 0) <= 0 then
      raise exception 'quantity must be positive';
    end if;
    insert into public.magasin_sale_lines (sale_id, product_name, quantity, unit_price)
    values (
      v_sale,
      coalesce(nullif(trim(v_line->>'product_name'), ''), 'Item'),
      (v_line->>'quantity')::numeric,
      coalesce((v_line->>'unit_price')::numeric, 0)
    );
  end loop;

  select coalesce(sum(line_total), 0) into v_total
  from public.magasin_sale_lines where sale_id = v_sale;

  update public.magasin_sales set total_amount = v_total where id = v_sale;

  if v_total > 0 then
    select id into v_cat from public.financial_categories where key = 'MAGASIN_SALE';
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, magasin_sale_id, description, created_by)
    values
      ('INCOME', 'MAGASIN_SALE', v_total, now(), 'MAGASIN', 'SHOP', v_cat, v_sale,
       'Magasin sale ' || to_char(coalesce(p_sale_date, (now() at time zone 'Africa/Algiers')::date), 'YYYY-MM-DD'), v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.sale.create', 'magasin_sale', v_sale, jsonb_build_object('total', v_total));

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoped daily summary for the MAGASIN screen (no treasury exposure)
-- ---------------------------------------------------------------------------
create or replace function public.magasin_daily_summary(p_date date)
returns table (sales numeric, expenses numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then
    raise exception 'forbidden';
  end if;
  return query
    select
      coalesce(sum(amount) filter (where type = 'INCOME'), 0),
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0),
      coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0)
    from public.financial_transactions
    where source = 'MAGASIN'
      and (occurred_at at time zone 'Africa/Algiers')::date = p_date;
end;
$$;

-- >>> 0019_magasin_expenses.sql

-- 0019 — MAGASIN expenses (operational shop spending → central ledger)
-- Nahla Cake Panel — Finance expansion Phase 7
--
-- Shop staff (magasin.expense.create) record shop spending; posted to the central
-- ledger as EXPENSE (source=MAGASIN, dept SHOP). Listing for the shop screen is a
-- scoped SECURITY DEFINER function so staff never read the whole ledger.

create or replace function public.record_magasin_expense(
  p_amount      numeric,
  p_category_id uuid,
  p_description text,
  p_occurred_at timestamptz,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('magasin.expense.create') then
    raise exception 'forbidden: magasin.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select key into v_key from public.financial_categories where id = p_category_id;

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, description, created_by)
  values
    ('EXPENSE', coalesce(v_key, 'OTHER'), p_amount, coalesce(p_occurred_at, now()),
     'MAGASIN', 'SHOP', p_category_id, p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'magasin.expense.create', 'financial_transaction', v_tx,
          jsonb_build_object('amount', p_amount, 'category', v_key));

  return v_tx;
end;
$$;

-- Scoped list of a day's MAGASIN expenses for the shop screen.
create or replace function public.magasin_day_expenses(p_date date)
returns table (id uuid, amount numeric, category text, description text, occurred_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.has_permission('magasin.view') or public.has_permission('finance.transactions.view')) then
    raise exception 'forbidden';
  end if;
  return query
    select t.id, t.amount,
           coalesce(fc.name, t.category),
           t.description, t.occurred_at
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source = 'MAGASIN' and t.type = 'EXPENSE'
      and (t.occurred_at at time zone 'Africa/Algiers')::date = p_date
    order by t.occurred_at desc;
end;
$$;

-- >>> 0020_payroll_schema.sql

-- 0020 — Payroll architecture: employees, rates, periods, records, advances,
--        piece work. Nahla Cake Panel — Finance expansion Phase 10.

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
create table public.employees (
  id             uuid primary key default gen_random_uuid(),
  code           text unique,
  full_name      text not null,
  phone          text,
  job            text,
  department     text not null default 'LABORATORY',
  payment_method text not null check (payment_method in ('PIECE_BASED', 'DAILY', 'WEEKLY', 'MONTHLY')),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_employees_active on public.employees(is_active);
create trigger trg_employees_updated
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rates (flexible: employee/job × work_category × product_size × effective date)
-- product_size is a free-text label (e.g. "20 CM").
-- ---------------------------------------------------------------------------
create table public.payroll_rates (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references public.employees(id) on delete cascade,
  job            text,
  work_category  text,
  product_size   text,
  rate           numeric(12,2) not null check (rate >= 0),
  rate_kind      text not null check (rate_kind in ('PIECE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  effective_from date not null default now(),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index idx_payroll_rates_emp on public.payroll_rates(employee_id);

-- ---------------------------------------------------------------------------
-- Payroll periods
-- ---------------------------------------------------------------------------
create table public.payroll_periods (
  id          uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('DAILY', 'WEEKLY', 'MONTHLY')),
  start_date  date not null,
  end_date    date not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (period_type, start_date, end_date)
);

-- ---------------------------------------------------------------------------
-- Payroll records (one per employee per period; state machine)
-- ---------------------------------------------------------------------------
create table public.payroll_records (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  period_id      uuid not null references public.payroll_periods(id) on delete cascade,
  payment_method text not null,
  gross_amount   numeric(12,2) not null default 0,
  advances_total numeric(12,2) not null default 0,
  adjustments    numeric(12,2) not null default 0,
  paid_amount    numeric(12,2) not null default 0,
  remaining      numeric(12,2) generated always as
                   (gross_amount + adjustments - advances_total - paid_amount) stored,
  status         text not null default 'DRAFT'
                   check (status in ('DRAFT', 'CALCULATED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, period_id)
);
create index idx_payroll_records_emp on public.payroll_records(employee_id);
create trigger trg_payroll_records_updated
  before update on public.payroll_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Advances (never overwritten; multiple per period)
-- ---------------------------------------------------------------------------
create table public.payroll_advances (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  amount            numeric(12,2) not null check (amount > 0),
  advance_date      date not null default now(),
  payroll_record_id uuid references public.payroll_records(id) on delete set null,
  transaction_id    uuid references public.financial_transactions(id),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);
create index idx_payroll_advances_emp on public.payroll_advances(employee_id);

-- ---------------------------------------------------------------------------
-- Piece work records (store inputs, not just totals)
-- ---------------------------------------------------------------------------
create table public.piece_work_records (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees(id) on delete cascade,
  work_date         date not null,
  order_id          uuid references public.orders(id),
  work_category     text,
  product_size      text,
  quantity          numeric(12,3) not null check (quantity > 0),
  applied_rate      numeric(12,2) not null check (applied_rate >= 0),
  amount            numeric(12,2) generated always as (round(quantity * applied_rate, 2)) stored,
  payroll_record_id uuid references public.payroll_records(id) on delete set null,
  entered_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now()
);
create index idx_piece_work_emp on public.piece_work_records(employee_id);
create index idx_piece_work_date on public.piece_work_records(work_date);

-- ---------------------------------------------------------------------------
-- Ledger link columns (now that the tables exist)
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column if not exists employee_id       uuid references public.employees(id),
  add column if not exists payroll_record_id uuid references public.payroll_records(id),
  add column if not exists payroll_advance_id uuid references public.payroll_advances(id);
create index if not exists idx_fin_tx_employee on public.financial_transactions(employee_id);
create index if not exists idx_fin_tx_payroll_record on public.financial_transactions(payroll_record_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.employees          enable row level security;
alter table public.payroll_rates      enable row level security;
alter table public.payroll_periods    enable row level security;
alter table public.payroll_records    enable row level security;
alter table public.payroll_advances   enable row level security;
alter table public.piece_work_records enable row level security;

create policy "employees_select" on public.employees for select to authenticated
  using (public.has_permission('employees.view') or public.has_permission('payroll.view'));
create policy "employees_write" on public.employees for all to authenticated
  using (public.has_permission('employees.manage')) with check (public.has_permission('employees.manage'));

create policy "payroll_rates_select" on public.payroll_rates for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_rates_write" on public.payroll_rates for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_periods_select" on public.payroll_periods for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_periods_write" on public.payroll_periods for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_records_select" on public.payroll_records for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "payroll_records_write" on public.payroll_records for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

create policy "payroll_advances_select" on public.payroll_advances for select to authenticated
  using (public.has_permission('payroll.view'));
-- advances/payments are written through SECURITY DEFINER functions in later phases

create policy "piece_work_select" on public.piece_work_records for select to authenticated
  using (public.has_permission('payroll.view'));
create policy "piece_work_write" on public.piece_work_records for all to authenticated
  using (public.has_permission('payroll.manage')) with check (public.has_permission('payroll.manage'));

-- >>> 0021_piece_work.sql

-- 0021 — Piece-based payroll: rate resolution + work records
-- Nahla Cake Panel — Finance expansion Phase 11

-- Resolve the most specific active rate for a piece of work.
-- Specificity: employee-specific > job-generic; matching size/category > wildcard;
-- latest effective_from wins.
create or replace function public.resolve_rate(
  p_employee_id  uuid,
  p_work_category text,
  p_product_size  text,
  p_work_date     date,
  p_rate_kind     text default 'PIECE'
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select r.rate
  from public.payroll_rates r
  where r.is_active
    and r.rate_kind = p_rate_kind
    and r.effective_from <= p_work_date
    and (r.employee_id = p_employee_id or r.employee_id is null)
    and (r.work_category is null or r.work_category = p_work_category)
    and (r.product_size is null or r.product_size = p_product_size)
  order by (r.employee_id = p_employee_id) desc nulls last,
           (r.product_size = p_product_size) desc nulls last,
           (r.work_category = p_work_category) desc nulls last,
           r.effective_from desc
  limit 1;
$$;

-- Add a piece-work record with the resolved rate stored (auditable).
create or replace function public.add_work_record(
  p_employee_id   uuid,
  p_work_date     date,
  p_order_id      uuid,
  p_work_category text,
  p_product_size  text,
  p_quantity      numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_rate numeric;
  v_id   uuid;
  v_date date := coalesce(p_work_date, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'quantity must be positive'; end if;

  v_rate := public.resolve_rate(p_employee_id, p_work_category, p_product_size, v_date, 'PIECE');
  if v_rate is null then
    raise exception 'no matching piece rate configured for this work';
  end if;

  insert into public.piece_work_records
    (employee_id, work_date, order_id, work_category, product_size, quantity, applied_rate, entered_by)
  values
    (p_employee_id, v_date, p_order_id, p_work_category, p_product_size, p_quantity, v_rate, v_uid)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.work_record.create', 'piece_work_record', v_id,
          jsonb_build_object('employee', p_employee_id, 'quantity', p_quantity, 'rate', v_rate));

  return v_id;
end;
$$;

-- >>> 0022_payroll_calc.sql

-- 0022 — Payroll periods + deterministic calculation
-- Nahla Cake Panel — Finance expansion Phase 12

create or replace function public.create_payroll_period(
  p_type  text,
  p_start date,
  p_end   date,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;
  if p_type not in ('DAILY', 'WEEKLY', 'MONTHLY') then raise exception 'invalid period type'; end if;
  if p_end < p_start then raise exception 'end date is before start date'; end if;

  insert into public.payroll_periods (period_type, start_date, end_date, label)
  values (p_type, p_start, p_end, p_label)
  on conflict (period_type, start_date, end_date) do update set label = excluded.label
  returning id into v_id;
  return v_id;
end;
$$;

-- Compute gross for an employee/period per their payment method.
-- PIECE: sum of the period's work records (linked to this record).
-- DAILY: daily rate × p_worked_days.
-- WEEKLY/MONTHLY: the resolved period rate.
-- Re-runnable while DRAFT/CALCULATED; locked once PARTIALLY_PAID/PAID/CANCELLED.
create or replace function public.calculate_payroll(
  p_employee_id uuid,
  p_period_id   uuid,
  p_worked_days int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_method text;
  v_start  date;
  v_end    date;
  v_rec    uuid;
  v_status text;
  v_gross  numeric;
  v_rate   numeric;
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;

  select payment_method into v_method from public.employees where id = p_employee_id;
  if v_method is null then raise exception 'employee not found'; end if;
  select start_date, end_date into v_start, v_end from public.payroll_periods where id = p_period_id;
  if v_start is null then raise exception 'period not found'; end if;

  select id, status into v_rec, v_status
  from public.payroll_records where employee_id = p_employee_id and period_id = p_period_id;

  if v_rec is not null and v_status in ('PARTIALLY_PAID', 'PAID', 'CANCELLED') then
    raise exception 'payroll is %; cannot recalculate', v_status;
  end if;
  if v_rec is null then
    insert into public.payroll_records (employee_id, period_id, payment_method, created_by)
    values (p_employee_id, p_period_id, v_method, v_uid)
    returning id into v_rec;
  end if;

  if v_method = 'PIECE_BASED' then
    update public.piece_work_records set payroll_record_id = v_rec
    where employee_id = p_employee_id
      and payroll_record_id is null
      and work_date between v_start and v_end;
    select coalesce(sum(amount), 0) into v_gross
    from public.piece_work_records where payroll_record_id = v_rec;
  elsif v_method = 'DAILY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'DAILY');
    v_gross := coalesce(v_rate, 0) * coalesce(p_worked_days, 0);
  elsif v_method = 'WEEKLY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'WEEKLY');
    v_gross := coalesce(v_rate, 0);
  else
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'MONTHLY');
    v_gross := coalesce(v_rate, 0);
  end if;

  update public.payroll_records
    set gross_amount = v_gross,
        status = case when status = 'DRAFT' then 'CALCULATED' else status end,
        updated_at = now()
  where id = v_rec;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.calculate', 'payroll_record', v_rec,
          jsonb_build_object('gross', v_gross, 'method', v_method));

  return v_rec;
end;
$$;

-- >>> 0023_payroll_advances.sql

-- 0023 — Payroll advances + advances-aware recalculation
-- Nahla Cake Panel — Finance expansion Phase 13

-- Record an advance: real EXPENSE to the ledger + advance row, linked to the
-- employee's current open payroll record; bumps that record's advances_total so
-- remaining drops. Advances are never overwritten.
create or replace function public.record_payroll_advance(
  p_employee_id uuid,
  p_amount      numeric,
  p_advance_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_rec  uuid;
  v_dept text;
  v_name text;
  v_cat  uuid;
  v_tx   uuid;
  v_adv  uuid;
  v_date date := coalesce(p_advance_date, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select department, full_name into v_dept, v_name from public.employees where id = p_employee_id;
  if v_name is null then raise exception 'employee not found'; end if;

  select id into v_rec from public.payroll_records
  where employee_id = p_employee_id and status in ('DRAFT', 'CALCULATED', 'PARTIALLY_PAID')
  order by created_at desc limit 1;

  select id into v_cat from public.financial_categories where key = 'PAYROLL';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, payroll_record_id, description, created_by)
  values
    ('EXPENSE', 'PAYROLL_ADVANCE', p_amount, v_date::timestamptz, 'PAYROLL', coalesce(v_dept, 'GENERAL'),
     v_cat, p_employee_id, v_rec, 'Advance for ' || v_name, v_uid)
  returning id into v_tx;

  insert into public.payroll_advances (employee_id, amount, advance_date, payroll_record_id, transaction_id, created_by)
  values (p_employee_id, p_amount, v_date, v_rec, v_tx, v_uid)
  returning id into v_adv;

  update public.financial_transactions set payroll_advance_id = v_adv where id = v_tx;

  if v_rec is not null then
    update public.payroll_records
      set advances_total = (select coalesce(sum(amount), 0) from public.payroll_advances where payroll_record_id = v_rec)
    where id = v_rec;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.advance.create', 'payroll_advance', v_adv,
          jsonb_build_object('employee', p_employee_id, 'amount', p_amount));

  return v_tx;
end;
$$;

-- Redefine calculate_payroll to also link period advances and keep advances_total.
create or replace function public.calculate_payroll(
  p_employee_id uuid,
  p_period_id   uuid,
  p_worked_days int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_method text;
  v_start  date;
  v_end    date;
  v_rec    uuid;
  v_status text;
  v_gross  numeric;
  v_rate   numeric;
  v_adv    numeric;
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;

  select payment_method into v_method from public.employees where id = p_employee_id;
  if v_method is null then raise exception 'employee not found'; end if;
  select start_date, end_date into v_start, v_end from public.payroll_periods where id = p_period_id;
  if v_start is null then raise exception 'period not found'; end if;

  select id, status into v_rec, v_status
  from public.payroll_records where employee_id = p_employee_id and period_id = p_period_id;

  if v_rec is not null and v_status in ('PARTIALLY_PAID', 'PAID', 'CANCELLED') then
    raise exception 'payroll is %; cannot recalculate', v_status;
  end if;
  if v_rec is null then
    insert into public.payroll_records (employee_id, period_id, payment_method, created_by)
    values (p_employee_id, p_period_id, v_method, v_uid)
    returning id into v_rec;
  end if;

  if v_method = 'PIECE_BASED' then
    update public.piece_work_records set payroll_record_id = v_rec
    where employee_id = p_employee_id and payroll_record_id is null
      and work_date between v_start and v_end;
    select coalesce(sum(amount), 0) into v_gross
    from public.piece_work_records where payroll_record_id = v_rec;
  elsif v_method = 'DAILY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'DAILY');
    v_gross := coalesce(v_rate, 0) * coalesce(p_worked_days, 0);
  elsif v_method = 'WEEKLY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'WEEKLY');
    v_gross := coalesce(v_rate, 0);
  else
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'MONTHLY');
    v_gross := coalesce(v_rate, 0);
  end if;

  -- Link any unlinked advances dated within the period.
  update public.payroll_advances set payroll_record_id = v_rec
  where employee_id = p_employee_id and payroll_record_id is null
    and advance_date between v_start and v_end;
  select coalesce(sum(amount), 0) into v_adv
  from public.payroll_advances where payroll_record_id = v_rec;

  update public.payroll_records
    set gross_amount = v_gross,
        advances_total = v_adv,
        status = case when status = 'DRAFT' then 'CALCULATED' else status end,
        updated_at = now()
  where id = v_rec;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.calculate', 'payroll_record', v_rec,
          jsonb_build_object('gross', v_gross, 'advances', v_adv, 'method', v_method));

  return v_rec;
end;
$$;

-- >>> 0024_payroll_payment.sql

-- 0024 — Salary payments: post to ledger + advance the status machine
-- Nahla Cake Panel — Finance expansion Phase 14

create or replace function public.record_payroll_payment(
  p_record_id uuid,
  p_amount    numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_emp       uuid;
  v_name      text;
  v_dept      text;
  v_gross     numeric;
  v_adv       numeric;
  v_adj       numeric;
  v_paid      numeric;
  v_status    text;
  v_remaining numeric;
  v_cat       uuid;
  v_tx        uuid;
  v_new_paid  numeric;
  v_new_status text;
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select pr.employee_id, e.full_name, e.department,
         pr.gross_amount, pr.advances_total, pr.adjustments, pr.paid_amount, pr.status
    into v_emp, v_name, v_dept, v_gross, v_adv, v_adj, v_paid, v_status
  from public.payroll_records pr
  join public.employees e on e.id = pr.employee_id
  where pr.id = p_record_id
  for update;

  if v_emp is null then raise exception 'payroll record not found'; end if;
  if v_status not in ('CALCULATED', 'PARTIALLY_PAID') then
    raise exception 'payroll is %; not payable', v_status;
  end if;

  v_remaining := v_gross + v_adj - v_adv - v_paid;
  if p_amount > v_remaining then
    raise exception 'payment exceeds the remaining amount';
  end if;

  select id into v_cat from public.financial_categories where key = 'PAYROLL';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, payroll_record_id, description, created_by)
  values
    ('EXPENSE', 'PAYROLL_PAYMENT', p_amount, now(), 'PAYROLL', coalesce(v_dept, 'GENERAL'),
     v_cat, v_emp, p_record_id, 'Salary payment for ' || v_name, v_uid)
  returning id into v_tx;

  v_new_paid := v_paid + p_amount;
  v_new_status := case when (v_gross + v_adj - v_adv - v_new_paid) <= 0 then 'PAID' else 'PARTIALLY_PAID' end;

  update public.payroll_records
    set paid_amount = v_new_paid, status = v_new_status, updated_at = now()
  where id = p_record_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.payment.create', 'payroll_record', p_record_id,
          jsonb_build_object('amount', p_amount, 'employee', v_emp, 'status', v_new_status));

  return v_tx;
end;
$$;

-- >>> 0025_reports_category_id.sql

-- 0025 — Add category_id to the category breakdown (for drill-down)
-- Nahla Cake Panel — Finance expansion Phase 15/16

drop function if exists public.finance_by_category(timestamptz, timestamptz);

create function public.finance_by_category(p_from timestamptz, p_to timestamptz)
returns table (category_id uuid, category_key text, category_name text, income numeric, expense numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      fc.id,
      coalesce(fc.key, 'OTHER'),
      coalesce(fc.name, 'Other'),
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0)
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by fc.id, fc.key, fc.name
    order by coalesce(sum(t.amount), 0) desc;
end;
$$;

-- >>> seed.sql

-- seed.sql — permission catalog, base roles, and role→permission mappings
-- Nahla Cake Panel. Idempotent: safe to run multiple times.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('dashboard.view',              'View the dashboard'),
  ('shop.view',                   'Access the shop / POS'),
  ('orders.view',                 'View orders'),
  ('orders.create',               'Create orders'),
  ('orders.edit',                 'Edit orders'),
  ('orders.delete',               'Delete orders'),
  ('laboratory.view',             'Access the laboratory'),
  ('production.update',           'Update production status / ready-made output'),
  ('calendar.view',               'View the annual calendar'),
  ('delivery.view',               'View deliveries'),
  ('delivery.update',             'Update delivery status'),
  ('finance.view',                'Access finance area'),
  ('finance.income.create',       'Record income'),
  ('finance.expense.create',      'Record expenses'),
  ('finance.transactions.view',   'View financial transactions and balance'),
  ('finance.attachments.view',    'View financial attachments'),
  ('users.view',                  'View users'),
  ('users.create',                'Create users'),
  ('users.edit',                  'Edit users'),
  ('users.delete',                'Delete users'),
  ('roles.view',                  'View roles'),
  ('roles.create',                'Create roles'),
  ('roles.edit',                  'Edit roles'),
  ('permissions.manage',          'Manage permissions'),
  ('settings.manage',             'Manage settings and view audit log')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Job roles. The old base roles (main / operations / shop_magasin) were retired
-- and must NOT be recreated here — they are superseded by the roles below.
-- ---------------------------------------------------------------------------
insert into public.roles (key, name, description, is_system) values
  ('admin',       'Admin',       'Full operational and financial access', false),
  ('preparateur', 'Préparateur', 'Operations — cake preparation', false),
  ('maskage',     'Maskage',     'Operations — masking / coating', false),
  ('finition',    'Finition',    'Operations — finishing / decoration', false),
  ('vendeur',     'Vendeur',     'Shop (Magasin) — sales counter', false)
on conflict (key) do nothing;

-- admin role: every permission
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- preparateur / maskage / finition: operational permissions only
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.key in (
    'dashboard.view', 'shop.view',
    'orders.view', 'orders.create', 'orders.edit',
    'laboratory.view', 'production.update',
    'calendar.view',
    'delivery.view', 'delivery.update',
    'products.view'
  )
where r.key in ('preparateur', 'maskage', 'finition')
on conflict do nothing;

-- vendeur: shop / magasin operational permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p
  on p.key in (
    'shop.view',
    'magasin.view', 'magasin.sale.create', 'magasin.expense.create',
    'products.view'
  )
where r.key = 'vendeur'
on conflict do nothing;
