/**
 * GET /api/v1/people — the caller's people, newest touch first.
 * Scope: graph:read. Optional `?limit=` (1–100, default 40).
 *
 * Thin adapter over `entity.listPeople` — the same procedure the app uses.
 */
import { entityRouter } from '@/lib/trpc/routers/entity';
import { apiCallerContext, withApiKey } from '@/lib/api/server';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  return withApiKey(req, 'graph:read', async ({ userId, headers }) => {
    const limitParam = new URL(req.url).searchParams.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    return entityRouter
      .createCaller(apiCallerContext(userId, headers))
      .listPeople({ limit: Number.isFinite(limit) ? limit : undefined });
  });
}
