'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import {
  createProduct,
  updateProduct,
  type ProductFormState,
} from '@/lib/products/actions';
import { Button, LinkButton } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: ProductFormState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

type Product = {
  id: string;
  name: string | null;
  diameter_cm: number | null;
  size_label: string | null;
};

export function ProductForm({
  product,
  photoUrl,
}: {
  product?: Product;
  photoUrl?: string | null;
}) {
  const locale = useLocale();
  const isEdit = Boolean(product);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateProduct : createProduct,
    initial,
  );
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {isEdit ? <input type="hidden" name="productId" value={product!.id} /> : null}

      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Name', 'الاسم')} <span className="font-normal text-neutral-400">{tr(locale, '(optional)', '(اختياري)')}</span>
        </label>
        <input
          id="name"
          name="name"
          defaultValue={product?.name ?? ''}
          placeholder={tr(locale, 'e.g. Chocolate round cake', 'مثال: كعكة شوكولاتة دائرية')}
          className={inputCls}
        />
        {fe.name ? <p className="text-xs text-amber-600">{fe.name}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sizeLabel" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Size', 'الحجم')} <span className="font-normal text-neutral-400">{tr(locale, '(optional)', '(اختياري)')}</span>
        </label>
        <input
          id="sizeLabel"
          name="sizeLabel"
          type="text"
          defaultValue={product?.size_label ?? (product?.diameter_cm != null ? String(product.diameter_cm) : '')}
          placeholder={tr(locale, 'Any value: 20, Mini, 1/2 plateau…', 'أي قيمة: 20، ميني، نصف بلاطو…')}
          className={inputCls}
        />
        {fe.sizeLabel ? <p className="text-xs text-amber-600">{fe.sizeLabel}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo" className="text-sm font-medium text-neutral-700">
          {tr(locale, 'Product photo', 'صورة المنتج')} {isEdit ? <span className="font-normal text-neutral-400">{tr(locale, '(upload to replace)', '(ارفع صورة للاستبدال)')}</span> : null}
        </label>
        {isEdit && photoUrl ? (
          <div className="mb-1 flex items-center gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-neutral-200">
              <Image src={photoUrl} alt={tr(locale, 'Current photo', 'الصورة الحالية')} fill className="object-cover" unoptimized />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" name="removePhoto" className="rounded border-neutral-300" />
              {tr(locale, 'Remove current photo', 'إزالة الصورة الحالية')}
            </label>
          </div>
        ) : null}
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
        />
        <p className="text-xs text-neutral-400">{tr(locale, 'JPEG, PNG or WEBP · max 5 MB', 'JPEG أو PNG أو WEBP · بحد أقصى 5 ميغابايت')}</p>
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/products" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending}>
          {pending
            ? tr(locale, 'Saving…', 'جارٍ الحفظ…')
            : isEdit
              ? tr(locale, 'Save product', 'حفظ المنتج')
              : tr(locale, 'Add product', 'إضافة منتج')}
        </Button>
      </div>
    </form>
  );
}
