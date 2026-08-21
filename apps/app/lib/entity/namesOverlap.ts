/** Tokenize a display name for whole-token matching (avoids "Ann" → "Joanne"). */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(Boolean);
}

/**
 * True when two person names likely refer to the same spoken identity.
 * Exact match, or the shorter name's tokens all appear in the longer
 * ("Sagar" ↔ "Sagar Patel", "Sarah Chen" ↔ "Sarah Chen").
 */
export function namesOverlap(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  if (ta.join(' ') === tb.join(' ')) return true;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 1) return long.includes(short[0]!);
  return short.every((t) => long.includes(t));
}
