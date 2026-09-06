import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Paperclip, CheckCircle2, AlertTriangle } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import { getTransactionDetail } from '@/lib/finance/queries';
import { reverseTransaction } from '@/lib/finance/actions';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatAmount } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'Transaction — Nahla Cake Panel' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value}</span>
    </div>
  );
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  await requirePermission('finance.transactions.view');
  const locale = await getLocale();
  const { id } = await params;
  const { msg, error } = await searchParams;
  const tx = await getTransactionDetail(id);
  if (!tx) notFound();

  const perms = await getMyPermissions();
  const canViewAtt = perms.has('finance.attachments.view');
  const canReverse = perms.has('finance.reverse');
  const isReversal = tx.source === 'REVERSAL';
  const isOpening = tx.source === 'OPENING_BALANCE';

  return (
    <>
      <Link href="/finance/transactions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" />
        {tr(locale, 'Back to transactions', 'العودة إلى المعاملات')}
      </Link>
      <PageHeader
        title={`${tx.type === 'INCOME' ? '+' : '−'}${formatAmount(tx.amount)}`}
        description={new Date(tx.occurred_at).toLocaleString('en-GB')}
        action={
          canReverse && !isReversal && !isOpening ? (
            <ConfirmDialog
              triggerLabel={<span className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">{tr(locale, 'Reverse', 'عكس')}</span>}
              title={tr(locale, 'Reverse this transaction?', 'عكس هذه المعاملة؟')}
              description={tr(locale, 'This creates an opposite correcting entry. The original is preserved.', 'ينشئ هذا قيدًا تصحيحيًا معاكسًا. يتم الاحتفاظ بالأصل.')}
              confirmLabel={tr(locale, 'Reverse', 'عكس')}
              action={reverseTransaction}
              hiddenFields={{ transactionId: tx.id }}
            />
          ) : undefined
        }
      />

      {msg ? <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />{msg}</div> : null}
      {error ? <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700"><AlertTriangle className="h-5 w-5" />{error}</div> : null}

      <Card className="max-w-2xl">
        <CardBody className="pt-1">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone={tx.type === 'INCOME' ? 'green' : 'rose'}>{tx.type === 'INCOME' ? tr(locale, 'Income', 'دخل') : tr(locale, 'Expense', 'مصروف')}</Badge>
            <Badge tone="blue">{tx.source}</Badge>
            <Badge tone="neutral">{tx.department}</Badge>
          </div>
          <div className="divide-y divide-neutral-100">
            <Row label={tr(locale, 'Amount', 'المبلغ')} value={formatAmount(tx.amount)} />
            <Row label={tr(locale, 'Category', 'الفئة')} value={tx.category_name ?? '—'} />
            <Row label={tr(locale, 'Item', 'البند')} value={tx.item_name ?? '—'} />
            <Row label={tr(locale, 'Description', 'الوصف')} value={tx.description ?? '—'} />
            {tx.order_id ? <Row label={tr(locale, 'Order', 'الطلب')} value={<Link href={`/orders/${tx.order_id}`} className="text-amber-600 hover:underline">{tr(locale, 'View order', 'عرض الطلب')}</Link>} /> : null}
            {tx.employee_name ? <Row label={tr(locale, 'Employee', 'الموظف')} value={tx.employee_name} /> : null}
            <Row label={tr(locale, 'Recorded by', 'سُجّل بواسطة')} value={tx.created_by_name ?? '—'} />
            {tx.reverses_transaction_id ? (
              <Row label={tr(locale, 'Reverses', 'يعكس')} value={<Link href={`/finance/transactions/${tx.reverses_transaction_id}`} className="text-amber-600 hover:underline">{tr(locale, 'original', 'الأصلية')}</Link>} />
            ) : null}
            {tx.hasAttachment && canViewAtt ? (
              <Row label={tr(locale, 'Attachment', 'المرفق')} value={<a href={`/api/finance-attachments/${tx.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-600 hover:underline"><Paperclip className="h-3.5 w-3.5" />{tr(locale, 'View', 'عرض')}</a>} />
            ) : null}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
