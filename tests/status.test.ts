import { describe, it, expect } from 'vitest';
import { canTransitionProduction, canTransitionDelivery } from '@/lib/orders/status';

describe('production transitions', () => {
  it('allows the valid forward path', () => {
    expect(canTransitionProduction('NEW', 'IN_PRODUCTION')).toBe(true);
    expect(canTransitionProduction('IN_PRODUCTION', 'READY')).toBe(true);
  });
  it('rejects skips and backward moves', () => {
    expect(canTransitionProduction('NEW', 'READY')).toBe(false);
    expect(canTransitionProduction('READY', 'NEW')).toBe(false);
    expect(canTransitionProduction('READY', 'IN_PRODUCTION')).toBe(false);
  });
});

describe('delivery transitions', () => {
  it('allows the valid forward path', () => {
    expect(canTransitionDelivery('READY', 'OUT_FOR_DELIVERY')).toBe(true);
    expect(canTransitionDelivery('OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
  });
  it('rejects skips and backward moves', () => {
    expect(canTransitionDelivery('READY', 'DELIVERED')).toBe(false);
    expect(canTransitionDelivery('DELIVERED', 'OUT_FOR_DELIVERY')).toBe(false);
  });
});
