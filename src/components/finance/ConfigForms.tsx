'use client';

import { useActionState } from 'react';
import { createDepartment, createCategory, type ConfigState } from '@/lib/finance/config-actions';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: ConfigState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function DepartmentForm() {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createDepartment, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{state.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="key" placeholder={tr(locale, 'KEY (e.g. WAREHOUSE)', 'المفتاح (مثال: WAREHOUSE)')} className={inputCls} required />
        <input name="name" placeholder={tr(locale, 'Display name', 'اسم العرض')} className={inputCls} required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>{pending ? tr(locale, 'Adding…', 'جارٍ الإضافة…') : tr(locale, 'Add department', 'إضافة قسم')}</Button>
    </form>
  );
}

export function CategoryForm() {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createCategory, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{state.error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="key" placeholder={tr(locale, 'KEY (e.g. MARKETING)', 'المفتاح (مثال: MARKETING)')} className={inputCls} required />
        <input name="name" placeholder={tr(locale, 'Display name', 'اسم العرض')} className={inputCls} required />
        <select name="direction" className={inputCls} defaultValue="EXPENSE">
          <option value="EXPENSE">{tr(locale, 'Expense', 'مصروف')}</option>
          <option value="INCOME">{tr(locale, 'Income', 'دخل')}</option>
          <option value="BOTH">{tr(locale, 'Both', 'كلاهما')}</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>{pending ? tr(locale, 'Adding…', 'جارٍ الإضافة…') : tr(locale, 'Add category', 'إضافة فئة')}</Button>
    </form>
  );
}
