import type { Locale } from './config';

/** Inline translation helper: returns the Arabic string in Arabic locale, else English. */
export function tr(locale: Locale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}
