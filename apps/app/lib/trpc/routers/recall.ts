import { z } from 'zod';
import { and, eq, inArray, isNull, or, desc, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { embedText } from '@wingmic/extractor/embeddings';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackAnalyticsEvent } from '@/lib/analytics/server';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { ENTITY_EMBEDDING_INDEX, EVENT_EMBEDDING_INDEX } from '@wingmic/db/schema';

type RecallMode = 'semantic' | 'text';

export type RecallPersonResult = {
  kind: 'person';
  id: string;
  name: string;
  aliases: string[];
  score: number;
  companies: Array<{ id: string; name: string; domain: string | null; role: string | null }>;
  events: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  facts: Array<{ key: string; value: string; confidence: number }>;
};

export type RecallEventResult = {
  kind: 'event';
  id: string;
  name: string;
  location: string | null;
  score: number;
  people: Array<{ id: string; name: string; aliases: string[] }>;
};

export type RecallResult = RecallPersonResult | RecallEventResult;

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
}

type ScoredHit = { kind: 'person' | 'event'; id: string; score: number };

async function userAttendedEventIds(db: DB, userId: string): Promise<Set<string>> {
  const rows = await db.all<{ event_id: string }>(sql`
    SELECT DISTINCT ee.event_id AS event_id
    FROM entity_event ee
    INNER JOIN entity e ON e.id = ee.entity_id
    WHERE e.owner_user_id = ${userId}
      AND e.deleted_at IS NULL
      AND ee.source_deleted = 0
  `);
  return new Set(rows.map((r) => r.event_id));
}

function mergeRankedHits(personHits: ScoredHit[], eventHits: ScoredHit[], limit: number): ScoredHit[] {
  const merged = [...personHits, ...eventHits].sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: ScoredHit[] = [];
  for (const hit of merged) {
    const key = `${hit.kind}:${hit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export const recallRouter = router({
  /**
   * Natural-language recall query. Prefers semantic ANN (embed + vector_top_k),
   * but degrades to a userId-scoped LIKE match over name/aliases when the
   * embedding path or index is unavailable (missing OPENROUTER_API_KEY,
   * migration 0002 not applied, etc.) — issue #60.
   *
   * Returns a ranked union of people and events (#103). `entities` remains
   * person-only for older clients; prefer `results` for kind-aware routing.
   */
  query: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1, 'query cannot be empty').max(500),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const t0 = Date.now();
      const trackSearchRun = (results: number): void => {
        trackAnalyticsEvent(ctx.user.id, ANALYTICS_EVENTS.searchRun, {
          mode,
          results,
          durationMs: Date.now() - t0,
        });
      };
      let mode: RecallMode = 'semantic';
      let hits: ScoredHit[] = [];

      try {
        const queryEmbedding = await embedText(input.q);
        const vectorLiteral = `[${queryEmbedding.join(',')}]`;
        const k = input.limit * 4;

        const [personTopRows, attendedEventIds] = await Promise.all([
          ctx.db.all<{ id: string }>(sql`
            SELECT e.id as id
            FROM vector_top_k(${ENTITY_EMBEDDING_INDEX}, vector32(${vectorLiteral}), ${k}) vt
            JOIN entity e ON e.rowid = vt.id
            WHERE e.owner_user_id = ${ctx.user.id}
              AND e.deleted_at IS NULL
          `),
          userAttendedEventIds(ctx.db, ctx.user.id),
        ]);

        let eventTopRows: { id: string }[] = [];
        try {
          eventTopRows = await ctx.db.all<{ id: string }>(sql`
            SELECT ev.id as id
            FROM vector_top_k(${EVENT_EMBEDDING_INDEX}, vector32(${vectorLiteral}), ${k}) vt
            JOIN event ev ON ev.rowid = vt.id
          `);
        } catch {
          // Migration 0018 not applied yet — person semantic recall still works.
        }

        const personIds = personTopRows.map((r) => r.id);
        const eventIds = eventTopRows.map((r) => r.id).filter((id) => attendedEventIds.has(id));

        const scoreByKey = new Map<string, number>();

        if (personIds.length > 0) {
          const idPlaceholders = sql.join(
            personIds.map((id) => sql`${id}`),
            sql`, `,
          );
          const distances = await ctx.db.all<{ id: string; sim: number }>(sql`
            SELECT id, (1.0 - vector_distance_cos(embedding, vector32(${vectorLiteral}))) AS sim
            FROM entity
            WHERE id IN (${idPlaceholders})
          `);
          for (const d of distances) scoreByKey.set(`person:${d.id}`, d.sim);
        }

        if (eventIds.length > 0) {
          const idPlaceholders = sql.join(
            eventIds.map((id) => sql`${id}`),
            sql`, `,
          );
          const distances = await ctx.db.all<{ id: string; sim: number }>(sql`
            SELECT id, (1.0 - vector_distance_cos(embedding, vector32(${vectorLiteral}))) AS sim
            FROM event
            WHERE id IN (${idPlaceholders})
          `);
          for (const d of distances) scoreByKey.set(`event:${d.id}`, d.sim);
        }

        const personHits: ScoredHit[] = personIds.map((id) => ({
          kind: 'person',
          id,
          score: scoreByKey.get(`person:${id}`) ?? 0,
        }));
        const eventHits: ScoredHit[] = eventIds.map((id) => ({
          kind: 'event',
          id,
          score: scoreByKey.get(`event:${id}`) ?? 0,
        }));

        hits = mergeRankedHits(personHits, eventHits, input.limit);
      } catch {
        mode = 'text';
        const terms = tokenizeQuery(input.q);
        if (terms.length === 0) {
          trackSearchRun(0);
          return { entities: [], results: [], durationMs: Date.now() - t0, mode };
        }

        const likeClauses = terms.flatMap((t) => {
          const pat = `%${t}%`;
          return [
            sql`lower(${schema.entities.name}) like ${pat}`,
            sql`lower(${schema.entities.aliases}) like ${pat}`,
          ];
        });

        const attendedEventIds = await userAttendedEventIds(ctx.db, ctx.user.id);
        const eventLikeClauses = terms.flatMap((t) => {
          const pat = `%${t}%`;
          return [sql`lower(${schema.events.name}) like ${pat}`, sql`lower(coalesce(${schema.events.location}, '')) like ${pat}`];
        });

        const [personRows, eventRows] = await Promise.all([
          ctx.db.query.entities.findMany({
            where: and(
              eq(schema.entities.ownerUserId, ctx.user.id),
              isNull(schema.entities.deletedAt),
              or(...likeClauses),
            ),
            columns: { id: true },
            limit: input.limit,
          }),
          attendedEventIds.size > 0
            ? ctx.db.query.events.findMany({
                where: and(inArray(schema.events.id, [...attendedEventIds]), or(...eventLikeClauses)),
                columns: { id: true },
                limit: input.limit,
              })
            : Promise.resolve([]),
        ]);

        hits = mergeRankedHits(
          personRows.map((r) => ({ kind: 'person' as const, id: r.id, score: 0 })),
          eventRows.map((r) => ({ kind: 'event' as const, id: r.id, score: 0 })),
          input.limit,
        );
      }

      if (hits.length === 0) {
        trackSearchRun(0);
        return { entities: [], results: [], durationMs: Date.now() - t0, mode };
      }

      const personHitIds = hits.filter((h) => h.kind === 'person').map((h) => h.id);
      const eventHitIds = hits.filter((h) => h.kind === 'event').map((h) => h.id);
      const scoreFor = (hit: ScoredHit) => Math.round(hit.score * 1000) / 1000;

      const [entities, events, entityEventsForEvents] = await Promise.all([
        personHitIds.length
          ? ctx.db.query.entities.findMany({
              where: inArray(schema.entities.id, personHitIds),
            })
          : Promise.resolve([]),
        eventHitIds.length
          ? ctx.db.query.events.findMany({
              where: inArray(schema.events.id, eventHitIds),
            })
          : Promise.resolve([]),
        eventHitIds.length
          ? ctx.db
              .select({
                eventId: schema.entityEvents.eventId,
                entityId: schema.entityEvents.entityId,
              })
              .from(schema.entityEvents)
              .innerJoin(schema.entities, eq(schema.entities.id, schema.entityEvents.entityId))
              .where(
                and(
                  inArray(schema.entityEvents.eventId, eventHitIds),
                  eq(schema.entities.ownerUserId, ctx.user.id),
                  isNull(schema.entities.deletedAt),
                  eq(schema.entityEvents.sourceDeleted, false),
                ),
              )
          : Promise.resolve([]),
      ]);

      let ec: typeof schema.entityCompanies.$inferSelect[] = [];
      let ee: typeof schema.entityEvents.$inferSelect[] = [];
      let et: typeof schema.entityTopics.$inferSelect[] = [];
      let facts: typeof schema.entityFacts.$inferSelect[] = [];

      if (personHitIds.length > 0) {
        [ec, ee, et, facts] = await Promise.all([
          ctx.db.query.entityCompanies.findMany({
            where: inArray(schema.entityCompanies.entityId, personHitIds),
          }),
          ctx.db.query.entityEvents.findMany({
            where: inArray(schema.entityEvents.entityId, personHitIds),
          }),
          ctx.db.query.entityTopics.findMany({
            where: inArray(schema.entityTopics.entityId, personHitIds),
          }),
          ctx.db.query.entityFacts.findMany({
            where: inArray(schema.entityFacts.entityId, personHitIds),
            orderBy: desc(schema.entityFacts.confidence),
          }),
        ]);
      }

      const companyIds = [...new Set(ec.map((x) => x.companyId))];
      const relatedEventIds = [...new Set(ee.map((x) => x.eventId))];
      const topicIds = [...new Set(et.map((x) => x.topicId))];
      const peopleEntityIds = [...new Set(entityEventsForEvents.map((x) => x.entityId))];

      const [companies, relatedEvents, topics, peopleEntities] = await Promise.all([
        companyIds.length
          ? ctx.db.query.companies.findMany({
              where: inArray(schema.companies.id, companyIds),
            })
          : Promise.resolve([]),
        relatedEventIds.length
          ? ctx.db.query.events.findMany({
              where: inArray(schema.events.id, relatedEventIds),
            })
          : Promise.resolve([]),
        topicIds.length
          ? ctx.db.query.topics.findMany({
              where: inArray(schema.topics.id, topicIds),
            })
          : Promise.resolve([]),
        peopleEntityIds.length
          ? ctx.db.query.entities.findMany({
              where: and(
                inArray(schema.entities.id, peopleEntityIds),
                eq(schema.entities.ownerUserId, ctx.user.id),
                isNull(schema.entities.deletedAt),
              ),
            })
          : Promise.resolve([]),
      ]);

      const entityById = new Map(entities.map((e) => [e.id, e]));
      const companyById = new Map(companies.map((c) => [c.id, c]));
      const eventById = new Map([...events, ...relatedEvents].map((e) => [e.id, e]));
      const topicById = new Map(topics.map((t) => [t.id, t]));
      const peopleById = new Map(peopleEntities.map((e) => [e.id, e]));

      const peopleByEventId = new Map<string, Array<{ id: string; name: string; aliases: string[] }>>();
      for (const row of entityEventsForEvents) {
        const person = peopleById.get(row.entityId);
        if (!person) continue;
        const list = peopleByEventId.get(row.eventId) ?? [];
        list.push({
          id: person.id,
          name: person.name,
          aliases: person.aliases ?? [],
        });
        peopleByEventId.set(row.eventId, list);
      }

      const results: RecallResult[] = hits
        .map((hit) => {
          if (hit.kind === 'event') {
            const event = eventById.get(hit.id);
            if (!event) return null;
            return {
              kind: 'event' as const,
              id: event.id,
              name: event.name,
              location: event.location ?? null,
              score: scoreFor(hit),
              people: peopleByEventId.get(event.id) ?? [],
            };
          }

          const entity = entityById.get(hit.id);
          if (!entity) return null;
          const myCompanies = ec
            .filter((x) => x.entityId === entity.id)
            .map((x) => {
              const c = companyById.get(x.companyId);
              return c
                ? { id: c.id, name: c.name, domain: c.domain ?? null, role: x.role ?? null }
                : null;
            })
            .filter(
              (x): x is { id: string; name: string; domain: string | null; role: string | null } =>
                x !== null,
            );

          const myEvents = ee
            .filter((x) => x.entityId === entity.id)
            .map((x) => {
              const e = eventById.get(x.eventId);
              return e ? { id: e.id, name: e.name } : null;
            })
            .filter((x): x is { id: string; name: string } => x !== null);

          const myTopics = et
            .filter((x) => x.entityId === entity.id)
            .map((x) => {
              const t = topicById.get(x.topicId);
              return t ? { id: t.id, name: t.name } : null;
            })
            .filter((x): x is { id: string; name: string } => x !== null);

          const myFacts = facts
            .filter((x) => x.entityId === entity.id)
            .slice(0, 5)
            .map((f) => ({ key: f.key, value: f.value, confidence: f.confidence }));

          return {
            kind: 'person' as const,
            id: entity.id,
            name: entity.name,
            aliases: entity.aliases ?? [],
            score: scoreFor(hit),
            companies: myCompanies,
            events: myEvents,
            topics: myTopics,
            facts: myFacts,
          };
        })
        .filter((x): x is RecallResult => x !== null);

      const personResults = results.filter((r): r is RecallPersonResult => r.kind === 'person');
      const entitiesOut = personResults.map(({ kind: _k, ...rest }) => rest);

      trackSearchRun(results.length);
      return { entities: entitiesOut, results, durationMs: Date.now() - t0, mode };
    }),
});
