'use client';

import { useActionState } from 'react';
import { createUser, type AdminFormState } from '@/lib/admin/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { RemunerationFields } from '@/components/admin/RemunerationFields';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: AdminFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function CreateUserForm({
  roles,
  canManagePay = false,
}: {
  roles: { id: string; name: string }[];
  canManagePay?: boolean;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createUser, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium text-neutral-700">{tr(locale, 'Full name', 'الاسم الكامل')}</label>
        <input id="fullName" name="fullName" className={inputCls} required />
        {fe.fullName ? <p className="text-xs text-amber-600">{fe.fullName}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">{tr(locale, 'Email', 'البريد الإلكتروني')}</label>
        <input id="email" name="email" type="email" className={inputCls} required />
        {fe.email ? <p className="text-xs text-amber-600">{fe.email}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">{tr(locale, 'Temporary password', 'كلمة مرور مؤقتة')}</label>
        <input id="password" name="password" type="text" className={inputCls} required minLength={8} />
        {fe.password ? <p className="text-xs text-amber-600">{fe.password}</p> : null}
        <p className="text-xs text-neutral-400">{tr(locale, 'At least 8 characters. Share it securely with the user.', '8 أحرف على الأقل. شاركها مع المستخدم بشكل آمن.')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="roleId" className="text-sm font-medium text-neutral-700">{tr(locale, 'Role', 'الدور')}</label>
        <select id="roleId" name="roleId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'No role', 'بدون دور')}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {canManagePay ? (
        <div className="border-t border-neutral-100 pt-5">
          <RemunerationFields
            methodName="remMethod"
            amountName="remAmount"
            defaultMethod="MONTHLY"
            defaultAmount={0}
            amountRequired={false}
          />
          <p className="mt-2 text-xs text-neutral-400">{tr(locale, 'Optional — links a payroll employee to this user so pay is tracked.', 'اختياري — يربط موظفًا في كشوف الأجور بهذا المستخدم لتتبّع الأجر.')}</p>
        </div>
      ) : null}

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/users" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending}>{pending ? tr(locale, 'Creating…', 'جارٍ الإنشاء…') : tr(locale, 'Create user', 'إنشاء مستخدم')}</Button>
      </div>
    </form>
  );
}
