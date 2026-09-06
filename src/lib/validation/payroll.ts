import { z } from 'zod';

export const PAYMENT_METHODS = ['PIECE_BASED', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export const RATE_KINDS = ['PIECE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

export const EmployeeSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(120),
  code: z.string().trim().max(40).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  job: z.string().trim().max(80).optional().default(''),
  department: z.string().trim().max(40).default('LABORATORY'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  isActive: z.boolean().default(true),
});

export const RateSchema = z.object({
  employeeId: z.string().uuid().optional().or(z.literal('')),
  job: z.string().trim().max(80).optional().default(''),
  workCategory: z.string().trim().max(80).optional().default(''),
  productSize: z.string().trim().max(40).optional().default(''),
  rate: z.coerce.number().min(0, 'Rate cannot be negative').max(10_000_000),
  rateKind: z.enum(RATE_KINDS),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
});
