/**
 * GET /api/v1/graph — whole-graph payload (people, orgs, events, topics as
 * nodes; works_at / attended / discussed links). Scope: graph:read.
 *
 * Thin adapter: runs the same `graph.get` procedure the app's tRPC surface
 * uses — no duplicated business logic.
 */
import { graphRouter } from '@/lib/trpc/routers/graph';
import { apiCallerContext, withApiKey } from '@/lib/api/server';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  return withApiKey(req, 'graph:read', async ({ userId, headers }) => {
    return graphRouter.createCaller(apiCallerContext(userId, headers)).get();
  });
}
