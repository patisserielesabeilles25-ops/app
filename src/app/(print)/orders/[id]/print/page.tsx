import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/permissions';
import { getOrderDetail } from '@/lib/orders/queries';
import { getSignedOrderImageUrl } from '@/lib/orders/images';
import { PrintButton } from '@/components/orders/PrintButton';
import { formatAmount } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bon de commande — Les Abeilles' };

const YELLOW = '#FCD40A';

// Arabic weekday + Algerian (Maghrebi) month names, e.g.
// "الثلاثاء 12 افريل 2026 الساعة 12:00".
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-3 py-1.5"
      style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <span className="font-bold text-neutral-900" style={{ fontSize: '11px' }}>{label} : </span>
      <span className="text-neutral-900" style={{ fontSize: '11px' }}>{value}</span>
    </div>
  );
}

function AmountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-bold text-neutral-900" style={{ fontSize: '10px' }}>{label} :</span>
      <span className="text-neutral-900" style={{ fontSize: '10px' }}>{value}</span>
    </div>
  );
}

/** A single compact bon de commande copy that fits ~half an A4 page */
function BonCopy({
  order,
  financials,
  imageUrl,
  amt,
  isLast,
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
  isLast: boolean;
}) {
  return (
    <div
      className="bon-copy"
      style={{
        /* Each copy occupies exactly half the printable A4 height (277mm minus margins) */
        boxSizing: 'border-box',
        padding: '8px 12px',
        borderBottom: isLast ? 'none' : '1px dashed #ccc',
      }}
    >
      {/* Brand header (compact banner) */}
      <div style={{ marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px solid #e5e5e5' }} dir="ltr">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Banner.png" alt="Les Abeilles — Artisanal & designed cakes" style={{ width: '100%', height: 'auto', maxHeight: '50px', objectFit: 'contain' }} />
      </div>

      {/* Customer + date */}
      <div className="grid grid-cols-2 gap-1.5" style={{ marginBottom: '4px' }}>
        <Field label="رقم الهاتف" value={order.customer_phone} />
        <Field label="الإسم" value={order.customer_name} />
        <Field label="التوصيل" value={order.fulfillment === 'DELIVERY' ? 'توصيل' : 'استلام من المحل'} />
        <Field label="التاريخ" value={arInvoiceDate(order.delivery_date, order.delivery_time)} />
      </div>

      {/* Image + amounts */}
      <div className="grid grid-cols-2 gap-1.5">
        <div
          className="flex items-center justify-center overflow-hidden rounded-xl"
          style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', height: '160px' }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Modèle" style={{ maxHeight: '150px', width: '100%', objectFit: 'contain' }} />
          ) : (
            <span className="text-3xl">🎂</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div
            className="rounded-xl px-3 py-2"
            style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <AmountLine label="المبلغ الإجمالي" value={amt(financials ? financials.total_amount + financials.montage_amount + financials.delivery_amount : null)} />
            <AmountLine label="المبلغ المدفوع" value={amt(financials?.advance_payment)} />
            <AmountLine label="المبلغ المتبقي" value={amt(financials?.remaining_amount)} />
            <AmountLine label="مبلغ التركيب" value={amt(financials?.montage_amount)} />
            <AmountLine label="مبلغ التوصيل" value={amt(financials?.delivery_amount)} />
          </div>
          {/* Details */}
          <div
            className="flex-1 rounded-xl px-3 py-1.5"
            style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <span className="font-bold text-neutral-900" style={{ fontSize: '10px' }}>تفاصيل النموذج : </span>
            <span className="text-neutral-900" style={{ fontSize: '10px' }}>{order.description || ''}</span>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '2px', fontSize: '9px', textAlign: 'left', color: '#a3a3a3' }} dir="ltr">Réf. {order.order_number}</p>

      {/* Footer */}
      <div style={{ marginTop: '4px', borderTop: '1px solid #e5e5e5', paddingTop: '3px', textAlign: 'center' }}>
        <p className="font-bold text-neutral-800" style={{ fontSize: '10px' }}>شكرا لكم على زيارتكم و على ثقتكم</p>
        <p className="font-semibold text-neutral-700" style={{ fontSize: '9px' }} dir="ltr">0770752079 / 0774000952 / 0553 51 50 68</p>
        <p className="text-neutral-600" style={{ fontSize: '8px' }} dir="ltr">
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
    <div className="min-h-screen bg-neutral-200 py-6" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 8mm; }
          html, body { background: #fff !important; }
          .print-page {
            page-break-after: always;
            height: 277mm; /* A4 height minus top+bottom margins (297 - 8 - 8 ≈ 281, using 277 for safety) */
            overflow: hidden;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
          .bon-copy {
            height: 138mm; /* Half of printable area */
            overflow: hidden;
          }
        }
        @media screen {
          .print-page {
            margin-bottom: 24px;
          }
          .bon-copy {
            padding: 12px 16px !important;
          }
        }
      `}</style>

      <PrintButton />

      {/* Page 1: copies 1 & 2 */}
      <div className="print-page mx-auto max-w-[820px] bg-white shadow-lg print:shadow-none">
        <BonCopy order={order} financials={financials} imageUrl={imageUrl} amt={amt} isLast={false} />
        <BonCopy order={order} financials={financials} imageUrl={imageUrl} amt={amt} isLast={true} />
      </div>

      {/* Page 2: copies 3 & 4 */}
      <div className="print-page mx-auto max-w-[820px] bg-white shadow-lg print:shadow-none">
        <BonCopy order={order} financials={financials} imageUrl={imageUrl} amt={amt} isLast={false} />
        <BonCopy order={order} financials={financials} imageUrl={imageUrl} amt={amt} isLast={true} />
      </div>
    </div>
  );
}
