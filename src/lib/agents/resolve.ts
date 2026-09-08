import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Users ARE the agents. The finance/production tables key on employees.id, so
 * when an agent (app user) is selected we resolve — creating on first use — the
 * payroll employee row backing that user, and return its id.
 *
 * @param profileId the selected agent's profile (user) id, or empty/null.
 * @returns the backing employee id, or null when no agent was selected.
 */
export async function ensureAgentEmployeeId(
  profileId: string | null | undefined,
): Promise<string | null> {
  const id = (profileId ?? '').trim();
  if (!id) return null;

  const service = createServiceClient();

  const { data: existing } = await service
    .from('employees')
    .select('id')
    .eq('profile_id', id)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', id)
    .maybeSingle();
  const fullName = (profile?.full_name as string | null)?.trim() || 'Agent';

  const { data: created, error } = await service
    .from('employees')
    .insert({
      full_name: fullName,
      department: 'SHOP',
      payment_method: 'MONTHLY',
      is_active: true,
      profile_id: id,
      created_by: id,
    })
    .select('id')
    .single();

  if (error) {
    // Lost a race on the unique(profile_id) index — re-read the winner.
    const { data: again } = await service
      .from('employees')
      .select('id')
      .eq('profile_id', id)
      .maybeSingle();
    return (again?.id as string) ?? null;
  }
  return created.id as string;
}
