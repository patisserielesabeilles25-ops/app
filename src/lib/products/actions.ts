'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/permissions';
import {
  ProductSchema,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '@/lib/validation/product';

export type ProductFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const BUCKET = 'product-photos';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

function parse(formData: FormData) {
  return ProductSchema.safeParse({
    name: formData.get('name') ?? '',
    diameterCm: formData.get('diameterCm'),
    purchasePrice: formData.get('purchasePrice') || 0,
    sellingPrice: formData.get('sellingPrice') || 0,
  });
}

function collectFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

/** Upload a product photo to the private bucket. Returns the object path. */
async function uploadPhoto(file: File): Promise<{ path?: string; error?: string }> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Photo must be JPEG, PNG, or WEBP.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Photo must be 5 MB or smaller.' };
  }
  const service = createServiceClient();
  const path = `${crypto.randomUUID()}/${safeName(file.name || 'photo')}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Photo upload failed: ${error.message}` };
  return { path };
}

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requirePermission('products.manage');
  const user = await requireUser();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const input = parsed.data;

  const file = formData.get('photo');
  let photoPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    const up = await uploadPhoto(file);
    if (up.error) return { error: up.error };
    photoPath = up.path ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('products').insert({
    name: input.name ? input.name : null,
    diameter_cm: input.diameterCm,
    purchase_price: input.purchasePrice,
    selling_price: input.sellingPrice,
    photo_bucket: photoPath ? BUCKET : null,
    photo_path: photoPath,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    if (photoPath) await createServiceClient().storage.from(BUCKET).remove([photoPath]);
    return { error: 'Could not create the product. Please try again.' };
  }

  revalidatePath('/products');
  redirect('/products?created=1');
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requirePermission('products.manage');
  const user = await requireUser();
  const id = String(formData.get('productId') ?? '');
  if (!id) return { error: 'Missing product.' };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const input = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('products')
    .select('photo_bucket, photo_path')
    .eq('id', id)
    .maybeSingle();

  const removePhoto = formData.get('removePhoto') === 'on';
  const file = formData.get('photo');
  const hasNewPhoto = file instanceof File && file.size > 0;

  let photoBucket = existing?.photo_bucket ?? null;
  let photoPath = existing?.photo_path ?? null;
  let uploadedPath: string | null = null;

  if (hasNewPhoto) {
    const up = await uploadPhoto(file as File);
    if (up.error) return { error: up.error };
    uploadedPath = up.path ?? null;
    photoBucket = BUCKET;
    photoPath = uploadedPath;
  } else if (removePhoto) {
    photoBucket = null;
    photoPath = null;
  }

  const { error } = await supabase
    .from('products')
    .update({
      name: input.name ? input.name : null,
      diameter_cm: input.diameterCm,
      purchase_price: input.purchasePrice,
      selling_price: input.sellingPrice,
      photo_bucket: photoBucket,
      photo_path: photoPath,
      updated_by: user.id,
    })
    .eq('id', id);

  if (error) {
    if (uploadedPath) await createServiceClient().storage.from(BUCKET).remove([uploadedPath]);
    return { error: 'Could not update the product.' };
  }

  // Clean up the old photo when it was replaced or removed.
  const oldPath = existing?.photo_path ?? null;
  if (oldPath && oldPath !== photoPath) {
    await createServiceClient().storage.from(existing?.photo_bucket ?? BUCKET).remove([oldPath]);
  }

  revalidatePath('/products');
  revalidatePath(`/products/${id}/edit`);
  redirect('/products?updated=1');
}

export async function deleteProduct(formData: FormData): Promise<void> {
  await requirePermission('products.manage');
  const id = String(formData.get('productId') ?? '');
  if (!id) redirect('/products');
  const supabase = await createClient();
  const service = createServiceClient();

  // Products linked to existing orders cannot be hard-deleted (FK) and shouldn't
  // be — that would erase the product from order history and analytics. Archive
  // them instead (hidden from the catalog and the order picker). Only truly
  // unused products are permanently removed.
  const { count } = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) {
      redirect(`/products?error=${encodeURIComponent('Could not archive the product.')}`);
    }
    revalidatePath('/products');
    redirect('/products?archived=1');
  }

  const { data: existing } = await supabase
    .from('products')
    .select('photo_bucket, photo_path')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    redirect(`/products?error=${encodeURIComponent('Could not delete the product.')}`);
  }

  if (existing?.photo_path) {
    await service.storage.from(existing.photo_bucket ?? BUCKET).remove([existing.photo_path]);
  }

  revalidatePath('/products');
  redirect('/products?deleted=1');
}
