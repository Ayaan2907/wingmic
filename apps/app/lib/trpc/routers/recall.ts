import { z } from 'zod';
import { eq, inArray, desc, sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { embedText, EmbeddingError } from '@wingmic/extractor/embeddings';
import { TRPCError } from '@trpc/server';
import * as schema from '@wingmic/db/schema';

export const recallRouter = router({
  /**
   * Natural-language recall query. Embeds the query via OpenAI text-embedding-3-small,
   * then runs libSQL's `vector_top_k` ANN index over this user's Entity embeddings
   * and returns the top-N with canonical Company / Event / Topic edges joined.
   *
   * One code path — no in-memory cosine fallback (plan eng-review #7). Index is
   * created by migration 0002_vector_top_k_entity_embedding (idx name
   * `entity_embedding_vector_idx`). If the index returns fewer than `limit` rows
   * (e.g. user has 3 entities, limit=10), the query degrades gracefully and
   * returns what's there.
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
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embedText(input.q);
      } catch (err) {
        if (err instanceof EmbeddingError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `embedding failed: ${err.message}`,
            cause: err,
          });
        }
        throw err;
      }

      // libSQL ANN: vector_top_k('idx', vec, k) returns rows with a single `id`
      // column (the indexed table's rowid). We join back to entity to recover the
      // string PK + filter by owner. We over-fetch (limit * 4) so the per-user
      // filter has headroom before slicing.
      // TODO(#12): replace with packages/logger once available.
      console.time('recall');
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;
      const k = input.limit * 4;
      const topRows = await ctx.db.all<{ id: string }>(sql`
        SELECT e.id as id
        FROM vector_top_k('entity_embedding_vector_idx', vector32(${vectorLiteral}), ${k}) vt
        JOIN entity e ON e.rowid = vt.id
        WHERE e.owner_user_id = ${ctx.user.id}
      `);
      console.timeEnd('recall');

      const ranked = topRows.slice(0, input.limit);
      const ids = ranked.map((r) => r.id);
      // vector_top_k orders by ascending distance; preserve that order as our score
      // proxy (1.0 for best match, descending linearly). Real similarity scores
      // require a second SELECT — deferred to v0.1.2 cluster browser work.
      const scoreById = new Map(
        ranked.map((r, i) => [r.id, ranked.length > 1 ? 1 - i / ranked.length : 1]),
      );
      if (ids.length === 0) {
        return { entities: [], durationMs: Date.now() - t0 };
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

      const results = ids
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

      return { entities: results, durationMs: Date.now() - t0 };
    }),
});
