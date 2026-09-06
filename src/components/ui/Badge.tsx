import { cn } from '@/lib/utils';
import type { BadgeTone } from '@/lib/orders/status';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600',
  blue: 'bg-amber-50 text-amber-700',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
