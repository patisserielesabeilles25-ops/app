'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions';
import { MAX_MEDIA_BYTES } from '@/lib/whatsapp/constants';

export type WhatsAppFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

const BUCKET = 'whatsapp-media';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

function mediaTypeOf(file: File): 'image' | 'video' | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

/**
 * Upload media to the PUBLIC whatsapp-media bucket. Returns the public URL and
 * media type. Only image/* and video/* up to 16 MB are accepted.
 */
async function uploadMedia(
  file: File,
): Promise<{ url?: string; type?: 'image' | 'video'; error?: string }> {
  const type = mediaTypeOf(file);
  if (!type) return { error: 'Media must be an image or a video.' };
  if (file.size > MAX_MEDIA_BYTES) return { error: 'Media must be 16 MB or smaller.' };

  const service = createServiceClient();
  const path = `${crypto.randomUUID()}/${safeName(file.name || 'media')}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Media upload failed: ${error.message}` };

  const { data } = service.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, type };
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------
export async function createAutomation(
  _prev: WhatsAppFormState,
  formData: FormData,
): Promise<WhatsAppFormState> {
  await requirePermission('whatsapp.manage');
  const user = await requireUser();

  const triggerType = String(formData.get('triggerType') ?? '');
  const triggerKey = String(formData.get('triggerKey') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (triggerType !== 'canonical' && triggerType !== 'custom') {
    fieldErrors.triggerKey = 'Choose a trigger.';
  }
  if (!triggerKey) fieldErrors.triggerKey = 'Choose a trigger.';
  if (!message) fieldErrors.message = 'Write a message.';
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  let mediaUrl: string | null = null;
  let mediaType: 'image' | 'video' | null = null;
  const file = formData.get('media');
  if (file instanceof File && file.size > 0) {
    const up = await uploadMedia(file);
    if (up.error) return { error: up.error };
    mediaUrl = up.url ?? null;
    mediaType = up.type ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_automations').insert({
    trigger_type: triggerType,
    trigger_key: triggerKey,
    message,
    media_url: mediaUrl,
    media_type: mediaType,
    created_by: user.id,
  });

  if (error) {
    return { error: 'Could not create the automation. Please try again.' };
  }

  revalidatePath('/whatsapp');
  return { ok: true };
}

export async function toggleAutomation(formData: FormData): Promise<void> {
  await requirePermission('whatsapp.manage');
  const id = String(formData.get('id') ?? '');
  const isActive = String(formData.get('is_active') ?? '') === 'true';
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('whatsapp_automations').update({ is_active: !isActive }).eq('id', id);
  revalidatePath('/whatsapp');
}

export async function deleteAutomation(formData: FormData): Promise<void> {
  await requirePermission('whatsapp.manage');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('whatsapp_automations').delete().eq('id', id);
  revalidatePath('/whatsapp');
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export async function createTemplate(
  _prev: WhatsAppFormState,
  formData: FormData,
): Promise<WhatsAppFormState> {
  await requirePermission('whatsapp.manage');
  const user = await requireUser();

  const name = String(formData.get('name') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Give the template a name.';
  if (!message) fieldErrors.message = 'Write a message.';
  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }

  let mediaUrl: string | null = null;
  let mediaType: 'image' | 'video' | null = null;
  const file = formData.get('media');
  if (file instanceof File && file.size > 0) {
    const up = await uploadMedia(file);
    if (up.error) return { error: up.error };
    mediaUrl = up.url ?? null;
    mediaType = up.type ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('whatsapp_templates').insert({
    name,
    message,
    media_url: mediaUrl,
    media_type: mediaType,
    created_by: user.id,
  });

  if (error) {
    return { error: 'Could not create the template. Please try again.' };
  }

  revalidatePath('/whatsapp');
  return { ok: true };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  await requirePermission('whatsapp.manage');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const supabase = await createClient();
  await supabase.from('whatsapp_templates').delete().eq('id', id);
  revalidatePath('/whatsapp');
}

// ---------------------------------------------------------------------------
// Connection (the app only requests; the worker consumes the command)
// ---------------------------------------------------------------------------
export async function requestConnect(): Promise<void> {
  await requirePermission('whatsapp.manage');
  const supabase = await createClient();
  await supabase
    .from('whatsapp_connection')
    .update({ command: 'connect', status: 'connecting' })
    .eq('id', 'default');
  revalidatePath('/whatsapp');
}

export async function requestDisconnect(): Promise<void> {
  await requirePermission('whatsapp.manage');
  const supabase = await createClient();
  await supabase
    .from('whatsapp_connection')
    .update({ command: 'disconnect' })
    .eq('id', 'default');
  revalidatePath('/whatsapp');
}
