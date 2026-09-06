/** Payment methods shared by payroll actions and the remuneration UI. */
export const PAYMENT_METHODS = ['PIECE_BASED', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Maps an employee payment method to the payroll_rate kind. */
export const RATE_KIND: Record<PaymentMethod, string> = {
  PIECE_BASED: 'PIECE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
};

export function isPaymentMethod(v: string): v is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}
