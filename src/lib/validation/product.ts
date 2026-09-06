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
    diameterCm: z.coerce
      .number({ message: 'Enter the diameter' })
      .positive('Diameter must be greater than 0')
      .max(1000, 'Diameter looks too large'),
    purchasePrice: z.coerce
      .number({ message: 'Enter the purchase price' })
      .min(0, 'Cannot be negative')
      .max(10_000_000),
    sellingPrice: z.coerce
      .number({ message: 'Enter the selling price' })
      .min(0, 'Cannot be negative')
      .max(10_000_000),
  });

export type ProductInput = z.infer<typeof ProductSchema>;
