import 'server-only';

import { createClient } from '@/lib/supabase/server';

export type Department = {
  id: string;
  key: string;
  name: string;
  is_active: boolean;
  sort: number;
};

export type FinancialCategory = {
  id: string;
  key: string;
  name: string;
  direction: 'INCOME' | 'EXPENSE' | 'BOTH';
  parent_id: string | null;
  is_system: boolean;
  is_active: boolean;
  sort: number;
};

export async function getDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('departments')
    .select('id, key, name, is_active, sort')
    .order('sort');
  return (data ?? []) as Department[];
}

export async function getCategories(): Promise<FinancialCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('financial_categories')
    .select('id, key, name, direction, parent_id, is_system, is_active, sort')
    .order('sort');
  return (data ?? []) as FinancialCategory[];
}
