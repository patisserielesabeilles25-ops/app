import { describe, it, expect } from 'vitest';
import {
  computeLineTotal,
  computePieceAmount,
  computeRemaining,
  nextPayrollStatus,
} from '@/lib/payroll/calc';

describe('payroll math', () => {
  it('piece amount = qty × rate (the §78 example)', () => {
    expect(computePieceAmount(5, 500)).toBe(2500);
  });

  it('line totals round to 2 decimals', () => {
    expect(computeLineTotal(2, 500)).toBe(1000);
    expect(computeLineTotal(3, 250)).toBe(750);
    expect(computeLineTotal(1.5, 3.33)).toBe(5); // 4.995 -> 5.00
  });

  it('remaining = gross + adj − advances − paid', () => {
    // §78: gross 2500, advance 1000 -> remaining 1500
    expect(computeRemaining(2500, 0, 1000, 0)).toBe(1500);
    // after paying 1500 -> remaining 0
    expect(computeRemaining(2500, 0, 1000, 1500)).toBe(0);
  });

  it('status advances to PAID only when fully settled', () => {
    expect(nextPayrollStatus(0)).toBe('PAID');
    expect(nextPayrollStatus(-0.01)).toBe('PAID');
    expect(nextPayrollStatus(500)).toBe('PARTIALLY_PAID');
  });
});
