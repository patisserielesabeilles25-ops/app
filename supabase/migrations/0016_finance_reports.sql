-- 0016 — Finance reporting: server-side aggregation RPCs
-- Nahla Cake Panel — Finance expansion Phase 4
--
-- All guarded by finance.transactions.view OR finance.reports.view. Period bounds
-- are [p_from, p_to) timestamptz (caller computes them in the business timezone).
-- OPENING_BALANCE rows are excluded from period income/expense (they belong to
-- the running balance, not to a period's activity). Reversal rows are included
-- (they are real opposite movements, keeping net consistent with the balance).

create or replace function public._finance_can_report()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('finance.transactions.view')
      or public.has_permission('finance.reports.view');
$$;

create or replace function public.finance_summary(p_from timestamptz, p_to timestamptz)
returns table (income numeric, expense numeric, net numeric, income_count int, expense_count int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      coalesce(sum(amount) filter (where type = 'INCOME'), 0),
      coalesce(sum(amount) filter (where type = 'EXPENSE'), 0),
      coalesce(sum(case when type = 'INCOME' then amount else -amount end), 0),
      coalesce(count(*) filter (where type = 'INCOME'), 0)::int,
      coalesce(count(*) filter (where type = 'EXPENSE'), 0)::int
    from public.financial_transactions
    where source <> 'OPENING_BALANCE'
      and occurred_at >= p_from and occurred_at < p_to;
end;
$$;

create or replace function public.finance_by_category(p_from timestamptz, p_to timestamptz)
returns table (category_key text, category_name text, income numeric, expense numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      coalesce(fc.key, 'OTHER'),
      coalesce(fc.name, 'Other'),
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0)
    from public.financial_transactions t
    left join public.financial_categories fc on fc.id = t.category_id
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by fc.key, fc.name
    order by coalesce(sum(t.amount), 0) desc;
end;
$$;

create or replace function public.finance_by_department(p_from timestamptz, p_to timestamptz)
returns table (department text, income numeric, expense numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      t.department,
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0),
      coalesce(sum(case when t.type = 'INCOME' then t.amount else -t.amount end), 0)
    from public.financial_transactions t
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by t.department
    order by 4 desc;
end;
$$;

create or replace function public.finance_by_source(p_from timestamptz, p_to timestamptz)
returns table (source text, income numeric, expense numeric, net numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._finance_can_report() then raise exception 'forbidden'; end if;
  return query
    select
      t.source,
      coalesce(sum(t.amount) filter (where t.type = 'INCOME'), 0),
      coalesce(sum(t.amount) filter (where t.type = 'EXPENSE'), 0),
      coalesce(sum(case when t.type = 'INCOME' then t.amount else -t.amount end), 0)
    from public.financial_transactions t
    where t.source <> 'OPENING_BALANCE'
      and t.occurred_at >= p_from and t.occurred_at < p_to
    group by t.source
    order by 4 desc;
end;
$$;
