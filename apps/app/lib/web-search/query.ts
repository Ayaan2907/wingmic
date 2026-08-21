import type { WebSearchIntent, WebSearchQuery } from './types';

export function isBlockedExtractUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    return (
      host === 'linkedin.com' ||
      host.endsWith('.linkedin.com') ||
      host === 'lnkd.in' ||
      host.endsWith('.lnkd.in')
    );
  } catch {
    return true;
  }
}

export type WebSearchQueryHints = {
  intent: WebSearchIntent;
  /** If set, used as-is. */
  q?: string;
  name?: string;
  company?: string;
  linkedinUrl?: string;
  event?: string;
  year?: string;
  domain?: string;
};

/**
 * Build vendor-agnostic query text from this user's signals only.
 * The Tavily/Exa adapter sends `q` unchanged (plus intent-specific options).
 */
export function buildWebSearchQuery(hints: WebSearchQueryHints): WebSearchQuery {
  const explicit = hints.q?.trim();
  if (explicit) return { intent: hints.intent, q: explicit };

  switch (hints.intent) {
    case 'profile': {
      const q = hints.linkedinUrl?.trim() || joinPresent(quoteName(hints.name), hints.company);
      return { intent: 'profile', q };
    }
    case 'person':
      return { intent: 'person', q: joinPresent(quoteName(hints.name), hints.company) };
    case 'company': {
      const company = hints.company?.trim() || undefined;
      const domain = hints.domain?.trim() || undefined;
      const subject = company ?? domain;
      return {
        intent: 'company',
        q: joinPresent(subject, subject ? 'official site' : undefined),
      };
    }
    case 'event':
      return { intent: 'event', q: joinPresent(hints.event, hints.year) };
    case 'general':
      return { intent: 'general', q: joinPresent(hints.name, hints.company, hints.event) };
    default: {
      const _exhaustive: never = hints.intent;
      return { intent: 'general', q: String(_exhaustive) };
    }
  }
}

function quoteName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  return `"${trimmed}"`;
}

function joinPresent(...parts: Array<string | undefined>): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(' ');
}
