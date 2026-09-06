/**
 * Central, reusable order status definitions. Every interface (shop, laboratory,
 * delivery, calendar, dashboard) renders statuses from here so labels and colors
 * stay consistent.
 */

export type ProductionStatus = 'NEW' | 'IN_PRODUCTION' | 'READY';
export type DeliveryStatus = 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type Fulfillment = 'PICKUP' | 'DELIVERY';

export type BadgeTone =
  | 'neutral'
  | 'blue'
  | 'amber'
  | 'green'
  | 'rose'
  | 'violet';

type StatusMeta<T extends string> = Record<
  T,
  { label: string; tone: BadgeTone }
>;

export const PRODUCTION_STATUS: StatusMeta<ProductionStatus> = {
  NEW: { label: 'New', tone: 'blue' },
  IN_PRODUCTION: { label: 'In production', tone: 'amber' },
  READY: { label: 'Ready', tone: 'green' },
};

export const DELIVERY_STATUS: StatusMeta<DeliveryStatus> = {
  READY: { label: 'Ready', tone: 'green' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'violet' },
  DELIVERED: { label: 'Delivered', tone: 'neutral' },
};

export const FULFILLMENT: StatusMeta<Fulfillment> = {
  PICKUP: { label: 'Pickup', tone: 'neutral' },
  DELIVERY: { label: 'Delivery', tone: 'blue' },
};

/** Allowed production transitions (server + UI both enforce this). */
export const PRODUCTION_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  NEW: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['READY'],
  READY: [],
};

/** Allowed delivery transitions. */
export const DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
};

export function canTransitionProduction(
  from: ProductionStatus,
  to: ProductionStatus,
): boolean {
  return PRODUCTION_TRANSITIONS[from].includes(to);
}

export function canTransitionDelivery(
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}
