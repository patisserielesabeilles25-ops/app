import { Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth/permissions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { ProductionSheet } from '@/components/production/ProductionSheet';
import { getLocale } from '@/lib/i18n/server';
import { tr } from '@/lib/i18n/t';

export const metadata = { title: 'Production Sheets — Nahla Cake Panel' };

export default async function ProductionSheetsPage() {
  await requirePermission('orders.view');
  const locale = await getLocale();

  return (
    <>
      <PageHeader
        title={tr(locale, 'Production sheets', 'أوراق الإنتاج')}
        description={tr(
          locale,
          'Blank weekly logs for piece-rate staff (masking & casting) to record their daily output by hand. Print one per worker.',
          'أوراق أسبوعية فارغة لعمّال القطعة (التغطية والصب) لتسجيل إنتاجهم اليومي يدويًا. اطبع نسخة لكل عامل.',
        )}
        action={
          <a
            href="/production-sheets/print"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-amber-500"
          >
            <Printer className="h-4 w-4" />
            {tr(locale, 'Print sheets', 'طباعة الأوراق')}
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="MASQUAGE" />
          <CardBody>
            <ProductionSheet title="MASQUAGE" extraSizes />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="COULAGE" />
          <CardBody>
            <ProductionSheet title="COULAGE" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
