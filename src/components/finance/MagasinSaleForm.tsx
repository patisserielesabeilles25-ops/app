'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { recordMagasinSale, type MagasinState } from '@/lib/magasin/actions';
import { Button } from '@/components/ui/Button';
import { formatAmount } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: MagasinState = {};
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export type ProductOption = { id: string; name: string | null; diameter: number; price: number };
type Row = { productId: string; name: string; qty: string; price: string };
const emptyRow = (): Row => ({ productId: '', name: '', qty: '1', price: '' });

const displayName = (p: ProductOption) => p.name || `⌀ ${p.diameter} cm`;
const optionLabel = (p: ProductOption) =>
  `${displayName(p)} · ⌀${p.diameter}cm · ${formatAmount(p.price)} DA`;

export function MagasinSaleForm({ date, products, agents = [] }: { date: string; products: ProductOption[]; agents?: { id: string; name: string }[] }) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(recordMagasinSale, initial);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const selectProduct = (i: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    update(i, { productId, name: p ? displayName(p) : '', price: p ? String(p.price) : '' });
  };

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0), 0);

  if (products.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {tr(locale, 'No products in the catalog.', 'لا توجد منتجات في الكتالوج.')}{' '}
        <Link href="/products/new" className="font-medium text-amber-600 hover:underline">{tr(locale, 'Add a product', 'إضافة منتج')}</Link> {tr(locale, 'first.', 'أولاً.')}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="saleDate" value={date} />
      {state.error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <select name="agent" className={inputCls} defaultValue="" required>
        <option value="" disabled>{tr(locale, 'Agent making the sale…', 'العون الذي يقوم بالبيع…')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const subtotal = (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);
          return (
            <div key={i} className="grid grid-cols-[1fr_56px_84px_auto] items-center gap-2">
              <select
                value={r.productId}
                onChange={(e) => selectProduct(i, e.target.value)}
                className={inputCls}
              >
                <option value="">{tr(locale, 'Product…', 'المنتج…')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{optionLabel(p)}</option>
                ))}
              </select>
              {/* Submitted product name (from the chosen catalog product). */}
              <input type="hidden" name="product_name" value={r.name} />
              <input
                name="quantity"
                type="number"
                min="0"
                step="1"
                value={r.qty}
                onChange={(e) => update(i, { qty: e.target.value })}
                placeholder={tr(locale, 'Qty', 'الكمية')}
                className={inputCls}
              />
              <input
                name="unit_price"
                type="number"
                min="0"
                step="0.01"
                value={r.price}
                onChange={(e) => update(i, { price: e.target.value })}
                placeholder={tr(locale, 'Price', 'السعر')}
                className={inputCls}
              />
              <button
                type="button"
                aria-label={tr(locale, 'Remove line', 'حذف السطر')}
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-amber-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="col-span-4 -mt-1 text-right text-xs text-neutral-500">
                {tr(locale, 'Subtotal:', 'المجموع الفرعي:')} <span className="font-medium text-neutral-700">{formatAmount(subtotal)} DA</span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, emptyRow()])}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline"
      >
        <Plus className="h-4 w-4" />
        {tr(locale, 'Add a product', 'إضافة منتج')}
      </button>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
        <span className="text-sm text-neutral-500">{tr(locale, 'Total', 'المجموع')}</span>
        <span className="text-lg font-bold text-neutral-900">{formatAmount(total)}</span>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Record sale', 'تسجيل البيع')}
      </Button>
    </form>
  );
}
