-- 0043 — WhatsApp birthday trigger (client birthday → message)
-- Nahla Cake Panel
--
-- A time-based automation trigger: trigger_type='event', trigger_key='BIRTHDAY'.
-- Unlike order-status triggers, this is customer-based (no order), so it needs a
-- customer variable renderer and a daily job that finds today's birthdays and
-- enqueues messages for the active birthday automations.

-- Allow the new 'event' trigger type.
alter table public.whatsapp_automations drop constraint if exists whatsapp_automations_trigger_type_check;
alter table public.whatsapp_automations add constraint whatsapp_automations_trigger_type_check
  check (trigger_type in ('canonical', 'custom', 'event'));

-- Render a template for a CUSTOMER (order-only variables resolve to empty).
create or replace function public.whatsapp_render_customer(p_template text, p_customer_id uuid, p_status_label text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  v text := p_template;
begin
  select name, phone into c from public.customers where id = p_customer_id;
  if not found then return v; end if;
  v := replace(v, '{name}',   coalesce(c.name, ''));
  v := replace(v, '{phone}',  coalesce(c.phone, ''));
  v := replace(v, '{shop}',   'Nahla Cake');
  v := replace(v, '{status}', coalesce(p_status_label, ''));
  v := replace(v, '{reference}', '');
  v := replace(v, '{product}', '');
  v := replace(v, '{size}', '');
  v := replace(v, '{total}', '');
  v := replace(v, '{advance}', '');
  v := replace(v, '{remaining}', '');
  v := replace(v, '{delivery_fee}', '');
  v := replace(v, '{delivery_date}', '');
  v := replace(v, '{delivery_time}', '');
  v := replace(v, '{fulfillment}', '');
  return v;
end;
$$;

-- Enqueue customer-based messages for active event automations (de-duped per day).
create or replace function public.whatsapp_enqueue_customer(p_customer_id uuid, p_trigger_key text, p_status_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a       record;
  v_raw   text;
  v_phone text;
  v_body  text;
begin
  select phone into v_raw from public.customers where id = p_customer_id;
  v_phone := regexp_replace(coalesce(v_raw, ''), '\D', '', 'g');
  if v_phone = '' then return; end if;
  if left(v_phone, 3) <> '213' then
    if left(v_phone, 1) = '0' then v_phone := '213' || substr(v_phone, 2);
    else v_phone := '213' || v_phone;
    end if;
  end if;

  for a in
    select * from public.whatsapp_automations
    where is_active and trigger_type = 'event' and trigger_key = p_trigger_key
  loop
    -- Skip if this automation was already queued to this number today.
    if exists (
      select 1 from public.whatsapp_messages m
      where m.automation_id = a.id and m.to_phone = v_phone
        and (m.created_at at time zone 'Africa/Algiers')::date = (now() at time zone 'Africa/Algiers')::date
    ) then
      continue;
    end if;
    v_body := public.whatsapp_render_customer(a.message, p_customer_id, p_status_label);
    insert into public.whatsapp_messages
      (order_id, automation_id, to_phone, body, media_url, media_type, trigger_key, status)
    values
      (null, a.id, v_phone, v_body, a.media_url, a.media_type, p_trigger_key, 'pending');
  end loop;
end;
$$;

-- Daily birthday run: customers whose birthday (month+day) is today (Africa/Algiers).
create or replace function public.whatsapp_birthday_run()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c       record;
  v_count int := 0;
  v_today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if not exists (
    select 1 from public.whatsapp_automations
    where is_active and trigger_type = 'event' and trigger_key = 'BIRTHDAY'
  ) then
    return 0;
  end if;

  for c in
    select id from public.customers
    where date_of_birth is not null
      and extract(month from date_of_birth) = extract(month from v_today)
      and extract(day   from date_of_birth) = extract(day   from v_today)
  loop
    perform public.whatsapp_enqueue_customer(c.id, 'BIRTHDAY', 'Anniversaire');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Run every morning at 08:10 Africa/Algiers (07:10 UTC).
do $$ begin perform cron.unschedule('whatsapp-birthday'); exception when others then null; end $$;
select cron.schedule('whatsapp-birthday', '10 7 * * *', $cron$ select public.whatsapp_birthday_run(); $cron$);
