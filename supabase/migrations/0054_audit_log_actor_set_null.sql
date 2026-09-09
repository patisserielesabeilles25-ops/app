-- 0054 — Let users be deleted without losing audit history
-- Nahla Cake Panel
--
-- audit_log.actor_id referenced profiles with NO ACTION, so deleting a user who
-- had performed any action failed ("Could not delete the user"). Switch it to
-- ON DELETE SET NULL: the audit entries survive (actor becomes "Système"),
-- and the user can be removed.

do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.audit_log'::regclass
    and contype = 'f'
    and confrelid = 'public.profiles'::regclass;
  if c is not null then
    execute format('alter table public.audit_log drop constraint %I', c);
  end if;
  alter table public.audit_log
    add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
end $$;
