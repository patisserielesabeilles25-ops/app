import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Writes an audit entry from a server action. Uses the service client because
 * audit_log has no INSERT policy for authenticated users (it is append-only via
 * privileged paths). ALWAYS call this AFTER an application-level permission check,
 * and pass the acting user's id explicitly.
 *
 * Most audit entries are written inside SECURITY DEFINER SQL functions
 * (create_order, status transitions, finance). Use this helper for actions that
 * happen purely in application code (e.g. user/role/permission management).
 */
export async function writeAudit(params: {
  actorId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const service = createServiceClient();
  await service.from('audit_log').insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
  });
}
