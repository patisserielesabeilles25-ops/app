'use client';

import { Printer } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

/** Screen-only button that triggers the browser print dialog. Hidden when printing. */
export function PrintButton() {
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed right-5 top-5 z-10 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-lg hover:bg-amber-500"
    >
      <Printer className="h-4 w-4" />
      {tr(locale, 'Print', 'طباعة')}
    </button>
  );
}
