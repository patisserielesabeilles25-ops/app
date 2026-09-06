'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  );
}

/**
 * Reusable confirmation dialog for destructive actions. Wraps a server action
 * in a native <dialog>; the action only fires after explicit confirmation.
 */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel = 'Confirm',
  action,
  hiddenFields,
  triggerClassName,
}: {
  triggerLabel: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setOpen(true);
          ref.current?.showModal();
        }}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={ref}
        className="m-auto w-full max-w-sm rounded-2xl border border-neutral-200 p-0 backdrop:bg-neutral-900/40"
        onClose={() => setOpen(false)}
      >
        {open ? (
          <div className="p-6">
            <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm text-neutral-500">{description}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => ref.current?.close()}
              >
                Cancel
              </Button>
              <form
                action={action}
                onSubmit={() => ref.current?.close()}
              >
                {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <ConfirmButton label={confirmLabel} />
              </form>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
