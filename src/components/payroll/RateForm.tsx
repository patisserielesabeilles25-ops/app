'use client';

import { useActionState } from 'react';
import { createRate, type PayrollFormState } from '@/lib/payroll/actions';
import { RATE_KINDS } from '@/lib/validation/payroll';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: PayrollFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function RateForm({
  employees,
  today,
}: {
  employees: { id: string; full_name: string }[];
  today: string;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createRate, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <select name="employeeId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'Any employee (by job)', 'أي موظف (حسب الوظيفة)')}</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select name="rateKind" className={inputCls} defaultValue="PIECE">
          {RATE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input name="job" placeholder={tr(locale, 'Job (e.g. Decoration)', 'الوظيفة (مثال: تزيين)')} className={inputCls} />
        <input name="workCategory" placeholder={tr(locale, 'Work category', 'فئة العمل')} className={inputCls} />
        <input name="productSize" placeholder={tr(locale, 'Size (e.g. 20 CM)', 'المقاس (مثال: 20 CM)')} className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input name="rate" type="number" step="0.01" min="0" placeholder={tr(locale, 'Rate', 'المعدل')} className={inputCls} required />
          {fe.rate ? <p className="mt-1 text-xs text-amber-600">{fe.rate}</p> : null}
        </div>
        <input name="effectiveFrom" type="date" defaultValue={today} className={inputCls} required />
      </div>

      <Button type="submit" size="sm" disabled={pending}>{pending ? tr(locale, 'Adding…', 'جارٍ الإضافة…') : tr(locale, 'Add rate', 'إضافة معدل')}</Button>
    </form>
  );
}
