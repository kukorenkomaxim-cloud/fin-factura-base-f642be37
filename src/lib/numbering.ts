// Document numbering model: "prefix + trailing numeric counter".
//
// A user-defined invoice number is split into a fixed PREFIX and the LAST
// group of digits (the counter). Incrementing a number means adding 1 to that
// last digit group while preserving its zero-padded width.
//
//   "0042365"   -> prefix=""        digits="0042365" width=7  -> "0042366"
//   "01f45-14"  -> prefix="01f45-"  digits="14"      width=2  -> "01f45-15"
//   "FAC-099"   -> prefix="FAC-"    digits="099"     width=3  -> "FAC-100"
//
// Numbering "spaces" are fully independent per (doc_type x mode):
// factura/proforma and sandbox/production never share or block each other.

export interface ParsedDocNumber {
  /** Everything before the trailing digit group (kept verbatim). */
  prefix: string;
  /** The trailing digit group as typed (with leading zeros). */
  digits: string;
  /** Width (number of characters) of the trailing digit group. */
  width: number;
  /** Numeric value of the trailing digit group. */
  value: number;
}

/**
 * Parse a document number into its fixed prefix and trailing numeric counter.
 * Returns null when the string has no trailing digit group.
 */
export function parseDocNumber(input: string): ParsedDocNumber | null {
  const s = (input ?? "").trim();
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const prefix = m[1];
  const digits = m[2];
  return {
    prefix,
    digits,
    width: digits.length,
    value: Number(digits),
  };
}

/**
 * Increment a document number by 1, preserving the prefix and the
 * zero-padded width of the trailing counter (width grows only on overflow).
 * Returns null when the input has no trailing digit group.
 */
export function incrementDocNumber(input: string): string | null {
  const parsed = parseDocNumber(input);
  if (!parsed) return null;
  const next = parsed.value + 1;
  const nextDigits = String(next).padStart(parsed.width, "0");
  return `${parsed.prefix}${nextDigits}`;
}

/**
 * Two numbers share the same FORMAT when their prefix and counter width match.
 * Used to warn when a manually-edited number deviates from the space's format.
 */
export function sameFormat(a: string, b: string): boolean {
  const pa = parseDocNumber(a);
  const pb = parseDocNumber(b);
  if (!pa || !pb) return false;
  return pa.prefix === pb.prefix && pa.width === pb.width;
}

/**
 * Order two document numbers. Primary key is the numeric counter value
 * (the part that increments); ties fall back to a stable string compare so
 * different prefixes/widths remain deterministically ordered.
 */
export function compareDocNumbers(a: string, b: string): number {
  const pa = parseDocNumber(a);
  const pb = parseDocNumber(b);
  if (pa && pb) {
    if (pa.value !== pb.value) return pa.value - pb.value;
    return a.localeCompare(b);
  }
  return (a ?? "").localeCompare(b ?? "");
}

/**
 * Given the list of existing numbers in a space, compute the next number.
 * - If numbers exist, increment the highest one.
 * - Otherwise fall back to `firstNumber` (the user-defined first number).
 * Returns "" when neither is available (caller must ask the user to define it).
 */
export function computeNextNumber(existing: string[], firstNumber: string): string {
  const valid = existing.filter((n) => parseDocNumber(n) !== null);
  if (valid.length === 0) {
    return firstNumber.trim();
  }
  let highest = valid[0];
  for (const n of valid) {
    if (compareDocNumbers(n, highest) > 0) highest = n;
  }
  return incrementDocNumber(highest) ?? "";
}
