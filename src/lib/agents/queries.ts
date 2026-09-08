import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

export type Agent = { id: string; name: string };

/**
 * Operational "agents" ARE the app's users (the people who log in). Any active
 * user can be picked as the agent who took an order, received a payment, made a
 * store sale, or completed a production stage — no separate employee setup.
 *
 * The returned `id` is the user's profile id. Server actions resolve it to the
 * backing payroll employee (auto-created on first use) via ensureAgentEmployeeId.
 */
export async function getAgents(): Promise<Agent[]> {
  const service = createServiceClient();
  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name, is_active')
    .eq('is_active', true);

  const rows = (profiles ?? []) as { id: string; full_name: string | null }[];

  // Fall back to the login email only for users without a display name.
  let emailById = new Map<string, string>();
  if (rows.some((p) => !p.full_name?.trim())) {
    const { data: authList } = await service.auth.admin.listUsers({ perPage: 1000 });
    emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? '']));
  }

  return rows
    .map((p) => ({
      id: p.id,
      name: p.full_name?.trim() || emailById.get(p.id) || 'Utilisateur',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
