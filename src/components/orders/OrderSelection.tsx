'use client';

import { createContext, useContext, useState } from 'react';

type Ctx = { selectedId: string | null; setSelectedId: (id: string | null) => void };

const OrderSelectionContext = createContext<Ctx>({
  selectedId: null,
  setSelectedId: () => {},
});

/** Wraps the orders toolbar + table so a selected row drives the action bar. */
export function OrderSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <OrderSelectionContext.Provider value={{ selectedId, setSelectedId }}>
      {children}
    </OrderSelectionContext.Provider>
  );
}

export function useOrderSelection() {
  return useContext(OrderSelectionContext);
}

/** Single-select radio placed in each order row. Click again to deselect. */
export function OrderSelectRadio({ orderId }: { orderId: string }) {
  const { selectedId, setSelectedId } = useOrderSelection();
  const checked = selectedId === orderId;
  return (
    <input
      type="radio"
      name="orderSelect"
      checked={checked}
      aria-label="Select order"
      onChange={() => setSelectedId(orderId)}
      onClick={() => {
        // Clicking the already-selected radio clears the selection.
        if (checked) setSelectedId(null);
      }}
      className="h-4 w-4 cursor-pointer border-neutral-300 text-amber-500 focus:ring-amber-300"
    />
  );
}
