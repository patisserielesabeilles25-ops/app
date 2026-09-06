'use client';

import { useActionState } from 'react';
import { recordAdvance, type PayrollFormState } from '@/lib/payroll/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PayrollFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function AdvanceForm({ employeeId, today }: { employeeId: string; today: string }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(recordAdvance, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" type="number" min="0" step="0.01" placeholder={tr(locale, 'Amount', 'المبلغ')} className={inputCls} required />
        <input name="advanceDate" type="date" defaultValue={today} className={inputCls} required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Record advance', 'تسجيل سلفة')}</Button>
    </form>
  );
}
