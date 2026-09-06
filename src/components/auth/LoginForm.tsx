'use client';

import { useActionState } from 'react';
import { signIn, type LoginState } from '@/lib/auth/actions';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

const initialState: LoginState = {};

export function LoginForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Email', 'البريد الإلكتروني')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          placeholder="you@nahlacake.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Password', 'كلمة المرور')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          placeholder="••••••••"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? tr(locale, 'Signing in…', 'جارٍ تسجيل الدخول…') : tr(locale, 'Sign in', 'تسجيل الدخول')}
      </button>
    </form>
  );
}
