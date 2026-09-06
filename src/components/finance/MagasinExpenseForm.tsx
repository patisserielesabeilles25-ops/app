'use client';

import { useActionState } from 'react';
import { recordMagasinExpense, type MagasinState } from '@/lib/magasin/actions';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: MagasinState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function MagasinExpenseForm({
  date,
  categories,
  agents = [],
}: {
  date: string;
  categories: { id: string; name: string }[];
  agents?: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(recordMagasinExpense, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="occurredAt" value={date} />
      {state.error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <select name="agent" className={inputCls} defaultValue="" required>
        <option value="" disabled>{tr(locale, 'Agent making the expense…', 'العون الذي يقوم بالمصروف…')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" type="number" min="0" step="0.01" placeholder={tr(locale, 'Amount', 'المبلغ')} className={inputCls} required />
        <select name="categoryId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'Category…', 'الفئة…')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <input name="description" placeholder={tr(locale, 'Description (optional)', 'الوصف (اختياري)')} className={inputCls} />
      <input
        name="attachment"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
      />
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Record expense', 'تسجيل المصروف')}
      </Button>
    </form>
  );
}
