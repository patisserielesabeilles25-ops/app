-- 0050 — Salary settlement cycle
-- Nahla Cake Panel
--
-- Advances to a worker are recorded as "Employee payroll" (category PAYROLL)
-- Magasin expenses attributed to them; they count as "Avance" and reduce the
-- "Reste à payer" (= gains − avance) in the Users pay dialog. Confirming the
-- payment closes the cycle: it stamps employees.last_settled_at, so gains and
-- avance reset to zero and a fresh calculation begins.

alter table public.employees
  add column if not exists last_settled_at timestamptz;

-- record_salary_payment now (a) allows amount 0 (settle only), (b) records the
-- payment as before when > 0, and (c) always closes the cycle.
create or replace function public.record_salary_payment(
  p_employee_id uuid,
  p_amount      numeric,
  p_paid_on     date,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_dept text;
  v_name text;
  v_cat  uuid;
  v_tx   uuid;
  v_amt  numeric := coalesce(p_amount, 0);
  v_date date := coalesce(p_paid_on, (now() at time zone 'Africa/Algiers')::date);
begin
  if v_uid is null or not public.has_permission('payroll.pay') then
    raise exception 'forbidden: payroll.pay required';
  end if;
  if v_amt < 0 then raise exception 'amount cannot be negative'; end if;

  select department, full_name into v_dept, v_name from public.employees where id = p_employee_id;
  if v_name is null then raise exception 'employee not found'; end if;

  if v_amt > 0 then
    select id into v_cat from public.financial_categories where key = 'PAYROLL';
    insert into public.financial_transactions
      (type, category, amount, occurred_at, source, department, category_id, employee_id, description, created_by)
    values
      ('EXPENSE', 'PAYROLL_SALARY', v_amt, v_date::timestamptz, 'PAYROLL', coalesce(v_dept, 'GENERAL'),
       v_cat, p_employee_id, coalesce(nullif(p_note, ''), 'Salaire — ' || v_name), v_uid)
    returning id into v_tx;
  end if;

  -- Close the pay cycle → gains & avance reset to zero from here.
  update public.employees set last_settled_at = now() where id = p_employee_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'payroll.salary.pay', 'financial_transaction', coalesce(v_tx, p_employee_id),
          jsonb_build_object('employee', p_employee_id, 'amount', v_amt, 'settled', true));

  return coalesce(v_tx, p_employee_id);
end;
$$;
