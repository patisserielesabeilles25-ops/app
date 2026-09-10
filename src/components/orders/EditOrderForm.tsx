'use client';

import { useActionState, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { updateOrder, createOrderImageUploadUrl, type UpdateOrderState } from '@/lib/orders/actions';
import { COATING_OPTIONS, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/validation/order';
import { createClient } from '@/lib/supabase/client';
import type { OrderProductOption } from '@/components/orders/OrderForm';
import { Button, LinkButton } from '@/components/ui/Button';
import { formatAmount } from '@/lib/utils';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: UpdateOrderState = {};
const IMAGE_BUCKET = 'order-images';
const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

const productSize = (p: OrderProductOption) =>
  p.sizeLabel?.trim() || (p.diameter != null ? `⌀ ${p.diameter} cm` : null);

const productLabel = (p: OrderProductOption) =>
  [p.name || productSize(p) || 'Produit', productSize(p), p.price > 0 ? `${formatAmount(p.price)} DA` : null]
    .filter(Boolean)
    .join(' · ');

export type OrderDefaults = {
  id: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  cakeSizeCm: string;
  description: string;
  fourage: string;
  coating: string;
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
  products = [],
  currentImageUrl = null,
}: {
  defaults: OrderDefaults;
  canFinance: boolean;
  products?: OrderProductOption[];
  currentImageUrl?: string | null;
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(updateOrder, initial);
  const [total, setTotal] = useState(String(defaults.totalAmount ?? ''));
  const [montage, setMontage] = useState(String(defaults.montageAmount ?? ''));
  const [advance, setAdvance] = useState(String(defaults.advancePayment ?? ''));
  const [delivery, setDelivery] = useState(defaults.deliveryRequired);
  const [deliveryAmt, setDeliveryAmt] = useState(String(defaults.deliveryAmount ?? ''));

  // Reference image: uploaded straight to Storage on select (keeps large files
  // off the server action). Only the new path is submitted; empty = keep old.
  const [img, setImg] = useState<{ path: string; mime: string; size: number } | null>(null);
  const [imgStatus, setImgStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [imgError, setImgError] = useState<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImg(null);
    setImgError(null);
    setImgStatus('idle');
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImgStatus('error');
      setImgError(tr(locale, 'Use a JPEG, PNG or WEBP image.', 'استخدم صورة JPEG أو PNG أو WEBP.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImgStatus('error');
      setImgError(tr(locale, `Image must be ${MAX_IMAGE_MB} MB or smaller.`, `يجب أن تكون الصورة ${MAX_IMAGE_MB} ميغابايت أو أقل.`));
      return;
    }
    setImgStatus('uploading');
    const signed = await createOrderImageUploadUrl(file.type, file.size, file.name);
    if ('error' in signed) {
      setImgStatus('error');
      setImgError(signed.error);
      return;
    }
    const supabase = (supabaseRef.current ??= createClient());
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (error) {
      setImgStatus('error');
      setImgError(tr(locale, 'Upload failed. Please try again.', 'فشل الرفع. حاول مرة أخرى.'));
      return;
    }
    setImg({ path: signed.path, mime: file.type, size: file.size });
    setImgStatus('done');
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
        {products.length > 0 ? (
          <Field label={tr(locale, 'Product', 'المنتج')} htmlFor="productId" error={fe.productId}>
            <select id="productId" name="productId" defaultValue={defaults.productId} className={inputCls} required>
              <option value="" disabled>{tr(locale, 'Choose a product…', 'اختر منتجًا…')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{productLabel(p)}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={tr(locale, 'Cake size', 'حجم الكعكة')} htmlFor="cakeSizeCm" error={fe.cakeSizeCm}>
          <input id="cakeSizeCm" name="cakeSizeCm" type="text" defaultValue={defaults.cakeSizeCm} className={inputCls} placeholder={tr(locale, 'e.g. 20, Mini, 1/2 plateau…', 'مثال: 20، ميني، نصف بلاطو…')} required />
        </Field>
        <Field label={tr(locale, 'Coating', 'التغطية')} htmlFor="coating" error={fe.coating}>
          <select id="coating" name="coating" defaultValue={defaults.coating} className={inputCls} required>
            <option value="" disabled>{tr(locale, 'Choose a coating…', 'اختر التغطية…')}</option>
            {COATING_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={tr(locale, 'Reference image', 'الصورة المرجعية')} htmlFor="image">
          {currentImageUrl && !img ? (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentImageUrl} alt={tr(locale, 'Current reference', 'المرجع الحالي')} className="h-28 w-auto rounded-lg border border-neutral-200 object-contain" />
              <p className="mt-1 text-xs text-neutral-400">{tr(locale, 'Current image — choose a new one to replace it.', 'الصورة الحالية — اختر واحدة جديدة لاستبدالها.')}</p>
            </div>
          ) : null}
          {/* Camera capture — phones/tablets only. Opens the rear camera. */}
          <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 lg:hidden">
            <Camera className="h-4 w-4" />
            {tr(locale, 'Take a photo', 'التقاط صورة')}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onImageChange} className="hidden" />
          </label>
          {/* No `name`: uploaded directly to Storage on select. */}
          <input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onImageChange}
            className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
          />
          <p className="mt-1 text-xs text-neutral-400">{tr(locale, `JPEG, PNG or WEBP · max ${MAX_IMAGE_MB} MB`, `JPEG أو PNG أو WEBP · بحد أقصى ${MAX_IMAGE_MB} ميغابايت`)}</p>
          {imgStatus === 'uploading' ? <p className="text-xs text-neutral-500">{tr(locale, 'Uploading image…', 'جارٍ رفع الصورة…')}</p> : null}
          {imgStatus === 'done' ? <p className="text-xs text-emerald-600">{tr(locale, 'New image uploaded ✓', 'تم رفع الصورة الجديدة ✓')}</p> : null}
          {imgError ? <p className="text-xs text-amber-600">{imgError}</p> : null}
          {img ? (
            <>
              <input type="hidden" name="imagePath" value={img.path} />
              <input type="hidden" name="imageMime" value={img.mime} />
              <input type="hidden" name="imageSize" value={String(img.size)} />
            </>
          ) : null}
        </Field>
        <Field label={tr(locale, 'Fourrage (extra / modified ingredient)', 'الحشوة (مكوّن إضافي / تعديل)')} htmlFor="fourage" error={fe.fourage}>
          <input id="fourage" name="fourage" defaultValue={defaults.fourage} className={inputCls} placeholder={tr(locale, 'e.g. extra chocolate filling, no nuts…', 'مثال: حشوة شوكولاتة إضافية، بدون مكسرات…')} />
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
        <Button type="submit" disabled={pending || imgStatus === 'uploading'}>
          {imgStatus === 'uploading'
            ? tr(locale, 'Uploading image…', 'جارٍ رفع الصورة…')
            : pending
              ? tr(locale, 'Saving…', 'جارٍ الحفظ…')
              : tr(locale, 'Save changes', 'حفظ التغييرات')}
        </Button>
      </div>
    </form>
  );
}
