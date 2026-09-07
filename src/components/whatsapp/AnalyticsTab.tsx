'use client';

import { CheckCircle2, Clock3, XCircle, MinusCircle, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WhatsAppMessage } from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

export function AnalyticsTab({ messages }: { messages: WhatsAppMessage[] }) {
  const locale = useLocale();

  const total = messages.length;
  const sent = messages.filter((m) => m.status === 'sent').length;
  const pending = messages.filter((m) => m.status === 'pending').length;
  const failed = messages.filter((m) => m.status === 'failed').length;
  const skipped = messages.filter((m) => m.status === 'skipped').length;
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;

  const cards: { icon: LucideIcon; label: string; value: number; cls: string; value_cls: string }[] = [
    { icon: CheckCircle2, label: tr(locale, 'Sent', 'أُرسلت'), value: sent, cls: 'bg-emerald-50 text-emerald-600', value_cls: 'text-emerald-700' },
    { icon: Clock3, label: tr(locale, 'Pending', 'قيد الانتظار'), value: pending, cls: 'bg-amber-100 text-amber-600', value_cls: 'text-amber-700' },
    { icon: XCircle, label: tr(locale, 'Failed', 'فشلت'), value: failed, cls: 'bg-red-50 text-red-600', value_cls: 'text-red-700' },
    { icon: MinusCircle, label: tr(locale, 'Skipped', 'متخطاة'), value: skipped, cls: 'bg-neutral-100 text-neutral-500', value_cls: 'text-neutral-700' },
  ];

  const bars = [
    { label: tr(locale, 'Sent', 'أُرسلت'), value: sent, color: '#10b981' },
    { label: tr(locale, 'Pending', 'قيد الانتظار'), value: pending, color: '#f59e0b' },
    { label: tr(locale, 'Failed', 'فشلت'), value: failed, color: '#f43f5e' },
    { label: tr(locale, 'Skipped', 'متخطاة'), value: skipped, color: '#a3a3a3' },
  ];
  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <p className={`mt-3 text-2xl font-bold tracking-tight ${c.value_cls}`}>{c.value}</p>
            <p className="text-sm font-medium text-neutral-600">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Delivery rate', 'معدل التسليم')}</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {tr(locale, `${sent} of ${total} messages sent`, `${sent} من ${total} رسالة أُرسلت`)}
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-600">{deliveryRate}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${deliveryRate}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Messages by status', 'الرسائل حسب الحالة')}</h3>
          </div>
          <div className="p-5">
            {total === 0 ? (
              <p className="flex items-center gap-2 text-sm text-neutral-400">
                <BarChart3 className="h-4 w-4" />
                {tr(locale, 'No data yet.', 'لا توجد بيانات بعد.')}
              </p>
            ) : (
              <ul className="space-y-3">
                {bars.map((b) => (
                  <li key={b.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-neutral-700">{b.label}</span>
                      <span className="font-semibold text-neutral-800">{b.value}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full" style={{ width: `${(b.value / max) * 100}%`, background: b.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
