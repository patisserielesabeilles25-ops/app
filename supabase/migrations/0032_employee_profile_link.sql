-- 0032 — Link a payroll employee to a user account
-- Nahla Cake Panel
--
-- Lets the "Mode de rémunération" section on the Users page attach a real
-- payroll employee (with a payment method + rate) to a user, so payments are
-- tracked through the existing payroll module (periods, records, payments).

alter table public.employees
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

-- At most one employee per user.
create unique index if not exists uq_employees_profile
  on public.employees(profile_id) where profile_id is not null;
