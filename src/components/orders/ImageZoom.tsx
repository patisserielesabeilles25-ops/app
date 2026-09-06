'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { tr } from '@/lib/i18n/t';

/** Reference-image thumbnail that opens a full-screen zoom on click. */
export function ImageZoom({ url, alt }: { url: string; alt?: string }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const altText = alt ?? tr(locale, 'Reference', 'مرجع');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={tr(locale, 'Enlarge the image', 'تكبير الصورة')}
        className="block overflow-hidden rounded-lg border border-neutral-200 transition hover:ring-2 hover:ring-amber-300"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={altText} className="h-10 w-10 object-cover" />
      </button>

      {open ? (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            aria-label={tr(locale, 'Close', 'إغلاق')}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={altText}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </>
  );
}
