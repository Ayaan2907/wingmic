/**
 * Normalize LinkedIn profile URLs / handles.
 * Query params, www, and trailing slashes collapse. Non-profile URLs return null.
 * Browser-safe (no node:crypto) so the app client can import this module.
 */
export function canonicalizeLinkedin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let input = trimmed.toLowerCase().replace(/^@/, '');
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
