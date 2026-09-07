'use client';

import { History } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { BadgeTone } from '@/lib/orders/status';
import type { WhatsAppMessage } from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const STATUS_TONE: Record<WhatsAppMessage['status'], BadgeTone> = {
  sent: 'green',
  pending: 'amber',
  failed: 'rose',
  skipped: 'neutral',
};

function statusLabel(locale: 'en' | 'ar', status: WhatsAppMessage['status']): string {
  switch (status) {
    case 'sent':
      return tr(locale, 'Sent', 'أُرسلت');
    case 'pending':
      return tr(locale, 'Pending', 'قيد الانتظار');
    case 'failed':
      return tr(locale, 'Failed', 'فشلت');
    case 'skipped':
      return tr(locale, 'Skipped', 'متخطاة');
  }
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Algiers',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function HistoryTab({ messages }: { messages: WhatsAppMessage[] }) {
  const locale = useLocale();

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={History}
        title={tr(locale, 'No messages yet', 'لا توجد رسائل بعد')}
        description={tr(
          locale,
          'Messages sent by your automations will appear here.',
          'ستظهر هنا الرسائل التي ترسلها الأتمتة.',
        )}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-start text-xs uppercase tracking-wide text-neutral-400">
            <th className="px-4 py-3 text-start font-semibold">{tr(locale, 'Recipient', 'المستلم')}</th>
            <th className="px-4 py-3 text-start font-semibold">{tr(locale, 'Order', 'الطلب')}</th>
            <th className="px-4 py-3 text-start font-semibold">{tr(locale, 'Message', 'الرسالة')}</th>
            <th className="px-4 py-3 text-start font-semibold">{tr(locale, 'Status', 'الحالة')}</th>
            <th className="px-4 py-3 text-start font-semibold">{tr(locale, 'Time', 'الوقت')}</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => (
            <tr key={m.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-700" dir="ltr">
                {m.to_phone}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                {m.order_number ? `#${m.order_number}` : '—'}
              </td>
              <td className="max-w-[280px] px-4 py-3 text-neutral-600">
                <span className="line-clamp-1">{m.body}</span>
                {m.status === 'failed' && m.error ? (
                  <span className="mt-0.5 block text-xs text-red-500">{m.error}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[m.status]}>{statusLabel(locale, m.status)}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-neutral-400" dir="ltr">
                {formatWhen(m.sent_at ?? m.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
