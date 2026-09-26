import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { BayRecord, Meet, ScoreOutcome } from '@wingmic/bay';
import {
  BAY_CATEGORIES,
  buildProfile,
  dailyCap,
  limiter,
  personaView,
  profileText,
  resolvePersona,
  scoreEvent,
  sourcesOf,
} from '@wingmic/bay';
import * as schema from '@wingmic/db/schema';
import { env } from '@/lib/config/env';
import { getExplainChat } from '@/lib/bay/chat';
import { embeddingScores } from '@/lib/bay/retrieval';
import { runAsk } from '@/lib/bay/ask';
import { ExpiredEventError } from '@/lib/bay/errors';
import { loadBayEvent, loadBayRecords, liveOf } from '@/lib/bay/store';
import { bayClaimCaptureId, makeWingmicClient } from '@/lib/bay/wingmic';
import type { TRPCContext } from '@/lib/trpc/context';
import { publicProcedure, protectedProcedure, router } from '../trpc';

/**
 * The bay router: the map's reads, the ask, the scorer, and the claim — one
 * router serving the merged /bay surface. Reads, ask, and score are public
 * (the map is indexable and shareable; deep links work signed out); claim is
 * the only write and requires a session. No PostHog here — the analytics PR
 * owns instrumentation to avoid merge conflicts.
 */

const httpsLink = z
  .string()
  .max(300)
  .refine((v) => /^https:\/\//.test(v), 'links must be https');

export const clientProfileSchema = z
  .object({
    /** raw pasted text — rides into retrieval as-is and parses for fields */
    text: z.string().max(4000).optional(),
    name: z.string().max(120).optional(),
    headline: z.string().max(200).optional(),
    roles: z.array(z.string().max(80)).max(12).optional(),
    topics: z.array(z.string().max(80)).max(24).optional(),
    goals: z.array(z.string().max(120)).max(12).optional(),
    links: z
      .object({
        linkedin: httpsLink,
        github: httpsLink,
        x: httpsLink,
        site: httpsLink,
      })
      .partial()
      .optional(),
  })
  .refine(
    (v) =>
      Boolean(
        (v.text && v.text.trim()) ||
          v.name ||
          v.headline ||
          v.roles?.length ||
          v.topics?.length ||
          v.goals?.length ||
          (v.links && Object.keys(v.links).length),
      ),
    { message: 'a client profile needs something to read — paste a few lines or fill a field' },
  );

type ClientProfile = z.infer<typeof clientProfileSchema>;

/** Map the browser-held profile onto the score pipeline's input shape: raw
 * text rides as the source (parsePaste lifts fields AND the raw words stay in
 * retrieval); structured fields go as the profile. */
function clientProfileInputs(cp: ClientProfile): { profile?: unknown; source?: unknown } {
  if (cp.text && cp.text.trim()) return { source: { kind: 'text', value: cp.text } };
  return {
    profile: {
      name: cp.name,
      headline: cp.headline,
      roles: cp.roles,
      topics: cp.topics,
      goals: cp.goals,
      links: cp.links,
    },
  };
}

const LINK_KINDS = [
  ['linkedin', 'linkedin'],
  ['github', 'github'],
  ['x', 'twitter'],
  ['site', 'url'],
] as const;

/**
 * Provenance for a claimed profile. The identity_claim schema's kind enum has
 * no 'bay_claim', so the row derives from the profile's own asserted links
 * (linkedin / github / twitter / url) — the same identity-assertion semantics
 * the old /api/link capture implied. One row per (userId, kind, value); that
 * triple carries a unique index, so re-claims — including two concurrent
 * submits — land on one row instead of duplicating it.
 */
async function claimIdentityFromLinks(
  db: TRPCContext['db'],
  userId: string,
  links: NonNullable<ClientProfile['links']>,
): Promise<{ kind: string; value: string } | null> {
  for (const [key, kind] of LINK_KINDS) {
    const value = links[key];
    if (!value) continue;
    const existing = await db.query.identityClaims.findFirst({
      where: and(
        eq(schema.identityClaims.userId, userId),
        eq(schema.identityClaims.kind, kind),
        eq(schema.identityClaims.value, value),
      ),
      columns: { kind: true, value: true },
    });
    if (existing) return { kind: existing.kind, value: existing.value };
    // unique (user_id, kind, value): a concurrent double-claim loses the race
    // here instead of duplicating the row; the winner's row is read back
    await db
      .insert(schema.identityClaims)
      .values({ userId, kind, value })
      .onConflictDoNothing();
    const row = await db.query.identityClaims.findFirst({
      where: and(
        eq(schema.identityClaims.userId, userId),
        eq(schema.identityClaims.kind, kind),
        eq(schema.identityClaims.value, value),
      ),
      columns: { kind: true, value: true },
    });
    if (row) return { kind: row.kind, value: row.value };
    return null;
  }
  return null; // no external identity asserted — the idempotent capture carries provenance
}

/**
 * The old route's status mapping, as tRPC errors: 400 / 401 / 404 / 410 / 503.
 * The boundary degrades internally instead of failing, so these are the only
 * failure codes a score can produce — never a naked 500.
 */
export function outcomeToTRPCError(outcome: Extract<ScoreOutcome, { ok: false }>): TRPCError {
  switch (outcome.error) {
    case 'bad_persona':
      return new TRPCError({ code: 'BAD_REQUEST', message: outcome.message ?? 'unknown persona' });
    case 'bad_source':
      return new TRPCError({
        code: 'BAD_REQUEST',
        message:
          outcome.message ??
          'that does not look like a linkedin url — paste a few lines about yourself instead',
      });
    case 'profile_needed':
      return new TRPCError({
        code: 'BAD_REQUEST',
        message:
          outcome.message ?? 'paste your profile or a linkedin url so the score means something',
      });
    case 'bad_request':
      return new TRPCError({
        code: 'BAD_REQUEST',
        message: outcome.message ?? 'that event id does not look right',
      });
    case 'wingmic_auth':
      return new TRPCError({
        code: 'UNAUTHORIZED',
        message: outcome.message ?? 'that wingmic key did not resolve — sign in again',
      });
    case 'unknown_event':
      return new TRPCError({ code: 'NOT_FOUND', message: 'no such event on the board' });
    case 'expired_event':
      // rides NOT_FOUND plus bayHttpStatus 410 through the error formatter
      return new ExpiredEventError();
    case 'wingmic_unavailable':
      return new TRPCError({
        code: 'SERVICE_UNAVAILABLE',
        message: outcome.message ?? 'wingmic wiring is not live — scoring without the network',
      });
  }
}

// the old route's per-visitor limiter, wired through the ported module (same
// interface; in-memory is right for the single Railway instance — the module's
// own note). the ask is a query but it does llm + embedding work, so it carries
// its own looser window. signed-in traffic keys on the session user (an
// attacker cannot mint new identities by rotating a header); anonymous traffic
// keys on the proxy-appended address. the daily caps are the global backstop
// the ported module ships: the paid ask/score work cannot run away across
// many rotated buckets.
const DEFAULT_SCORE_PER_HOUR = 30;
const DEFAULT_ASK_PER_HOUR = 30;
const DEFAULT_SCORE_DAILY = 500;
const DEFAULT_ASK_DAILY = 1000;

/** The limiter bucket for a request. Signed-in first — a header can be
 * rotated per request, a session cannot. Anonymous falls to the RIGHTMOST
 * x-forwarded-for entry (a trusted proxy appends the real address on the
 * right; the leftmost is fully client-controlled) or x-real-ip. */
function clientKey(headers: Headers, userId: string | undefined): string {
  if (userId) return `user:${userId}`;
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const entries = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (entries.length > 0) return entries[entries.length - 1];
  }
  return 'anonymous';
}

function takeRate(
  l: { take: (ip: string) => boolean },
  key: string,
  what: string,
): void {
  if (!l.take(key)) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `${what} is rate limited — try again in a bit`,
    });
  }
}

/** The global daily backstop — one counter per day, all visitors combined. */
function takeDaily(cap: { take: () => boolean }, what: string): void {
  if (!cap.take()) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `${what} is rate limited for today — try again tomorrow`,
    });
  }
}

function requireKnownPersona(personaId: string | undefined): void {
  if (!personaId) return;
  if (!resolvePersona(personaId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown persona "${personaId}"` });
  }
}

/** Test seam: fresh rate-limit windows per instance; the exported singleton
 * uses the production defaults. */
export function createBayRouter(
  rates: {
    scorePerHour?: number;
    askPerHour?: number;
    scoreDaily?: number;
    askDaily?: number;
  } = {},
) {
  const scoreLimiter = limiter({ perHour: rates.scorePerHour ?? DEFAULT_SCORE_PER_HOUR });
  const askLimiter = limiter({ perHour: rates.askPerHour ?? DEFAULT_ASK_PER_HOUR });
  const scoreDailyCap = dailyCap(rates.scoreDaily ?? DEFAULT_SCORE_DAILY);
  const askDailyCap = dailyCap(rates.askDaily ?? DEFAULT_ASK_DAILY);

  return router({
    places: publicProcedure
      .input(
        z
          .object({
            layers: z.array(z.string().max(40)).max(BAY_CATEGORIES.length).optional(),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        const layers = input?.layers;
        if (layers) {
          const unknownLayers = layers.filter(
            (l) => !(BAY_CATEGORIES as readonly string[]).includes(l),
          );
          if (unknownLayers.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `unknown layer(s): ${unknownLayers.join(', ')}`,
            });
          }
        }
        const now = Date.now();
        const raw = await loadBayRecords(ctx.db, { now, placeCategories: layers });
        const { live, expired } = liveOf(raw.places, now);
        return {
          records: live,
          total: live.length,
          expired,
          sources: sourcesOf(live),
          readErrors: raw.readErrors,
          asOf: raw.asOf,
        };
      }),

    events: publicProcedure
      .input(z.object({ persona: z.string().max(40).optional() }).optional())
      .query(async ({ input, ctx }) => {
        const now = Date.now();
        const raw = await loadBayRecords(ctx.db, { now });
        const { live, expired } = liveOf(raw.events, now);
        const personaId = input?.persona;
        const view = personaId ? personaView(personaId, live) : null;
        // unknown persona is a 400, never a silent unranked 200 (ported rule)
        if (personaId && (!view || !view.ok)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown persona "${personaId}"` });
        }
        return {
          records: live,
          total: live.length,
          expired,
          sources: sourcesOf(live),
          readErrors: raw.readErrors,
          asOf: raw.asOf,
          // one stable output shape — persona is null when no view was asked for
          persona: view?.ok ? view.persona : null,
        };
      }),

    ask: publicProcedure
      .input(
        z.object({
          q: z.string().min(1).max(500),
          personaId: z.string().max(40).optional(),
          clientProfile: clientProfileSchema.optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        takeDaily(askDailyCap, 'the ask');
        takeRate(askLimiter, clientKey(ctx.headers, ctx.user?.id), 'the ask');
        requireKnownPersona(input.personaId);
        const now = Date.now();
        const raw = await loadBayRecords(ctx.db, { now });
        const { live: places } = liveOf(raw.places, now);
        const { live: events } = liveOf(raw.events, now);

        // the viewer: the session profile via the boundary, else the
        // browser-held throwaway — nothing is stored server-side before claim
        // (locked decision 3)
        const boundary = makeWingmicClient(ctx.session, ctx.db, ctx.headers);
        const userId = ctx.user?.id ?? null;
        const built = input.clientProfile
          ? buildProfile(clientProfileInputs(input.clientProfile))
          : null;
        const profile = boundary
          ? await boundary.getProfile().catch(() => null) // degrade: the ask rides on without a profile
          : (built?.profile ?? null);

        // embedding retrieval over places and bay_events (the entity-recall
        // mechanism). no key or db trouble degrades to the pure text ranker.
        const embedding = await embeddingScores(ctx.db, input.q).catch(() => null);
        let meetsFor: ((event: BayRecord) => Promise<Meet[]>) | null = null;
        if (boundary && userId) {
          const svc = boundary;
          // the token slot carries the session-resolved userId — never client input
          meetsFor = (event) => svc.networkOverlap(userId, { event }).catch(() => []);
        }

        const result = await runAsk(
          { q: input.q, personaId: input.personaId ?? null, profile },
          {
            places,
            events,
            meetsFor,
            chat: getExplainChat(),
            model: env.EXTRACTION_MODEL,
            embedding,
            now,
          },
        );
        return result;
      }),

    score: publicProcedure
      .input(
        z.object({
          eventId: z.string().min(1).max(120),
          personaId: z.string().max(40).optional(),
          clientProfile: clientProfileSchema.optional(),
          goal: z.string().max(400).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        takeDaily(scoreDailyCap, 'scoring');
        takeRate(scoreLimiter, clientKey(ctx.headers, ctx.user?.id), 'scoring');
        requireKnownPersona(input.personaId);
        const boundary = makeWingmicClient(ctx.session, ctx.db, ctx.headers);
        // one targeted read for the scored event (404/410 semantics on any
        // retained history row, however old) + the bounded live board for the
        // fit-rank context — "#N of M" only means something when M is the
        // board, not a single row
        const [{ record: single }, board] = await Promise.all([
          loadBayEvent(ctx.db, input.eventId),
          loadBayRecords(ctx.db, {}),
        ]);
        const events =
          single && !board.events.some((e) => e.id === single.id)
            ? [single, ...board.events]
            : board.events;
        const outcome = await scoreEvent(
          {
            eventId: input.eventId,
            // the token slot carries the session-resolved userId — never client input
            wingmicToken: ctx.user?.id,
            ...(input.clientProfile ? clientProfileInputs(input.clientProfile) : {}),
            goal: input.goal,
            personaId: input.personaId,
          },
          {
            events,
            client: boundary,
            chat: getExplainChat(),
            model: env.EXTRACTION_MODEL,
          },
        );
        if (!outcome.ok) throw outcomeToTRPCError(outcome);
        return outcome;
      }),

    claim: protectedProcedure
      .input(
        z.object({
          clientProfile: clientProfileSchema,
          captureId: z
            .string()
            .min(8)
            .max(64)
            .regex(/^[A-Za-z0-9:_-]+$/, 'captureId may use letters, digits, :, _ and -')
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const boundary = makeWingmicClient(ctx.session, ctx.db, ctx.headers);
        // protectedProcedure guarantees the session; the guard keeps types honest
        if (!boundary || !ctx.user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'sign in required' });
        }
        const viewer = buildProfile(clientProfileInputs(input.clientProfile));
        if (!viewer.profile) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'that profile did not parse — paste a few lines about yourself',
          });
        }
        // the raw paste is what the person wrote — capture that, not the digest
        const captureText = viewer.profile.raw || profileText(viewer.profile);
        const captureId = bayClaimCaptureId(captureText, input.captureId);
        const captured = await boundary.capture(ctx.user.id, { text: captureText, id: captureId });
        if (!captured) {
          return {
            captured: false,
            captureId,
            identityClaim: null,
            next: '/bay',
            note: 'the capture pipeline could not store that profile — nothing was written; try again',
          };
        }
        const identityClaim = await claimIdentityFromLinks(
          ctx.db,
          ctx.user.id,
          input.clientProfile.links ?? {},
        );
        const user = await ctx.db.query.users.findFirst({
          where: eq(schema.users.id, ctx.user.id),
          columns: { acknowledgedPrivacy: true },
        });
        return {
          captured: true,
          captureId,
          identityClaim,
          next: user?.acknowledgedPrivacy ? '/bay' : '/onboarding',
        };
      }),
  });
}

/** Production router — registered in the root router. */
export const bayRouter = createBayRouter();
