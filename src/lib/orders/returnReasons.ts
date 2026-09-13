import type { Locale } from '@/lib/i18n/config';

/**
 * Predefined cancellation / return reasons. Stored as a stable KEY in
 * orders.return_reason so analytics can group them reliably regardless of the
 * viewer's language. Labels follow the app's EN/AR convention (see tr()).
 */
export const RETURN_REASONS = [
  { key: 'DUPLICATE', en: 'Duplicate order', ar: 'طلب مكرّر' },
  { key: 'UNREACHABLE', en: 'Customer unreachable', ar: 'تعذّر الوصول إلى العميل' },
  { key: 'WRONG_NUMBER', en: 'Wrong phone number', ar: 'رقم هاتف خاطئ' },
  { key: 'REFUSED', en: 'Customer refused the order', ar: 'العميل رفض الطلب' },
  { key: 'NO_ORDER', en: 'Customer never ordered', ar: 'العميل لم يطلب شيئًا' },
  { key: 'BOUGHT_ELSEWHERE', en: 'Ordered elsewhere', ar: 'طلب من مكان آخر' },
  { key: 'NOT_SERIOUS', en: 'Customer not serious', ar: 'عميل غير جاد' },
  { key: 'PRICE', en: 'Price disagreement', ar: 'خلاف على السعر' },
  { key: 'OUT_OF_TOWN', en: 'Customer away / travelling', ar: 'العميل مسافر' },
  { key: 'OTHER', en: 'Other reason', ar: 'سبب آخر' },
] as const;

export type ReturnReasonKey = (typeof RETURN_REASONS)[number]['key'];

const BY_KEY = new Map(RETURN_REASONS.map((r) => [r.key, r]));

/** Human label for a stored reason key (falls back to the raw value, then Unspecified). */
export function returnReasonLabel(key: string | null | undefined, locale: Locale): string {
  if (!key) return locale === 'ar' ? 'غير محدّد' : 'Unspecified';
  const r = BY_KEY.get(key as ReturnReasonKey);
  if (!r) return key; // legacy free-text reason
  return locale === 'ar' ? r.ar : r.en;
}
