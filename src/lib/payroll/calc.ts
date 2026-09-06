/**
 * Pure payroll math (mirrors the DB generated columns / formulas) so it can be
 * unit-tested independently of the database.
 */

/** Line total for a magasin sale line / piece work: round(qty * unitPrice, 2). */
export function computeLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/** Piece-work amount: quantity × applied rate. */
export function computePieceAmount(quantity: number, rate: number): number {
  return computeLineTotal(quantity, rate);
}

/** Payroll remaining = gross + adjustments − advances − paid (matches DB column). */
export function computeRemaining(
  gross: number,
  adjustments: number,
  advances: number,
  paid: number,
): number {
  return gross + adjustments - advances - paid;
}

/** Next payroll status after a payment, given the new remaining. */
export function nextPayrollStatus(remainingAfter: number): 'PAID' | 'PARTIALLY_PAID' {
  return remainingAfter <= 0 ? 'PAID' : 'PARTIALLY_PAID';
}
