'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, QrCode, Loader2, Power, PlugZap, Smartphone, RefreshCw } from 'lucide-react';
import { requestConnect, requestDisconnect } from '@/lib/whatsapp/actions';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';
import type { WhatsAppConnection as Connection } from '@/lib/whatsapp/queries';

export function WhatsAppConnection({
  connection,
  canManage,
}: {
  connection: Connection;
  canManage: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { status, qr_code, phone_number } = connection;

  // While connecting, refresh the server component periodically so the QR /
  // final status pushed by the worker shows up.
  useEffect(() => {
    if (status !== 'connecting') return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [status, router]);

  const connect = () => startTransition(() => void requestConnect());
  const disconnect = () => startTransition(() => void requestDisconnect());

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
            <MessageCircle className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">
                {tr(locale, 'WhatsApp connection', 'اتصال واتساب')}
              </h2>
              <StatusPill status={status} />
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              {connected
                ? phone_number
                  ? tr(locale, `Connected as ${phone_number}`, `متصل باسم ${phone_number}`)
                  : tr(locale, 'Your WhatsApp account is connected.', 'حساب واتساب متصل.')
                : connecting
                  ? tr(locale, 'Waiting for you to scan the QR code…', 'في انتظار مسح رمز QR…')
                  : tr(
                      locale,
                      'Connect a WhatsApp account to start sending automatic messages.',
                      'اربط حساب واتساب لبدء إرسال الرسائل التلقائية.',
                    )}
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="shrink-0">
            {connected ? (
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
              >
                <Power className="h-4 w-4" />
                {tr(locale, 'Disconnect', 'قطع الاتصال')}
              </button>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={pending || connecting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {connecting ? tr(locale, 'Connecting…', 'جارٍ الاتصال…') : tr(locale, 'Connect', 'اتصال')}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* QR panel while connecting */}
      {connecting ? (
        <div className="border-t border-emerald-100 bg-white/60 p-5 sm:p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              {qr_code ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr_code}
                  alt={tr(locale, 'WhatsApp QR code', 'رمز QR لواتساب')}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400">
                  <QrCode className="h-10 w-10" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">{tr(locale, 'Generating QR…', 'جارٍ إنشاء الرمز…')}</span>
                </div>
              )}
            </div>
            <ol className="max-w-xs space-y-2 text-sm text-neutral-600">
              <li className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {tr(locale, 'Open WhatsApp on your phone.', 'افتح واتساب على هاتفك.')}
              </li>
              <li className="flex items-start gap-2">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {tr(
                  locale,
                  'Go to Settings → Linked devices → Link a device.',
                  'اذهب إلى الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.',
                )}
              </li>
              <li className="flex items-start gap-2 font-medium text-neutral-800">
                {tr(locale, 'Scan this QR code with WhatsApp.', 'امسح رمز QR هذا بواسطة واتساب.')}
              </li>
              {canManage ? (
                <li className="pt-1">
                  <button
                    type="button"
                    onClick={connect}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
                    {tr(locale, 'Refresh QR code', 'تحديث رمز QR')}
                  </button>
                  <p className="mt-1 text-xs text-neutral-400">
                    {tr(
                      locale,
                      'The code expires after ~1 minute — refresh if scanning fails.',
                      'ينتهي الرمز بعد حوالي دقيقة — حدّثه إذا فشل المسح.',
                    )}
                  </p>
                </li>
              ) : null}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: Connection['status'] }) {
  const locale = useLocale();
  const map = {
    connected: {
      cls: 'bg-emerald-100 text-emerald-700',
      dot: 'bg-emerald-500',
      label: tr(locale, 'Connected', 'متصل'),
    },
    connecting: {
      cls: 'bg-amber-100 text-amber-700',
      dot: 'bg-amber-500 animate-pulse',
      label: tr(locale, 'Connecting', 'جارٍ الاتصال'),
    },
    disconnected: {
      cls: 'bg-neutral-100 text-neutral-500',
      dot: 'bg-neutral-400',
      label: tr(locale, 'Not connected', 'غير متصل'),
    },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </span>
  );
}
