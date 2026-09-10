'use client';

import { useActionState, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { recordIncome, recordExpense, financeAttachmentUploadUrl, type FinanceFormState } from '@/lib/finance/actions';
import { ACCEPTED_FINANCE_TYPES, MAX_FINANCE_BYTES } from '@/lib/validation/finance';
import { createClient } from '@/lib/supabase/client';
import { Button, LinkButton } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/t';
import { useLocale } from '@/lib/i18n/LocaleProvider';

const initial: FinanceFormState = {};
const ATTACH_BUCKET = 'finance-attachments';
const MAX_FINANCE_MB = Math.round(MAX_FINANCE_BYTES / (1024 * 1024));
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100';

export function EntryForm({
  type,
  categories,
  today,
}: {
  type: 'INCOME' | 'EXPENSE';
  categories: { id: string; name: string }[];
  today: string;
}) {
  const locale = useLocale();
  const action = type === 'INCOME' ? recordIncome : recordExpense;
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};
  const isExpense = type === 'EXPENSE';

  // Receipt uploaded straight to Storage on select (keeps large files off the
  // server action). Only the resulting path is submitted with the form.
  const [att, setAtt] = useState<{ path: string; mime: string; size: number; isImage: boolean } | null>(null);
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
    setAtt({ path: signed.path, mime: file.type, size: file.size, isImage: file.type.startsWith('image/') });
    setAttStatus('done');
  };

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{state.error}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium text-neutral-700">{tr(locale, 'Amount', 'المبلغ')}</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0" className={inputCls} required />
          {fe.amount ? <p className="text-xs text-amber-600">{fe.amount}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="occurredAt" className="text-sm font-medium text-neutral-700">{tr(locale, 'Date', 'التاريخ')}</label>
          <input id="occurredAt" name="occurredAt" type="date" defaultValue={today} className={inputCls} required />
          {fe.occurredAt ? <p className="text-xs text-amber-600">{fe.occurredAt}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-sm font-medium text-neutral-700">{tr(locale, 'Category', 'الفئة')}</label>
        <select id="categoryId" name="categoryId" className={inputCls} defaultValue="">
          <option value="">{tr(locale, 'Uncategorized', 'غير مصنّف')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isExpense ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemName" className="text-sm font-medium text-neutral-700">{tr(locale, 'Item / supplier (optional)', 'البند / المورّد (اختياري)')}</label>
          <input id="itemName" name="itemName" className={inputCls} placeholder={tr(locale, 'e.g. Oven, flour, electricity bill…', 'مثال: فرن، دقيق، فاتورة الكهرباء…')} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-neutral-700">{tr(locale, 'Description', 'الوصف')}</label>
        <textarea id="description" name="description" rows={2} className={inputCls} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="attachment" className="text-sm font-medium text-neutral-700">{tr(locale, 'Receipt / document (optional)', 'إيصال / مستند (اختياري)')}</label>
        {/* Camera capture — phones/tablets only; opens the rear camera. */}
        <label className="mb-1 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 lg:hidden">
          <Camera className="h-4 w-4" />
          {tr(locale, 'Take a photo', 'التقاط صورة')}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onAttachmentChange} className="hidden" />
        </label>
        {/* No `name`: uploaded directly to Storage on select. */}
        <input
          id="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onAttachmentChange}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
        />
        <p className="text-xs text-neutral-400">{tr(locale, `JPEG, PNG, WEBP or PDF · max ${MAX_FINANCE_MB} MB`, `JPEG أو PNG أو WEBP أو PDF · بحد أقصى ${MAX_FINANCE_MB} ميغابايت`)}</p>
        {attStatus === 'uploading' ? <p className="text-xs text-neutral-500">{tr(locale, 'Uploading…', 'جارٍ الرفع…')}</p> : null}
        {attStatus === 'done' ? <p className="text-xs text-emerald-600">{tr(locale, 'Attached ✓', 'تم الإرفاق ✓')}</p> : null}
        {attError ? <p className="text-xs text-amber-600">{attError}</p> : null}
        {att ? (
          <>
            <input type="hidden" name="attachmentPath" value={att.path} />
            <input type="hidden" name="attachmentMime" value={att.mime} />
            <input type="hidden" name="attachmentSize" value={String(att.size)} />
          </>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5">
        <LinkButton href="/finance" variant="secondary">{tr(locale, 'Cancel', 'إلغاء')}</LinkButton>
        <Button type="submit" disabled={pending || attStatus === 'uploading'}>
          {attStatus === 'uploading'
            ? tr(locale, 'Uploading…', 'جارٍ الرفع…')
            : pending
              ? tr(locale, 'Saving…', 'جارٍ الحفظ…')
              : type === 'INCOME'
                ? tr(locale, 'Record income', 'تسجيل الدخل')
                : tr(locale, 'Record expense', 'تسجيل المصروف')}
        </Button>
      </div>
    </form>
  );
}
