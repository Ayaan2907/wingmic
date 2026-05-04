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
