import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { getProducts } from '@/lib/products/queries';
import { getAgents } from '@/lib/agents/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { OrderForm } from '@/components/orders/OrderForm';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Nouvelle commande — Nahla Cake Panel' };

export default async function NewOrderPage() {
  await requirePermission('orders.create');
  const locale = await getLocale();
  const [products, agentOptions] = await Promise.all([getProducts({}), getAgents()]);
  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    diameter: p.diameter_cm,
    sizeLabel: p.size_label,
    price: p.selling_price,
  }));
  return (
    <>
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to orders', 'العودة إلى الطلبات')}
      </Link>
      <PageHeader
        title={tr(locale, 'New order', 'طلب جديد')}
        description={tr(locale, 'Register a custom customer order and send it to production.', 'سجّل طلب عميل مخصّص وأرسله إلى الإنتاج.')}
      />
      <Card className="max-w-3xl">
        <CardBody>
          <OrderForm products={productOptions} agents={agentOptions} />
        </CardBody>
      </Card>
    </>
  );
}
