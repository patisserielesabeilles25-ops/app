import 'server-only';

import type { Locale } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { triggerLabel, VARIABLES_COUNT } from '@/lib/whatsapp/constants';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type WhatsAppConnection = {
  status: ConnectionStatus;
  qr_code: string | null;
  phone_number: string | null;
  command: 'connect' | 'disconnect' | null;
  last_connected_at: string | null;
};

export type WhatsAppAutomation = {
  id: string;
  trigger_type: 'canonical' | 'custom' | 'event';
  trigger_key: string;
  message: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  is_active: boolean;
  created_at: string;
  /** Resolved, non-localized display label (canonical or custom status name). */
  label: string;
};

export type WhatsAppTemplate = {
  id: string;
  name: string;
  message: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
};

export type WhatsAppMessage = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  to_phone: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  trigger_key: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type WhatsAppCustomStatus = {
  id: string;
  name: string;
  canonical: string;
};

export type WhatsAppStats = {
  activeAutomations: number;
  totalAutomations: number;
  configuredTriggers: number;
  variablesCount: number;
  connectionStatus: ConnectionStatus;
};

/** The single connection row (id='default'). */
export async function getConnection(): Promise<WhatsAppConnection> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_connection')
    .select('status, qr_code, phone_number, command, last_connected_at')
    .eq('id', 'default')
    .maybeSingle();

  return {
    status: (data?.status as ConnectionStatus) ?? 'disconnected',
    qr_code: data?.qr_code ?? null,
    phone_number: data?.phone_number ?? null,
    command: (data?.command as 'connect' | 'disconnect' | null) ?? null,
    last_connected_at: data?.last_connected_at ?? null,
  };
}

/** Active custom statuses, used for the trigger picker and label resolution. */
export async function getCustomStatuses(): Promise<WhatsAppCustomStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('custom_statuses')
    .select('id, name, canonical')
    .eq('is_active', true)
    .order('canonical', { ascending: true })
    .order('name', { ascending: true })
    .limit(500);
  return (data ?? []) as WhatsAppCustomStatus[];
}

/**
 * Automations with a resolved display label. `locale` is used only for the
 * canonical labels; custom-status names come straight from the DB (not
 * translated).
 */
export async function getAutomations(locale: Locale): Promise<WhatsAppAutomation[]> {
  const supabase = await createClient();
  const [{ data }, customStatuses] = await Promise.all([
    supabase
      .from('whatsapp_automations')
      .select('id, trigger_type, trigger_key, message, media_url, media_type, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    getCustomStatuses(),
  ]);

  const customById = new Map(customStatuses.map((c) => [c.id, c.name]));

  return (data ?? []).map((a) => ({
    id: a.id as string,
    trigger_type: a.trigger_type as 'canonical' | 'custom' | 'event',
    trigger_key: a.trigger_key as string,
    message: a.message as string,
    media_url: (a.media_url as string | null) ?? null,
    media_type: (a.media_type as 'image' | 'video' | null) ?? null,
    is_active: Boolean(a.is_active),
    created_at: a.created_at as string,
    label:
      a.trigger_type === 'custom'
        ? customById.get(a.trigger_key as string) ?? (a.trigger_key as string)
        : triggerLabel(locale, a.trigger_key as string),
  }));
}

export async function getTemplates(): Promise<WhatsAppTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_templates')
    .select('id, name, message, media_url, media_type, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as WhatsAppTemplate[];
}

/** Recent outbound messages for the History tab (joins the order number). */
export async function getMessages(limit = 50): Promise<WhatsAppMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select(
      'id, order_id, to_phone, body, media_url, media_type, trigger_key, status, error, created_at, sent_at, orders(order_number)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((m) => {
    const order = (m as { orders?: { order_number?: string } | { order_number?: string }[] }).orders;
    const orderNumber = Array.isArray(order) ? order[0]?.order_number : order?.order_number;
    return {
      id: m.id as string,
      order_id: (m.order_id as string | null) ?? null,
      order_number: orderNumber ?? null,
      to_phone: m.to_phone as string,
      body: m.body as string,
      media_url: (m.media_url as string | null) ?? null,
      media_type: (m.media_type as string | null) ?? null,
      trigger_key: (m.trigger_key as string | null) ?? null,
      status: m.status as WhatsAppMessage['status'],
      error: (m.error as string | null) ?? null,
      created_at: m.created_at as string,
      sent_at: (m.sent_at as string | null) ?? null,
    };
  });
}

export async function getStats(): Promise<WhatsAppStats> {
  const supabase = await createClient();
  const [{ data: automations }, connection] = await Promise.all([
    supabase.from('whatsapp_automations').select('trigger_key, is_active').limit(1000),
    getConnection(),
  ]);

  const rows = automations ?? [];
  const active = rows.filter((a) => a.is_active);
  const configuredTriggers = new Set(active.map((a) => a.trigger_key as string)).size;

  return {
    activeAutomations: active.length,
    totalAutomations: rows.length,
    configuredTriggers,
    variablesCount: VARIABLES_COUNT,
    connectionStatus: connection.status,
  };
}
