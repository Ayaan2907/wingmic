import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { buildWebSearchQuery, isBlockedExtractUrl, type WebSearchProvider } from '@/lib/web-search';
import { parseEventFields } from './parseEventFields';

export async function enrichEventsAfterCommit(opts: {
  db: DB;
  eventIds: string[];
  capturedAt: Date;
  provider: WebSearchProvider | null;
}): Promise<void> {
  const { db, eventIds, capturedAt, provider } = opts;
  if (!provider || eventIds.length === 0) return;

  const events = await db.query.events.findMany({
    where: inArray(schema.events.id, eventIds),
  });

  for (const event of events) {
    const datesSet = event.dateRangeStart != null && event.dateRangeEnd != null;
    if (event.url && datesSet) continue;

    const year = /\b(20\d{2})\b/.exec(event.name)?.[1] ?? String(capturedAt.getUTCFullYear());
    const query = buildWebSearchQuery({
      intent: 'event',
      event: event.name,
      year,
    });
    if (!query.q.trim()) continue;

    const hits = await provider.search(query);
    let parsed = parseEventFields(hits);

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

    const patch: Partial<typeof schema.events.$inferInsert> = {};
    if (!event.url && parsed.url) patch.url = parsed.url;
    if (!event.location && parsed.location) patch.location = parsed.location;
    if (event.dateRangeStart == null && parsed.dateRangeStart) {
      patch.dateRangeStart = parsed.dateRangeStart;
    }
    if (event.dateRangeEnd == null && parsed.dateRangeEnd) {
      patch.dateRangeEnd = parsed.dateRangeEnd;
    }
    if (!event.externalSource && !event.externalId && parsed.external) {
      patch.externalSource = parsed.external.source;
      patch.externalId = parsed.external.id;
    }

    if (Object.keys(patch).length === 0) continue;
    await db.update(schema.events).set(patch).where(eq(schema.events.id, event.id));
  }
}
