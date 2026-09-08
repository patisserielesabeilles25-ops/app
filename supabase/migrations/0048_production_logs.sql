-- 0048 — Per-user weekly production logs
-- Nahla Cake Panel
--
-- Each worker fills their OWN weekly sheet (MASQUAGE / PREPARATION), entering
-- the number of pieces done per size row, per weekday (Sat..Fri = 0..6).
-- Users read & write only their own rows; payroll viewers can read everyone's.

create table if not exists public.production_logs (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  week_start date not null,                                   -- Saturday of the week
  sheet      text not null check (sheet in ('MASQUAGE', 'PREPARATION')),
  row_key    text not null,
  day        smallint not null check (day between 0 and 6),   -- 0 = Saturday .. 6 = Friday
  qty        integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (profile_id, week_start, sheet, row_key, day)
);

create index if not exists idx_production_logs_lookup
  on public.production_logs(profile_id, week_start);

alter table public.production_logs enable row level security;

-- Own rows: full access.
create policy "production_logs_own_select" on public.production_logs
  for select to authenticated using (profile_id = auth.uid());
create policy "production_logs_own_insert" on public.production_logs
  for insert to authenticated with check (profile_id = auth.uid());
create policy "production_logs_own_update" on public.production_logs
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "production_logs_own_delete" on public.production_logs
  for delete to authenticated using (profile_id = auth.uid());

-- Payroll/production supervisors can review everyone's sheets (read-only).
create policy "production_logs_supervisor_select" on public.production_logs
  for select to authenticated
  using (public.has_permission('payroll.view') or public.has_permission('production.update'));
