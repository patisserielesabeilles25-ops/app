'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n/config';

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Current UI locale inside client components. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
