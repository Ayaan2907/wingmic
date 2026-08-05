import { z } from 'zod';
import { and, eq, inArray, isNull, or, desc, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { embedText } from '@wingmic/extractor/embeddings';
import * as schema from '@wingmic/db/schema';
import { ENTITY_EMBEDDING_INDEX } from '@wingmic/db/schema';

type RecallMode = 'semantic' | 'text';

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
}

export const recallRouter = router({
  /**
   * Natural-language recall query. Prefers semantic ANN (embed + vector_top_k),
   * but degrades to a userId-scoped LIKE match over name/aliases when the
   * embedding path or index is unavailable (missing OPENROUTER_API_KEY,
   * migration 0002 not applied, etc.) — issue #60.
   *
   * Response always includes `mode: 'semantic' | 'text'` so the UI can label
   * the degraded path without treating it as a hard failure.
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
      let mode: RecallMode = 'semantic';
      let ids: string[] = [];
      let scoreById = new Map<string, number>();

      try {
        const queryEmbedding = await embedText(input.q);
        const vectorLiteral = `[${queryEmbedding.join(',')}]`;
        const k = input.limit * 4;
        const topRows = await ctx.db.all<{ id: string }>(sql`
          SELECT e.id as id
          FROM vector_top_k(${ENTITY_EMBEDDING_INDEX}, vector32(${vectorLiteral}), ${k}) vt
          JOIN entity e ON e.rowid = vt.id
          WHERE e.owner_user_id = ${ctx.user.id}
        `);

        ids = topRows.slice(0, input.limit).map((r) => r.id);

        if (ids.length > 0) {
          const idPlaceholders = sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          );
          const distances = await ctx.db.all<{ id: string; sim: number }>(sql`
            SELECT id, (1.0 - vector_distance_cos(embedding, vector32(${vectorLiteral}))) AS sim
            FROM entity
            WHERE id IN (${idPlaceholders})
          `);
          scoreById = new Map(distances.map((d) => [d.id, d.sim]));
        }
      } catch {
        mode = 'text';
        const terms = tokenizeQuery(input.q);
        if (terms.length === 0) {
          return { entities: [], durationMs: Date.now() - t0, mode };
        }

        const likeClauses = terms.flatMap((t) => {
          const pat = `%${t}%`;
          return [
            sql`lower(${schema.entities.name}) like ${pat}`,
            sql`lower(${schema.entities.aliases}) like ${pat}`,
          ];
        });

        const rows = await ctx.db.query.entities.findMany({
          where: and(
            eq(schema.entities.ownerUserId, ctx.user.id),
            isNull(schema.entities.deletedAt),
            or(...likeClauses),
          ),
          columns: { id: true },
          limit: input.limit,
        });
        ids = rows.map((r) => r.id);
        // text mode: no meaningful score — keep 0 so UI thresholds stay honest
        scoreById = new Map(ids.map((id) => [id, 0]));
      }

      if (ids.length === 0) {
        return { entities: [], durationMs: Date.now() - t0, mode };
      }

      const [entities, ec, ee, et, facts] = await Promise.all([
        ctx.db.query.entities.findMany({
          where: inArray(schema.entities.id, ids),
        }),
        ctx.db.query.entityCompanies.findMany({
          where: inArray(schema.entityCompanies.entityId, ids),
        }),
        ctx.db.query.entityEvents.findMany({
          where: inArray(schema.entityEvents.entityId, ids),
        }),
        ctx.db.query.entityTopics.findMany({
          where: inArray(schema.entityTopics.entityId, ids),
        }),
        ctx.db.query.entityFacts.findMany({
          where: inArray(schema.entityFacts.entityId, ids),
          orderBy: desc(schema.entityFacts.confidence),
        }),
      ]);

      const companyIds = [...new Set(ec.map((x) => x.companyId))];
      const eventIds = [...new Set(ee.map((x) => x.eventId))];
      const topicIds = [...new Set(et.map((x) => x.topicId))];

      const [companies, events, topics] = await Promise.all([
        companyIds.length
          ? ctx.db.query.companies.findMany({
              where: inArray(schema.companies.id, companyIds),
            })
          : Promise.resolve([]),
        eventIds.length
          ? ctx.db.query.events.findMany({
              where: inArray(schema.events.id, eventIds),
            })
          : Promise.resolve([]),
        topicIds.length
          ? ctx.db.query.topics.findMany({
              where: inArray(schema.topics.id, topicIds),
            })
          : Promise.resolve([]),
      ]);

      const entityById = new Map(entities.map((e) => [e.id, e]));
      const companyById = new Map(companies.map((c) => [c.id, c]));
      const eventById = new Map(events.map((e) => [e.id, e]));
      const topicById = new Map(topics.map((t) => [t.id, t]));

      const orderedIds =
        mode === 'semantic'
          ? [...ids].sort((a, b) => (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0))
          : ids;

      const results = orderedIds
        .map((id) => {
          const entity = entityById.get(id);
          if (!entity) return null;
          const score = scoreById.get(id) ?? 0;

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
            id: entity.id,
            name: entity.name,
            aliases: entity.aliases ?? [],
            score: Math.round(score * 1000) / 1000,
            companies: myCompanies,
            events: myEvents,
            topics: myTopics,
            facts: myFacts,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return { entities: results, durationMs: Date.now() - t0, mode };
    }),
});
