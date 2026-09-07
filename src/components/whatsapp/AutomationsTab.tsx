'use client';

import { Zap, Trash2, Image as ImageIcon, Video } from 'lucide-react';
import { toggleAutomation, deleteAutomation } from '@/lib/whatsapp/actions';
import { AutomationWizard } from '@/components/whatsapp/AutomationWizard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { triggerEmoji } from '@/lib/whatsapp/constants';
import type { WhatsAppAutomation, WhatsAppCustomStatus } from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

export function AutomationsTab({
  automations,
  customStatuses,
  canManage,
}: {
  automations: WhatsAppAutomation[];
  customStatuses: WhatsAppCustomStatus[];
  canManage: boolean;
}) {
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">
            {tr(locale, 'Automations', 'الأتمتة')}
          </h3>
          <p className="text-xs text-neutral-500">
            {tr(
              locale,
              'Send a message automatically when an order reaches a status.',
              'إرسال رسالة تلقائيًا عند وصول الطلب إلى حالة معينة.',
            )}
          </p>
        </div>
        {canManage ? <AutomationWizard customStatuses={customStatuses} /> : null}
      </div>

      {automations.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={tr(locale, 'No automations yet', 'لا توجد أتمتة بعد')}
          description={tr(
            locale,
            'Create your first automation to message customers when their order changes status.',
            'أنشئ أول أتمتة لمراسلة العملاء عند تغيّر حالة طلباتهم.',
          )}
        />
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span>{triggerEmoji(a.trigger_key)}</span>
                    {a.label}
                  </span>
                  {a.media_type === 'image' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                      <ImageIcon className="h-3.5 w-3.5" /> {tr(locale, 'Image', 'صورة')}
                    </span>
                  ) : a.media_type === 'video' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
                      <Video className="h-3.5 w-3.5" /> {tr(locale, 'Video', 'فيديو')}
                    </span>
                  ) : null}
                  {!a.is_active ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                      {tr(locale, 'Paused', 'موقوفة')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-neutral-600">{a.message}</p>
              </div>

              {canManage ? (
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleAutomation}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="is_active" value={String(a.is_active)} />
                    <Toggle active={a.is_active} />
                  </form>
                  <ConfirmDialog
                    triggerLabel={<Trash2 className="h-4 w-4" />}
                    triggerClassName="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                    title={tr(locale, 'Delete this automation?', 'حذف هذه الأتمتة؟')}
                    description={tr(
                      locale,
                      'This automation will stop sending messages. This cannot be undone.',
                      'ستتوقف هذه الأتمتة عن إرسال الرسائل. لا يمكن التراجع عن هذا الإجراء.',
                    )}
                    confirmLabel={tr(locale, 'Delete', 'حذف')}
                    action={deleteAutomation}
                    hiddenFields={{ id: a.id }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Toggle({ active }: { active: boolean }) {
  const locale = useLocale();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={active}
      aria-label={active ? tr(locale, 'Pause automation', 'إيقاف الأتمتة') : tr(locale, 'Activate automation', 'تفعيل الأتمتة')}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        active ? 'bg-emerald-500' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          active ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
        }`}
      />
    </button>
  );
}
