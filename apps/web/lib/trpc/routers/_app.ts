import { router, publicProcedure, protectedProcedure } from '../trpc';

/**
 * Root tRPC router. Capture, recall, and entity routers will be added
 * in PRs 8/9/10 as their procedures land. For now this exposes a
 * health-check `ping` (public) and `me` (protected) so the wiring is
 * verifiable end-to-end.
 */
export const appRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name ?? null,
  })),
});

export type AppRouter = typeof appRouter;
