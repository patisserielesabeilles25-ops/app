import { Zap, ListChecks, Braces, MessageCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requirePermission, getMyPermissions } from '@/lib/auth/permissions';
import {
  getConnection,
  getAutomations,
  getMessages,
  getCustomStatuses,
  getStats,
} from '@/lib/whatsapp/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import { WhatsAppConnection } from '@/components/whatsapp/WhatsAppConnection';
import { WhatsAppTabs } from '@/components/whatsapp/WhatsAppTabs';
import { tr } from '@/lib/i18n/t';
import { getLocale } from '@/lib/i18n/server';

export const metadata = { title: 'WhatsApp Automation — Nahla Cake Panel' };

export default async function WhatsAppPage() {
  await requirePermission('whatsapp.view');
  const locale = await getLocale();
  const perms = await getMyPermissions();
  const canManage = perms.has('whatsapp.manage');

  const [connection, automations, messages, customStatuses, stats] = await Promise.all([
    getConnection(),
    getAutomations(locale),
    getMessages(50),
    getCustomStatuses(),
    getStats(),
  ]);

  const connected = connection.status === 'connected';

  return (
    <>
      <PageHeader
        title={tr(locale, 'WhatsApp Automation', 'أتمتة واتساب')}
        description={tr(
          locale,
          'Automatic messages triggered by order statuses.',
          'رسائل تلقائية تُطلقها حالات الطلبات.',
        )}
        action={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
              connected ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
            {connected ? tr(locale, 'Connected', 'متصل') : tr(locale, 'Not connected', 'غير متصل')}
          </span>
        }
      />

      <div className="mb-6">
        <WhatsAppConnection connection={connection} canManage={canManage} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Zap}
          accent="emerald"
          value={String(stats.activeAutomations)}
          label={tr(locale, 'Active automations', 'أتمتة نشطة')}
          sub={tr(
            locale,
            `${stats.activeAutomations} of ${stats.totalAutomations} total`,
            `${stats.activeAutomations} من ${stats.totalAutomations} إجمالًا`,
          )}
        />
        <StatCard
          icon={ListChecks}
          accent="sky"
          value={String(stats.configuredTriggers)}
          label={tr(locale, 'Configured statuses', 'حالات مُهيّأة')}
          sub={tr(locale, 'with an automation', 'مربوطة بأتمتة')}
        />
        <StatCard
          icon={Braces}
          accent="violet"
          value={String(stats.variablesCount)}
          label={tr(locale, 'Variables', 'المتغيرات')}
          sub={tr(locale, 'available in messages', 'متاحة في الرسائل')}
        />
        <StatCard
          icon={MessageCircle}
          accent={connected ? 'emerald' : 'neutral'}
          value={
            connected
              ? tr(locale, 'Connected', 'متصل')
              : connection.status === 'connecting'
                ? tr(locale, 'Connecting', 'جارٍ الاتصال')
                : tr(locale, 'Offline', 'غير متصل')
          }
          label={tr(locale, 'WhatsApp status', 'حالة واتساب')}
          sub={connection.phone_number ?? tr(locale, 'No account linked', 'لا يوجد حساب مرتبط')}
        />
      </div>

      <WhatsAppTabs
        automations={automations}
        messages={messages}
        customStatuses={customStatuses}
        canManage={canManage}
      />
    </>
  );
}

type Accent = 'emerald' | 'sky' | 'violet' | 'neutral';
const ACCENT: Record<Accent, { chip: string; value: string }> = {
  emerald: { chip: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  sky: { chip: 'bg-sky-50 text-sky-600', value: 'text-sky-700' },
  violet: { chip: 'bg-violet-50 text-violet-600', value: 'text-violet-700' },
  neutral: { chip: 'bg-neutral-100 text-neutral-500', value: 'text-neutral-900' },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
}) {
  const c = ACCENT[accent];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.chip}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={`mt-3 text-2xl font-bold tracking-tight ${c.value}`}>{value}</p>
      <p className="text-sm font-medium text-neutral-600">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-neutral-400">{sub}</p> : null}
    </div>
  );
}
