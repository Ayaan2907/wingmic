import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { createApiKey, listApiKeys, revokeApiKey, API_SCOPES } from '@/lib/api/keys';

// apiKeys.list / create / revoke — dashboard key management. Same rule as
// settings: every operation is scoped to the caller's own keys; a keyId is
// only ever honored when it belongs to ctx.user.id. The raw key appears in
// the `create` response exactly once and is never persisted or logged.

const createInput = z.object({
  name: z.string().min(1, 'name your key').max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1, 'pick at least one scope'),
});

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listApiKeys(ctx.db, ctx.user.id);
  }),

  create: protectedProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const { rawKey, apiKey } = await createApiKey({
      db: ctx.db,
      userId: ctx.user.id,
      name: input.name,
      scopes: input.scopes,
    });
    // rawKey rides the response once — the dashboard shows it exactly once.
    return { rawKey, apiKey };
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const ok = await revokeApiKey(ctx.db, ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'key not found (or already revoked)' });
      }
      return { ok: true as const };
    }),
});
