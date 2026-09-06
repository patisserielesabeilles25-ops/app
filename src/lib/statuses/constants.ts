import type { BadgeTone } from '@/lib/orders/status';

/**
 * The fixed, hardcoded (canonical) statuses of the order pipeline. Custom
 * statuses always link to exactly one of these. These keys are stable
 * identifiers; the labels are what users see.
 */
export type CanonicalStatusKey =
  | 'NOUVEAU'
  | 'EN_PREPARATION'
  | 'EN_MASKAGE'
  | 'EN_FINITION'
  | 'READY'
  | 'REPORTED'
  | 'DELIVERED'
  | 'RETURNED';

export const CANONICAL_STATUSES: {
  key: CanonicalStatusKey;
  label: string;
  tone: BadgeTone;
  hint?: string;
  links?: { href: string; label: string }[];
}[] = [
  { key: 'NOUVEAU', label: 'NOUVEAU', tone: 'blue' },
  { key: 'EN_PREPARATION', label: 'EN PRÉPARATION', tone: 'amber' },
  { key: 'EN_MASKAGE', label: 'EN MASKAGE', tone: 'amber' },
  { key: 'EN_FINITION', label: 'EN FINITION', tone: 'violet' },
  { key: 'READY', label: 'READY', tone: 'green' },
  {
    key: 'REPORTED',
    label: 'REPORTED',
    tone: 'amber',
    hint: 'Order postponed / rescheduled — sets delivery-or-pickup, a new delivery date (shown on the Calendar) and delivery time.',
    links: [
      { href: '/calendar', label: 'Calendar' },
      { href: '/orders/new', label: 'Delivery / pickup & time' },
    ],
  },
  { key: 'DELIVERED', label: 'DELIVERED', tone: 'neutral' },
  { key: 'RETURNED', label: 'RETURNED', tone: 'rose' },
];

export const CANONICAL_KEYS = CANONICAL_STATUSES.map((s) => s.key);

export function canonicalLabel(key: string): string {
  return CANONICAL_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function canonicalTone(key: string): BadgeTone {
  return CANONICAL_STATUSES.find((s) => s.key === key)?.tone ?? 'neutral';
}

export function isCanonicalKey(v: string): v is CanonicalStatusKey {
  return (CANONICAL_KEYS as string[]).includes(v);
}
