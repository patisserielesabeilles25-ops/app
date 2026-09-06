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
