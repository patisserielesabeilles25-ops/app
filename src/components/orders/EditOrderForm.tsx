'use client';

import { useActionState, useState } from 'react';
import { updateOrder, type UpdateOrderState } from '@/lib/orders/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { formatAmount } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: UpdateOrderState = {};

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export type OrderDefaults = {
  id: string;
  customerName: string;
  customerPhone: string;
  cakeSizeCm: number;
  description: string;
  deliveryDate: string;
  deliveryTime: string;
  deliveryRequired: boolean;
  totalAmount?: number;
  montageAmount?: number;
  advancePayment?: number;
  deliveryAmount?: number;
};

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-amber-600">{error}</p> : null}
    </div>
  );
}

export function EditOrderForm({
  defaults,
  canFinance,
}: {
  defaults: OrderDefaults;
  canFinance: boolean;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(updateOrder, initial);
  const [total, setTotal] = useState(String(defaults.totalAmount ?? ''));
  const [montage, setMontage] = useState(String(defaults.montageAmount ?? ''));
  const [advance, setAdvance] = useState(String(defaults.advancePayment ?? ''));
  const [delivery, setDelivery] = useState(defaults.deliveryRequired);
  const [deliveryAmt, setDeliveryAmt] = useState(String(defaults.deliveryAmount ?? ''));
  const remaining = Math.max(
    (parseFloat(total) || 0) +
      (parseFloat(montage) || 0) +
      (delivery ? parseFloat(deliveryAmt) || 0 : 0) -
      (parseFloat(advance) || 0),
    0,
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="orderId" value={defaults.id} />

      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {state.error}
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Customer', 'العميل')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(locale, 'Customer name', 'اسم العميل')} htmlFor="customerName" error={fe.customerName}>
            <input id="customerName" name="customerName" defaultValue={defaults.customerName} className={inputCls} required />
          </Field>
          <Field label={tr(locale, 'Phone number', 'رقم الهاتف')} htmlFor="customerPhone" error={fe.customerPhone}>
            <input id="customerPhone" name="customerPhone" defaultValue={defaults.customerPhone} className={inputCls} required />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Delivery / pickup', 'التوصيل / الاستلام')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(locale, 'Delivery date', 'تاريخ التوصيل')} htmlFor="deliveryDate" error={fe.deliveryDate}>
            <input id="deliveryDate" name="deliveryDate" type="date" defaultValue={defaults.deliveryDate} className={inputCls} required />
          </Field>
          <Field label={tr(locale, 'Delivery time', 'وقت التوصيل')} htmlFor="deliveryTime" error={fe.deliveryTime}>
            <input id="deliveryTime" name="deliveryTime" type="time" defaultValue={defaults.deliveryTime} className={inputCls} required />
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="deliveryRequired"
            checked={delivery}
            onChange={(e) => setDelivery(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-amber-500 focus:ring-amber-300"
          />
          {tr(locale, 'This order requires delivery', 'هذا الطلب يتطلب التوصيل')}
        </label>
        {delivery && canFinance ? (
          <Field label={tr(locale, 'Delivery price', 'مبلغ التوصيل')} htmlFor="deliveryAmount" error={fe.deliveryAmount}>
            <input id="deliveryAmount" name="deliveryAmount" type="number" step="0.01" min="0" value={deliveryAmt} onChange={(e) => setDeliveryAmt(e.target.value)} className={inputCls} placeholder="0" />
          </Field>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Cake', 'الكعكة')}</h2>
        <Field label={tr(locale, 'Size (cm)', 'الحجم (سم)')} htmlFor="cakeSizeCm" error={fe.cakeSizeCm}>
          <input id="cakeSizeCm" name="cakeSizeCm" type="number" step="0.5" min="0" defaultValue={defaults.cakeSizeCm} className={inputCls} required />
        </Field>
        <Field label={tr(locale, 'Order description / details', 'وصف / تفاصيل الطلب')} htmlFor="description" error={fe.description}>
          <textarea id="description" name="description" rows={3} defaultValue={defaults.description} className={inputCls} />
        </Field>
      </section>

      {canFinance ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Payment', 'الدفع')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr(locale, 'Total amount', 'المبلغ الإجمالي')} htmlFor="totalAmount" error={fe.totalAmount}>
              <input id="totalAmount" name="totalAmount" type="number" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} className={inputCls} required />
            </Field>
            <Field label={tr(locale, 'Montage price', 'مبلغ التركيب')} htmlFor="montageAmount" error={fe.montageAmount}>
              <input id="montageAmount" name="montageAmount" type="number" step="0.01" min="0" value={montage} onChange={(e) => setMontage(e.target.value)} className={inputCls} placeholder="0" />
            </Field>
            <Field label={tr(locale, 'Advance payment', 'الدفعة المقدمة')} htmlFor="advancePayment" error={fe.advancePayment}>
              <input id="advancePayment" name="advancePayment" type="number" step="0.01" min="0" value={advance} onChange={(e) => setAdvance(e.target.value)} className={inputCls} />
            </Field>
            <Field label={tr(locale, 'Remaining', 'المتبقي')}>
              <div className="rounded-lg bg-neutral-100 px-3 py-2.5 text-sm font-semibold text-neutral-800">
                {formatAmount(remaining)}
              </div>
            </Field>
          </div>
        </section>
      ) : null}

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-6">
        <LinkButton href={`/orders/${defaults.id}`} variant="secondary">
          {tr(locale, 'Cancel', 'إلغاء')}
        </LinkButton>
        <Button type="submit" disabled={pending}>
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save changes', 'حفظ التغييرات')}
        </Button>
      </div>
    </form>
  );
}
