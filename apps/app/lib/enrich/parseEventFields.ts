import { isBlockedExtractUrl, type WebSearchHit } from '@/lib/web-search';
import { parseEventExternal, type EventExternalSource } from '@wingmic/extractor';

export type ParsedEventFields = {
  url: string | null;
  location: string | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  external: { source: EventExternalSource; id: string } | null;
};

export function parseEventFields(hits: WebSearchHit[]): ParsedEventFields {
  let url: string | null = null;
  let external: ParsedEventFields['external'] = null;
  const blob = hits.map((h) => `${h.title}\n${h.snippet}\n${h.url}`).join('\n');

  for (const hit of hits) {
    if (!external) {
      external = parseEventExternal(hit.url) ?? parseEventExternal(hit.snippet);
    }
    if (!url && !isBlockedExtractUrl(hit.url)) {
      url = hit.url;
    }
  }
  if (!url && external) {
    const fromBlob = blob.match(
      /https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com|partiful\.com)\/[^\s)]+/i,
    );
    if (fromBlob) url = fromBlob[0];
  }

  const dates = parseDateRange(blob);
  const location = parseLocation(blob);

  return {
    url,
    location,
    dateRangeStart: dates?.start ?? null,
    dateRangeEnd: dates?.end ?? null,
    external,
  };
}

const MONTH: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function parseDateRange(text: string): { start: Date; end: Date } | null {
  const isos = [...text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)];
  if (isos.length >= 2) {
    const a = isos[0]!;
    const b = isos[1]!;
    return {
      start: utcDate(Number(a[1]), Number(a[2]) - 1, Number(a[3])),
      end: utcDate(Number(b[1]), Number(b[2]) - 1, Number(b[3])),
    };
  }
  if (isos.length === 1) {
    const a = isos[0]!;
    const d = utcDate(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    return { start: d, end: d };
  }

  const month = Object.keys(MONTH).join('|');
  const range = new RegExp(
    `\\b(${month})\\s+(\\d{1,2})(?:\\s*[–-]\\s*(?:(${month})\\s+)?(\\d{1,2}))?,\\s*(\\d{4})\\b`,
    'i',
  );
  const m = text.match(range);
  if (!m) return null;
  const year = Number(m[5]);
  const startMonth = MONTH[m[1]!.toLowerCase()]!;
  const startDay = Number(m[2]);
  const endMonth = m[3] ? MONTH[m[3].toLowerCase()]! : startMonth;
  const endDay = m[4] ? Number(m[4]) : startDay;
  return {
    start: utcDate(year, startMonth, startDay),
    end: utcDate(year, endMonth, endDay),
  };
}

function parseLocation(text: string): string | null {
  const dotted = text.match(/·\s*([^·\n|]{2,40})/);
  if (dotted) return dotted[1]!.trim();
  const inCity = text.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (inCity) return inCity[1]!.trim();
  return null;
}
