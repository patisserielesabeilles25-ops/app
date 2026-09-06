/**
 * Pure classification helpers (no server/DB deps) so they can be unit-tested.
 */

/** Infer the ledger `source` from the chosen category key. */
export function inferSource(catKey: string | null): string {
  switch (catKey) {
    case 'GOODS':
      return 'PURCHASE';
    case 'MACHINES':
    case 'ASSET_SALE':
      return 'MACHINE';
    case 'INVESTMENT':
      return 'INVESTMENT';
    case 'DELIVERY_FEE':
      return 'DELIVERY';
    default:
      return 'OTHER';
  }
}
