/**
 * GET /api/v1/recall — natural-language recall over the caller's graph
 * ("who do I know that ships rust?"). Scope: search:read.
 * Required `?q=` (1–500 chars), optional `?limit=` (1–50, default 10).
 *
 * Thin adapter over `recall.query` — the same procedure the app's recall
 * page uses, including the semantic→text degradation contract.
 */
import { recallRouter } from '@/lib/trpc/routers/recall';
import { apiCallerContext, withApiKey } from '@/lib/api/server';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  return withApiKey(req, 'search:read', async ({ userId, headers }) => {
    const params = new URL(req.url).searchParams;
    const q = params.get('q') ?? '';
    const limitParam = params.get('limit');
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    return recallRouter
      .createCaller(apiCallerContext(userId, headers))
      .query({ q, limit: Number.isFinite(limit) ? limit : undefined });
  });
}
