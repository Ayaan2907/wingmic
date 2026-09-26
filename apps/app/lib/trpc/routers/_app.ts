import { router, publicProcedure, protectedProcedure } from '../trpc';
import { captureRouter } from './capture';
import { recallRouter } from './recall';
import { entityRouter } from './entity';
import { graphRouter } from './graph';
import { settingsRouter } from './settings';
import { onboardingRouter } from './onboarding';
import { actsRouter } from './acts';
import { importsRouter } from './imports';
import { eventsRouter } from './events';
import { apiKeysRouter } from './apiKeys';
import { bayRouter } from './bay';

/**
 * Root tRPC router. Capture + recall wedges plus the `ping` / `me`
 * health-checks. Imports router lands in v0.2.
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
  onboarding: onboardingRouter,
  acts: actsRouter,
  imports: importsRouter,
  apiKeys: apiKeysRouter,
  events: eventsRouter,
  bay: bayRouter,
});

export type AppRouter = typeof appRouter;
