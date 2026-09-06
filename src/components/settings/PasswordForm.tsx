'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { changePassword, type PasswordState } from '@/lib/settings/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PasswordState = {};

function PasswordField({
  id,
  label,
  toggle = true,
}: {
  id: string;
  label: string;
  toggle?: boolean;
}) {
  const locale = useLocale();
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={show ? 'text' : 'password'}
          minLength={8}
          required
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        {toggle ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? tr(locale, 'Hide', 'إخفاء') : tr(locale, 'Show', 'إظهار')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PasswordForm() {
  const locale = useLocale();
  const [state, action, pending] = useActionState(changePassword, initial);

  return (
    <form action={action} className="max-w-lg space-y-5" key={state.success ? 'done' : 'form'}>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {tr(locale, 'Password updated.', 'تم تحديث كلمة المرور.')}
        </p>
      ) : null}

      <PasswordField id="currentPassword" label={tr(locale, 'Current password', 'كلمة المرور الحالية')} />
      <PasswordField id="newPassword" label={tr(locale, 'New password', 'كلمة المرور الجديدة')} />
      <PasswordField id="confirmPassword" label={tr(locale, 'Confirm new password', 'تأكيد كلمة المرور الجديدة')} toggle={false} />

      <Button type="submit" disabled={pending}>
        {pending ? tr(locale, 'Updating…', 'جارٍ التحديث…') : tr(locale, 'Update password', 'تحديث كلمة المرور')}
      </Button>
    </form>
  );
}
