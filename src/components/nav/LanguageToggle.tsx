'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { setLocale } from '@/lib/i18n/actions';
import type { Locale } from '@/lib/i18n/config';

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await setLocale(next); router.refresh(); })}
      title={locale === 'ar' ? 'English' : 'العربية'}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
    >
      <Languages className="h-4 w-4" />
      {locale === 'ar' ? 'EN' : 'ع'}
    </button>
  );
}
