'use client';

import { useActionState } from 'react';
import { updateClient, type ClientFormState } from '@/lib/clients/actions';
import { Button } from '@/components/ui/Button';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: ClientFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function ClientEditForm({
  client,
}: {
  client: {
    id: string;
    name: string;
    phone: string;
    date_of_birth: string | null;
    notes: string | null;
  };
}) {
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(updateClient, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="clientId" value={client.id} />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-neutral-700">{tr(locale, 'Name', 'الاسم')}</label>
          <input id="name" name="name" defaultValue={client.name} className={inputCls} required />
          {fe.name ? <p className="text-xs text-amber-600">{fe.name}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium text-neutral-700">{tr(locale, 'Phone', 'الهاتف')}</label>
          <input id="phone" name="phone" defaultValue={client.phone} className={inputCls} required />
          {fe.phone ? <p className="text-xs text-amber-600">{fe.phone}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dateOfBirth" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Date of birth', 'تاريخ الميلاد')}
        </label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={client.date_of_birth ?? ''}
          className={inputCls}
        />
        {fe.dateOfBirth ? <p className="text-xs text-amber-600">{fe.dateOfBirth}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-neutral-700">{tr(locale, 'Notes', 'ملاحظات')}</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={client.notes ?? ''} className={inputCls} />
      </div>

      <div className="flex justify-end border-t border-neutral-100 pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save client', 'حفظ العميل')}
        </Button>
      </div>
    </form>
  );
}
