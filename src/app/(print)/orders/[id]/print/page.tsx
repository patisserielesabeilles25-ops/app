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
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      <span className="font-bold text-neutral-900">{label} : </span>
      <span className="text-neutral-900">{value}</span>
    </div>
  );
}

function AmountLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-bold text-neutral-900">{label} :</span>
      <span className="text-neutral-900">{value}</span>
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
          @page { size: A4; margin: 10mm; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <PrintButton />

      <div className="mx-auto max-w-[820px] bg-white p-8 shadow-lg print:shadow-none">
        {/* Brand header (wide banner) */}
        <div className="mb-6 border-b border-neutral-200 pb-5" dir="ltr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Banner.png" alt="Les Abeilles — Artisanal & designed cakes" className="mx-auto h-auto w-full object-contain" />
        </div>

        {/* Customer + date */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="رقم الهاتف" value={order.customer_phone} />
          <Field label="الإسم" value={order.customer_name} />
          <Field label="التوصيل" value={order.fulfillment === 'DELIVERY' ? 'توصيل' : 'استلام من المحل'} />
          <Field label="التاريخ" value={arInvoiceDate(order.delivery_date, order.delivery_time)} />
        </div>

        {/* Image + amounts */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div
            className="flex min-h-[380px] items-center justify-center overflow-hidden rounded-2xl"
            style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Modèle" className="h-full max-h-[460px] w-full object-contain" />
            ) : (
              <span className="text-4xl">🎂</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div
              className="space-y-2 rounded-2xl px-4 py-4"
              style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
            >
              <AmountLine label="المبلغ الإجمالي" value={amt(financials ? financials.total_amount + financials.montage_amount + financials.delivery_amount : null)} />
              <AmountLine label="المبلغ المدفوع" value={amt(financials?.advance_payment)} />
              <AmountLine label="المبلغ المتبقي" value={amt(financials?.remaining_amount)} />
              <AmountLine label="مبلغ التركيب" value={amt(financials?.montage_amount)} />
              <AmountLine label="مبلغ التوصيل" value={amt(financials?.delivery_amount)} />
            </div>
            {/* Details fill the space under the amounts, matching the image height. */}
            <div
              className="flex-1 rounded-2xl px-4 py-3"
              style={{ backgroundColor: YELLOW, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
            >
              <span className="font-bold text-neutral-900">تفاصيل النموذج : </span>
              <span className="text-neutral-900">{order.description || ''}</span>
            </div>
          </div>
        </div>

        <p className="mt-2 text-left text-xs text-neutral-400" dir="ltr">Réf. {order.order_number}</p>

        {/* Footer */}
        <div className="mt-6 border-t border-neutral-200 pt-4 text-center">
          <p className="font-bold text-neutral-800">شكرا لكم على زيارتكم و على ثقتكم</p>
          <p className="mt-1 font-semibold text-neutral-700" dir="ltr">0770752079 / 0774000952 / 0553 51 50 68</p>
          <p className="mt-1 text-sm text-neutral-600" dir="ltr">
            INSTA : les.abeilles.25 / TIKTOK : nahlacake / FB : Patisserie les abeilles
          </p>
        </div>
      </div>
    </div>
  );
}
