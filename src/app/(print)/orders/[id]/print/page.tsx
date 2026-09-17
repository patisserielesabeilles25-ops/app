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
      className="rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1"
      style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <span className="font-bold text-neutral-950 text-[10px] shrink-0">{label} : </span>
      <span className="font-semibold text-neutral-900 text-[10px] truncate">{value}</span>
    </div>
  );
}

function MiniAmountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="font-bold text-neutral-950 text-[9.5px] whitespace-nowrap">{label} :</span>
      <span className="font-semibold text-neutral-900 text-[9.5px] whitespace-nowrap">{value}</span>
    </div>
  );
}

/** One compact bon copy — wider banner and restored dynamic yellow box fill */
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
    <div
      className="bon-quarter flex flex-col justify-between h-full p-2.5 bg-white rounded-xl border border-neutral-200 overflow-hidden box-border"
      dir="rtl"
    >
      {/* 1. Header Banner - Full Width */}
      <div className="border-b border-neutral-200 pb-1 mb-1.5 shrink-0" dir="ltr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Banner.png" alt="Les Abeilles" className="w-full h-auto max-h-[55px] object-contain" />
      </div>

      {/* 2. Customer fields (2x2 grid) */}
      <div className="grid grid-cols-2 gap-1.5 mb-1.5 shrink-0">
        <MiniField label="رقم الهاتف" value={order.customer_phone} />
        <MiniField label="الإسم" value={order.customer_name} />
        <MiniField label="التوصيل" value={order.fulfillment === 'DELIVERY' ? 'توصيل' : 'استلام من المحل'} />
        <MiniField label="التاريخ" value={arInvoiceDate(order.delivery_date, order.delivery_time)} />
      </div>

      {/* 3. Middle area: Restored flex-1 dynamic fill height */}
      <div className="flex-1 grid grid-cols-2 gap-1.5 min-h-0 mb-1.5">
        {/* Column 1 (Right in RTL): Tall Image Card - fills 100% height */}
        <div
          className="flex items-center justify-center overflow-hidden rounded-xl h-full p-1.5"
          style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Modèle" className="h-full w-full object-contain rounded-lg" />
          ) : (
            <span className="text-4xl">🎂</span>
          )}
        </div>

        {/* Column 2 (Left in RTL): Amounts Card + Description Card - fills 100% height */}
        <div className="flex flex-col gap-1.5 h-full min-h-0">
          {/* Amounts Card */}
          <div
            className="rounded-xl px-2.5 py-2 flex flex-col justify-between shrink-0"
            style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <MiniAmountLine label="المبلغ الإجمالي" value={amt(financials ? financials.total_amount + financials.montage_amount + financials.delivery_amount : null)} />
            <MiniAmountLine label="المبلغ المدفوع" value={amt(financials?.advance_payment)} />
            <MiniAmountLine label="المبلغ المتبقي" value={amt(financials?.remaining_amount)} />
            <MiniAmountLine label="مبلغ التركيب" value={amt(financials?.montage_amount)} />
            <MiniAmountLine label="مبلغ التوصيل" value={amt(financials?.delivery_amount)} />
          </div>

          {/* Details / Description Card - Restored flex-1 dynamic height */}
          <div
            className="flex-1 rounded-xl px-2.5 py-2 flex flex-col justify-start min-h-0 overflow-hidden"
            style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <span className="font-bold text-neutral-950 text-[10px] block mb-0.5">تفاصيل النموذج : </span>
            <span className="text-neutral-900 text-[9.5px] leading-snug overflow-y-auto">{order.description || ''}</span>
          </div>
        </div>
      </div>

      {/* 4. Footer Area */}
      <div className="shrink-0 pt-0.5">
        <p className="text-[8px] text-left text-neutral-400 mb-0.5" dir="ltr">Réf. {order.order_number}</p>
        <div className="border-t border-neutral-200 pt-1 text-center">
          <p className="font-bold text-neutral-900 text-[9.5px] leading-none mb-0.5">شكرا لكم على زيارتكم و على ثقتكم</p>
          <p className="font-bold text-neutral-800 text-[8.5px] leading-none mb-0.5" dir="ltr">0770752079 / 0774000952 / 0553 51 50 68</p>
          <p className="text-neutral-700 text-[7.5px] leading-none" dir="ltr">
            INSTA : les.abeilles.25 / TIKTOK : nahlacake / FB : Patisserie les abeilles
          </p>
        </div>
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
    <div className="print-wrapper min-h-screen bg-neutral-200 py-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page {
            size: A4 portrait;
            margin: 4mm !important;
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
            width: 202mm !important;
            height: 289mm !important;
            overflow: hidden !important;
          }
          .grid-4up {
            width: 202mm !important;
            height: 289mm !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: 1fr 1fr !important;
            gap: 3mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          .bon-quarter {
            border: 1px dashed #aaa !important;
            box-sizing: border-box !important;
          }
        }
        .grid-4up {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        @media screen {
          .grid-4up {
            max-width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background: #fff;
            padding: 6mm;
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
