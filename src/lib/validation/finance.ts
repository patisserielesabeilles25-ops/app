import { z } from 'zod';

export const ACCEPTED_FINANCE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
export const MAX_FINANCE_BYTES = 5 * 1024 * 1024;

export const INCOME_CATEGORIES = ['PAYMENT', 'OTHER'] as const;
export const EXPENSE_CATEGORIES = ['PURCHASE', 'SERVICE', 'OTHER'] as const;

export const IncomeSchema = z.object({
  amount: z.coerce.number({ message: 'Enter an amount' }).positive('Amount must be positive').max(10_000_000),
  category: z.enum(INCOME_CATEGORIES).default('PAYMENT'),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  description: z.string().trim().max(500).optional().default(''),
});

export const ExpenseSchema = z.object({
  amount: z.coerce.number({ message: 'Enter an amount' }).positive('Amount must be positive').max(10_000_000),
  category: z.enum(EXPENSE_CATEGORIES).default('PURCHASE'),
  itemName: z.string().trim().max(200).optional().default(''),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  description: z.string().trim().max(500).optional().default(''),
});

export type IncomeInput = z.infer<typeof IncomeSchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
