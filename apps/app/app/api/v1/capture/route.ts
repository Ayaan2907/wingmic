/**
 * POST /api/v1/capture — run the hybrid extraction pipeline on a transcript
 * and commit it into the caller's graph. Scope: capture:write.
 *
 * Thin adapter over `capture.commit` — the same procedure the app's chat
 * surface uses. The body is forwarded as-is to the procedure's zod input
 * parser, so field validation and error shapes come from the router.
 */
import { captureRouter } from '@/lib/trpc/routers/capture';
import { apiCallerContext, ApiRequestError, withApiKey } from '@/lib/api/server';

export const runtime = 'nodejs';

type CommitInput = Parameters<ReturnType<typeof captureRouter.createCaller>['commit']>[0];

export async function POST(req: Request): Promise<Response> {
  return withApiKey(req, 'capture:write', async ({ userId, headers }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiRequestError(400, 'bad_request', 'expected a JSON body');
    }

    // Forwarded to the procedure's zod parser, which validates every field —
    // bad input surfaces as 400 via the TRPCError mapping, not a 500.
    const input = body as CommitInput;
    return captureRouter.createCaller(apiCallerContext(userId, headers)).commit(input);
  });
}
