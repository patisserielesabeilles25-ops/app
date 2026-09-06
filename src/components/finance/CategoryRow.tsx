'use client';

import { useActionState, useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { updateCategory, deleteCategory, type ConfigState } from '@/lib/finance/config-actions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: ConfigState = {};

export function CategoryRow({
  category,
}: {
  category: { id: string; name: string; is_system: boolean };
}) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [state, updateAction] = useActionState(updateCategory, initial);

  if (editing) {
    return (
      <li className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
        <form action={updateAction} className="flex flex-1 items-center gap-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <input
            name="name"
            defaultValue={category.name}
            autoFocus
            className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button type="submit" aria-label={tr(locale, 'Save', 'حفظ')} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50">
            <Check className="h-4 w-4" />
          </button>
        </form>
        <button type="button" aria-label={tr(locale, 'Cancel', 'إلغاء')} onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
        </div>
        {state.error ? <p className="text-xs text-amber-600">{state.error}</p> : null}
      </li>
    );
  }

  return (
    <li className="group flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-neutral-50">
      <span className="text-sm text-neutral-700">{category.name}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={tr(locale, 'Edit', 'تعديل')}
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          <Pencil className="h-3.5 w-3.5" />
          {tr(locale, 'Edit', 'تعديل')}
        </button>
        <ConfirmDialog
          triggerLabel={
            <span className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
              {tr(locale, 'Delete', 'حذف')}
            </span>
          }
          title={tr(locale, 'Delete this category?', 'حذف هذه الفئة؟')}
          description={tr(locale, `"${category.name}" will be deleted. Existing transactions are not affected. A category in use cannot be deleted.`, `سيتم حذف «${category.name}». المعاملات الحالية لن تتأثر. لا يمكن حذف فئة قيد الاستخدام.`)}
          confirmLabel={tr(locale, 'Delete', 'حذف')}
          action={deleteCategory}
          hiddenFields={{ categoryId: category.id }}
        />
      </div>
    </li>
  );
}
