import type { Locale } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/t';

/**
 * Canonical status triggers for WhatsApp automations. `key` mirrors the status
 * keys used by the order pipeline (and the DB enqueue trigger); labels are what
 * users see in the trigger picker. Client-safe (no server-only imports).
 */
export type WhatsAppTrigger = {
  key: string;
  en: string;
  ar: string;
  emoji: string;
};

export const WHATSAPP_TRIGGERS: WhatsAppTrigger[] = [
  { key: 'NOUVEAU', en: 'New', ar: 'جديد', emoji: '🆕' },
  { key: 'EN_PREPARATION', en: 'In preparation', ar: 'قيد التحضير', emoji: '👩‍🍳' },
  { key: 'EN_MASKAGE', en: 'Masking', ar: 'التغطية', emoji: '🎨' },
  { key: 'EN_FINITION', en: 'Finishing', ar: 'التشطيب', emoji: '✨' },
  { key: 'READY', en: 'Ready', ar: 'جاهزة', emoji: '✅' },
  { key: 'OUT_FOR_DELIVERY', en: 'Out for delivery', ar: 'قيد التوصيل', emoji: '🚚' },
  { key: 'DELIVERED', en: 'Delivered', ar: 'مُسلّمة', emoji: '📦' },
  { key: 'RETURNED', en: 'Returned', ar: 'مُرتجعة', emoji: '↩️' },
  { key: 'REPORTED', en: 'Reported', ar: 'مؤجلة', emoji: '⏳' },
];

const TRIGGER_BY_KEY = new Map(WHATSAPP_TRIGGERS.map((t) => [t.key, t]));

/** Localized label for a canonical trigger key (falls back to the key). */
export function triggerLabel(locale: Locale, key: string): string {
  const t = TRIGGER_BY_KEY.get(key);
  return t ? tr(locale, t.en, t.ar) : key;
}

export function triggerEmoji(key: string): string {
  return TRIGGER_BY_KEY.get(key)?.emoji ?? '🔔';
}

/**
 * Message variables that can be inserted into an automation message. The DB
 * (`whatsapp_render`) resolves these tokens when a message is enqueued.
 */
export type WhatsAppVariable = {
  token: string;
  en: string;
  ar: string;
};

export const WHATSAPP_VARIABLES: WhatsAppVariable[] = [
  { token: '{name}', en: 'Customer name', ar: 'اسم العميل' },
  { token: '{reference}', en: 'Order reference', ar: 'مرجع الطلب' },
  { token: '{product}', en: 'Product', ar: 'المنتج' },
  { token: '{size}', en: 'Size', ar: 'الحجم' },
  { token: '{total}', en: 'Total', ar: 'الإجمالي' },
  { token: '{advance}', en: 'Advance', ar: 'الدفعة المقدمة' },
  { token: '{remaining}', en: 'Remaining', ar: 'المتبقي' },
  { token: '{delivery_fee}', en: 'Delivery fee', ar: 'رسوم التوصيل' },
  { token: '{delivery_date}', en: 'Delivery date', ar: 'تاريخ التوصيل' },
  { token: '{delivery_time}', en: 'Delivery time', ar: 'وقت التوصيل' },
  { token: '{fulfillment}', en: 'Fulfillment', ar: 'طريقة التسليم' },
  { token: '{status}', en: 'Status', ar: 'الحالة' },
  { token: '{phone}', en: 'Phone', ar: 'الهاتف' },
  { token: '{shop}', en: 'Shop', ar: 'المتجر' },
];

export const VARIABLES_COUNT = WHATSAPP_VARIABLES.length;

/** Accepted media for automations/templates. */
export const ACCEPTED_MEDIA_PREFIXES = ['image/', 'video/'];
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16 MB
