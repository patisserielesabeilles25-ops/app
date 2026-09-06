import { describe, it, expect } from 'vitest';
import { getCustomRange, getRange } from '@/lib/reports/period';

describe('getCustomRange', () => {
  it('is a half-open range in business tz, end exclusive (next day)', () => {
    const r = getCustomRange('2026-09-01', '2026-09-30');
    expect(r.from).toBe('2026-09-01T00:00:00+01:00');
    expect(r.to).toBe('2026-10-01T00:00:00+01:00');
  });

  it('single day spans one day', () => {
    const r = getCustomRange('2026-09-04', '2026-09-04');
    expect(r.from).toBe('2026-09-04T00:00:00+01:00');
    expect(r.to).toBe('2026-09-05T00:00:00+01:00');
  });
});

describe('getRange presets', () => {
  it('month starts on the 1st and ends on the 1st of next month', () => {
    const r = getRange('month');
    expect(r.from).toMatch(/^\d{4}-\d{2}-01T00:00:00\+01:00$/);
    expect(r.to).toMatch(/^\d{4}-\d{2}-01T00:00:00\+01:00$/);
  });

  it('year starts and ends on Jan 1', () => {
    const r = getRange('year');
    expect(r.from).toMatch(/-01-01T00:00:00\+01:00$/);
    expect(r.to).toMatch(/-01-01T00:00:00\+01:00$/);
  });

  it('week is a 7-day half-open range', () => {
    const r = getRange('week');
    const from = new Date(r.from).getTime();
    const to = new Date(r.to).getTime();
    expect((to - from) / 86_400_000).toBe(7);
  });
});
