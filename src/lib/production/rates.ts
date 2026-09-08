import type { SheetKey } from './rows';

/**
 * Price paid to the worker per finished piece, in DA, by sheet (stage) and size
 * row. Daily earnings = sum over rows of (pieces × rate). Each stage has its own
 * pricing structure.
 *
 * TODO: fill in the real rates provided by the shop. 0 means "not set yet".
 */
export const PIECE_RATES: Record<SheetKey, Record<string, number>> = {
  MASQUAGE: {
    '10_13': 0,
    mini: 0,
    ital_1_4: 0,
    '15_18': 0,
    '25_30': 0,
    '30_plus': 0,
    plateau: 0,
    '3_4p': 0, // "PLATEAU M"
    '1_2p': 0,
    '1_4p': 0,
    '1_6p': 0,
  },
  PREPARATION: {
    '10_13': 0,
    mini: 0,
    '15_18': 0,
    '25_30': 0,
    '30_plus': 0,
    plateau: 0,
    '3_4p': 0, // "PLATEAU M"
    '1_2p': 0,
    '1_4p': 0,
    '1_6p': 0,
  },
};

export function pieceRate(sheet: SheetKey, rowKey: string): number {
  return PIECE_RATES[sheet]?.[rowKey] ?? 0;
}
