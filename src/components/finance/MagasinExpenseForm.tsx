'use client';

import { useActionState, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { recordMagasinExpense, type MagasinState } from '@/lib/magasin/actions';
import { financeAttachmentUploadUrl } from '@/lib/finance/actions';
import { ACCEPTED_FINANCE_TYPES, MAX_FINANCE_BYTES } from '@/lib/validation/finance';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: MagasinState = {};
const ATTACH_BUCKET = 'finance-attachments';
const MAX_FINANCE_MB = Math.round(MAX_FINANCE_BYTES / (1024 * 1024));
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function MagasinExpenseForm({
  date,
  categories,
  agents = [],
}: {
  date: string;
  categories: { id: string; name: string }[];
  agents?: { id: string; name: string }[];
}) {
  const locale = useLocale();
  const [state, action, pending] = useActionState(recordMagasinExpense, initial);

  // Receipt uploaded straight to Storage on select — keeps large files off the
  // server action (Next caps its body at 1 MB, Vercel at ~4.5 MB).
  const [att, setAtt] = useState<{ path: string; mime: string; size: number } | null>(null);
  const [attStatus, setAttStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [attError, setAttError] = useState<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const onAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAtt(null);
    setAttError(null);
    setAttStatus('idle');
    if (!file) return;
    if (!ACCEPTED_FINANCE_TYPES.includes(file.type)) {
      setAttStatus('error');
      setAttError(tr(locale, 'Use a JPEG, PNG, WEBP or PDF file.', 'استخدم ملف JPEG أو PNG أو WEBP أو PDF.'));
      return;
    }
    if (file.size > MAX_FINANCE_BYTES) {
      setAttStatus('error');
      setAttError(tr(locale, `File must be ${MAX_FINANCE_MB} MB or smaller.`, `يجب أن يكون الملف ${MAX_FINANCE_MB} ميغابايت أو أقل.`));
      return;
    }
    setAttStatus('uploading');
    const signed = await financeAttachmentUploadUrl(file.type, file.size, file.name);
    if ('error' in signed) {
      setAttStatus('error');
      setAttError(signed.error);
      return;
    }
    const supabase = (supabaseRef.current ??= createClient());
    const { error } = await supabase.storage
      .from(ATTACH_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (error) {
      setAttStatus('error');
      setAttError(tr(locale, 'Upload failed. Please try again.', 'فشل الرفع. حاول مرة أخرى.'));
      return;
    }
    setAtt({ path: signed.path, mime: file.type, size: file.size });
    setAttStatus('done');
  };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="occurredAt" value={date} />
      {state.error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <select name="agent" className={inputCls} defaultValue="" required>
        <option value="" disabled>{tr(locale, 'Agent making the expense…', 'العون الذي يقوم بالمصروف…')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <input name="amount" type="number" min="0" step="0.01" placeholder={tr(locale, 'Amount', 'المبلغ')} className={inputCls} required />
        <select name="categoryId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'Category…', 'الفئة…')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <input name="description" placeholder={tr(locale, 'Description (optional)', 'الوصف (اختياري)')} className={inputCls} />

      {/* Camera capture — phones/tablets only. */}
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 lg:hidden">
        <Camera className="h-4 w-4" />
        {tr(locale, 'Take a photo', 'التقاط صورة')}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onAttachmentChange} className="hidden" />
      </label>
      {/* No `name`: uploaded directly to Storage on select. */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={onAttachmentChange}
        className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
      />
      {attStatus === 'uploading' ? <p className="text-xs text-neutral-500">{tr(locale, 'Uploading…', 'جارٍ الرفع…')}</p> : null}
      {attStatus === 'done' ? <p className="text-xs text-emerald-600">{tr(locale, 'Receipt attached ✓', 'تم إرفاق الإيصال ✓')}</p> : null}
      {attError ? <p className="text-xs text-amber-600">{attError}</p> : null}
      {att ? (
        <>
          <input type="hidden" name="attachmentPath" value={att.path} />
          <input type="hidden" name="attachmentMime" value={att.mime} />
          <input type="hidden" name="attachmentSize" value={String(att.size)} />
        </>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || attStatus === 'uploading'} className="w-full">
        {attStatus === 'uploading'
          ? tr(locale, 'Uploading…', 'جارٍ الرفع…')
          : pending
            ? tr(locale, 'Saving…', 'جارٍ الحفظ…')
            : tr(locale, 'Record expense', 'تسجيل المصروف')}
      </Button>
    </form>
  );
}
