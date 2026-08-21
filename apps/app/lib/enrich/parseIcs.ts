export type ParsedIcsEvent = {
  summary: string;
  location: string | null;
  url: string | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
};

function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function icsDate(value: string | undefined): Date | null {
  if (!value) return null;
  const compact = value.trim();
  const m = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const second = m[6] ? Number(m[6]) : 0;
  if (m[7] === 'Z' || m[4]) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(Date.UTC(year, month, day));
}

function field(block: string, key: string): string | null {
  const re = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'im');
  const match = block.match(re);
  const value = match?.[1]?.trim();
  return value || null;
}

export function parseIcsEvents(raw: string): ParsedIcsEvent[] {
  const text = unfoldIcs(raw);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedIcsEvent[] = [];
  for (const chunk of blocks) {
    const block = chunk.split(/END:VEVENT/i)[0] ?? '';
    const summary = field(block, 'SUMMARY');
    if (!summary) continue;
    events.push({
      summary,
      location: field(block, 'LOCATION'),
      url: field(block, 'URL'),
      dateRangeStart: icsDate(field(block, 'DTSTART') ?? undefined),
      dateRangeEnd: icsDate(field(block, 'DTEND') ?? undefined),
    });
  }
  return events;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

export function matchIcsEvent(
  name: string,
  events: ParsedIcsEvent[],
): ParsedIcsEvent | null {
  const want = new Set(tokens(name));
  if (want.size === 0) return null;
  let best: { event: ParsedIcsEvent; score: number } | null = null;
  for (const event of events) {
    const have = tokens(event.summary);
    const overlap = have.filter((t) => want.has(t)).length;
    if (overlap === 0) continue;
    const score = overlap / Math.max(want.size, have.length);
    if (!best || score > best.score) best = { event, score };
  }
  return best && best.score >= 0.4 ? best.event : null;
}

const ICS_FETCH_MS = 8_000;
const ICS_MAX_BYTES = 512 * 1024;
const PUBLIC_ICS_PATH = /^\/calendar\/ical\/[^/]+\/public\/(?:basic|full)\.ics$/i;

export async function fetchCalendarIcs(url: string): Promise<string | null> {
  const parsed = parseCalendarIcsUrl(url);
  if (!parsed) return null;
  try {
    const res = await fetch(parsed, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(ICS_FETCH_MS),
      headers: { accept: 'text/calendar, text/plain' },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 16 || buf.byteLength > ICS_MAX_BYTES) return null;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Public Google Calendar iCal feed only.
 * Secret `/private-{token}/` addresses are capability URLs for the whole
 * calendar — we never store or fetch those.
 */
export function parseCalendarIcsUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  if (url.search || url.hash) return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'calendar.google.com') return null;
  const path = url.pathname;
  if (/\/private(?:-|\/)/i.test(path)) return null;
  if (!PUBLIC_ICS_PATH.test(path)) return null;
  return `https://calendar.google.com${path}`;
}
