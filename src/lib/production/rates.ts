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
    '10_13': 100,
    mini: 50,
    ital_1_4: 250,
    '15_18': 200,
    '25_30': 300,
    '30_plus': 400,
    plateau: 500,
    '3_4p': 350, // "PLATEAU M"
    '1_2p': 250,
    '1_4p': 150,
    '1_6p': 100,
  },
  PREPARATION: {
    '10_13': 60,
    mini: 30,
    '15_18': 100,
    '25_30': 200,
    '30_plus': 300,
    plateau: 300,
    '3_4p': 150, // "PLATEAU M"
    '1_2p': 150,
    '1_4p': 100,
    '1_6p': 50,
  },
};

export function pieceRate(sheet: SheetKey, rowKey: string): number {
  return PIECE_RATES[sheet]?.[rowKey] ?? 0;
}
