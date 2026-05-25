/**
 * Private internals for the /api/capture/transcribe route handler.
 *
 * Lives in a `_`-prefixed file so Next.js App Router does not treat it as a
 * route. Holds module-scoped state (rate limiter, lazy AssemblyAI client)
 * and pure helpers used by the route AND its test file.
 *
 * The previous version exported these from `route.ts` as `__testing`, but
 * Next.js validates route-handler exports and only allows `GET`/`POST`/
 * `runtime`/etc. — custom exports break `next build` (see CI fix on PR #31).
 */
import { AssemblyAI } from 'assemblyai';
import { env } from '@/lib/config/env';

// ── Constants ──────────────────────────────────────────────────────────
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024; // 3 MB (locked decision #13)
export const MAX_DURATION_SECONDS = 90; // locked decision #13
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 10; // locked decision #13

// ── Rate limiter (in-memory, per-user sliding window) ──────────────────
// Sufficient for v0.1.1 demo scale. libSQL-backed version slips to v0.1.1b.
const rateLimitBuckets = new Map<string, number[]>();

export function rateLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const stamps = (rateLimitBuckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  rateLimitBuckets.set(userId, stamps);
  return true;
}

// ── Lazy AssemblyAI client ─────────────────────────────────────────────
let _client: AssemblyAI | null = null;

export function getClient(): AssemblyAI {
  if (!_client) {
    if (!env.ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY missing');
    }
    _client = new AssemblyAI({ apiKey: env.ASSEMBLYAI_API_KEY });
  }
  return _client;
}

// ── Error envelope ─────────────────────────────────────────────────────
export type ErrorCode =
  | 'unauthenticated'
  | 'too_big'
  | 'too_long'
  | 'rate_limited'
  | 'provider_error'
  | 'transcript_empty'
  | 'bad_request'
  | 'unknown_error';

export function errorBody(
  code: ErrorCode,
  message: string,
  cause?: { provider: 'assemblyai'; code: string },
) {
  return { error: cause ? { code, message, cause } : { code, message } };
}

// ── Test-only helpers ──────────────────────────────────────────────────
// Used by route.test.ts to reset module state between tests.
export const __testing = {
  reset() {
    rateLimitBuckets.clear();
    _client = null;
  },
  setClient(c: AssemblyAI | null) {
    _client = c;
  },
};
