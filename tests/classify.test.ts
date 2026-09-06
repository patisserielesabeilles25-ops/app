import { describe, it, expect } from 'vitest';
import { inferSource } from '@/lib/finance/classify';

describe('inferSource', () => {
  it('maps categories to ledger sources', () => {
    expect(inferSource('GOODS')).toBe('PURCHASE');
    expect(inferSource('MACHINES')).toBe('MACHINE');
    expect(inferSource('ASSET_SALE')).toBe('MACHINE');
    expect(inferSource('INVESTMENT')).toBe('INVESTMENT');
    expect(inferSource('DELIVERY_FEE')).toBe('DELIVERY');
  });
  it('defaults to OTHER', () => {
    expect(inferSource(null)).toBe('OTHER');
    expect(inferSource('SHOP_RENT')).toBe('OTHER');
    expect(inferSource('WHATEVER')).toBe('OTHER');
  });
});
