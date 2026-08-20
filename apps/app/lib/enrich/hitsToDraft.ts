import { canonicalizeLinkedin, type PersonaDraft } from '@wingmic/extractor';
import { isBlockedExtractUrl, type WebSearchHit } from '@/lib/web-search';

export function hitsToPersonaDraft(
  spoken: {
    name: string;
    companyHint?: string | null;
    linkedin?: string | null;
  },
  hits: WebSearchHit[],
): PersonaDraft {
  let linkedin = spoken.linkedin ? canonicalizeLinkedin(spoken.linkedin) : null;
  let sourceUrl: string | null = null;

  for (const hit of hits) {
    if (!linkedin) {
      const fromHit = canonicalizeLinkedin(hit.url);
      if (fromHit) linkedin = fromHit;
    }
    if (!sourceUrl && !isBlockedExtractUrl(hit.url)) {
      sourceUrl = hit.url;
    }
  }

  return {
    name: spoken.name,
    companyHint: spoken.companyHint ?? null,
    linkedin,
    sourceUrl,
  };
}
