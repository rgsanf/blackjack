/** Fixed one decimal so a column of percentages keeps its decimal points aligned. */
export function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * Signed EV with a U+2212 MINUS SIGN rather than a hyphen, so "+" and "-" occupy the
 * same width and the column does not shift as values cross zero.
 */
export function ev(v: number): string {
  const s = v.toFixed(3);
  return v < 0 ? `\u2212${s.slice(1)}` : `+${s}`;
}

export function signedCount(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : "0";
}

export function oneDecimal(n: number): string {
  const s = Math.abs(n).toFixed(1);
  return n > 0 ? `+${s}` : n < 0 ? `\u2212${s}` : "0.0";
}
