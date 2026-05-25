import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { extractHybrid, commit, ExtractionError, EmbeddingError } from '@wingmic/extractor';
import { TRPCError } from '@trpc/server';
import { transcribeEntities } from '@/lib/capture/transcribe-entities';

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
        const extracted = await extractHybrid({
          transcript: input.transcript,
          providerEntities,
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
});
