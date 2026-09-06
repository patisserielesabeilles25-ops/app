'use client';

import { useActionState } from 'react';
import { createEmployee, updateEmployee, type PayrollFormState } from '@/lib/payroll/actions';
import { PAYMENT_METHODS } from '@/lib/validation/payroll';
import { Button, LinkButton } from '@/components/ui/Button';
import type { Employee } from '@/lib/payroll/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

const initial: PayrollFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

const DEPARTMENTS = ['LABORATORY', 'SHOP', 'DELIVERY', 'ADMINISTRATION', 'GENERAL', 'INVESTMENT'];

function methodLabel(locale: Locale, key: string): string {
  const labels: Record<string, string> = {
    PIECE_BASED: tr(locale, 'Piece-based', 'بالقطعة'),
    DAILY: tr(locale, 'Daily', 'يومي'),
    WEEKLY: tr(locale, 'Weekly', 'أسبوعي'),
    MONTHLY: tr(locale, 'Monthly', 'شهري'),
  };
  return labels[key] ?? key;
}

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const locale = useLocale();
  const isEdit = !!employee;
  const [state, action, pending] = useActionState(isEdit ? updateEmployee : createEmployee, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {isEdit ? <input type="hidden" name="employeeId" value={employee.id} /> : null}
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium text-neutral-700">{tr(locale, 'Full name', 'الاسم الكامل')}</label>
          <input id="fullName" name="fullName" defaultValue={employee?.full_name} className={inputCls} required />
          {fe.fullName ? <p className="text-xs text-amber-600">{fe.fullName}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium text-neutral-700">{tr(locale, 'Code (optional)', 'الرمز (اختياري)')}</label>
          <input id="code" name="code" defaultValue={employee?.code ?? ''} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-neutral-700">{tr(locale, 'Phone (optional)', 'الهاتف (اختياري)')}</label>
          <input id="phone" name="phone" defaultValue={employee?.phone ?? ''} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="job" className="text-sm font-medium text-neutral-700">{tr(locale, 'Job / role (optional)', 'الوظيفة / الدور (اختياري)')}</label>
          <input id="job" name="job" defaultValue={employee?.job ?? ''} placeholder={tr(locale, 'e.g. Decoration, Montage', 'مثال: تزيين، تركيب')} className={inputCls} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="department" className="text-sm font-medium text-neutral-700">{tr(locale, 'Department', 'القسم')}</label>
          <select id="department" name="department" defaultValue={employee?.department ?? 'LABORATORY'} className={inputCls}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="paymentMethod" className="text-sm font-medium text-neutral-700">{tr(locale, 'Payment method', 'طريقة الدفع')}</label>
          <select id="paymentMethod" name="paymentMethod" defaultValue={employee?.payment_method ?? 'MONTHLY'} className={inputCls}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(locale, m)}</option>)}
          </select>
        </div>
      </div>

      {isEdit ? (
        <label className="flex items-center gap-2.5 text-sm text-neutral-700">
          <input type="checkbox" name="isActive" defaultChecked={employee.is_active} className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-300" />
          {tr(locale, 'Active', 'نشط')}
        </label>
      ) : null}

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/payroll" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : isEdit ? tr(locale, 'Save changes', 'حفظ التغييرات') : tr(locale, 'Create employee', 'إنشاء موظف')}</Button>
      </div>
    </form>
  );
}
