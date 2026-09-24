export type ParsedIcsEvent = {
  summary: string;
  location: string | null;
  url: string | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  /**
   * VALUE=DATE event. ICS all-day DTEND is exclusive; parseIcsEvents
   * normalizes it to the inclusive last-day midnight, so window matching
   * shifts one day back out (see icsEventWindow).
   */
  allDay: boolean;
  /**
   * Raw RRULE value (e.g. "FREQ=WEEKLY;BYDAY=MO,WE"), null when the event
   * is a single fixed occurrence. Consumed by the recurrence expansion in
   * icsWindow.ts; other consumers see the base occurrence only.
   */
  rrule: string | null;
  /** Deleted-occurrence start instants (UTC ms) — EXDATE. Empty unless set. */
  exdates: number[];
  /** Added-occurrence start instants (UTC ms) — RDATE. Empty unless set. */
  rdates: number[];
};

function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

type IcsField = {
  value: string;
  params: Map<string, string>;
};

function zonedUtcDate(parts: number[], timeZone: string): Date | null {
  const [year, month, day, hour, minute, second] = parts;
  const localAsUtc = Date.UTC(year!, month!, day!, hour!, minute!, second!);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    let result = localAsUtc;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const formatted = Object.fromEntries(
        formatter.formatToParts(new Date(result)).map((part) => [part.type, part.value]),
      );
      const displayedAsUtc = Date.UTC(
        Number(formatted.year),
        Number(formatted.month) - 1,
        Number(formatted.day),
        Number(formatted.hour),
        Number(formatted.minute),
        Number(formatted.second),
      );
      result += localAsUtc - displayedAsUtc;
    }
    return new Date(result);
  } catch {
    return null;
  }
}

function icsDate(fieldValue: IcsField | null, inclusiveDateEnd = false): Date | null {
  if (!fieldValue) return null;
  const compact = fieldValue.value.trim();
  const m = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const second = m[6] ? Number(m[6]) : 0;
  let date: Date | null;
  const timeZone = fieldValue.params.get('TZID')?.replace(/^"|"$/g, '');
  if (m[7] === 'Z' || !timeZone) {
    date = new Date(Date.UTC(year, month, day, hour, minute, second));
  } else {
    date = zonedUtcDate([year, month, day, hour, minute, second], timeZone);
  }
  if (date && inclusiveDateEnd && fieldValue.params.get('VALUE')?.toUpperCase() === 'DATE') {
    date = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  return date;
}

function parsedField(block: string, key: string): IcsField | null {
  return fieldValues(block, key)[0] ?? null;
}

/** All occurrences of a property line — EXDATE/RDATE repeat and carry comma lists. */
function fieldValues(block: string, key: string): IcsField[] {
  const re = new RegExp(`^${key}((?:;[^:]*)?):(.+)$`, 'gim');
  const fields: IcsField[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    const value = match[2]?.trim();
    if (!value) continue;
    const params = new Map<string, string>();
    for (const entry of (match[1] ?? '').split(';').filter(Boolean)) {
      const separator = entry.indexOf('=');
      if (separator > 0) {
        params.set(entry.slice(0, separator).toUpperCase(), entry.slice(separator + 1));
      }
    }
    fields.push({ value, params });
  }
  return fields;
}

function field(block: string, key: string): string | null {
  return parsedField(block, key)?.value ?? null;
}

/**
 * EXDATE/RDATE instants, canonicalized exactly like DTSTART (same TZID /
 * floating / Z semantics — the feed repeats its own DTSTART form on these
 * lines). Any value form we cannot canonicalize — unknown TZID, RDATE
 * PERIOD ("start/duration"), malformed dates — marks the list unsupported:
 * silently ignoring it would re-bind cancelled meetings, so the event
 * degrades to its base occurrence instead.
 */
function icsDateList(block: string, key: string): { dates: number[]; supported: boolean } {
  const fields = fieldValues(block, key);
  if (fields.length === 0) return { dates: [], supported: true };
  const dates: number[] = [];
  for (const fieldValue of fields) {
    for (const piece of fieldValue.value.split(',')) {
      const date = icsDate({ value: piece, params: fieldValue.params });
      if (!date) return { dates: [], supported: false };
      dates.push(date.getTime());
    }
  }
  return { dates, supported: true };
}

export function parseIcsEvents(raw: string): ParsedIcsEvent[] {
  const text = unfoldIcs(raw);
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedIcsEvent[] = [];
  for (const chunk of blocks) {
    const block = chunk.split(/END:VEVENT/i)[0] ?? '';
    const summary = field(block, 'SUMMARY');
    if (!summary) continue;
    const dtstart = parsedField(block, 'DTSTART');
    const rrule = field(block, 'RRULE');
    const exdates = icsDateList(block, 'EXDATE');
    const rdates = icsDateList(block, 'RDATE');
    const datesSupported = exdates.supported && rdates.supported;
    events.push({
      summary,
      location: field(block, 'LOCATION'),
      url: field(block, 'URL'),
      dateRangeStart: icsDate(dtstart),
      dateRangeEnd: icsDate(parsedField(block, 'DTEND'), true),
      allDay: dtstart?.params.get('VALUE')?.toUpperCase() === 'DATE',
      // Expansion that ignored EXDATE/RDATE would bind cancelled meetings,
      // so an unsupported list drops the rule to the base occurrence.
      rrule: datesSupported ? rrule : null,
      exdates: datesSupported ? exdates.dates : [],
      rdates: datesSupported ? rdates.dates : [],
    });
  }
  return events;
}

function tokens(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

export function matchIcsEvent(name: string, events: ParsedIcsEvent[]): ParsedIcsEvent | null {
  const wantTokens = tokens(name);
  const want = new Set(wantTokens);
  if (want.size === 0) return null;
  let best: { event: ParsedIcsEvent; score: number } | null = null;
  let tied = false;
  for (const event of events) {
    const have = new Set(tokens(event.summary));
    const exact = have.size === want.size && [...have].every((token) => want.has(token));
    const overlap = [...have].filter((token) => want.has(token)).length;
    if (!exact && overlap < 2) continue;
    const score = exact ? 1 : overlap / Math.max(want.size, have.size);
    if (!best || score > best.score) {
      best = { event, score };
      tied = false;
    } else if (score === best.score) {
      tied = true;
    }
  }
  return best && !tied && best.score >= 0.4 ? best.event : null;
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
    const declaredLength = res.headers.get('content-length');
    if (declaredLength && Number(declaredLength) > ICS_MAX_BYTES) return null;
    if (!res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > ICS_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (byteLength < 16) return null;
    const buf = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }
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
