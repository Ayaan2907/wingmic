import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { buildWebSearchQuery, isBlockedExtractUrl, type WebSearchProvider } from '@/lib/web-search';
import { parseEventFields } from './parseEventFields';
import { fetchCalendarIcs, matchIcsEvent, parseIcsEvents } from './parseIcs';

export async function enrichEventsAfterCommit(opts: {
  db: DB;
  eventIds: string[];
  capturedAt: Date;
  provider: WebSearchProvider | null;
  calendarIcsUrl?: string | null;
}): Promise<void> {
  const { db, eventIds, capturedAt, provider, calendarIcsUrl } = opts;
  if (eventIds.length === 0) return;
  if (!provider && !calendarIcsUrl) return;

  const icsEvents = calendarIcsUrl
    ? await (async () => {
        const text = await fetchCalendarIcs(calendarIcsUrl);
        return text ? parseIcsEvents(text) : [];
      })()
    : [];

  const events = await db.query.events.findMany({
    where: inArray(schema.events.id, eventIds),
  });

  for (const event of events) {
    const datesSet = event.dateRangeStart != null && event.dateRangeEnd != null;
    if (event.url && datesSet) continue;

    const patch: Partial<typeof schema.events.$inferInsert> = {};
    const icsHit = icsEvents.length > 0 ? matchIcsEvent(event.name, icsEvents) : null;
    if (icsHit) {
      if (!event.url && icsHit.url) patch.url = icsHit.url;
      if (!event.location && icsHit.location) patch.location = icsHit.location;
      if (event.dateRangeStart == null && icsHit.dateRangeStart) {
        patch.dateRangeStart = icsHit.dateRangeStart;
      }
      if (event.dateRangeEnd == null && icsHit.dateRangeEnd) {
        patch.dateRangeEnd = icsHit.dateRangeEnd;
      }
    }

    if (provider) {
      let parsed = {
        url: null as string | null,
        location: null as string | null,
        dateRangeStart: null as Date | null,
        dateRangeEnd: null as Date | null,
        external: null as ReturnType<typeof parseEventFields>['external'],
      };

      if (event.url && !isBlockedExtractUrl(event.url) && !datesSet) {
        try {
          const extracted = await provider.extract({ urls: [event.url], query: event.name });
          parsed = parseEventFields([
            { title: event.name, url: event.url, snippet: extracted[0]?.content ?? '' },
          ]);
          parsed.url = event.url;
        } catch {
          parsed.url = event.url;
        }
      } else {
        const year = /\b(20\d{2})\b/.exec(event.name)?.[1] ?? String(capturedAt.getUTCFullYear());
        const query = buildWebSearchQuery({
          intent: 'event',
          event: event.name,
          year,
        });
        if (query.q.trim()) {
          const hits = await provider.search(query);
          parsed = parseEventFields(hits);
          if (parsed.url && !isBlockedExtractUrl(parsed.url)) {
            try {
              const extracted = await provider.extract({ urls: [parsed.url], query: event.name });
              if (extracted[0]?.content) {
                const fromExtract = parseEventFields([
                  { title: event.name, url: parsed.url, snippet: extracted[0].content },
                ]);
                parsed = {
                  url: parsed.url,
                  location: parsed.location ?? fromExtract.location,
                  dateRangeStart: parsed.dateRangeStart ?? fromExtract.dateRangeStart,
                  dateRangeEnd: parsed.dateRangeEnd ?? fromExtract.dateRangeEnd,
                  external: parsed.external ?? fromExtract.external,
                };
              }
            } catch {
              // search snippets are enough
            }
          }
        }
      }

      if (!event.url && parsed.url) patch.url = parsed.url;
      if (!event.location && !patch.location && parsed.location) patch.location = parsed.location;
      if (event.dateRangeStart == null && !patch.dateRangeStart && parsed.dateRangeStart) {
        patch.dateRangeStart = parsed.dateRangeStart;
      }
      if (event.dateRangeEnd == null && !patch.dateRangeEnd && parsed.dateRangeEnd) {
        patch.dateRangeEnd = parsed.dateRangeEnd;
      }
      if (!event.externalSource && !event.externalId && parsed.external) {
        patch.externalSource = parsed.external.source;
        patch.externalId = parsed.external.id;
      }
    }

    if (Object.keys(patch).length === 0) continue;
    await db.update(schema.events).set(patch).where(eq(schema.events.id, event.id));
  }
}
