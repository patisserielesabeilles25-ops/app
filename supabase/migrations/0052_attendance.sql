-- 0052 — Attendance register
-- Nahla Cake Panel
--
-- Records exceptions to attendance for fixed-rate workers: absence, half-day,
-- or paid leave. PRESENT is the default (no row). Fixed-rate salaries deduct
-- one day-equivalent (rate / working-days) per absent day (half = 0.5, paid
-- leave = 0). Per-order workers need no attendance — they earn per piece.

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date   date not null,
  status      text not null check (status in ('ABSENT', 'HALF', 'LEAVE')),
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (employee_id, work_date)
);
create index if not exists idx_attendance_emp on public.attendance(employee_id, work_date);

alter table public.attendance enable row level security;

create policy "attendance_read" on public.attendance
  for select to authenticated
  using (public.has_permission('payroll.view') or public.has_permission('payroll.manage'));

create policy "attendance_write" on public.attendance
  for all to authenticated
  using (public.has_permission('payroll.manage'))
  with check (public.has_permission('payroll.manage'));
