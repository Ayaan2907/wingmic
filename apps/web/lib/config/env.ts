/**
 * Zod-validated environment variables. Single source of truth.
 *
 * Usage:
 *   import { env } from '@/lib/config/env';
 *   const key = env.ANTHROPIC_API_KEY;
 *
 * Rules (enforced project-wide by CLAUDE.md + CONTRIBUTING.md once issue #12 lands):
 *   - Never read `process.env.X` directly outside this file.
 *   - New env vars require a Zod entry below + an entry in apps/web/.env.example.
 *   - Required server vars throw at import time with a readable error.
 *   - Client-side bundle only sees NEXT_PUBLIC_* keys (Next.js inlines them at build).
 *
 * Issue: https://github.com/Ayaan2907/wingmic/issues/12
 */
import { z } from 'zod';

// ── Server schema ───────────────────────────────────────────────────────
// Validated on the server (process.env populated). On the client, this
// schema is NOT parsed; the client only sees the public schema below.

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CI: z.coerce.boolean().optional(),
  PORT: z.coerce.number().int().positive().optional(),

  // ── Database (libSQL / Turso) ─────────────────────────────────────────
  TURSO_DB_URL: z.string().default('file:./local.db'),
  TURSO_AUTH_TOKEN: z.string().optional(),

  // ── Auth (BetterAuth) ─────────────────────────────────────────────────
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3210'),

  // ── Email (Resend) — magic link delivery ──────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('wingmic <auth@wingmic.xyz>'),

  // ── LLM providers ─────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_EXTRACTION_MODEL: z.string().default('claude-sonnet-4-6'),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
});

// ── Client schema ───────────────────────────────────────────────────────
// Only NEXT_PUBLIC_* + a couple of build-time globals. Next.js inlines
// these at build time; reading anything not listed here on the client
// returns undefined.

const clientSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url().default('http://localhost:3210'),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;
export type Env = ServerEnv & ClientEnv;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((i) => `  ${i.path.join('.') || '<root>'}: ${i.message}`).join('\n');
}

/**
 * Strip empty-string env values so `.optional()` schemas hit defaults
 * instead of failing min-length / URL validation.
 * `.env` files commonly set `FOO=` for unset vars; `process.env.FOO`
 * then resolves to `""`, which is truthy from Zod's POV.
 */
function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function loadEnv(): Env {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const result = serverSchema.safeParse(stripEmpty(process.env));
    if (!result.success) {
      throw new Error(
        `[env] invalid server environment variables:\n${formatIssues(
          result.error.issues,
        )}\n\nFill apps/web/.env.local — see apps/web/.env.example.`,
      );
    }
    // Merge in client schema defaults so consumers can read either set
    // from a server context (e.g., RSC reading NEXT_PUBLIC_APP_URL).
    const clientResult = clientSchema.safeParse(
      stripEmpty({
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
      }),
    );
    return {
      ...result.data,
      ...(clientResult.success ? clientResult.data : ({} as ClientEnv)),
    };
  }

  // Client-side. Next.js inlines NEXT_PUBLIC_* at build time.
  const clientEnv = stripEmpty({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  });
  const result = clientSchema.safeParse(clientEnv);
  if (!result.success) {
    throw new Error(
      `[env client] invalid environment variables:\n${formatIssues(result.error.issues)}`,
    );
  }
  // Server-only fields are undefined on the client. Cast at the boundary;
  // any consumer that reaches for a server-only field client-side will
  // hit a runtime `undefined` and a typed-not-null assertion at the call
  // site — caught in dev, surfaced loudly in prod.
  return result.data as Env;
}

export const env = loadEnv();
