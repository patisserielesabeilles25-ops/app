import { Badge } from '@/components/ui/Badge';
import {
  PRODUCTION_STATUS,
  DELIVERY_STATUS,
  FULFILLMENT,
  type ProductionStatus,
  type DeliveryStatus,
  type Fulfillment,
} from '@/lib/orders/status';
import { canonicalLabel, canonicalTone } from '@/lib/statuses/constants';

export function ProductionStatusBadge({ status }: { status: ProductionStatus }) {
  const meta = PRODUCTION_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const meta = DELIVERY_STATUS[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function FulfillmentBadge({ value }: { value: Fulfillment }) {
  const meta = FULFILLMENT[value];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CanonicalStatusBadge({ statusKey }: { statusKey: string }) {
  return <Badge tone={canonicalTone(statusKey)}>{canonicalLabel(statusKey)}</Badge>;
}
