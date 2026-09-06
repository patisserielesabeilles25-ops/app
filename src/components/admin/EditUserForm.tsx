'use client';

import { useActionState } from 'react';
import { updateUser, type AdminFormState } from '@/lib/admin/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: AdminFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function EditUserForm({
  userId,
  fullName,
  isActive,
  allRoles,
  assignedRoleIds,
}: {
  userId: string;
  fullName: string;
  isActive: boolean;
  allRoles: { id: string; name: string }[];
  assignedRoleIds: string[];
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(updateUser, initial);
  const fe = state.fieldErrors ?? {};
  const assigned = new Set(assignedRoleIds);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-neutral-700">{tr(locale, 'Full name', 'الاسم الكامل')}</label>
        <input id="fullName" name="fullName" defaultValue={fullName} className={inputCls} required />
        {fe.fullName ? <p className="text-xs text-amber-600">{fe.fullName}</p> : null}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-neutral-700">
        <input type="checkbox" name="isActive" defaultChecked={isActive} className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-300" />
        {tr(locale, 'Account active', 'الحساب نشط')}
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">{tr(locale, 'Roles', 'الأدوار')}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {allRoles.map((r) => (
            <label key={r.id} className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
              <input type="checkbox" name="roleIds" value={r.id} defaultChecked={assigned.has(r.id)} className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-300" />
              {r.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/users" variant="secondary">{tr(locale, 'Back', 'رجوع')}</LinkButton>
        <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save changes', 'حفظ التغييرات')}</Button>
      </div>
    </form>
  );
}
