'use client';

import { useActionState } from 'react';
import { createPeriod, type PayrollFormState } from '@/lib/payroll/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PayrollFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function PeriodForm({ today }: { today: string }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createPeriod, initial);

  return (
    <form action={action} className="space-y-3">
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="periodType" className={inputCls} defaultValue="MONTHLY">
          <option value="MONTHLY">{tr(locale, 'Monthly', 'شهري')}</option>
          <option value="WEEKLY">{tr(locale, 'Weekly', 'أسبوعي')}</option>
          <option value="DAILY">{tr(locale, 'Daily', 'يومي')}</option>
        </select>
        <input name="label" placeholder={tr(locale, 'Label (e.g. September 2026)', 'التسمية (مثال: September 2026)')} className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="startDate" type="date" defaultValue={today} className={inputCls} required />
        <input name="endDate" type="date" defaultValue={today} className={inputCls} required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>{pending ? tr(locale, 'Creating…', 'جارٍ الإنشاء…') : tr(locale, 'Create period', 'إنشاء فترة')}</Button>
    </form>
  );
}
