/** Root-relative path for magic-link callback. Rejects open redirects. */
export function safeNextPath(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '/chat';
  if (!value.startsWith('/') || value.startsWith('//')) return '/chat';
  if (value.includes('\\') || value.includes('://')) return '/chat';
  // Browsers strip tab/CR/LF from URLs, so "/\t//host" would become
  // scheme-relative after the checks above — reject all ASCII controls.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/chat';
  return value;
}
