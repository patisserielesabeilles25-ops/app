import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { getProduct, getSignedProductPhotoUrl } from '@/lib/products/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ProductForm } from '@/components/products/ProductForm';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Edit Product — Nahla Cake Panel' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('products.manage');
  const locale = await getLocale();
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const photoUrl =
    product.photo_bucket && product.photo_path
      ? await getSignedProductPhotoUrl(product.photo_bucket, product.photo_path)
      : null;

  return (
    <>
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to products', 'العودة إلى المنتجات')}
      </Link>

      <PageHeader title={tr(locale, 'Edit product', 'تعديل المنتج')} description={tr(locale, 'Update the name, diameter, or photo.', 'حدّث الاسم أو القطر أو الصورة.')} />
      <Card className="max-w-2xl">
        <CardBody>
          <ProductForm
            product={{
              id: product.id,
              name: product.name,
              diameter_cm: product.diameter_cm,
              size_label: product.size_label,
            }}
            photoUrl={photoUrl}
          />
        </CardBody>
      </Card>
    </>
  );
}
