import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/permissions';
import { getSalaryReceipt } from '@/lib/payroll/salary';
import { PrintButton } from '@/components/orders/PrintButton';
import { formatAmount, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reçu de paiement — Les Abeilles' };

export default async function SalaryReceiptPage({ params }: { params: Promise<{ txId: string }> }) {
  await requirePermission('payroll.view');
  const { txId } = await params;
  const r = await getSalaryReceipt(txId);
  if (!r) notFound();

  return (
    <div className="min-h-screen bg-neutral-200 py-6">
      <style>{`@media print { .no-print { display:none !important; } @page { size:A5; margin:12mm; } html,body { background:#fff !important; } }`}</style>
      <PrintButton />

      <div className="mx-auto max-w-[560px] bg-white p-8 shadow-lg print:shadow-none">
        <div className="mb-6 flex items-center gap-4 border-b border-neutral-200 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Les Abeilles" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-xl font-extrabold text-neutral-900">Les Abeilles</h1>
            <p className="text-xs tracking-widest text-neutral-500">REÇU DE PAIEMENT</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-neutral-500">Employé</span><span className="font-semibold text-neutral-900">{r.employeeName}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Date</span><span className="font-medium text-neutral-800">{formatDate(r.date)}</span></div>
          {r.note ? <div className="flex justify-between"><span className="text-neutral-500">Note</span><span className="text-right font-medium text-neutral-800">{r.note}</span></div> : null}
          <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-3">
            <span className="text-sm font-semibold text-neutral-700">Montant versé</span>
            <span className="text-2xl font-bold text-emerald-600">{formatAmount(r.amount)} DA</span>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-xs text-neutral-500">
          <div className="border-t border-neutral-300 pt-2 text-center">Signature employé</div>
          <div className="border-t border-neutral-300 pt-2 text-center">Signature responsable</div>
        </div>
      </div>
    </div>
  );
}
