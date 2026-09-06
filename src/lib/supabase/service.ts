import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Privileged service-role Supabase client. BYPASSES Row Level Security.
 *
 * SERVER ONLY. The `server-only` import above makes importing this from any
 * client bundle a build error. Use exclusively inside server actions / route
 * handlers, and ALWAYS after an application-level permission check
 * (see src/lib/auth). Never expose the secret key to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!secretKey) {
    throw new Error('Missing environment variable: SUPABASE_SECRET_KEY');
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
