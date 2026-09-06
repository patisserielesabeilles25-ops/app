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

-- ---------------------------------------------------------------------------
-- admin role: every permission
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- preparateur / maskage / finition: operational permissions only
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- vendeur: shop / magasin operational permissions
-- ---------------------------------------------------------------------------
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
