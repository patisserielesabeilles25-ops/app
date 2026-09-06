-- 0027 — Product catalog (add / edit / delete products)
-- Nahla Cake Panel
--
-- A simple catalog of sellable products with diameter, purchase price
-- (prix d'achat), selling price (prix de vente) and an optional private photo.
-- Photos live in the private `product-photos` bucket; the browser never touches
-- storage directly (upload via the service role, download via signed URLs).

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  diameter_cm    numeric not null check (diameter_cm > 0),
  purchase_price numeric not null default 0 check (purchase_price >= 0),
  selling_price  numeric not null default 0 check (selling_price >= 0),
  photo_bucket   text,
  photo_path     text,
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_products_active on public.products(is_active);
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('products.view',   'View the product catalog'),
  ('products.manage', 'Add, edit, and delete products')
on conflict (key) do nothing;

-- main: both. operations + shop_magasin: view only.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('products.view', 'products.manage')
where r.key = 'main'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'products.view'
where r.key in ('operations', 'shop_magasin')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;

create policy "products_select" on public.products
  for select to authenticated
  using (public.has_permission('products.view'));
create policy "products_insert" on public.products
  for insert to authenticated
  with check (public.has_permission('products.manage'));
create policy "products_update" on public.products
  for update to authenticated
  using (public.has_permission('products.manage'))
  with check (public.has_permission('products.manage'));
create policy "products_delete" on public.products
  for delete to authenticated
  using (public.has_permission('products.manage'));

-- ---------------------------------------------------------------------------
-- Private storage bucket for product photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', false)
on conflict (id) do nothing;
