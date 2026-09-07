'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, FileText, Trash2, Image as ImageIcon, Video } from 'lucide-react';
import { createTemplate, deleteTemplate, type WhatsAppFormState } from '@/lib/whatsapp/actions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { WHATSAPP_VARIABLES } from '@/lib/whatsapp/constants';
import type { WhatsAppTemplate } from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: WhatsAppFormState = {};

export function TemplatesTab({
  templates,
  canManage,
}: {
  templates: WhatsAppTemplate[];
  canManage: boolean;
}) {
  const locale = useLocale();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">{tr(locale, 'Templates', 'القوالب')}</h3>
          <p className="text-xs text-neutral-500">
            {tr(locale, 'Reusable messages you can copy into automations.', 'رسائل قابلة لإعادة الاستخدام يمكنك نسخها في الأتمتة.')}
          </p>
        </div>
        {canManage ? <TemplateDialog /> : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={tr(locale, 'No templates yet', 'لا توجد قوالب بعد')}
          description={tr(locale, 'Save a message you use often as a template.', 'احفظ رسالة تستخدمها كثيرًا كقالب.')}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-800">{t.name}</h4>
                {canManage ? (
                  <ConfirmDialog
                    triggerLabel={<Trash2 className="h-4 w-4" />}
                    triggerClassName="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                    title={tr(locale, 'Delete this template?', 'حذف هذا القالب؟')}
                    confirmLabel={tr(locale, 'Delete', 'حذف')}
                    action={deleteTemplate}
                    hiddenFields={{ id: t.id }}
                  />
                ) : null}
              </div>
              <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-neutral-600">{t.message}</p>
              {t.media_type ? (
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-400">
                  {t.media_type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                  {t.media_type === 'image' ? tr(locale, 'Image', 'صورة') : tr(locale, 'Video', 'فيديو')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateDialog() {
  const locale = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTemplate, initial);

  useEffect(() => {
    if (state.ok) {
      ref.current?.close();
      router.refresh();
    }
  }, [state.ok, router]);

  const start = () => {
    setOpen(true);
    ref.current?.showModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" />
        {tr(locale, 'New template', 'قالب جديد')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-lg rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <form action={formAction} className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-neutral-900">{tr(locale, 'New template', 'قالب جديد')}</h2>
              <button
                type="button"
                aria-label={tr(locale, 'Close', 'إغلاق')}
                onClick={() => ref.current?.close()}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {state.error ? (
              <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {state.error}
              </p>
            ) : null}

            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tpl-name" className="text-sm font-medium text-neutral-700">
                  {tr(locale, 'Template name', 'اسم القالب')}
                </label>
                <input
                  id="tpl-name"
                  name="name"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                />
                {state.fieldErrors?.name ? (
                  <p className="text-xs text-amber-600">{state.fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tpl-message" className="text-sm font-medium text-neutral-700">
                  {tr(locale, 'Message', 'الرسالة')}
                </label>
                <textarea
                  id="tpl-message"
                  name="message"
                  rows={4}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  required
                />
                {state.fieldErrors?.message ? (
                  <p className="text-xs text-amber-600">{state.fieldErrors.message}</p>
                ) : null}
                <p className="text-xs text-neutral-400">
                  {tr(locale, 'You can use variables like', 'يمكنك استخدام متغيرات مثل')}{' '}
                  {WHATSAPP_VARIABLES.slice(0, 4).map((v) => v.token).join(' ')}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tpl-media" className="text-sm font-medium text-neutral-700">
                  {tr(locale, 'Attachment (optional)', 'مرفق (اختياري)')}
                </label>
                <input
                  id="tpl-media"
                  name="media"
                  type="file"
                  accept="image/*,video/*"
                  className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
                />
                <p className="text-xs text-neutral-400">
                  {tr(locale, 'Image or video · max 16 MB', 'صورة أو فيديو · بحد أقصى 16 ميغابايت')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
              >
                {tr(locale, 'Cancel', 'إلغاء')}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Save template', 'حفظ القالب')}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
