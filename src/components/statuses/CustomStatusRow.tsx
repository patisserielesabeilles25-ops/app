'use client';

import { useActionState, useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { updateCustomStatus, deleteCustomStatus, type StatusState } from '@/lib/statuses/actions';
import { CANONICAL_STATUSES } from '@/lib/statuses/constants';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: StatusState = {};

export function CustomStatusRow({
  status,
}: {
  status: { id: string; name: string; canonical: string };
}) {
  const locale = useLocale();
  const [editing, setEditing] = useState(false);
  const [state, updateAction] = useActionState(updateCustomStatus, initial);

  if (editing) {
    return (
      <li className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <form action={updateAction} className="flex flex-1 items-center gap-2">
            <input type="hidden" name="statusId" value={status.id} />
            <input
              name="name"
              defaultValue={status.name}
              autoFocus
              className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
            <select
              name="canonical"
              defaultValue={status.canonical}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {CANONICAL_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
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
      <span className="text-sm text-neutral-700">{status.name}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={tr(locale, 'Edit', 'تعديل')} onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <form action={deleteCustomStatus}>
          <input type="hidden" name="statusId" value={status.id} />
          <button type="submit" aria-label={tr(locale, 'Delete', 'حذف')} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-amber-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </li>
  );
}
