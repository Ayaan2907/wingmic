import { canonicalizeLinkedin } from '@wingmic/extractor/linkedin';

/** Null-safe wrapper around extractor `canonicalizeLinkedin` for stored facts. */
export function linkedinProfileHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return canonicalizeLinkedin(raw);
}
