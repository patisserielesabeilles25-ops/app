'use server';

import { createClient as createStandaloneClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { getPublicSupabaseEnv } from '@/lib/env';

export type PasswordState = { error?: string; success?: boolean };

/**
 * Change the signed-in user's own password. Verifies the current password first
 * (using a throwaway client so the active session cookies are untouched), then
 * updates it on the current session.
 */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();
  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!current) return { error: 'Entrez votre mot de passe actuel.' };
  if (next.length < 8) return { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' };
  if (next !== confirm) return { error: 'Les mots de passe ne correspondent pas.' };
  if (next === current) return { error: 'Le nouveau mot de passe doit être différent de l’actuel.' };
  if (!user.email) return { error: 'Ce compte n’a pas d’adresse e-mail.' };

  // Verify the current password without disturbing the session.
  const { url, publishableKey } = getPublicSupabaseEnv();
  const check = createStandaloneClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyErr } = await check.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (verifyErr) return { error: 'Mot de passe actuel incorrect.' };

  // Update the password on the current (cookie) session.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: 'Impossible de mettre à jour le mot de passe.' };

  return { success: true };
}
