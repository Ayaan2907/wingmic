import { eq } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import * as schema from '@wingmic/db/schema';

// onboarding.acknowledge — flip the caller's first-run privacy flag. Called by
// the /onboarding flow on "get started" and on skip. SECURITY: the write is
// scoped `WHERE id = ctx.user.id`; a userId is NEVER accepted from input. The
// column exists from the 0003 migration; no migration here.

export const onboardingRouter = router({
  acknowledge: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(schema.users)
      .set({ acknowledgedPrivacy: true })
      .where(eq(schema.users.id, ctx.user.id));
    return { ok: true as const };
  }),
});
