// Free-text size helpers. Users can type any size ("Mini", "1/2 plateau",
// "20 cm", "?/…"); we keep the raw text for display and parse a number out of
// it (when present) for the numeric column used by rate lookups / sorting.

/** First positive number found in the text, or null. */
export function parseSizeNumber(label: string | null | undefined): number | null {
  if (label == null) return null;
  const m = String(label).match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** What to show for a size: the free text if any, else "<n> cm", else "—". */
export function sizeDisplay(
  sizeLabel: string | null | undefined,
  cm: number | null | undefined,
): string {
  const label = (sizeLabel ?? '').trim();
  if (label) return label;
  return cm != null ? `${cm} cm` : '—';
}
