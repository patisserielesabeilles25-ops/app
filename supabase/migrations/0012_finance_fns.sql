-- 0012 — Finance: private attachments bucket + atomic ledger write functions
-- Nahla Cake Panel
--
-- record_income / record_expense append to the immutable ledger and optionally
-- link a private attachment, all in one transaction. SECURITY DEFINER with an
-- explicit permission check; created_by is auth.uid() (not forgeable). Balance
-- stays derived (never mutated).

insert into storage.buckets (id, name, public)
values ('finance-attachments', 'finance-attachments', false)
on conflict (id) do nothing;

create or replace function public.record_income(
  p_amount      numeric,
  p_category    text,
  p_occurred_at timestamptz,
  p_description text,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.income.create') then
    raise exception 'forbidden: finance.income.create required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.financial_transactions (type, category, amount, occurred_at, description, created_by)
  values ('INCOME', coalesce(nullif(p_category, ''), 'OTHER'), p_amount, coalesce(p_occurred_at, now()), p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', 'INCOME', 'amount', p_amount, 'category', p_category));

  return v_tx;
end;
$$;

create or replace function public.record_expense(
  p_amount      numeric,
  p_category    text,
  p_item_name   text,
  p_occurred_at timestamptz,
  p_description text,
  p_image_path  text default null,
  p_image_mime  text default null,
  p_image_size  int  default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tx  uuid;
begin
  if v_uid is null or not public.has_permission('finance.expense.create') then
    raise exception 'forbidden: finance.expense.create required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.financial_transactions (type, category, amount, occurred_at, item_name, description, created_by)
  values ('EXPENSE', coalesce(nullif(p_category, ''), 'OTHER'), p_amount, coalesce(p_occurred_at, now()), p_item_name, p_description, v_uid)
  returning id into v_tx;

  if p_image_path is not null then
    insert into public.financial_attachments (transaction_id, bucket, object_path, mime_type, size_bytes, uploaded_by)
    values (v_tx, 'finance-attachments', p_image_path, p_image_mime, p_image_size, v_uid);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'finance.transaction.create', 'financial_transaction', v_tx,
          jsonb_build_object('type', 'EXPENSE', 'amount', p_amount, 'category', p_category));

  return v_tx;
end;
$$;
