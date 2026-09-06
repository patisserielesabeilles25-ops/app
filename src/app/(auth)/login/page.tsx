import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { LoginForm } from '@/components/auth/LoginForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = {
  title: 'Sign in — Nahla Cake Panel',
};

// Reads the session cookie to bounce already-authenticated users.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect('/');
  const locale = await getLocale();

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Les Abeilles" className="mx-auto mb-3 h-20 w-20 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Nahla Cake
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{tr(locale, 'Management Panel', 'لوحة الإدارة')}</p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-semibold text-neutral-800">{tr(locale, 'Sign in', 'تسجيل الدخول')}</h2>
          <LoginForm locale={locale} />
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          {tr(locale, 'Authorized staff only.', 'للموظفين المصرَّح لهم فقط.')}
        </p>
      </div>
    </main>
  );
}
