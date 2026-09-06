'use client';

import { useActionState } from 'react';
import { recordIncome, recordExpense, type FinanceFormState } from '@/lib/finance/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: FinanceFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function EntryForm({
  type,
  categories,
  today,
}: {
  type: 'INCOME' | 'EXPENSE';
  categories: { id: string; name: string }[];
  today: string;
}) {
  const locale = useLocale();
  const action = type === 'INCOME' ? recordIncome : recordExpense;
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};
  const isExpense = type === 'EXPENSE';

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium text-neutral-700">{tr(locale, 'Amount', 'المبلغ')}</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" className={inputCls} required />
          {fe.amount ? <p className="text-xs text-amber-600">{fe.amount}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="occurredAt" className="text-sm font-medium text-neutral-700">{tr(locale, 'Date', 'التاريخ')}</label>
          <input id="occurredAt" name="occurredAt" type="date" defaultValue={today} className={inputCls} required />
          {fe.occurredAt ? <p className="text-xs text-amber-600">{fe.occurredAt}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium text-neutral-700">{tr(locale, 'Category', 'الفئة')}</label>
        <select id="categoryId" name="categoryId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'Uncategorized', 'غير مصنّف')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isExpense ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemName" className="text-sm font-medium text-neutral-700">{tr(locale, 'Item / supplier (optional)', 'البند / المورّد (اختياري)')}</label>
          <input id="itemName" name="itemName" className={inputCls} placeholder={tr(locale, 'e.g. Oven, flour, electricity bill…', 'مثال: فرن، دقيق، فاتورة الكهرباء…')} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-neutral-700">{tr(locale, 'Description', 'الوصف')}</label>
        <textarea id="description" name="description" rows={2} className={inputCls} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="attachment" className="text-sm font-medium text-neutral-700">{tr(locale, 'Receipt / document (optional)', 'إيصال / مستند (اختياري)')}</label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
        />
        <p className="text-xs text-neutral-400">{tr(locale, 'JPEG, PNG, WEBP or PDF · max 5 MB', 'JPEG أو PNG أو WEBP أو PDF · بحد أقصى 5 ميغابايت')}</p>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/finance" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : type === 'INCOME' ? tr(locale, 'Record income', 'تسجيل الدخل') : tr(locale, 'Record expense', 'تسجيل المصروف')}
        </Button>
      </div>
    </form>
  );
}
