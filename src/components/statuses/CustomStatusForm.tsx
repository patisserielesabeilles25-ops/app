'use client';

import { useActionState } from 'react';
import { createCustomStatus, type StatusState } from '@/lib/statuses/actions';
import { CANONICAL_STATUSES } from '@/lib/statuses/constants';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: StatusState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function CustomStatusForm() {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createCustomStatus, initial);

  return (
    <form action={action} className="space-y-3">
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium text-neutral-600">{tr(locale, 'Custom status name', 'اسم الحالة المخصصة')}</label>
          <input id="name" name="name" placeholder={tr(locale, 'e.g. Waiting on client', 'مثال: بانتظار العميل')} className={inputCls} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="canonical" className="text-xs font-medium text-neutral-600">{tr(locale, 'Links to', 'مرتبطة بـ')}</label>
          <select id="canonical" name="canonical" className={inputCls} defaultValue="">
            <option value="" disabled>{tr(locale, 'Choose a status…', 'اختر حالة…')}</option>
            {CANONICAL_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Adding…', 'جارٍ الإضافة…') : tr(locale, 'Add', 'إضافة')}</Button>
      </div>
    </form>
  );
}
