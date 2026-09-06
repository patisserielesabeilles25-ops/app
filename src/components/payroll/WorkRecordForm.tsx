'use client';

import { useActionState } from 'react';
import { addWorkRecord, type PayrollFormState } from '@/lib/payroll/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PayrollFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function WorkRecordForm({ employeeId, today }: { employeeId: string; today: string }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(addWorkRecord, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <input name="workDate" type="date" defaultValue={today} className={inputCls} required />
        <input name="quantity" type="number" min="0" step="1" placeholder={tr(locale, 'Quantity', 'الكمية')} className={inputCls} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input name="workCategory" placeholder={tr(locale, 'Work category (e.g. Decoration)', 'فئة العمل (مثال: تزيين)')} className={inputCls} />
        <input name="productSize" placeholder={tr(locale, 'Size (e.g. 20 CM)', 'المقاس (مثال: 20 CM)')} className={inputCls} />
      </div>
      <p className="text-xs text-neutral-400">{tr(locale, 'The rate is resolved from the configured rates.', 'يُحدَّد المعدل من المعدلات المُعدّة.')}</p>
      <Button type="submit" size="sm" disabled={pending}>{pending ? tr(locale, 'Adding…', 'جارٍ الإضافة…') : tr(locale, 'Add work', 'إضافة عمل')}</Button>
    </form>
  );
}
