/**
 * Slug for canonical Company / Event / Topic. Lowercase, ASCII, hyphens.
 * Stable across users so two captures of "Acme" produce the same slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Tokenize a display name for exact normalized matching. */
export function personNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}\p{M}'-]/gu, ''))
    .filter(Boolean);
}

/** Lowercase token-join form used for unique-name reuse (exact only). */
export function normalizePersonName(name: string): string {
  return personNameTokens(name).join(' ');
}

export function personNameEquals(a: string, b: string): boolean {
  const ta = normalizePersonName(a);
  const tb = normalizePersonName(b);
  return ta.length > 0 && ta === tb;
}

export function entityMatchesPersonName(
  candidateName: string,
  entity: { name: string; aliases?: string[] | null },
): boolean {
  if (personNameEquals(candidateName, entity.name)) return true;
  for (const alias of entity.aliases ?? []) {
    if (personNameEquals(candidateName, alias)) return true;
  }
  return false;
}

/** Levenshtein-style similarity 0..1 (1 = identical). Cheap, no allocations beyond ASCII. */
export function nameSimilarity(a: string, b: string): number {
  const sa = slugify(a);
  const sb = slugify(b);
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  const m = sa.length;
  const n = sb.length;
  if (m === 0 || n === 0) return 0;

  // Prefix / suffix shortcut
  if (sa.startsWith(sb) || sb.startsWith(sa)) {
    return Math.min(m, n) / Math.max(m, n);
  }

  // Token-set Jaccard for multi-word names ("Sarah Chen" vs "Chen Sarah")
  const ta = new Set(sa.split('-'));
  const tb = new Set(sb.split('-'));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  if (union === 0) return 0;
  const jaccard = inter / union;

  // Single-letter sub-similarity for typos
  let edits = 0;
  const len = Math.max(m, n);
  for (let i = 0; i < len; i++) {
    if (sa[i] !== sb[i]) edits++;
  }
  const editScore = 1 - edits / len;

  return Math.max(jaccard, editScore * 0.6);
}
