import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/t';
import type { Locale } from '@/lib/i18n/config';

/**
 * Small colored client-standing badges.
 *   - green pill with a count = number of delivered/completed orders
 *   - red pill with a count   = number of returned orders
 *   - a plain "New" pill (no color) when the client has neither yet
 * A client with both delivered and returned orders shows both pills.
 */
export function ClientBadges({
  delivered,
  returned,
  size = 'sm',
  locale = 'en',
}: {
  delivered: number;
  returned: number;
  size?: 'sm' | 'md';
  locale?: Locale;
}) {
  const base = cn(
    'inline-flex items-center gap-1 rounded-full font-semibold',
    size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]',
  );

  if (delivered === 0 && returned === 0) {
    return (
      <span className={cn(base, 'bg-neutral-100 text-neutral-500')} title={tr(locale, 'New client — no completed orders yet', 'عميل جديد — لا توجد طلبات مكتملة بعد')}>
        {tr(locale, 'New', 'جديد')}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {delivered > 0 ? (
        <span
          className={cn(base, 'bg-emerald-100 text-emerald-700')}
          title={tr(locale, `${delivered} delivered order${delivered === 1 ? '' : 's'}`, `${delivered} طلب مُسلّم`)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {delivered}
        </span>
      ) : null}
      {returned > 0 ? (
        <span
          className={cn(base, 'bg-red-100 text-red-700')}
          title={tr(locale, `${returned} returned order${returned === 1 ? '' : 's'}`, `${returned} طلب مُرتجع`)}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {returned}
        </span>
      ) : null}
    </span>
  );
}
