import { z } from 'zod';
import { eq, inArray, desc } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { embedText, cosine, EmbeddingError } from '@/lib/extractor/embeddings';
import { TRPCError } from '@trpc/server';
import * as schema from '@/lib/db/schema';

export const recallRouter = router({
  /**
   * Natural-language recall query. Embeds the query via OpenAI text-embedding-3-small,
   * scores it against this user's Entity embeddings (cosine), returns the top-N
   * with canonical Company / Event / Topic edges joined.
   *
   * For v0.1.1 this is in-memory cosine; small graphs (<5k entities). v0.2 swaps
   * to libSQL `vector_top_k(idx, vector, k)` once the index is created.
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

      const entities = await ctx.db.query.entities.findMany({
        where: eq(schema.entities.ownerUserId, ctx.user.id),
      });

      const scored = entities
        .filter((e) => e.embedding && e.embedding.length === queryEmbedding.length)
        .map((e) => ({
          entity: e,
          score: cosine(e.embedding as number[], queryEmbedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      const ids = scored.map((s) => s.entity.id);
      if (ids.length === 0) {
        return { entities: [], durationMs: Date.now() - t0 };
      }

      const [ec, ee, et, facts] = await Promise.all([
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

      const companyById = new Map(companies.map((c) => [c.id, c]));
      const eventById = new Map(events.map((e) => [e.id, e]));
      const topicById = new Map(topics.map((t) => [t.id, t]));

      const results = scored.map(({ entity, score }) => {
        const myCompanies = ec
          .filter((x) => x.entityId === entity.id)
          .map((x) => {
            const c = companyById.get(x.companyId);
            return c ? { id: c.id, name: c.name, domain: c.domain ?? null, role: x.role ?? null } : null;
          })
          .filter((x): x is { id: string; name: string; domain: string | null; role: string | null } => x !== null);

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
      });

      return { entities: results, durationMs: Date.now() - t0 };
    }),
});
