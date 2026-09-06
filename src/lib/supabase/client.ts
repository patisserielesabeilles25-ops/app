'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from '@/lib/env';

/**
 * Browser Supabase client. Uses ONLY the publishable key and operates under
 * Row Level Security. Never has privileged access.
 */
export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
