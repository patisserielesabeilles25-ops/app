import Link from 'next/link';
import Image from 'next/image';
import { Package, Plus, Pencil, Trash2, ImageOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getProducts, getSignedProductPhotoUrl } from '@/lib/products/queries';
import { deleteProduct } from '@/lib/products/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatAmount } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Products — Nahla Cake Panel' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; deleted?: string; archived?: string; error?: string }>;
}) {
  await requirePermission('products.view');
  const locale = await getLocale();
  const { created, updated, deleted, archived, error } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('products.manage');

  const products = await getProducts({});
  const withPhotos = await Promise.all(
    products.map(async (p) => ({
      ...p,
      photoUrl:
        p.photo_bucket && p.photo_path
          ? await getSignedProductPhotoUrl(p.photo_bucket, p.photo_path)
          : null,
    })),
  );

  return (
    <>
      <PageHeader
        title={tr(locale, 'Products', 'المنتجات')}
        description={tr(locale, 'Your product catalog with diameter, prices, and photos.', 'كتالوج منتجاتك مع القطر والأسعار والصور.')}
        action={
          canManage ? (
            <LinkButton href="/products/new">
              <Plus className="h-4 w-4" />
              {tr(locale, 'Add product', 'إضافة منتج')}
            </LinkButton>
          ) : null
        }
      />

      {created ? <Banner tone="success">{tr(locale, 'Product added.', 'تمت إضافة المنتج.')}</Banner> : null}
      {updated ? <Banner tone="success">{tr(locale, 'Product updated.', 'تم تحديث المنتج.')}</Banner> : null}
      {deleted ? <Banner tone="success">{tr(locale, 'Product deleted.', 'تم حذف المنتج.')}</Banner> : null}
      {archived ? <Banner tone="success">{tr(locale, 'Product removed from the catalog (kept for existing orders).', 'تمت إزالة المنتج من الكتالوج (مع الاحتفاظ به للطلبات الحالية).')}</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {withPhotos.length === 0 ? (
        <EmptyState
          icon={Package}
          title={tr(locale, 'No products yet', 'لا توجد منتجات بعد')}
          description={
            canManage
              ? tr(locale, 'Add your first product to build the catalog.', 'أضف منتجك الأول لبناء الكتالوج.')
              : tr(locale, 'No products have been added yet.', 'لم تتم إضافة أي منتجات بعد.')
          }
          action={
            canManage ? (
              <LinkButton href="/products/new">
                <Plus className="h-4 w-4" />
                {tr(locale, 'Add product', 'إضافة منتج')}
              </LinkButton>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {withPhotos.map((p) => {
            const label = p.name || `⌀ ${p.diameter_cm} cm`;
            const margin = p.selling_price - p.purchase_price;
            return (
              <Card key={p.id} className="flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3] w-full bg-neutral-100">
                  {p.photoUrl ? (
                    <Image src={p.photoUrl} alt={label} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-neutral-300">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-neutral-800">{label}</h3>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      ⌀ {p.diameter_cm} cm
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">{tr(locale, 'Purchase price', 'سعر الشراء')}</dt>
                      <dd className="font-medium text-neutral-700">{formatAmount(p.purchase_price)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">{tr(locale, 'Selling price', 'سعر البيع')}</dt>
                      <dd className="font-medium text-neutral-700">{formatAmount(p.selling_price)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-neutral-100 pt-1">
                      <dt className="text-neutral-500">{tr(locale, 'Margin', 'الهامش')}</dt>
                      <dd className={margin >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                        {formatAmount(margin)}
                      </dd>
                    </div>
                  </dl>
                  {canManage ? (
                    <div className="mt-4 flex gap-2 border-t border-neutral-100 pt-3">
                      <Link
                        href={`/products/${p.id}/edit`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {tr(locale, 'Edit', 'تعديل')}
                      </Link>
                      <ConfirmDialog
                        triggerLabel={
                          <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                            {tr(locale, 'Delete', 'حذف')}
                          </span>
                        }
                        title={tr(locale, 'Delete this product?', 'حذف هذا المنتج؟')}
                        description={tr(locale, `"${label}" will be removed from the catalog. If it's used by existing orders it's kept for their history.`, `ستتم إزالة "${label}" من الكتالوج. إذا كان مستخدمًا في طلبات حالية فسيُحتفظ به لسجلّها.`)}
                        confirmLabel={tr(locale, 'Delete product', 'حذف المنتج')}
                        action={deleteProduct}
                        hiddenFields={{ productId: p.id }}
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Banner({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  const cls = tone === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-700';
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`mb-6 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${cls}`}>
      <Icon className="h-5 w-5" />
      {children}
    </div>
  );
}
