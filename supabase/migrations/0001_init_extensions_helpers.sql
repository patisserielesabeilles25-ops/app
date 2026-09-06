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
