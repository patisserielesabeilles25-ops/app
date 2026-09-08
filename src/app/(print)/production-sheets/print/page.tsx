import { requirePermission } from '@/lib/auth/permissions';
import { PrintButton } from '@/components/orders/PrintButton';
import { ProductionSheet } from '@/components/production/ProductionSheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feuilles de production — Les Abeilles' };

export default async function ProductionSheetsPrintPage() {
  await requirePermission('orders.view');

  return (
    <div className="min-h-screen bg-neutral-200 py-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #fff !important; }
          .sheet-break { break-after: page; page-break-after: always; }
        }
      `}</style>

      <PrintButton />

      <div className="mx-auto max-w-[820px] space-y-8">
        <div className="sheet-break bg-white p-8 shadow-lg print:p-0 print:shadow-none">
          <ProductionSheet title="MASQUAGE" extraSizes />
        </div>
        <div className="bg-white p-8 shadow-lg print:p-0 print:shadow-none">
          <ProductionSheet title="PREPARATION" />
        </div>
      </div>
    </div>
  );
}
