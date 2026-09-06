-- 0028 — Job roles (self-contained; supersede the old base roles)
-- Nahla Cake Panel
--
-- The original base roles (main / operations / shop_magasin) were retired. These
-- job roles replace them and define their permissions explicitly, so they do not
-- depend on any base role existing:
--   Admin                              -> every permission
--   Préparateur / Maskage / Finition   -> operational permissions
--   Vendeur                            -> shop / magasin operational permissions
-- Created as custom (non-system) roles so they can be edited/deleted from /roles.

insert into public.roles (key, name, description, is_system) values
  ('admin',       'Admin',       'Full operational and financial access', false),
  ('preparateur', 'Préparateur', 'Operations — cake preparation', false),
  ('maskage',     'Maskage',     'Operations — masking / coating', false),
  ('finition',    'Finition',    'Operations — finishing / decoration', false),
  ('vendeur',     'Vendeur',     'Shop (Magasin) — sales counter', false)
on conflict (key) do nothing;

-- Admin = every permission
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- Préparateur / Maskage / Finition = operational permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'dashboard.view', 'shop.view',
  'orders.view', 'orders.create', 'orders.edit',
  'laboratory.view', 'production.update',
  'calendar.view',
  'delivery.view', 'delivery.update',
  'products.view'
)
where r.key in ('preparateur', 'maskage', 'finition')
on conflict do nothing;

-- Vendeur = shop / magasin operational permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'shop.view',
  'magasin.view', 'magasin.sale.create', 'magasin.expense.create',
  'products.view'
)
where r.key = 'vendeur'
on conflict do nothing;
