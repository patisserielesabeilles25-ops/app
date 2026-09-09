'use client';

import { useState } from 'react';
import { Zap, History, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AutomationsTab } from '@/components/whatsapp/AutomationsTab';
import { HistoryTab } from '@/components/whatsapp/HistoryTab';
import { AnalyticsTab } from '@/components/whatsapp/AnalyticsTab';
import type {
  WhatsAppAutomation,
  WhatsAppMessage,
  WhatsAppCustomStatus,
} from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

type TabKey = 'automations' | 'history' | 'analytics';

export function WhatsAppTabs({
  automations,
  messages,
  customStatuses,
  canManage,
}: {
  automations: WhatsAppAutomation[];
  messages: WhatsAppMessage[];
  customStatuses: WhatsAppCustomStatus[];
  canManage: boolean;
}) {
  const locale = useLocale();
  const [tab, setTab] = useState<TabKey>('automations');

  const tabs: { key: TabKey; label: string; icon: LucideIcon; count?: number }[] = [
    { key: 'automations', label: tr(locale, 'Automations', 'الأتمتة'), icon: Zap, count: automations.length },
    { key: 'history', label: tr(locale, 'History', 'السجل'), icon: History },
    { key: 'analytics', label: tr(locale, 'Analytics', 'التحليلات'), icon: BarChart3 },
  ];

  return (
    <div>
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'automations' ? (
        <AutomationsTab automations={automations} customStatuses={customStatuses} canManage={canManage} />
      ) : null}
      {tab === 'history' ? <HistoryTab messages={messages} /> : null}
      {tab === 'analytics' ? <AnalyticsTab messages={messages} /> : null}
    </div>
  );
}
