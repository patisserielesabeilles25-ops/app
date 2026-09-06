'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/permissions';

export type ClientFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const UpdateClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().min(4, 'Enter a valid phone number').max(30),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(2000).optional().default(''),
});

/**
 * Update a client's profile (name, phone, date of birth, notes). Guarded by
 * orders.edit; the customers RLS update policy enforces the same server-side.
 */
export async function updateClient(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requirePermission('orders.edit');
  const id = String(formData.get('clientId') ?? '');
  if (!id) return { error: 'Missing client.' };

  const parsed = UpdateClientSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone'),
    dateOfBirth: formData.get('dateOfBirth') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: 'Please fix the highlighted fields.', fieldErrors };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({
      name: input.name,
      phone: input.phone,
      date_of_birth: input.dateOfBirth ? input.dateOfBirth : null,
      notes: input.notes ? input.notes : null,
    })
    .eq('id', id);

  if (error) {
    return { error: 'Could not update the client.' };
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?updated=1`);
}
