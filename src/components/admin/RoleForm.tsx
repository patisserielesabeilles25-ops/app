'use client';

import { useActionState } from 'react';
import { createRole, updateRole, type AdminFormState } from '@/lib/admin/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: AdminFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function RoleForm({
  mode,
  permissions,
  roleId,
  defaults,
  isSystem = false,
}: {
  mode: 'create' | 'edit';
  permissions: { id: string; key: string }[];
  roleId?: string;
  defaults?: { key: string; name: string; description: string; permissionIds: string[] };
  isSystem?: boolean;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    mode === 'create' ? createRole : updateRole,
    initial,
  );
  const fe = state.fieldErrors ?? {};
  const assigned = new Set(defaults?.permissionIds ?? []);

  // Group permissions by the segment before the first dot.
  const groups = new Map<string, { id: string; key: string }[]>();
  for (const p of permissions) {
    const g = p.key.split('.')[0];
    const list = groups.get(g) ?? [];
    list.push(p);
    groups.set(g, list);
  }

  return (
    <form action={action} className="space-y-6">
      {roleId ? <input type="hidden" name="roleId" value={roleId} /> : null}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="key" className="text-sm font-medium text-neutral-700">{tr(locale, 'Key', 'المفتاح')}</label>
          <input
            id="key"
            name="key"
            defaultValue={defaults?.key}
            className={inputCls}
            placeholder={tr(locale, 'e.g. cashier', 'مثال: cashier')}
            required
            readOnly={mode === 'edit'}
          />
          {mode === 'edit' ? <p className="text-xs text-neutral-400">{tr(locale, 'Key cannot be changed.', 'لا يمكن تغيير المفتاح.')}</p> : null}
          {fe.key ? <p className="text-xs text-amber-600">{fe.key}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-neutral-700">{tr(locale, 'Name', 'الاسم')}</label>
          <input id="name" name="name" defaultValue={defaults?.name} className={inputCls} required />
          {fe.name ? <p className="text-xs text-amber-600">{fe.name}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-neutral-700">{tr(locale, 'Description', 'الوصف')}</label>
        <input id="description" name="description" defaultValue={defaults?.description} className={inputCls} />
      </div>

      <div className="space-y-4">
        <span className="text-sm font-medium text-neutral-700">{tr(locale, 'Permissions', 'الصلاحيات')}</span>
        {[...groups.entries()].map(([group, perms]) => (
          <div key={group}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">{group}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {perms.map((p) => (
                <label key={p.id} className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700">
                  <input type="checkbox" name="permissionIds" value={p.id} defaultChecked={assigned.has(p.id)} className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-300" />
                  {p.key}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isSystem ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {tr(locale, 'This is a system role. Changing its permissions affects core access.', 'هذا دور نظامي. تغيير صلاحياته يؤثر على الوصول الأساسي.')}
        </p>
      ) : null}

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/roles" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : mode === 'create' ? tr(locale, 'Create role', 'إنشاء دور') : tr(locale, 'Save role', 'حفظ الدور')}
        </Button>
      </div>
    </form>
  );
}
