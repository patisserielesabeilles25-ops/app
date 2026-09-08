import type { CanonicalStatusKey } from '@/lib/statuses/constants';
import type {
  ProductionStatus,
  DeliveryStatus,
  Fulfillment,
} from '@/lib/orders/status';

const STAGE_KEYS: CanonicalStatusKey[] = ['NOUVEAU', 'EN_PREPARATION', 'EN_MASKAGE', 'EN_FINITION', 'READY'];

/** Whole days from today (midnight) until a yyyy-mm-dd date. Null if invalid. */
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Maps an order's current state to one of the canonical statuses.
 *
 * REPORTED is date-driven: any order whose delivery date is 3+ days away is
 * "scheduled" and shows REPORTED. Once 2 days or fewer remain it enters
 * production (EN_PREPARATION if not started yet, otherwise its real stage) —
 * matching the auto-start rule in migration 0041. Delivered / returned always
 * take precedence.
 */
export function orderCanonicalStatus(o: {
  production_status: ProductionStatus;
  delivery_status: DeliveryStatus | null;
  fulfillment: Fulfillment;
  returned_at: string | null;
  reported_at?: string | null;
  production_stage?: string | null;
  delivery_date?: string | null;
}): CanonicalStatusKey {
  if (o.returned_at) return 'RETURNED';
  if (o.delivery_status === 'DELIVERED') return 'DELIVERED';
  if (o.delivery_status === 'OUT_FOR_DELIVERY') return 'READY';

  // Scheduled for later → REPORTED while 3+ days remain (auto-starts at 2 days).
  const days = daysUntil(o.delivery_date);
  if (days !== null && days >= 3) return 'REPORTED';

  // Within 2 days (or past): show the real production/delivery status.
  if (o.delivery_status === 'READY') return 'READY';
  let stage: CanonicalStatusKey;
  if (o.production_stage && STAGE_KEYS.includes(o.production_stage as CanonicalStatusKey)) {
    stage = o.production_stage as CanonicalStatusKey;
  } else if (o.production_status === 'READY') {
    stage = 'READY';
  } else if (o.production_status === 'IN_PRODUCTION') {
    stage = 'EN_MASKAGE';
  } else {
    stage = 'NOUVEAU';
  }
  // A not-yet-started order that is now due → production begins at Maskage
  // (Preparation is auto-passed).
  if (stage === 'NOUVEAU') return 'EN_MASKAGE';
  return stage;
}
