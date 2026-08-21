/** Root-relative path for magic-link callback. Rejects open redirects. */
export function safeNextPath(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '/chat';
  if (!value.startsWith('/') || value.startsWith('//')) return '/chat';
  if (value.includes('\\') || value.includes('://')) return '/chat';
  return value;
}
