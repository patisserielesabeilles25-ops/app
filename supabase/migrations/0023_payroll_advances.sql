-- 0023 — Payroll advances + advances-aware recalculation
-- Nahla Cake Panel — Finance expansion Phase 13

-- Record an advance: real EXPENSE to the ledger + advance row, linked to the
-- employee's current open payroll record; bumps that record's advances_total so
-- remaining drops. Advances are never overwritten.
create or replace function public.record_payroll_advance(
  p_employee_id uuid,
  p_amount      numeric,
  p_advance_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_rec  uuid;
  v_dept text;
  v_name text;
  v_cat  uuid;
  v_tx   uuid;
  v_adv  uuid;
  v_date date := coalesce(p_advance_date, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select department, full_name into v_dept, v_name from public.employees where id = p_employee_id;
  if v_name is null then raise exception 'employee not found'; end if;

  select id into v_rec from public.payroll_records
  where employee_id = p_employee_id and status in ('DRAFT', 'CALCULATED', 'PARTIALLY_PAID')
  order by created_at desc limit 1;

  select id into v_cat from public.financial_categories where key = 'PAYROLL';

  insert into public.financial_transactions
    (type, category, amount, occurred_at, source, department, category_id, employee_id, payroll_record_id, description, created_by)
  values
    ('EXPENSE', 'PAYROLL_ADVANCE', p_amount, v_date::timestamptz, 'PAYROLL', coalesce(v_dept, 'GENERAL'),
     v_cat, p_employee_id, v_rec, 'Advance for ' || v_name, v_uid)
  returning id into v_tx;

  insert into public.payroll_advances (employee_id, amount, advance_date, payroll_record_id, transaction_id, created_by)
  values (p_employee_id, p_amount, v_date, v_rec, v_tx, v_uid)
  returning id into v_adv;

  update public.financial_transactions set payroll_advance_id = v_adv where id = v_tx;

  if v_rec is not null then
    update public.payroll_records
      set advances_total = (select coalesce(sum(amount), 0) from public.payroll_advances where payroll_record_id = v_rec)
    where id = v_rec;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.advance.create', 'payroll_advance', v_adv,
          jsonb_build_object('employee', p_employee_id, 'amount', p_amount));

  return v_tx;
end;
$$;

-- Redefine calculate_payroll to also link period advances and keep advances_total.
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
  v_adv    numeric;
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
    where employee_id = p_employee_id and payroll_record_id is null
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

  -- Link any unlinked advances dated within the period.
  update public.payroll_advances set payroll_record_id = v_rec
  where employee_id = p_employee_id and payroll_record_id is null
    and advance_date between v_start and v_end;
  select coalesce(sum(amount), 0) into v_adv
  from public.payroll_advances where payroll_record_id = v_rec;

  update public.payroll_records
    set gross_amount = v_gross,
        advances_total = v_adv,
        status = case when status = 'DRAFT' then 'CALCULATED' else status end,
        updated_at = now()
  where id = v_rec;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.calculate', 'payroll_record', v_rec,
          jsonb_build_object('gross', v_gross, 'advances', v_adv, 'method', v_method));

  return v_rec;
end;
$$;
