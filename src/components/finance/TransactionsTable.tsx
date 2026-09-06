import Link from 'next/link';
import { Paperclip, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditTransactionDialog } from '@/components/finance/EditTransactionDialog';
import { deleteTransaction } from '@/lib/finance/actions';
import { formatAmount, formatDate } from '@/lib/utils';
import type { TransactionRow } from '@/lib/finance/queries';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

export function TransactionsTable({
  rows,
  canViewAttachments,
  canEdit = false,
  canDelete = false,
  locale,
}: {
  rows: TransactionRow[];
  canViewAttachments: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  locale: Locale;
}) {
  if (rows.length === 0) {
    return <EmptyState title={tr(locale, 'No transactions', 'لا توجد معاملات')} description={tr(locale, 'Recorded income and expenses will appear here.', 'ستظهر هنا المداخيل والمصروفات المسجلة.')} />;
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">{tr(locale, 'Date', 'التاريخ')}</th>
              <th className="px-4 py-3 font-semibold">{tr(locale, 'Type', 'النوع')}</th>
              <th className="px-4 py-3 font-semibold">{tr(locale, 'Category', 'الفئة')}</th>
              <th className="px-4 py-3 font-semibold">{tr(locale, 'Details', 'التفاصيل')}</th>
              <th className="px-4 py-3 font-semibold">{tr(locale, 'By', 'بواسطة')}</th>
              <th className="px-4 py-3 text-right font-semibold">{tr(locale, 'Amount', 'المبلغ')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/finance/transactions/${r.id}`} className="text-amber-600 hover:underline">
                    {formatDate(r.occurred_at.slice(0, 10))}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.type === 'INCOME' ? 'green' : 'rose'}>
                    {r.type === 'INCOME' ? tr(locale, 'Income', 'دخل') : tr(locale, 'Expense', 'مصروف')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-neutral-600">{r.category}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {r.item_name ? <span className="font-medium text-neutral-800">{r.item_name}. </span> : null}
                  {r.description || (r.item_name ? '' : '—')}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{r.created_by_name || '—'}</td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                    r.type === 'INCOME' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {r.type === 'INCOME' ? '+' : '−'}
                  {formatAmount(r.amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {r.hasAttachment && canViewAttachments ? (
                      <a
                        href={`/api/finance-attachments/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {tr(locale, 'Receipt', 'إيصال')}
                      </a>
                    ) : null}
                    {canEdit ? (
                      <EditTransactionDialog
                        id={r.id}
                        amount={r.amount}
                        description={r.description}
                        date={r.occurred_at.slice(0, 10)}
                      />
                    ) : null}
                    {canDelete ? (
                      <ConfirmDialog
                        triggerLabel={
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                            <Trash2 className="h-3.5 w-3.5" />
                            {tr(locale, 'Delete', 'حذف')}
                          </span>
                        }
                        title={tr(locale, 'Delete this transaction?', 'حذف هذه المعاملة؟')}
                        description={tr(locale, 'Reserved for the administrator. The transaction will be permanently removed from the ledger.', 'مخصص للمسؤول. سيتم حذف المعاملة نهائيًا من دفتر الأستاذ.')}
                        confirmLabel={tr(locale, 'Delete', 'حذف')}
                        action={deleteTransaction}
                        hiddenFields={{ id: r.id }}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
