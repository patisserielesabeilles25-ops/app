import { cn } from '@/lib/utils';

// Coating → colour: pâte à sucre green, ganache blue, voulaire red,
// crème chantilly yellow.
const COATING_COLOR: Record<string, string> = {
  'Pâte à Sucre': 'bg-emerald-500',
  Ganache: 'bg-blue-500',
  Voulaire: 'bg-red-500',
  'Crème Chantilly': 'bg-amber-400',
};

/** A small colour-coded dot for an order's coating, optionally with its name. */
export function CoatingDot({
  coating,
  showLabel = true,
}: {
  coating: string | null;
  showLabel?: boolean;
}) {
  if (!coating) return null;
  const color = COATING_COLOR[coating] ?? 'bg-neutral-300';
  return (
    <span className="inline-flex items-center gap-1.5" title={coating}>
      <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', color)} style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }} />
      {showLabel ? <span className="text-xs text-neutral-600">{coating}</span> : null}
    </span>
  );
}
