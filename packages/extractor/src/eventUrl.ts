import type { ExtractionResult } from './schema';

export type EventExternalSource = 'luma' | 'partiful' | 'web';

export type HarvestedEvent = {
  source: EventExternalSource;
  id: string;
  url: string;
  name: string;
};

const EVENT_URL_DEBRIS = new Set([
  'http',
  'https',
  'www',
  'com',
  'luma',
  'lu.ma',
  'luma.com',
  'partiful',
  'partiful.com',
  'calendar',
  'google',
  'google.com',
  'calendar.google.com',
  'event',
  'eid',
  'tickets',
]);

function canonicalHttpUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\])},.;!?]+$/, '');
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function displayName(source: EventExternalSource, id: string): string {
  if (source === 'web' && id.startsWith('gcal:')) return 'google calendar event';
  return id.replace(/[-_]+/g, ' ').trim() || id;
}

export function parseEventExternal(
  raw: string,
): { source: EventExternalSource; id: string } | null {
  const trimmed = raw.trim();
  const canonical = canonicalHttpUrl(trimmed);
  try {
    const url = new URL(canonical ?? trimmed);
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
    if (
      host === 'calendar.google.com' ||
      host === 'google.com' ||
      host.endsWith('.google.com')
    ) {
      const eid = url.searchParams.get('eid');
      if (eid && /calendar/.test(url.pathname)) {
        return { source: 'web', id: `gcal:${eid}` };
      }
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

  const gcal = trimmed.match(
    /https?:\/\/(?:www\.)?(?:calendar\.)?google\.com\/calendar\/[^\s]*[?&]eid=([^&\s]+)/i,
  );
  if (gcal?.[1]) return { source: 'web', id: `gcal:${gcal[1]}` };

  return null;
}

function urlForParsed(
  raw: string,
  parsed: { source: EventExternalSource; id: string },
): string {
  const canon = canonicalHttpUrl(raw);
  if (canon) return canon;
  if (parsed.source === 'luma') return `https://lu.ma/${parsed.id}`;
  if (parsed.source === 'partiful') return `https://partiful.com/e/${parsed.id}`;
  return raw.trim();
}

/** First Luma / Partiful / Google Calendar event URL spoken or pasted. */
export function harvestEventFromTranscript(transcript: string): HarvestedEvent | null {
  const matches =
    transcript.match(
      /(?:https?:\/\/)?(?:www\.)?(?:lu\.ma|luma\.com|partiful\.com|calendar\.google\.com)\/[^\s<>"']+/gi,
    ) ?? [];
  for (const raw of matches) {
    const parsed = parseEventExternal(raw);
    if (!parsed) continue;
    const url = urlForParsed(raw, parsed);
    return {
      source: parsed.source,
      id: parsed.id,
      url,
      name: displayName(parsed.source, parsed.id),
    };
  }
  const parsed = parseEventExternal(transcript);
  if (!parsed) return null;
  return {
    source: parsed.source,
    id: parsed.id,
    url: urlForParsed(transcript, parsed),
    name: displayName(parsed.source, parsed.id),
  };
}

export function isEventUrlDebrisTopic(
  topic: string,
  harvested: HarvestedEvent | null,
): boolean {
  const tokens = topic
    .trim()
    .toLowerCase()
    .split(/[\s/]+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((t) => EVENT_URL_DEBRIS.has(t))) return true;
  if (!harvested) return false;
  const slug = harvested.id.toLowerCase();
  const name = harvested.name.toLowerCase();
  if (tokens.length === 1 && (tokens[0] === slug || tokens[0] === name)) return true;
  const blob = topic.toLowerCase();
  if (blob.includes('lu.ma') || blob.includes('partiful.com')) return true;
  if (blob.includes('calendar.google.com')) return true;
  if (harvested.url && blob.includes(harvested.url.toLowerCase())) return true;
  return false;
}

export function applyHarvestedEvent(
  extracted: ExtractionResult,
  transcript: string,
): ExtractionResult {
  const harvested = harvestEventFromTranscript(transcript);
  if (!harvested) return extracted;
  const topics = extracted.topics.filter((t) => !isEventUrlDebrisTopic(t, harvested));
  const persons = extracted.persons.map((person) => ({
    ...person,
    topics: person.topics.filter((topic) => !isEventUrlDebrisTopic(topic, harvested)),
  }));
  if (extracted.events.length === 0) {
    return {
      ...extracted,
      persons,
      topics,
      events: [
        {
          name: harvested.name,
          dateHint: null,
          location: null,
          url: harvested.url,
        },
      ],
    };
  }
  const events = extracted.events.map((event, i) => ({
    ...event,
    url: event.url || (i === 0 ? harvested.url : event.url),
  }));
  return { ...extracted, persons, topics, events };
}
