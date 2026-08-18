import type { WebSearchIntent, WebSearchQuery } from './types';

const LINKEDIN_EXTRACT_HOSTS = new Set(['linkedin.com', 'lnkd.in']);

export function isBlockedExtractUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
    return LINKEDIN_EXTRACT_HOSTS.has(host);
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
    case 'company':
      return {
        intent: 'company',
        q: joinPresent(hints.company ?? hints.domain, hints.company ? 'official site' : undefined),
      };
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
