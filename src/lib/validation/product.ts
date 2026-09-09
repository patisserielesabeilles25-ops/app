import { z } from 'zod';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Product input. Shared by the client form and the server action so validation
 * lives in one place. Server validation is authoritative and is additionally
 * backed by DB CHECK constraints.
 */
export const ProductSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(''),
    // Free-text size — any value, or empty. A number is parsed out for diameter_cm.
    sizeLabel: z.string().trim().max(120).optional().default(''),
    // Prices are no longer captured on the form; kept for legacy data (default 0).
    purchasePrice: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).optional().default(0),
    sellingPrice: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).optional().default(0),
  });

export type ProductInput = z.infer<typeof ProductSchema>;
