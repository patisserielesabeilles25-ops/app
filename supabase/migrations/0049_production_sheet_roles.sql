-- 0049 — Role-based visibility for production sheets
-- Nahla Cake Panel
--
-- Sheet access is decided by role:
--   * maskage      → the Masquage sheet only
--   * preparateur  → the Préparation sheet only
--   * admin (Master) → every sheet of every worker
-- Workers only ever see their OWN rows (RLS own-policies). This tightens the
-- earlier supervisor read policy so ONLY masters — not every production.update
-- holder — can read other workers' sheets.

-- Role keys held by the current user (mirrors my_permissions()).
create or replace function public.my_role_keys()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select r.key
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;
grant execute on function public.my_role_keys() to authenticated;

-- True when the current user holds the admin (Master) role.
create or replace function public.is_master()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.key = 'admin'
  );
$$;
grant execute on function public.is_master() to authenticated;

-- Only masters may read other workers' sheets (own rows stay covered by
-- production_logs_own_select).
drop policy if exists "production_logs_supervisor_select" on public.production_logs;
create policy "production_logs_master_select" on public.production_logs
  for select to authenticated using (public.is_master());
