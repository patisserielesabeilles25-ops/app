import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Generates a short-lived signed URL for a private order image. Call only after
 * verifying the caller may view the order (orders.view). The service client is
 * used because the bucket is private with no anon/authenticated storage policies.
 */
export async function getSignedOrderImageUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
