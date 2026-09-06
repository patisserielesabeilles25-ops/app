import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

/** Placeholder body for sections whose full implementation lands in a later phase. */
export function ComingSoon({
  icon,
  feature,
  phase,
}: {
  icon?: LucideIcon;
  feature: string;
  phase: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={`${feature} — coming soon`}
      description={`This section is scaffolded and permission-gated. Full functionality is scheduled for ${phase}.`}
    />
  );
}
