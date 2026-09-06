'use client';

import { useRef } from 'react';
import { setOrderCustomStatus } from '@/lib/orders/actions';

type Option = { id: string; name: string };

export function OrderCustomStatusSelect({
  orderId,
  value,
  options,
  canEdit,
}: {
  orderId: string;
  value: string | null;
  options: Option[];
  canEdit: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);

  if (!canEdit) {
    const sel = options.find((o) => o.id === value);
    return sel ? (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
        {sel.name}
      </span>
    ) : (
      <span className="text-neutral-300">—</span>
    );
  }

  return (
    <form ref={ref} action={setOrderCustomStatus}>
      <input type="hidden" name="orderId" value={orderId} />
      <select
        name="customStatusId"
        defaultValue={value ?? ''}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </form>
  );
}
