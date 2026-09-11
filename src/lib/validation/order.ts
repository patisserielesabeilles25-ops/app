import { z } from 'zod';

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB

/** Cake coating / finish — one must be chosen on every order. */
export const COATING_OPTIONS = ['Pâte à Sucre', 'Ganache', 'Voulaire', 'Crème Chantilly'] as const;

/**
 * Order creation input. Shared by the client form and the server action so
 * validation rules live in one place. Server validation is authoritative and is
 * additionally backed by DB CHECK constraints and the create_order function.
 */
export const CreateOrderSchema = z
  .object({
    customerName: z.string().trim().min(1, 'Customer name is required').max(120),
    customerPhone: z.string().trim().min(4, 'Enter a valid phone number').max(30),
    cakeSizeCm: z.string().trim().min(1, 'Enter the cake size').max(120),
    description: z.string().trim().max(2000).optional().default(''),
    fourage: z.string().trim().max(500).optional().default(''),
    coating: z.enum(COATING_OPTIONS, { message: 'Choose a coating' }),
    deliveryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a delivery date'),
    deliveryTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a delivery time'),
    deliveryRequired: z.boolean().default(false),
    deliveryAddress: z.string().trim().max(300).optional().default(''),
    deliveryAmount: z.coerce.number().min(0, 'Cannot be negative').max(1_000_000).default(0),
    totalAmount: z.coerce
      .number({ message: 'Enter the total amount' })
      .min(0, 'Cannot be negative')
      .max(10_000_000),
    montageAmount: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).default(0),
    advancePayment: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).default(0),
    receivedBy: z.string().trim().optional().default(''),
  })
  .refine((d) => d.advancePayment <= d.totalAmount + d.montageAmount + d.deliveryAmount, {
    message: 'Advance cannot exceed the total amount',
    path: ['advancePayment'],
  });

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/** Operational fields only — used when editing (amounts are gated separately). */
export const OperationalOrderSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  customerPhone: z.string().trim().min(4, 'Enter a valid phone number').max(30),
  cakeSizeCm: z.string().trim().min(1, 'Enter the cake size').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  fourage: z.string().trim().max(500).optional().default(''),
  coating: z.enum(COATING_OPTIONS, { message: 'Choose a coating' }),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a delivery date'),
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a delivery time'),
  deliveryRequired: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(300).optional().default(''),
});

/** Financial fields only — applied on edit when the user has finance permission. */
export const FinancialOrderSchema = z
  .object({
    totalAmount: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000),
    montageAmount: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).default(0),
    advancePayment: z.coerce.number().min(0, 'Cannot be negative').max(10_000_000).default(0),
    deliveryAmount: z.coerce.number().min(0, 'Cannot be negative').max(1_000_000).default(0),
  })
  .refine((d) => d.advancePayment <= d.totalAmount + d.montageAmount + d.deliveryAmount, {
    message: 'Advance cannot exceed the total amount',
    path: ['advancePayment'],
  });
