/**
 * Shared helpers for the public landing-page demo capture route.
 * No auth — IP rate limit only. Does not persist to the graph.
 */
import { AssemblyAI } from 'assemblyai';
import { env } from '@/lib/config/env';

export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 8;

const ALLOWED_ORIGINS = new Set([
  'https://wingmic.xyz',
  'https://www.wingmic.xyz',
  'http://localhost:3210',
  'http://127.0.0.1:3210',
]);

const rateLimitBuckets = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function rateLimit(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const stamps = (rateLimitBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  rateLimitBuckets.set(key, stamps);
  return true;
}

export function corsHeaders(origin: string | null): HeadersInit {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  return {};
}

export function jsonWithCors(
  body: unknown,
  init: ResponseInit & { origin?: string | null },
): Response {
  const { origin = null, ...rest } = init;
  const headers = new Headers(rest.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return Response.json(body, { ...rest, headers });
}

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

export type DemoErrorCode =
  | 'too_big'
  | 'too_long'
  | 'rate_limited'
  | 'provider_error'
  | 'transcript_empty'
  | 'bad_request'
  | 'unavailable';

export function errorBody(code: DemoErrorCode, message: string) {
  return { error: { code, message } };
}

export const __testing = {
  reset() {
    rateLimitBuckets.clear();
    _client = null;
  },
  setClient(c: AssemblyAI | null) {
    _client = c;
  },
};
