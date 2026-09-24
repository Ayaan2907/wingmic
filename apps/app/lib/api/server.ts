/**
 * Bearer-key middleware for /api/v1 route handlers.
 *
 * Every handler runs through `withApiKey`: authenticate the key, count the
 * request against the key's rate window, enforce the endpoint's scope, then
 * execute. Endpoints do NOT re-implement router logic — they invoke the
 * same tRPC procedures via `router.createCaller(...)` with a synthesized
 * context (the repo's established pattern: settings/page.tsx, *.test.ts),
 * so REST and the app share one business-logic layer.
 *
 * Error contract: 401 for a missing/unknown/revoked key, 429 when the
 * key's window is spent, 403 with `missingScope` named for a valid key
 * that lacks the endpoint's scope. Raw keys are never logged.
 */
import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { db } from '@wingmic/db';
import type { TRPCContext } from '@/lib/trpc/context';
import {
  authenticateApiKey,
  type ApiScope,
  type AuthenticatedApiKey,
} from '@/lib/api/keys';
import { consumeRateLimit } from '@/lib/api/rateLimit';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extraBody: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Extract the raw bearer key, or null when the header is absent/malformed. */
export function bearerKey(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/**
 * Synthesize a tRPC context for an API-key caller. API keys authenticate
 * the user directly; the procedures reachable from /api/v1 consume only
 * `user.id` (graph.get, entity.listPeople, capture.commit, recall.query).
 */
export function apiCallerContext(userId: string, headers: Headers): TRPCContext {
  return {
    db,
    session: { user: { id: userId } },
    user: { id: userId },
    headers,
  } as unknown as TRPCContext;
}

export type V1Context = {
  userId: string;
  key: AuthenticatedApiKey;
  headers: Headers;
};

/**
 * Shared middleware for every /api/v1 handler: authenticate → rate limit →
 * scope check → run. Throws ApiRequestError / TRPCError, mapped to a
 * response by `toApiResponse`.
 */
export async function withApiKey(
  req: Request,
  scope: ApiScope,
  run: (ctx: V1Context) => Promise<unknown>,
): Promise<Response> {
  try {
    const raw = bearerKey(req);
    if (!raw) {
      throw new ApiRequestError(401, 'unauthorized', 'missing bearer key — send Authorization: Bearer wk_live_…');
    }
    const key = await authenticateApiKey(db, raw);
    if (!key) {
      throw new ApiRequestError(401, 'unauthorized', 'invalid or revoked key');
    }

    const rl = await consumeRateLimit(db, key.id);
    if (!rl.allowed) {
      throw new ApiRequestError(
        429,
        'rate_limited',
        `rate limit exceeded — retry in ${rl.retryAfterSeconds}s`,
        {},
        { 'Retry-After': String(rl.retryAfterSeconds) },
      );
    }

    if (!key.scopes.includes(scope)) {
      throw new ApiRequestError(
        403,
        'insufficient_scope',
        `key is missing the required scope: ${scope}`,
        { missingScope: scope },
      );
    }

    const result = await run({ userId: key.userId, key, headers: req.headers });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return toApiResponse(err);
  }
}

/** Map TRPCError (from shared procedures) and ApiRequestError to responses. */
export function toApiResponse(err: unknown): Response {
  if (err instanceof ApiRequestError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...err.extraBody } },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof TRPCError) {
    const mapped = TRPC_TO_HTTP[err.code] ?? { status: 500, code: 'internal_error' };
    return NextResponse.json(
      { error: { code: mapped.code, message: err.message } },
      { status: mapped.status },
    );
  }
  console.error('[api/v1] unhandled error:', err);
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'something went wrong' } },
    { status: 500 },
  );
}

// tRPC's internal codes are uppercase; the v1 wire uses lowercase snake_case.
// TOO_MANY_REQUESTS surfaces as rate_limited (e.g. capture daily cap).
const TRPC_TO_HTTP: Record<string, { status: number; code: string }> = {
  BAD_REQUEST: { status: 400, code: 'bad_request' },
  UNAUTHORIZED: { status: 401, code: 'unauthorized' },
  FORBIDDEN: { status: 403, code: 'forbidden' },
  NOT_FOUND: { status: 404, code: 'not_found' },
  TOO_MANY_REQUESTS: { status: 429, code: 'rate_limited' },
  INTERNAL_SERVER_ERROR: { status: 500, code: 'internal_error' },
};
