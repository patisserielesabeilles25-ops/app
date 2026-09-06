import { requirePermission } from '@/lib/auth/permissions';
import { getCategories } from '@/lib/finance/config';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EntryForm } from '@/components/finance/EntryForm';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Record Income — Nahla Cake Panel' };

export default async function NewIncomePage() {
  await requirePermission('finance.income.create');
  const locale = await getLocale();
  const today = new Date().toISOString().slice(0, 10);
  const categories = await getCategories();
  const incomeCats = categories
    .filter((c) => (c.direction === 'INCOME' || c.direction === 'BOTH') && c.is_active)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title={tr(locale, 'Record Income', 'تسجيل دخل')} description={tr(locale, 'Add an income entry to the ledger.', 'أضف قيد دخل إلى دفتر الأستاذ.')} />
      <Card className="max-w-2xl">
        <CardBody>
          <EntryForm type="INCOME" categories={incomeCats} today={today} />
        </CardBody>
      </Card>
    </>
  );
}
