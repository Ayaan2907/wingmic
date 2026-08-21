/**
 * Normalize LinkedIn profile URLs / handles.
 * Query params, www, and trailing slashes collapse. Non-profile URLs return null.
 * Browser-safe (no node:crypto) so the app client can import this module.
 */
export function canonicalizeLinkedin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let input = trimmed.toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
  if (/^in\/[a-z0-9_-]+$/.test(input)) {
    input = `https://www.linkedin.com/${input}`;
  } else if (!input.includes('.') && !input.includes('/')) {
    input = `https://www.linkedin.com/in/${input}`;
  }

  const withProto = /^https?:\/\//.test(input)
    ? input
    : `https://${input.replace(/^\/\//, '')}`;

  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  // Profile URLs are exactly `/in/{handle}` — drop company, posts, and extra path.
  if (parts.length !== 2 || parts[0] !== 'in' || !parts[1]) return null;
  const handle = parts[1];

  const clean = handle.replace(/\/+$/, '');
  if (!clean || !/^[a-z0-9_-]+$/i.test(clean)) return null;

  return `https://www.linkedin.com/in/${clean}`;
}

const LINKEDIN_URL_PATTERNS: RegExp[] = [
  /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/gi,
  /(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/gi,
  /(?<![\w./:-])\/?in\/[A-Za-z0-9_-]+/gi,
];

const URL_DEBRIS = new Set([
  'http',
  'https',
  'www',
  'com',
  'linkedin',
  'linkedin.com',
  'www.linkedin.com',
  'in',
]);

/** First canonical /in/{handle} URL spoken or pasted in a memo. */
export function harvestLinkedinFromTranscript(transcript: string): string | null {
  const matches: Array<{ index: number; raw: string }> = [];
  for (const re of LINKEDIN_URL_PATTERNS) {
    re.lastIndex = 0;
    for (const match of transcript.matchAll(re)) {
      matches.push({
        index: match.index,
        raw: match[0].trim().replace(/^[\s/]+/, ''),
      });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  for (const match of matches) {
    const canon = canonicalizeLinkedin(match.raw);
    if (canon) return canon;
  }
  return null;
}

export function linkedinHandle(url: string | null | undefined): string | null {
  const canon = url ? canonicalizeLinkedin(url) : null;
  if (!canon) return null;
  try {
    const handle = new URL(canon).pathname.split('/').filter(Boolean)[1];
    return handle ?? null;
  } catch {
    return null;
  }
}

export function isLinkedinUrlDebrisTopic(topic: string, linkedinUrl: string | null): boolean {
  const tokens = topic
    .trim()
    .toLowerCase()
    .split(/[\s/]+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((t) => URL_DEBRIS.has(t))) return true;
  const handle = linkedinHandle(linkedinUrl);
  if (handle && tokens.length === 1 && tokens[0] === handle.toLowerCase()) return true;
  if (topic.toLowerCase().includes('linkedin.com')) return true;
  return false;
}
