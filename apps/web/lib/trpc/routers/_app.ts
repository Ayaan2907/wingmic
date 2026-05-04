import { router, publicProcedure, protectedProcedure } from '../trpc';
import { captureRouter } from './capture';

/**
 * Root tRPC router. Capture is wired here; recall lands alongside in
 * the next PR. `ping` and `me` remain as health-checks.
 */
export const appRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name ?? null,
  })),
  capture: captureRouter,
});

export type AppRouter = typeof appRouter;
