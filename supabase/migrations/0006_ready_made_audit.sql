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
