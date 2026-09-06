import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type AuditEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string | null } | null;
};

/**
 * Recent audit entries with the actor's name. RLS restricts this to
 * settings.manage holders.
 */
export async function getAuditEntries(filter?: {
  scope?: string;
}): Promise<AuditEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter?.scope === 'orders') query = query.like('action', 'order%');
  else if (filter?.scope === 'finance')
    query = query.or('action.like.finance%,action.like.payroll%,action.like.magasin%');
  else if (filter?.scope === 'users')
    query = query.or('action.like.user%,action.like.role%');

  const { data } = await query;
  return (data ?? []) as unknown as AuditEntry[];
}
