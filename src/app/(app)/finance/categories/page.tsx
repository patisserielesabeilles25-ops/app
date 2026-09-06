import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getCategories } from '@/lib/finance/config';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { CategoryForm } from '@/components/finance/ConfigForms';
import { CategoryRow } from '@/components/finance/CategoryRow';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Finance Categories — Nahla Cake Panel' };

export default async function FinanceCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('finance.view');
  const locale = await getLocale();
  const { msg, error } = await searchParams;
  const perms = await getMyPermissions();
  const canManage = perms.has('finance.categories.manage');

  const categories = await getCategories();
  const groups = [
    { key: 'INCOME', label: tr(locale, 'Income', 'دخل'), rows: categories.filter((c) => c.direction === 'INCOME') },
    { key: 'EXPENSE', label: tr(locale, 'Expense', 'مصروف'), rows: categories.filter((c) => c.direction === 'EXPENSE') },
    { key: 'BOTH', label: tr(locale, 'Both', 'كلاهما'), rows: categories.filter((c) => c.direction === 'BOTH') },
  ];

  return (
    <>
      <Link href="/finance" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to finance', 'العودة إلى المالية')}
      </Link>
      <PageHeader title={tr(locale, 'Categories', 'الفئات')} description={tr(locale, 'Configure how transactions are classified.', 'إعداد كيفية تصنيف المعاملات.')} />

      {msg ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />{msg}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-5 w-5" />{error}
        </div>
      ) : null}

      <Card className="max-w-3xl">
        <CardHeader title={tr(locale, 'Categories', 'الفئات')} description={`${categories.length} ${tr(locale, 'configured', 'مُعدّة')}`} />
        <CardBody className="space-y-5">
          {groups.map((g) =>
            g.rows.length > 0 ? (
              <div key={g.key}>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">{g.label}</p>
                <ul className="divide-y divide-neutral-50">
                  {g.rows.map((c) => (
                    <CategoryRow key={c.id} category={{ id: c.id, name: c.name, is_system: c.is_system }} />
                  ))}
                </ul>
              </div>
            ) : null,
          )}

          {canManage ? (
            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">{tr(locale, 'Add category', 'إضافة فئة')}</p>
              <CategoryForm />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
