-- ============================================================
-- Nahla Cake Panel — Finance Phase 2 (categories, departments,
-- new permissions, shop_magasin role). Run in Supabase SQL Editor.
-- Idempotent.
-- ============================================================

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
-- shop_magasin role: operational Magasin only (write-without-read on the ledger)
-- ---------------------------------------------------------------------------
insert into public.roles (key, name, description, is_system) values
  ('shop_magasin', 'Shop (Magasin)', 'Record shop sales and expenses into the central ledger without treasury access', true)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'shop.view', 'magasin.view', 'magasin.sale.create', 'magasin.expense.create'
)
where r.key = 'shop_magasin'
on conflict do nothing;

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
