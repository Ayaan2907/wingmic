import { router, publicProcedure, protectedProcedure } from '../trpc';
import { captureRouter } from './capture';
import { recallRouter } from './recall';
import { entityRouter } from './entity';
import { graphRouter } from './graph';
import { settingsRouter } from './settings';

/**
 * Root tRPC router. Capture + recall wedges plus the `ping` / `me`
 * health-checks. Imports + Acts routers will land in v0.2 / v0.3.
 */
export const appRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name ?? null,
  })),
  capture: captureRouter,
  recall: recallRouter,
  entity: entityRouter,
  graph: graphRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
