import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type ProductRow = {
  id: string;
  name: string | null;
  diameter_cm: number | null;
  size_label: string | null;
  purchase_price: number;
  selling_price: number;
  photo_bucket: string | null;
  photo_path: string | null;
  created_at: string;
};

const COLUMNS =
  'id, name, diameter_cm, size_label, purchase_price, selling_price, photo_bucket, photo_path, created_at';

/** Remove characters that would break a PostgREST or()/ilike filter. */
function sanitize(term: string): string {
  return term.replace(/[,()%*]/g, ' ').trim();
}

export async function getProducts({ q }: { q?: string }): Promise<ProductRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('products')
    .select(COLUMNS)
    .eq('is_active', true)
    .order('diameter_cm', { ascending: true })
    .limit(500);

  const term = q ? sanitize(q) : '';
  if (term) {
    query = query.or(`name.ilike.%${term}%`);
  }

  const { data } = await query;
  return (data ?? []) as ProductRow[];
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  return (data as ProductRow) ?? null;
}

/**
 * Short-lived signed URL for a private product photo. Call only after verifying
 * the caller may view products (products.view).
 */
export async function getSignedProductPhotoUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
