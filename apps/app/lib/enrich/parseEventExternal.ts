export type EventExternalSource = 'luma' | 'partiful' | 'web';

export function parseEventExternal(
  raw: string,
): { source: EventExternalSource; id: string } | null {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'lu.ma' || host === 'luma.com') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) return { source: 'luma', id };
    }
    if (host === 'partiful.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[0] === 'e' ? parts[1] : parts[0];
      if (id) return { source: 'partiful', id };
    }
  } catch {
    // fall through to snippet scan
  }

  const luma = trimmed.match(/https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\/([a-zA-Z0-9_-]+)/i);
  if (luma?.[1]) return { source: 'luma', id: luma[1] };

  const partiful = trimmed.match(
    /https?:\/\/(?:www\.)?partiful\.com\/(?:e\/)?([a-zA-Z0-9_-]+)/i,
  );
  if (partiful?.[1]) return { source: 'partiful', id: partiful[1] };

  return null;
}
