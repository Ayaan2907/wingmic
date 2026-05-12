import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';

/**
 * tRPC context. Created per request. Includes the resolved auth session
 * (or null) and the Drizzle DB client. Procedures can be public or
 * gated via the `protectedProcedure` middleware in `trpc.ts`.
 */
export async function createTRPCContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers });
  return {
    db,
    session,
    user: session?.user ?? null,
    headers,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
