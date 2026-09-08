import { Store, CheckCircle2 } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getMagasinDay } from '@/lib/magasin/queries';
import { getProducts } from '@/lib/products/queries';
import { getAgents } from '@/lib/agents/queries';
import { getCategories } from '@/lib/finance/config';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MagasinSaleForm } from '@/components/finance/MagasinSaleForm';
import { MagasinExpenseForm } from '@/components/finance/MagasinExpenseForm';
import { formatAmount, formatDate } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Magasin — Nahla Cake Panel' };

function algiersToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function MagasinPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string }>;
}) {
  await requirePermission('magasin.view');
  const locale = await getLocale();
  const { date, saved } = await searchParams;
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : algiersToday();
  const perms = await getMyPermissions();
  const canSale = perms.has('magasin.sale.create');
  const canExpense = perms.has('magasin.expense.create');

  const [day, products, categories, agentOptions] = await Promise.all([
    getMagasinDay(selected),
    getProducts({}),
    getCategories(),
    canSale || canExpense ? getAgents() : Promise.resolve([]),
  ]);
  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    diameter: p.diameter_cm,
    price: p.selling_price,
  }));
  const expenseCategories = categories
    .filter((c) => (c.direction === 'EXPENSE' || c.direction === 'BOTH') && c.is_active)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title={tr(locale, 'Store', 'المتجر')}
        description={tr(locale, 'Direct shop sales and expenses for the day.', 'مبيعات ومصاريف المتجر المباشرة لليوم.')}
      />

      {saved ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          {tr(locale, 'Saved.', 'تم الحفظ.')}
        </div>
      ) : null}

      <form method="get" className="mb-6 flex items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-medium text-neutral-700">{tr(locale, 'Date', 'التاريخ')}</label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={selected}
            className="rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <button type="submit" className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          {tr(locale, 'Load', 'تحميل')}
        </button>
      </form>

      {/* Daily summary */}
      <Card className="mb-6">
        <CardHeader title={tr(locale, 'Daily summary', 'ملخص اليوم')} description={formatDate(selected)} />
        <CardBody>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400">{tr(locale, 'Sales', 'المبيعات')}</p>
              <p className="mt-1 text-lg font-bold text-emerald-600">{formatAmount(day.summary.sales)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400">{tr(locale, 'Expenses', 'المصاريف')}</p>
              <p className="mt-1 text-lg font-bold text-amber-600">{formatAmount(day.summary.expenses)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400">{tr(locale, 'Net', 'الصافي')}</p>
              <p className="mt-1 text-lg font-bold text-neutral-900">{formatAmount(day.summary.net)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales column */}
        <div className="space-y-6">
          {canSale ? (
            <Card>
              <CardHeader title={tr(locale, 'New sale', 'بيع جديد')} description={tr(locale, 'Pick products from the catalog.', 'اختر المنتجات من الكتالوج.')} />
              <CardBody><MagasinSaleForm date={selected} products={productOptions} agents={agentOptions} /></CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader
              title={tr(locale, "Today's sales", 'مبيعات اليوم')}
              description={tr(
                locale,
                `${day.sales.length} sale(s) · ${day.orderPayments.length} order payment(s)`,
                `${day.sales.length} عملية بيع · ${day.orderPayments.length} دفعة طلب`,
              )}
            />
            <CardBody>
              {day.sales.length === 0 && day.orderPayments.length === 0 ? (
                <EmptyState icon={Store} title={tr(locale, 'No sales recorded', 'لا توجد مبيعات مسجلة')} />
              ) : (
                <ul className="space-y-3">
                  {day.orderPayments.map((p) => (
                    <li key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{tr(locale, 'Order', 'طلب')}</span>
                          <span className="text-neutral-700">{p.description || tr(locale, 'Order payment', 'دفعة طلب')}</span>
                        </span>
                        <span className="font-semibold text-emerald-600">{formatAmount(p.amount)}</span>
                      </div>
                    </li>
                  ))}
                  {day.sales.map((sale) => (
                    <li key={sale.id} className="rounded-lg border border-neutral-100 p-3">
                      <div className="mb-1 flex justify-between text-sm font-semibold text-neutral-800">
                        <span>{tr(locale, 'Store sale', 'بيع المتجر')}{sale.agent ? <span className="ml-1 font-normal text-neutral-400">· {tr(locale, 'by', 'بواسطة')} {sale.agent}</span> : null}</span>
                        <span>{formatAmount(sale.total_amount)}</span>
                      </div>
                      <ul className="space-y-0.5 text-xs text-neutral-500">
                        {sale.lines.map((l, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{l.quantity} × {l.product_name}</span>
                            <span>{formatAmount(l.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Expenses column */}
        <div className="space-y-6">
          {canExpense ? (
            <Card>
              <CardHeader title={tr(locale, 'New expense', 'مصروف جديد')} description={tr(locale, "Deducted from the day's summary.", 'يُخصم من ملخص اليوم.')} />
              <CardBody><MagasinExpenseForm date={selected} categories={expenseCategories} agents={agentOptions} /></CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title={tr(locale, "Today's expenses", 'مصاريف اليوم')} description={tr(locale, `${day.expenses.length} expense(s)`, `${day.expenses.length} مصروف`)} />
            <CardBody>
              {day.expenses.length === 0 ? (
                <EmptyState icon={Store} title={tr(locale, 'No expenses recorded', 'لا توجد مصاريف مسجلة')} />
              ) : (
                <ul className="space-y-2">
                  {day.expenses.map((e) => (
                    <li key={e.id} className="flex justify-between rounded-lg border border-neutral-100 p-3 text-sm">
                      <span className="text-neutral-700">
                        <span className="font-medium">{e.category}</span>
                        {e.description ? <span className="text-neutral-400"> · {e.description}</span> : null}
                        {e.agent ? <span className="text-neutral-400"> · {tr(locale, 'by', 'بواسطة')} {e.agent}</span> : null}
                      </span>
                      <span className="font-semibold text-amber-600">{formatAmount(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
