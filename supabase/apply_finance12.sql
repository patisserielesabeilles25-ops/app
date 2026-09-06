-- ============================================================
-- Nahla Cake Panel — Finance Phase 12 (payroll periods +
-- calculation: create_payroll_period, calculate_payroll).
-- Run in Supabase SQL Editor.
-- ============================================================

-- 0022 — Payroll periods + deterministic calculation
-- Nahla Cake Panel — Finance expansion Phase 12

create or replace function public.create_payroll_period(
  p_type  text,
  p_start date,
  p_end   date,
  p_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;
  if p_type not in ('DAILY', 'WEEKLY', 'MONTHLY') then raise exception 'invalid period type'; end if;
  if p_end < p_start then raise exception 'end date is before start date'; end if;

  insert into public.payroll_periods (period_type, start_date, end_date, label)
  values (p_type, p_start, p_end, p_label)
  on conflict (period_type, start_date, end_date) do update set label = excluded.label
  returning id into v_id;
  return v_id;
end;
$$;

-- Compute gross for an employee/period per their payment method.
-- PIECE: sum of the period's work records (linked to this record).
-- DAILY: daily rate × p_worked_days.
-- WEEKLY/MONTHLY: the resolved period rate.
-- Re-runnable while DRAFT/CALCULATED; locked once PARTIALLY_PAID/PAID/CANCELLED.
create or replace function public.calculate_payroll(
  p_employee_id uuid,
  p_period_id   uuid,
  p_worked_days int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_method text;
  v_start  date;
  v_end    date;
  v_rec    uuid;
  v_status text;
  v_gross  numeric;
  v_rate   numeric;
begin
  if v_uid is null or not public.has_permission('payroll.manage') then
    raise exception 'forbidden: payroll.manage required';
  end if;

  select payment_method into v_method from public.employees where id = p_employee_id;
  if v_method is null then raise exception 'employee not found'; end if;
  select start_date, end_date into v_start, v_end from public.payroll_periods where id = p_period_id;
  if v_start is null then raise exception 'period not found'; end if;

  select id, status into v_rec, v_status
  from public.payroll_records where employee_id = p_employee_id and period_id = p_period_id;

  if v_rec is not null and v_status in ('PARTIALLY_PAID', 'PAID', 'CANCELLED') then
    raise exception 'payroll is %; cannot recalculate', v_status;
  end if;
  if v_rec is null then
    insert into public.payroll_records (employee_id, period_id, payment_method, created_by)
    values (p_employee_id, p_period_id, v_method, v_uid)
    returning id into v_rec;
  end if;

  if v_method = 'PIECE_BASED' then
    update public.piece_work_records set payroll_record_id = v_rec
    where employee_id = p_employee_id
      and payroll_record_id is null
      and work_date between v_start and v_end;
    select coalesce(sum(amount), 0) into v_gross
    from public.piece_work_records where payroll_record_id = v_rec;
  elsif v_method = 'DAILY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'DAILY');
    v_gross := coalesce(v_rate, 0) * coalesce(p_worked_days, 0);
  elsif v_method = 'WEEKLY' then
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'WEEKLY');
    v_gross := coalesce(v_rate, 0);
  else
    v_rate := public.resolve_rate(p_employee_id, null, null, v_end, 'MONTHLY');
    v_gross := coalesce(v_rate, 0);
  end if;

  update public.payroll_records
    set gross_amount = v_gross,
        status = case when status = 'DRAFT' then 'CALCULATED' else status end,
        updated_at = now()
  where id = v_rec;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.calculate', 'payroll_record', v_rec,
          jsonb_build_object('gross', v_gross, 'method', v_method));

  return v_rec;
end;
$$;
