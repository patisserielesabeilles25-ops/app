-- 0042 — WhatsApp automation (Baileys)
-- Nahla Cake Panel
--
-- Automations send a templated WhatsApp message to the customer when an order
-- reaches a given status. The actual sending is done by a separate always-on
-- Baileys worker (Vercel serverless cannot hold a WhatsApp socket): the app and
-- the DB trigger only ENQUEUE messages (whatsapp_messages, status='pending');
-- the worker reads pending rows, sends them, and updates their status. The same
-- worker writes connection state + QR into whatsapp_connection.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('whatsapp.view',   'View the WhatsApp automation area'),
  ('whatsapp.manage', 'Manage WhatsApp automations, templates and connection')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('whatsapp.view', 'whatsapp.manage')
where r.key = 'admin'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Connection state (single row). The worker owns status/qr/phone; the app sets
-- `command` to request connect/disconnect and the worker consumes it.
-- ---------------------------------------------------------------------------
create table public.whatsapp_connection (
  id                text primary key default 'default' check (id = 'default'),
  status            text not null default 'disconnected'
                      check (status in ('disconnected', 'connecting', 'connected')),
  qr_code           text,
  phone_number      text,
  command           text check (command in ('connect', 'disconnect')),
  last_connected_at timestamptz,
  updated_at        timestamptz not null default now()
);
insert into public.whatsapp_connection (id) values ('default') on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Automations: status trigger -> templated message (+ optional media).
-- ---------------------------------------------------------------------------
create table public.whatsapp_automations (
  id           uuid primary key default gen_random_uuid(),
  trigger_type text not null default 'canonical' check (trigger_type in ('canonical', 'custom')),
  trigger_key  text not null,      -- canonical status key, or custom_statuses.id
  message      text not null,
  media_url    text,
  media_type   text check (media_type in ('image', 'video')),
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_wa_autom_trigger on public.whatsapp_automations (trigger_type, trigger_key) where is_active;
create trigger trg_wa_autom_updated
  before update on public.whatsapp_automations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reusable message templates.
-- ---------------------------------------------------------------------------
create table public.whatsapp_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  message    text not null,
  media_url  text,
  media_type text check (media_type in ('image', 'video')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_wa_tpl_updated
  before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Outbound message queue / history.
-- ---------------------------------------------------------------------------
create table public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete set null,
  automation_id uuid references public.whatsapp_automations(id) on delete set null,
  to_phone      text not null,
  body          text not null,
  media_url     text,
  media_type    text,
  trigger_key   text,
  status        text not null default 'pending'
                  check (status in ('pending', 'sent', 'failed', 'skipped')),
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index idx_wa_msg_pending on public.whatsapp_messages (created_at) where status = 'pending';
create index idx_wa_msg_recent on public.whatsapp_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- Public bucket for automation media (images/videos the worker fetches by URL).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Human labels for status keys (used for the {status} variable).
-- ---------------------------------------------------------------------------
create or replace function public._wa_stage_label(p_key text)
returns text language sql immutable as $$
  select case p_key
    when 'NOUVEAU'          then 'Nouveau'
    when 'EN_PREPARATION'   then 'En préparation'
    when 'EN_MASKAGE'       then 'En maskage'
    when 'EN_FINITION'      then 'En finition'
    when 'READY'            then 'Prête'
    when 'OUT_FOR_DELIVERY' then 'En livraison'
    when 'DELIVERED'        then 'Livrée'
    when 'RETURNED'         then 'Retournée'
    when 'REPORTED'         then 'Reportée'
    else p_key
  end;
$$;

-- ---------------------------------------------------------------------------
-- Render a message template for an order (resolves the {variables}).
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_render(p_template text, p_order_id uuid, p_status_label text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o       record;
  v       text := p_template;
  v_prod  text;
  v_grand numeric;
begin
  select ord.order_number, ord.customer_name, ord.customer_phone, ord.cake_size_cm,
         ord.description, ord.delivery_date, ord.delivery_time, ord.fulfillment, ord.product_id,
         f.total_amount, f.montage_amount, f.delivery_amount, f.advance_payment, f.remaining_amount
    into o
  from public.orders ord
  left join public.order_financials f on f.order_id = ord.id
  where ord.id = p_order_id;
  if not found then return v; end if;

  select p.name into v_prod from public.products p where p.id = o.product_id;
  v_grand := coalesce(o.total_amount, 0) + coalesce(o.montage_amount, 0) + coalesce(o.delivery_amount, 0);

  v := replace(v, '{name}',          coalesce(o.customer_name, ''));
  v := replace(v, '{reference}',     coalesce(o.order_number, ''));
  v := replace(v, '{product}',       coalesce(nullif(v_prod, ''), o.description, ''));
  v := replace(v, '{size}',          coalesce(o.cake_size_cm::text, '') || ' cm');
  v := replace(v, '{total}',         trim(to_char(v_grand, 'FM999999990D00')) || ' DA');
  v := replace(v, '{advance}',       trim(to_char(coalesce(o.advance_payment, 0), 'FM999999990D00')) || ' DA');
  v := replace(v, '{remaining}',     trim(to_char(coalesce(o.remaining_amount, 0), 'FM999999990D00')) || ' DA');
  v := replace(v, '{delivery_fee}',  trim(to_char(coalesce(o.delivery_amount, 0), 'FM999999990D00')) || ' DA');
  v := replace(v, '{delivery_date}', coalesce(to_char(o.delivery_date, 'DD/MM/YYYY'), ''));
  v := replace(v, '{delivery_time}', coalesce(to_char(o.delivery_time, 'HH24:MI'), ''));
  v := replace(v, '{fulfillment}',   case when o.fulfillment = 'DELIVERY' then 'Livraison' else 'Retrait' end);
  v := replace(v, '{status}',        coalesce(p_status_label, ''));
  v := replace(v, '{phone}',         coalesce(o.customer_phone, ''));
  v := replace(v, '{shop}',          'Nahla Cake');
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enqueue pending messages for the active automations matching a trigger.
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_enqueue(
  p_order_id uuid, p_trigger_type text, p_trigger_key text, p_status_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      record;
  v_raw  text;
  v_phone text;
  v_body text;
begin
  select customer_phone into v_raw from public.orders where id = p_order_id;
  v_phone := regexp_replace(coalesce(v_raw, ''), '\D', '', 'g');
  if v_phone = '' then return; end if;
  if left(v_phone, 3) <> '213' then
    if left(v_phone, 1) = '0' then v_phone := '213' || substr(v_phone, 2);
    else v_phone := '213' || v_phone;
    end if;
  end if;

  for a in
    select * from public.whatsapp_automations
    where is_active and trigger_type = p_trigger_type and trigger_key = p_trigger_key
  loop
    v_body := public.whatsapp_render(a.message, p_order_id, p_status_label);
    insert into public.whatsapp_messages
      (order_id, automation_id, to_phone, body, media_url, media_type, trigger_key, status)
    values
      (p_order_id, a.id, v_phone, v_body, a.media_url, a.media_type, p_trigger_key, 'pending');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fire enqueue on the relevant order status transitions. Wrapped so a messaging
-- error can NEVER break the underlying order write.
-- ---------------------------------------------------------------------------
create or replace function public.whatsapp_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if TG_OP = 'INSERT' then
      perform public.whatsapp_enqueue(NEW.id, 'canonical', NEW.production_stage, public._wa_stage_label(NEW.production_stage));
      if NEW.reported_at is not null then
        perform public.whatsapp_enqueue(NEW.id, 'canonical', 'REPORTED', 'Reportée');
      end if;
      if NEW.custom_status_id is not null then
        perform public.whatsapp_enqueue(NEW.id, 'custom', NEW.custom_status_id::text,
          (select name from public.custom_statuses where id = NEW.custom_status_id));
      end if;
    elsif TG_OP = 'UPDATE' then
      if NEW.production_stage is distinct from OLD.production_stage then
        perform public.whatsapp_enqueue(NEW.id, 'canonical', NEW.production_stage, public._wa_stage_label(NEW.production_stage));
      end if;
      if NEW.delivery_status is distinct from OLD.delivery_status
         and NEW.delivery_status in ('OUT_FOR_DELIVERY', 'DELIVERED') then
        perform public.whatsapp_enqueue(NEW.id, 'canonical', NEW.delivery_status, public._wa_stage_label(NEW.delivery_status));
      end if;
      if NEW.returned_at is not null and OLD.returned_at is null then
        perform public.whatsapp_enqueue(NEW.id, 'canonical', 'RETURNED', 'Retournée');
      end if;
      if NEW.reported_at is not null and OLD.reported_at is null then
        perform public.whatsapp_enqueue(NEW.id, 'canonical', 'REPORTED', 'Reportée');
      end if;
      if NEW.custom_status_id is distinct from OLD.custom_status_id and NEW.custom_status_id is not null then
        perform public.whatsapp_enqueue(NEW.id, 'custom', NEW.custom_status_id::text,
          (select name from public.custom_statuses where id = NEW.custom_status_id));
      end if;
    end if;
  exception when others then
    null; -- messaging must never break order writes
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_whatsapp_on_order_change on public.orders;
create trigger trg_whatsapp_on_order_change
  after insert or update on public.orders
  for each row execute function public.whatsapp_on_order_change();

-- ---------------------------------------------------------------------------
-- Row Level Security. The worker uses the service role (bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.whatsapp_connection  enable row level security;
alter table public.whatsapp_automations enable row level security;
alter table public.whatsapp_templates   enable row level security;
alter table public.whatsapp_messages    enable row level security;

create policy "wa_conn_select" on public.whatsapp_connection
  for select to authenticated
  using (public.has_permission('whatsapp.view') or public.has_permission('whatsapp.manage'));
create policy "wa_conn_update" on public.whatsapp_connection
  for update to authenticated
  using (public.has_permission('whatsapp.manage'))
  with check (public.has_permission('whatsapp.manage'));

create policy "wa_autom_select" on public.whatsapp_automations
  for select to authenticated
  using (public.has_permission('whatsapp.view') or public.has_permission('whatsapp.manage'));
create policy "wa_autom_write" on public.whatsapp_automations
  for all to authenticated
  using (public.has_permission('whatsapp.manage'))
  with check (public.has_permission('whatsapp.manage'));

create policy "wa_tpl_select" on public.whatsapp_templates
  for select to authenticated
  using (public.has_permission('whatsapp.view') or public.has_permission('whatsapp.manage'));
create policy "wa_tpl_write" on public.whatsapp_templates
  for all to authenticated
  using (public.has_permission('whatsapp.manage'))
  with check (public.has_permission('whatsapp.manage'));

-- messages: read-only for viewers; inserts happen via SECURITY DEFINER enqueue
-- and the service-role worker.
create policy "wa_msg_select" on public.whatsapp_messages
  for select to authenticated
  using (public.has_permission('whatsapp.view') or public.has_permission('whatsapp.manage'));
