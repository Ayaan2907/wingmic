import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { extractHybrid, commit, ExtractionError, EmbeddingError } from '@wingmic/extractor';
import { TRPCError } from '@trpc/server';
import { transcribeEntities } from '@/lib/capture/transcribe-entities';
import * as schema from '@wingmic/db/schema';

export const captureRouter = router({
  /**
   * Run the hybrid extraction + resolution pipeline on a transcript.
   *
   * v0.1.1 "Hosted Capture" (Task H4) — replaces the LLM-only `extract()`
   * with `extractHybrid({ transcript, providerEntities })`:
   *   1. transcribeEntities() re-runs AssemblyAI entity_detection on the
   *      (possibly user-edited) transcript per locked decision #11.
   *   2. extractHybrid() merges span-level entities + heuristics + Haiku
   *      relation linker into the existing ExtractionResult shape.
   *   3. commit() persists into the graph (resolution.ts unchanged).
   */
  commit: protectedProcedure
    .input(
      z.object({
        transcript: z
          .string()
          .min(1, 'transcript cannot be empty')
          .max(10000, 'transcripts longer than 10k chars need to be split'),
        capturedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const providerEntities = await transcribeEntities(input.transcript);

        const recentEntities = await ctx.db.query.entities.findMany({
          where: and(
            eq(schema.entities.ownerUserId, ctx.user.id),
            isNull(schema.entities.deletedAt),
          ),
          columns: { id: true, name: true },
          orderBy: desc(schema.entities.updatedAt),
          limit: 30,
        });

        const entityIds = recentEntities.map((e) => e.id);
        let companyNames: string[] = [];
        if (entityIds.length > 0) {
          const links = await ctx.db.query.entityCompanies.findMany({
            where: inArray(schema.entityCompanies.entityId, entityIds),
            columns: { companyId: true },
            limit: 60,
          });
          const companyIds = [...new Set(links.map((l) => l.companyId))].slice(0, 20);
          if (companyIds.length > 0) {
            const companies = await ctx.db.query.companies.findMany({
              where: inArray(schema.companies.id, companyIds),
              columns: { name: true },
            });
            companyNames = companies.map((c) => c.name);
          }
        }

        const extracted = await extractHybrid({
          transcript: input.transcript,
          providerEntities,
          knownContacts: {
            persons: recentEntities.map((e) => e.name),
            companies: companyNames,
          },
        });
        const result = await commit(extracted, {
          db: ctx.db,
          userId: ctx.user.id,
          transcript: input.transcript,
          capturedAt: input.capturedAt ?? new Date(),
        });
        return { extracted, ...result };
      } catch (err) {
        if (err instanceof ExtractionError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `extraction failed: ${err.message}`,
            cause: err,
          });
        }
        if (err instanceof EmbeddingError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `embedding failed: ${err.message}`,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Soft-delete a committed interaction (sets `deletedAt`). Scoped to the
   * calling user. Idempotent when already deleted.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.interactions.findFirst({
        where: and(
          eq(schema.interactions.id, input.id),
          eq(schema.interactions.userId, ctx.user.id),
        ),
        columns: { id: true, deletedAt: true },
      });
      if (!row) return { ok: false as const };
      if (row.deletedAt) return { ok: true as const };
      await ctx.db
        .update(schema.interactions)
        .set({ deletedAt: new Date() })
        .where(eq(schema.interactions.id, input.id));
      return { ok: true as const };
    }),

  /**
   * Undo a soft-delete within the client undo window (clears `deletedAt`).
   */
  restore: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.interactions.findFirst({
        where: and(
          eq(schema.interactions.id, input.id),
          eq(schema.interactions.userId, ctx.user.id),
        ),
        columns: { id: true, deletedAt: true },
      });
      if (!row) return { ok: false as const };
      if (!row.deletedAt) return { ok: true as const };
      await ctx.db
        .update(schema.interactions)
        .set({ deletedAt: null })
        .where(eq(schema.interactions.id, input.id));
      return { ok: true as const };
    }),
});
