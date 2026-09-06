'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALES, type Locale } from './config';

/** Persist the chosen UI locale in a cookie. */
export async function setLocale(locale: Locale): Promise<void> {
  if (!LOCALES.includes(locale)) return;
  const c = await cookies();
  c.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
