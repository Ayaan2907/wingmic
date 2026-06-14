import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import * as schema from '@wingmic/db/schema';

// settings.get / settings.update — read + partial-write the caller's own
// preference columns on `users`. Columns exist from the α-0 migration; no
// migration here. SECURITY: every write is scoped `WHERE id = ctx.user.id`;
// a userId is NEVER accepted from input. The audio-retention enum is
// validated server-side by Zod.

const updateInput = z.object({
  audioRetentionMode: z.enum(['24h', '7d', 'forever', 'never']).optional(),
  linkerModelOverride: z.string().max(120).nullable().optional(),
  preferredMicDeviceId: z.string().max(200).nullable().optional(),
  asrLanguage: z.string().min(2).max(20).optional(),
});

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.user.id),
    });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'user not found' });
    return {
      audioRetentionMode: row.audioRetentionMode,
      linkerModelOverride: row.linkerModelOverride,
      preferredMicDeviceId: row.preferredMicDeviceId,
      asrLanguage: row.asrLanguage,
      acknowledgedPrivacy: row.acknowledgedPrivacy,
    };
  }),

  update: protectedProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    // Build a patch from only the keys the caller actually provided. `null`
    // is a real value (clear the field); `undefined` means "not provided".
    const patch: Partial<typeof schema.users.$inferInsert> = {};
    if (input.audioRetentionMode !== undefined) patch.audioRetentionMode = input.audioRetentionMode;
    if (input.linkerModelOverride !== undefined) patch.linkerModelOverride = input.linkerModelOverride;
    if (input.preferredMicDeviceId !== undefined) patch.preferredMicDeviceId = input.preferredMicDeviceId;
    if (input.asrLanguage !== undefined) patch.asrLanguage = input.asrLanguage;

    // Empty patch → no-op (drizzle `.set({})` would emit invalid SQL).
    if (Object.keys(patch).length > 0) {
      await ctx.db.update(schema.users).set(patch).where(eq(schema.users.id, ctx.user.id));
    }
    return { ok: true as const };
  }),
});
