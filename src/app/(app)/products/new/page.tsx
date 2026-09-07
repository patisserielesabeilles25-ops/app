import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ProductForm } from '@/components/products/ProductForm';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Add Product — Nahla Cake Panel' };

export default async function NewProductPage() {
  await requirePermission('products.manage');
  const locale = await getLocale();

  return (
    <>
      <Link
        href="/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to products', 'العودة إلى المنتجات')}
      </Link>

      <PageHeader title={tr(locale, 'Add product', 'إضافة منتج')} description={tr(locale, 'A name, an optional diameter, and a photo.', 'اسم، وقطر اختياري، وصورة.')} />
      <Card className="max-w-2xl">
        <CardBody>
          <ProductForm />
        </CardBody>
      </Card>
    </>
  );
}
