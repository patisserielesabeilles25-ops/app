import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/permissions';
import { getOrderDetail } from '@/lib/orders/queries';
import { getSignedOrderImageUrl } from '@/lib/orders/images';
import { PrintButton } from '@/components/orders/PrintButton';
import { formatAmount } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bon de commande — Les Abeilles' };

const YELLOW = '#FCD40A';

const AR_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DZ_MONTHS = [
  'جانفي', 'فيفري', 'مارس', 'افريل', 'ماي', 'جوان',
  'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function arInvoiceDate(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = AR_WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const hhmm = (timeStr ?? '').slice(0, 5);
  return `${weekday} ${d} ${DZ_MONTHS[m - 1]} ${y} الساعة ${hhmm}`;
}

function MiniField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-2 py-1"
      style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <span className="font-bold text-neutral-900" style={{ fontSize: '8px' }}>{label} : </span>
      <span className="text-neutral-900" style={{ fontSize: '8px' }}>{value}</span>
    </div>
  );
}

function MiniAmountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-bold text-neutral-900" style={{ fontSize: '7.5px' }}>{label} :</span>
      <span className="text-neutral-900" style={{ fontSize: '7.5px' }}>{value}</span>
    </div>
  );
}

/** One compact bon copy — designed for quarter-A4 */
function BonQuarter({
  order,
  financials,
  imageUrl,
  amt,
}: {
  order: {
    customer_phone: string;
    customer_name: string;
    fulfillment: string;
    delivery_date: string;
    delivery_time: string;
    description: string | null;
    order_number: string;
  };
  financials: {
    total_amount: number;
    montage_amount: number;
    delivery_amount: number;
    advance_payment: number;
    remaining_amount: number;
  } | null;
  imageUrl: string | null;
  amt: (n: number | null | undefined) => string;
}) {
  return (
    <div className="bon-quarter" dir="rtl">
      {/* Banner */}
      <div style={{ marginBottom: '3px', paddingBottom: '2px', borderBottom: '1px solid #e5e5e5' }} dir="ltr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Banner.png" alt="Les Abeilles" style={{ width: '100%', height: 'auto', maxHeight: '36px', objectFit: 'contain' }} />
      </div>

      {/* Customer fields — 2×2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '3px' }}>
        <MiniField label="رقم الهاتف" value={order.customer_phone} />
        <MiniField label="الإسم" value={order.customer_name} />
        <MiniField label="التوصيل" value={order.fulfillment === 'DELIVERY' ? 'توصيل' : 'استلام من المحل'} />
        <MiniField label="التاريخ" value={arInvoiceDate(order.delivery_date, order.delivery_time)} />
      </div>

      {/* Image + amounts side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '2px' }}>
        <div
          className="flex items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', height: '95px' }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Modèle" style={{ maxHeight: '90px', width: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '24px' }}>🎂</span>
          )}
        </div>
        <div
          className="rounded-lg px-2 py-1.5 flex flex-col justify-center gap-0.5"
          style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          <MiniAmountLine label="المبلغ الإجمالي" value={amt(financials ? financials.total_amount + financials.montage_amount + financials.delivery_amount : null)} />
          <MiniAmountLine label="المبلغ المدفوع" value={amt(financials?.advance_payment)} />
          <MiniAmountLine label="المبلغ المتبقي" value={amt(financials?.remaining_amount)} />
          <MiniAmountLine label="مبلغ التركيب" value={amt(financials?.montage_amount)} />
          <MiniAmountLine label="مبلغ التوصيل" value={amt(financials?.delivery_amount)} />
        </div>
      </div>

      {/* Description */}
      <div
        className="rounded-lg px-2 py-1"
        style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', marginBottom: '2px' }}
      >
        <span className="font-bold text-neutral-900" style={{ fontSize: '7.5px' }}>تفاصيل النموذج : </span>
        <span className="text-neutral-900" style={{ fontSize: '7.5px' }}>{order.description || ''}</span>
      </div>

      <p style={{ fontSize: '6px', textAlign: 'left', color: '#a3a3a3', margin: '1px 0' }} dir="ltr">Réf. {order.order_number}</p>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: '2px', textAlign: 'center' }}>
        <p className="font-bold text-neutral-800" style={{ fontSize: '7.5px', margin: 0 }}>شكرا لكم على زيارتكم و على ثقتكم</p>
        <p className="font-semibold text-neutral-700" style={{ fontSize: '7px', margin: 0 }} dir="ltr">0770752079 / 0774000952 / 0553 51 50 68</p>
        <p className="text-neutral-600" style={{ fontSize: '6px', margin: 0 }} dir="ltr">
          INSTA : les.abeilles.25 / TIKTOK : nahlacake / FB : Patisserie les abeilles
        </p>
      </div>
    </div>
  );
}

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('orders.view');
  const { id } = await params;
  const { order, financials, image } = await getOrderDetail(id);
  if (!order) notFound();

  const imageUrl = image ? await getSignedOrderImageUrl(image.bucket, image.object_path) : null;
  const amt = (n: number | null | undefined) => (n != null ? `${formatAmount(n)} DA` : '—');

  return (
    <div className="print-wrapper min-h-screen bg-neutral-200 py-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
          }
          .print-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            background: #fff !important;
            min-height: 297mm !important;
            height: 297mm !important;
            overflow: hidden !important;
          }
          .grid-4up {
            width: 210mm !important;
            height: 297mm !important;
            gap: 4mm !important;
            padding: 4mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .bon-quarter {
            border: 1px dashed #bbb !important;
            border-radius: 6px !important;
            padding: 4px 6px !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
        }
        .grid-4up {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 6px;
          width: 100%;
          box-sizing: border-box;
        }
        .bon-quarter {
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 6px 8px;
          background: #fff;
          overflow: hidden;
          box-sizing: border-box;
        }
        @media screen {
          .grid-4up {
            max-width: 210mm;
            aspect-ratio: 210 / 297;
            margin: 0 auto;
            background: #fff;
            padding: 5mm;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          }
        }
      `}</style>

      <PrintButton />

      <div className="grid-4up">
        <BonQuarter order={order} financials={financials} imageUrl={imageUrl} amt={amt} />
        <BonQuarter order={order} financials={financials} imageUrl={imageUrl} amt={amt} />
        <BonQuarter order={order} financials={financials} imageUrl={imageUrl} amt={amt} />
        <BonQuarter order={order} financials={financials} imageUrl={imageUrl} amt={amt} />
      </div>
    </div>
  );
}
