import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type CustomStatus = {
  id: string;
  name: string;
  canonical: string;
};

export async function getCustomStatuses(): Promise<CustomStatus[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('custom_statuses')
    .select('id, name, canonical')
    .order('canonical', { ascending: true })
    .order('name', { ascending: true })
    .limit(500);
  return (data ?? []) as CustomStatus[];
}
