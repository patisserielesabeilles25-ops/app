'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

/**
 * Route-group error boundary for all authenticated pages.
 *
 * A server component that throws during render (e.g. a transient Supabase
 * timeout or cold-start hiccup) would otherwise surface Vercel's raw
 * "A server error occurred" page, which looks like a hard crash and gives the
 * user nowhere to go. This turns that into a recoverable in-app state: a clear
 * message, a Retry button (re-renders the segment), and the error digest so a
 * recurring problem can be reported and traced in the server logs.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();

  useEffect(() => {
    // Surfaces in the browser console for quick inspection; the full stack is
    // already recorded server-side by Next.js under the same digest.
    console.error('App route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-lg font-bold text-neutral-900">
        {tr(locale, "This page couldn't load", 'تعذّر تحميل هذه الصفحة')}
      </h1>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        {tr(
          locale,
          'A temporary error occurred. Your data is safe — please try again.',
          'حدث خطأ مؤقّت. بياناتك بأمان — يُرجى المحاولة مرة أخرى.',
        )}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
      >
        <RotateCw className="h-4 w-4" />
        {tr(locale, 'Try again', 'حاول مرة أخرى')}
      </button>
      {error.digest ? (
        <p className="mt-4 text-xs text-neutral-400">
          {tr(locale, 'Reference', 'المرجع')}: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
