-- 0029 — Custom order statuses that link to the hardcoded canonical statuses
-- Nahla Cake Panel
--
-- The canonical statuses (NOUVEAU / EN_PREPARATION / EN_MASKAGE / EN_FINITION /
-- READY / DELIVERED / RETURNED) live in application code and are fixed. This
-- table stores user-defined custom statuses, each linked to one canonical key.

create table public.custom_statuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  canonical  text not null check (canonical in (
               'NOUVEAU', 'EN_PREPARATION', 'EN_MASKAGE', 'EN_FINITION',
               'READY', 'DELIVERED', 'RETURNED'
             )),
  is_active  boolean not null default true,
  sort       int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_custom_statuses_canonical on public.custom_statuses(canonical);

alter table public.custom_statuses enable row level security;

-- Readable by anyone who manages settings or can view orders (labels are not
-- sensitive; this keeps them usable in the order UI later). Writes are admin-only.
create policy "custom_statuses_select" on public.custom_statuses
  for select to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('orders.view'));
create policy "custom_statuses_write" on public.custom_statuses
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));
