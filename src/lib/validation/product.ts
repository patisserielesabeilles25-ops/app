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
    // Optional: a product can be just a name. Empty → null.
    diameterCm: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : v),
      z.coerce
        .number({ message: 'Enter a valid diameter' })
        .positive('Diameter must be greater than 0')
        .max(1000, 'Diameter looks too large')
        .nullable(),
    ),
    // Prices are no longer captured on the form; kept for legacy data (default 0).
    purchasePrice: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).optional().default(0),
    sellingPrice: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).optional().default(0),
  });

export type ProductInput = z.infer<typeof ProductSchema>;
