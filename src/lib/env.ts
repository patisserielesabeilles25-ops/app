/**
 * Centralized environment access.
 *
 * Public values (NEXT_PUBLIC_*) are safe to read anywhere.
 * The service-role secret is read ONLY from `src/lib/supabase/service.ts`
 * (which is `import 'server-only'`), never here, so this module stays safe to
 * import from client components.
 */

export function getPublicSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!publishableKey) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  return { url, publishableKey };
}
