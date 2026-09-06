import Link from 'next/link';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

/**
 * Rendered when a server-side guard calls forbidden() — the user is
 * authenticated but lacks the required permission.
 */
export default async function Forbidden() {
  const locale = await getLocale();
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-amber-500">403</p>
        <h1 className="mt-2 text-xl font-bold text-neutral-900">
          {tr(locale, 'Access denied', 'تم رفض الوصول')}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {tr(
            locale,
            "You don't have permission to view this page. If you believe this is a mistake, contact an administrator.",
            'ليست لديك صلاحية لعرض هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، فتواصل مع المسؤول.',
          )}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-amber-500"
        >
          {tr(locale, 'Back to home', 'العودة إلى الرئيسية')}
        </Link>
      </div>
    </main>
  );
}
