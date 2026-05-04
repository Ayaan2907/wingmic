import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { extract, commit, ExtractionError, EmbeddingError } from '@/lib/extractor';
import { TRPCError } from '@trpc/server';

export const captureRouter = router({
  /**
   * Run the extraction + resolution pipeline on a transcript.
   * Returns the structured Claude output + the persisted graph result
   * (interaction id, entity ids, new-vs-matched counts).
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
        const extracted = await extract(input.transcript);
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
