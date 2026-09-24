import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { parseEventExternal, slugify } from '@wingmic/extractor';
import * as schema from '@wingmic/db/schema';
import { getIcsSnapshot } from '@/lib/enrich/icsSnapshot';
import { matchIcsWindow } from '@/lib/enrich/icsWindow';
import type { ParsedIcsEvent } from '@/lib/enrich/parseIcs';
import { router, protectedProcedure } from '../trpc';

/** Minutes past the scheduled end an event still binds the session (overruns). */
const ONGOING_PAST_BUFFER_MIN = 15;
/** Minutes ahead of the scheduled start an event surfaces as a pickable candidate. */
const UPCOMING_FUTURE_BUFFER_MIN = 90;

/**
 * An event on the session wire. `id` is the canonical `event` row id and is
 * null until `events.bind` lazily creates/reuses that row — window matching
 * runs on the user's ICS feed, which has no database identity of its own.
 */
export type EventSessionEvent = {
  id: string | null;
  name: string;
  location: string | null;
  url: string | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  /** Transport-only flag from the ICS feed; the canonical row does not track it. */
  allDay: boolean;
};

/**
 * The current-event session. `none` is the client-side pinned state when
 * this query returns `session: null` (no ICS set, or zero window matches).
 */
export type EventSession =
  | { state: 'none' }
  | { state: 'bound'; event: EventSessionEvent; source: 'ics-auto' | 'picked' }
  | { state: 'ambiguous'; candidates: EventSessionEvent[] };

export type EventSessionResponse = {
  /** Null when no ICS is set or no event window matches — see EventSession. */
  session: EventSession | null;
  /** Ongoing + upcoming candidates, ongoing first. */
  candidates: EventSessionEvent[];
};

const eventDescriptorInput = z.object({
  /** Canonical row id for pick-from-recent; ignored when it no longer resolves. */
  id: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(300),
  location: z.string().max(500).nullable().optional(),
  url: z.string().max(500).nullable().optional(),
  dateRangeStart: z.date().nullable().optional(),
  dateRangeEnd: z.date().nullable().optional(),
  allDay: z.boolean().optional(),
});

const bindInput = z.object({
  event: eventDescriptorInput,
  source: z.enum(['ics-auto', 'picked']).default('picked'),
});

function icsToSessionEvent(event: ParsedIcsEvent): EventSessionEvent {
  return {
    id: null,
    name: event.summary,
    location: event.location,
    url: event.url,
    dateRangeStart: event.dateRangeStart,
    dateRangeEnd: event.dateRangeEnd,
    allDay: event.allDay,
  };
}

function rowToSessionEvent(row: schema.Event, allDay = false): EventSessionEvent {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    url: row.url,
    dateRangeStart: row.dateRangeStart,
    dateRangeEnd: row.dateRangeEnd,
    allDay,
  };
}

function boundSession(event: EventSessionEvent, source: 'ics-auto' | 'picked') {
  return { session: { state: 'bound', event, source } as const };
}

type Harvested = NonNullable<ReturnType<typeof parseEventExternal>>;

/**
 * Deterministic slug for names with no ASCII projection (飲み会, emoji-only).
 * FNV-1a — stable across runtimes, no crypto dependency. Keeps same-name
 * binds converging while distinct names stay distinct.
 */
function fallbackSlugFor(name: string): string {
  let hash = 0x811c9dc5;
  for (const ch of name) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `x-${hash.toString(16).padStart(8, '0')}`;
}

function eventSlug(name: string): string {
  const slug = slugify(name);
  if (slug) return slug;
  // slugify's '' sentinel is load-bearing for the extractor fingerprint
  // path ("caller must validate"), so the non-collapsing fallback lives
  // on the bind surface: a shared '' slug would collapse distinct
  // calendar events onto one canonical row.
  return fallbackSlugFor(name);
}

/** Same hex-encoded disambiguation as upsertEvent (resolution.ts). */
function disambiguatedSlug(base: string, harvested: Harvested): string {
  const encodedId = Array.from(new TextEncoder().encode(harvested.id), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${base.slice(0, 40)}-${harvested.source}-${encodedId}`;
}

/**
 * The slug row carries a different external identity than the bind —
 * two distinct events sharing a name-slug (e.g. two lu.ma ids). Same
 * name with no external id is convergence, not collision.
 */
function isExternalCollision(row: schema.Event, harvested: Harvested | null): boolean {
  return Boolean(
    harvested &&
      row.externalSource !== null &&
      row.externalId !== null &&
      (row.externalSource !== harvested.source || row.externalId !== harvested.id),
  );
}

/**
 * events.current / events.bind — the server half of current-event binding
 * (spec D1). `current` is a pure read over the user's ICS feed; `bind` is
 * the only writer (lazy canonical-row creation). SECURITY: both scope to
 * ctx.user.id — a userId is never accepted from input.
 */
export const eventsRouter = router({
  current: protectedProcedure.query(async ({ ctx }): Promise<EventSessionResponse> => {
    const user = await ctx.db.query.users.findFirst({
      where: eq(schema.users.id, ctx.user.id),
      columns: { calendarIcsUrl: true },
    });
    const icsUrl = user?.calendarIcsUrl ?? null;
    if (!icsUrl) return { session: null, candidates: [] };

    const icsEvents = await getIcsSnapshot(ctx.db, ctx.user.id, icsUrl);
    const { ongoing, upcoming } = matchIcsWindow(icsEvents, new Date(), {
      pastBufferMin: ONGOING_PAST_BUFFER_MIN,
      futureBufferMin: UPCOMING_FUTURE_BUFFER_MIN,
    });

    const candidates = [...ongoing, ...upcoming].map(icsToSessionEvent);
    // Exactly one ongoing match binds silently; two or more ask via the
    // picker; zero stays honest with session: null.
    if (ongoing.length === 1) {
      const event = icsToSessionEvent(ongoing[0]!);
      return { session: { state: 'bound', event, source: 'ics-auto' }, candidates };
    }
    if (ongoing.length > 1) {
      return { session: { state: 'ambiguous', candidates }, candidates };
    }
    return { session: null, candidates };
  }),

  bind: protectedProcedure.input(bindInput).mutation(async ({ ctx, input }) => {
    const { event: descriptor, source } = input;

    if (descriptor.id) {
      const row = await ctx.db.query.events.findFirst({
        where: eq(schema.events.id, descriptor.id),
      });
      if (row) {
        return boundSession(rowToSessionEvent(row, descriptor.allDay ?? false), source);
      }
      // Stale id (event deleted server-side) — fall through and resolve
      // from the descriptor instead of failing the pin.
    }

    const harvested = descriptor.url ? parseEventExternal(descriptor.url) : null;

    // Mirror upsertEvent's identity order (packages/extractor/src/resolution.ts):
    // external id first, then slug — so a bound event and a later capture of
    // the same event land on the same canonical row.
    if (harvested) {
      const byExternal = await ctx.db.query.events.findFirst({
        where: and(
          eq(schema.events.externalSource, harvested.source),
          eq(schema.events.externalId, harvested.id),
        ),
      });
      if (byExternal) {
        return boundSession(rowToSessionEvent(byExternal, descriptor.allDay ?? false), source);
      }
    }

    let slug = eventSlug(descriptor.name);
    const bySlug = await ctx.db.query.events.findFirst({
      where: eq(schema.events.slug, slug),
    });
    if (bySlug && !isExternalCollision(bySlug, harvested)) {
      // Re-bind / same-named event — return the row untouched. observedCount
      // and promotedAt only move when a real capture observes the event.
      return boundSession(rowToSessionEvent(bySlug, descriptor.allDay ?? false), source);
    }
    if (bySlug && harvested) {
      slug = disambiguatedSlug(slug, harvested);
    }

    const insertAndBind = async (slugToUse: string) => {
      // Lazy-create the canonical row. observedCount starts at 0: binding is
      // not an observation — the counter (and promotion) only moves when a
      // real capture observes the event, preserving upsertEvent semantics.
      const inserted = await ctx.db
        .insert(schema.events)
        .values({
          slug: slugToUse,
          name: descriptor.name,
          dateRangeStart: descriptor.dateRangeStart ?? null,
          dateRangeEnd: descriptor.dateRangeEnd ?? null,
          location: descriptor.location ?? null,
          url: descriptor.url ?? null,
          externalSource: harvested?.source ?? null,
          externalId: harvested?.id ?? null,
          observedCount: 0,
        })
        .returning({ id: schema.events.id });
      const created = await ctx.db.query.events.findFirst({
        where: eq(schema.events.id, inserted[0]!.id),
      });
      if (!created) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'event vanished after insert',
        });
      }
      return boundSession(rowToSessionEvent(created, descriptor.allDay ?? false), source);
    };

    try {
      return await insertAndBind(slug);
    } catch (err) {
      if (!(err instanceof Error && /UNIQUE constraint failed/.test(err.message))) throw err;
      if (harvested) {
        // Concurrent bind of the same external identity — bind to the winner.
        const winner = await ctx.db.query.events.findFirst({
          where: and(
            eq(schema.events.externalSource, harvested.source),
            eq(schema.events.externalId, harvested.id),
          ),
        });
        if (winner) {
          return boundSession(rowToSessionEvent(winner, descriptor.allDay ?? false), source);
        }
      }
      // The slug was claimed between read and insert. A same-named bind
      // raced us — bind to the winner; a distinct event sharing the slug
      // re-runs the hex disambiguation and retries the insert once.
      const bySlugNow = await ctx.db.query.events.findFirst({
        where: eq(schema.events.slug, slug),
      });
      if (bySlugNow && !isExternalCollision(bySlugNow, harvested)) {
        return boundSession(rowToSessionEvent(bySlugNow, descriptor.allDay ?? false), source);
      }
      if (!harvested) {
        // Unreachable — without an external id the winner re-read binds.
        throw err;
      }
      return insertAndBind(disambiguatedSlug(slug, harvested));
    }
  }),
});
