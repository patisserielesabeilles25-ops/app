'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Check, ChevronLeft, ChevronRight, Paperclip } from 'lucide-react';
import { createAutomation, type WhatsAppFormState } from '@/lib/whatsapp/actions';
import {
  WHATSAPP_TRIGGERS,
  WHATSAPP_VARIABLES,
  triggerEmoji,
} from '@/lib/whatsapp/constants';
import type { WhatsAppCustomStatus } from '@/lib/whatsapp/queries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

const initial: WhatsAppFormState = {};

type Selected = { type: 'canonical' | 'custom'; key: string; label: string; emoji: string } | null;

export function AutomationWizard({
  customStatuses,
}: {
  customStatuses: WhatsAppCustomStatus[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<Selected>(null);
  const [message, setMessage] = useState('');
  const [mediaName, setMediaName] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState(createAutomation, initial);

  const close = () => {
    ref.current?.close();
  };
  const start = () => {
    setStep(1);
    setSelected(null);
    setMessage('');
    setMediaName(null);
    setOpen(true);
    ref.current?.showModal();
  };

  // Close + refresh once the action succeeds.
  useEffect(() => {
    if (state.ok) {
      ref.current?.close();
      router.refresh();
    }
  }, [state.ok, router]);

  const insertVariable = (token: string) => {
    const el = textRef.current;
    if (!el) {
      setMessage((m) => m + token);
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const canNext = step === 1 ? !!selected : step === 2 ? message.trim().length > 0 : true;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" />
        {tr(locale, 'New automation', 'أتمتة جديدة')}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-2xl rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <form action={formAction} className="flex max-h-[85vh] flex-col">
            {/* Header + stepper */}
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  {tr(locale, 'New automation', 'أتمتة جديدة')}
                </h2>
                <Stepper step={step} />
              </div>
              <button
                type="button"
                aria-label={tr(locale, 'Close', 'إغلاق')}
                onClick={close}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hidden fields carrying the selection + message */}
            <input type="hidden" name="triggerType" value={selected?.type ?? ''} />
            <input type="hidden" name="triggerKey" value={selected?.key ?? ''} />
            <input type="hidden" name="message" value={message} />

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {state.error ? (
                <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {state.error}
                </p>
              ) : null}

              {/* Step 1 — trigger */}
              <div hidden={step !== 1}>
                <p className="mb-3 text-sm text-neutral-600">
                  {tr(
                    locale,
                    'Choose the order status that triggers this message.',
                    'اختر حالة الطلب التي تُطلق هذه الرسالة.',
                  )}
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {WHATSAPP_TRIGGERS.map((t) => (
                    <TriggerButton
                      key={t.key}
                      emoji={t.emoji}
                      label={tr(locale, t.en, t.ar)}
                      active={selected?.type === 'canonical' && selected.key === t.key}
                      onClick={() =>
                        setSelected({ type: 'canonical', key: t.key, label: tr(locale, t.en, t.ar), emoji: t.emoji })
                      }
                    />
                  ))}
                </div>

                {customStatuses.length > 0 ? (
                  <>
                    <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {tr(locale, 'Custom statuses', 'حالات مخصصة')}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {customStatuses.map((c) => (
                        <TriggerButton
                          key={c.id}
                          emoji={triggerEmoji(c.canonical)}
                          label={c.name}
                          active={selected?.type === 'custom' && selected.key === c.id}
                          onClick={() =>
                            setSelected({ type: 'custom', key: c.id, label: c.name, emoji: triggerEmoji(c.canonical) })
                          }
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {state.fieldErrors?.triggerKey ? (
                  <p className="mt-3 text-xs text-amber-600">{state.fieldErrors.triggerKey}</p>
                ) : null}
              </div>

              {/* Step 2 — message */}
              <div hidden={step !== 2} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wa-message" className="text-sm font-medium text-neutral-700">
                    {tr(locale, 'Message', 'الرسالة')}
                  </label>
                  <textarea
                    id="wa-message"
                    ref={textRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder={tr(
                      locale,
                      'Hello {name}, your order {reference} is ready! 🎂',
                      'مرحبًا {name}، طلبك {reference} جاهز! 🎂',
                    )}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  {state.fieldErrors?.message ? (
                    <p className="text-xs text-amber-600">{state.fieldErrors.message}</p>
                  ) : null}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-neutral-500">
                    {tr(locale, 'Insert a variable', 'أدرج متغيرًا')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {WHATSAPP_VARIABLES.map((v) => (
                      <button
                        key={v.token}
                        type="button"
                        onClick={() => insertVariable(v.token)}
                        title={tr(locale, v.en, v.ar)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        {v.token}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wa-media" className="text-sm font-medium text-neutral-700">
                    {tr(locale, 'Attachment (optional)', 'مرفق (اختياري)')}
                  </label>
                  <input
                    id="wa-media"
                    name="media"
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setMediaName(e.target.files?.[0]?.name ?? null)}
                    className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
                  />
                  <p className="text-xs text-neutral-400">
                    {tr(locale, 'Image or video · max 16 MB', 'صورة أو فيديو · بحد أقصى 16 ميغابايت')}
                  </p>
                </div>
              </div>

              {/* Step 3 — preview */}
              <div hidden={step !== 3}>
                <p className="mb-3 text-sm text-neutral-600">
                  {tr(locale, 'This is how the message will look.', 'هكذا ستبدو الرسالة.')}
                </p>
                <div className="rounded-2xl bg-[#e5ddd5] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.04)_1px,transparent_0)] [background-size:16px_16px] p-5">
                  <div className="ms-auto max-w-[85%]">
                    {mediaName ? (
                      <div className="mb-1 flex items-center gap-2 rounded-t-xl rounded-bl-xl bg-[#d9fdd3] px-3 pt-3 text-xs text-neutral-500">
                        <Paperclip className="h-3.5 w-3.5" />
                        {mediaName}
                      </div>
                    ) : null}
                    <div className={`relative rounded-xl bg-[#d9fdd3] px-3 py-2 text-sm text-neutral-800 shadow-sm ${mediaName ? 'rounded-tr-none' : ''}`}>
                      <p className="whitespace-pre-wrap break-words">
                        {message.trim() || tr(locale, 'Your message preview…', 'معاينة رسالتك…')}
                      </p>
                      <span className="mt-1 block text-end text-[10px] text-neutral-400">12:00 ✓✓</span>
                    </div>
                  </div>
                </div>
                {selected ? (
                  <p className="mt-3 text-xs text-neutral-500">
                    {tr(locale, 'Trigger', 'المُطلِق')}: <span className="font-medium text-neutral-700">{selected.emoji} {selected.label}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {tr(locale, 'Back', 'رجوع')}
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => canNext && setStep((s) => Math.min(3, s + 1))}
                  disabled={!canNext}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {tr(locale, 'Next', 'التالي')}
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={pending || !selected || !message.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {pending ? tr(locale, 'Saving…', 'جارٍ الحفظ…') : tr(locale, 'Create automation', 'إنشاء الأتمتة')}
                </button>
              )}
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}

function Stepper({ step }: { step: number }) {
  const locale = useLocale();
  const labels = [
    tr(locale, 'Trigger', 'المُطلِق'),
    tr(locale, 'Message', 'الرسالة'),
    tr(locale, 'Preview', 'المعاينة'),
  ];
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <span key={label} className="flex items-center gap-1.5">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                active
                  ? 'bg-emerald-600 text-white'
                  : done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : n}
            </span>
            <span className={`text-xs ${active ? 'font-semibold text-neutral-700' : 'text-neutral-400'}`}>{label}</span>
            {n < 3 ? <span className="mx-0.5 h-px w-4 bg-neutral-200" /> : null}
          </span>
        );
      })}
    </div>
  );
}

function TriggerButton({
  emoji,
  label,
  active,
  onClick,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-medium transition ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-emerald-300 hover:bg-emerald-50/40'
      }`}
    >
      <span className="text-lg leading-none">{emoji}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
