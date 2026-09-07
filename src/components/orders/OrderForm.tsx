'use client';

import { useActionState, useState } from 'react';
import { createOrder, type CreateOrderState } from '@/lib/orders/actions';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: CreateOrderState = {};

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

function Field({
  label,
  htmlFor,
  error,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-neutral-400">{hint}</p> : null}
      {error ? <p className="text-xs text-amber-600">{error}</p> : null}
    </div>
  );
}

export type OrderProductOption = { id: string; name: string | null; diameter: number; price: number };
export type OrderAgentOption = { id: string; name: string };

const productLabel = (p: OrderProductOption) =>
  `${p.name || `⌀ ${p.diameter} cm`} · ⌀${p.diameter}cm · ${formatAmount(p.price)} DA`;

export function OrderForm({ products = [], agents = [] }: { products?: OrderProductOption[]; agents?: OrderAgentOption[] }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(createOrder, initial);

  const [total, setTotal] = useState('');
  const [montage, setMontage] = useState('');
  const [advance, setAdvance] = useState('');
  const [delivery, setDelivery] = useState(false);
  const [deliveryAmt, setDeliveryAmt] = useState('');
  const [productId, setProductId] = useState('');

  const selectedProduct = products.find((p) => p.id === productId);

  const onProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p && !total) setTotal(String(p.price)); // prefill total (only if empty)
  };

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
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
        >
          {state.error}
        </p>
      ) : null}

      {/* Customer */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Customer', 'العميل')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(locale, 'Customer name', 'اسم العميل')} htmlFor="customerName" error={fe.customerName}>
            <input id="customerName" name="customerName" className={inputCls} required />
          </Field>
          <Field label={tr(locale, 'Phone number', 'رقم الهاتف')} htmlFor="customerPhone" error={fe.customerPhone}>
            <input id="customerPhone" name="customerPhone" inputMode="tel" className={inputCls} required />
          </Field>
        </div>
      </section>

      {/* Delivery / pickup */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Delivery / pickup', 'التوصيل / الاستلام')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(locale, 'Delivery date', 'تاريخ التوصيل')} htmlFor="deliveryDate" error={fe.deliveryDate}>
            <input id="deliveryDate" name="deliveryDate" type="date" className={inputCls} required />
          </Field>
          <Field label={tr(locale, 'Delivery time', 'وقت التوصيل')} htmlFor="deliveryTime" error={fe.deliveryTime}>
            <input id="deliveryTime" name="deliveryTime" type="time" className={inputCls} required />
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
        {delivery ? (
          <Field label={tr(locale, 'Delivery price', 'مبلغ التوصيل')} htmlFor="deliveryAmount" error={fe.deliveryAmount}>
            <input
              id="deliveryAmount"
              name="deliveryAmount"
              type="number"
              step="0.01"
              min="0"
              value={deliveryAmt}
              onChange={(e) => setDeliveryAmt(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </Field>
        ) : null}
      </section>

      {/* Cake */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Cake', 'الكعكة')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={tr(locale, 'Product', 'المنتج')}
            htmlFor="productId"
            error={fe.cakeSizeCm}
            hint={products.length === 0 ? tr(locale, 'No products yet — add one in Products first.', 'لا توجد منتجات بعد — أضف منتجًا في المنتجات أولًا.') : undefined}
          >
            <select
              id="productId"
              name="productId"
              value={productId}
              onChange={(e) => onProduct(e.target.value)}
              className={inputCls}
              required
            >
              <option value="" disabled>{tr(locale, 'Choose a product…', 'اختر منتجًا…')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{productLabel(p)}</option>
              ))}
            </select>
            {/* cake_size_cm is derived from the chosen product's diameter */}
            <input type="hidden" name="cakeSizeCm" value={selectedProduct ? selectedProduct.diameter : ''} />
          </Field>
          <Field label={tr(locale, 'Reference image', 'الصورة المرجعية')} htmlFor="image" hint={tr(locale, 'JPEG, PNG or WEBP · max 5 MB', 'JPEG أو PNG أو WEBP · بحد أقصى 5 ميغابايت')}>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
            />
          </Field>
        </div>
        <Field label={tr(locale, 'Order description / details', 'وصف / تفاصيل الطلب')} htmlFor="description" error={fe.description}>
          <textarea id="description" name="description" rows={3} className={inputCls} />
        </Field>
      </section>

      {/* Financial */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Payment', 'الدفع')}</h2>
        <Field
          label={tr(locale, 'Agent (took the order / received the advance)', 'العون (استلم الطلب / الدفعة المقدمة)')}
          htmlFor="receivedBy"
          error={fe.receivedBy}
          hint={agents.length === 0 ? tr(locale, 'No agents. Set up a user’s remuneration first.', 'لا يوجد أعوان. قم بإعداد أجر مستخدم أولًا.') : undefined}
        >
          <select id="receivedBy" name="receivedBy" defaultValue="" className={inputCls} required={agents.length > 0}>
            <option value="" disabled>{tr(locale, 'Choose the agent…', 'اختر العون…')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr(locale, 'Total amount', 'المبلغ الإجمالي')} htmlFor="totalAmount" error={fe.totalAmount}>
            <input
              id="totalAmount"
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label={tr(locale, 'Montage price', 'مبلغ التركيب')} htmlFor="montageAmount" error={fe.montageAmount}>
            <input
              id="montageAmount"
              name="montageAmount"
              type="number"
              step="0.01"
              min="0"
              value={montage}
              onChange={(e) => setMontage(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </Field>
          <Field label={tr(locale, 'Advance payment', 'الدفعة المقدمة')} htmlFor="advancePayment" error={fe.advancePayment}>
            <input
              id="advancePayment"
              name="advancePayment"
              type="number"
              step="0.01"
              min="0"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label={tr(locale, 'Remaining', 'المتبقي')}>
            <div className="rounded-lg bg-neutral-100 px-3 py-2.5 text-sm font-semibold text-neutral-800">
              {formatAmount(remaining)}
            </div>
          </Field>
        </div>
      </section>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Create order', 'إنشاء الطلب')}
        </Button>
      </div>
    </form>
  );
}
