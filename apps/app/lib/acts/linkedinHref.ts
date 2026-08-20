/** Turn a stored LinkedIn fact into an https profile URL, or null if unusable. */
export function linkedinProfileHref(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
      url.protocol = 'https:';
      return url.toString();
    } catch {
      return null;
    }
  }

  const handle = value.replace(/^@/, '').replace(/^(in)\//i, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(handle)) return null;
  return `https://www.linkedin.com/in/${handle}`;
}
