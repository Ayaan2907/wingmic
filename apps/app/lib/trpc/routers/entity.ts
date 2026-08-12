import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';

// entity.detail — single procedure powering /person/[id], /company/[id],
// /event/[id]. Source of truth: docs/superpowers/plans/2026-05-23-...md §18
// PR β₂ and design/v2/design.md §13.
//
// id semantics differ by kind:
//   - person:  id = entities.id (private, owner-scoped)
//   - company: id = companies.id (canonical, global)
//   - event:   id = events.id   (canonical, global)
//
// All edges respect soft-delete:
//   entities.deletedAt IS NULL · entityCompanies.sourceDeleted = false ·
//   entityEvents.sourceDeleted = false · entityTopics.sourceDeleted = false.
// Canonical layer (companies/events/topics) has no per-user ownership, but
// we only count rows reachable through entities owned by ctx.user.id.

const DAY_MS = 86_400_000;

function daysSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / DAY_MS);
}

function toDate(v: Date | number | null | undefined): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v as number);
}

type Capture = {
  interactionId: string;
  capturedAt: string; // ISO
  transcript: string;
  // eventName intentionally omitted — there's no reliable interaction→event
  // mapping today (sourceInteractionId lives on entityFacts/entityTopics but
  // not on entityEvents). Don't fake it from events[0]; add the proper mapping
  // when the extractor stamps event linkage onto interactions.
};

type Related = {
  kind: 'person' | 'company' | 'event';
  id: string;
  name: string;
  role?: string | null;
};

type DetailSub = Record<string, unknown>;
type DetailStats = Array<{ key: string; value: string }>;

export const entityRouter = router({
  detail: protectedProcedure
    .input(
      z.object({
        kind: z.enum(['person', 'company', 'event']),
        id: z.string().min(1),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { kind, id } = input;
      const userId = ctx.user.id;
      const db = ctx.db;

      if (kind === 'person') {
        return await loadPerson(db, userId, id);
      }
      if (kind === 'company') {
        return await loadCompany(db, userId, id);
      }
      return await loadEvent(db, userId, id);
    }),

  /** Desktop person rail — owned people, newest first. */
  listPeople: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 40;
      const people = await ctx.db.query.entities.findMany({
        where: and(
          eq(schema.entities.ownerUserId, ctx.user.id),
          isNull(schema.entities.deletedAt),
          eq(schema.entities.kind, 'person'),
        ),
        orderBy: [desc(schema.entities.updatedAt)],
        limit,
      });
      return {
        people: people.map((p) => ({
          id: p.id,
          name: p.name,
          importSource: p.importSource,
        })),
      };
    }),
});

// ────────────────────────────────────────────────────────────────────
// Person
// ────────────────────────────────────────────────────────────────────

async function loadPerson(
  db: DB,
  userId: string,
  entityId: string,
) {
  const entity = await db.query.entities.findFirst({
    where: and(
      eq(schema.entities.id, entityId),
      eq(schema.entities.ownerUserId, userId),
      isNull(schema.entities.deletedAt),
    ),
  });
  if (!entity) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'entity not found' });
  }

  const [ec, ee, et, facts] = await Promise.all([
    db.query.entityCompanies.findMany({
      where: and(
        eq(schema.entityCompanies.entityId, entityId),
        eq(schema.entityCompanies.sourceDeleted, false),
      ),
    }),
    db.query.entityEvents.findMany({
      where: and(
        eq(schema.entityEvents.entityId, entityId),
        eq(schema.entityEvents.sourceDeleted, false),
      ),
    }),
    db.query.entityTopics.findMany({
      where: and(
        eq(schema.entityTopics.entityId, entityId),
        eq(schema.entityTopics.sourceDeleted, false),
      ),
    }),
    db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, entityId),
    }),
  ]);

  const companyIds: string[] = [...new Set(ec.map((x: any) => x.companyId))];
  const eventIds: string[] = [...new Set(ee.map((x: any) => x.eventId))];
  const topicIds: string[] = [...new Set(et.map((x: any) => x.topicId))];

  const [companies, events, topics] = await Promise.all([
    companyIds.length
      ? db.query.companies.findMany({ where: inArray(schema.companies.id, companyIds) })
      : Promise.resolve([] as any[]),
    eventIds.length
      ? db.query.events.findMany({ where: inArray(schema.events.id, eventIds) })
      : Promise.resolve([] as any[]),
    topicIds.length
      ? db.query.topics.findMany({ where: inArray(schema.topics.id, topicIds) })
      : Promise.resolve([] as any[]),
  ]);

  const companyById = new Map<string, any>(companies.map((c: any) => [c.id, c]));
  const eventById = new Map<string, any>(events.map((e: any) => [e.id, e]));

  // Primary company = first edge (deterministic for v0.1.2; richer ordering
  // can land later once we track "since" reliably).
  const primaryEc = ec[0] ?? null;
  const primaryCompany = primaryEc ? companyById.get(primaryEc.companyId) : null;

  // Captures: interactions referenced by facts or topic edges for this entity.
  const factInteractionIds = facts
    .map((f: any) => f.sourceInteractionId)
    .filter((x: string | null): x is string => !!x);
  const topicInteractionIds = et
    .map((x: any) => x.sourceInteractionId)
    .filter((x: string | null): x is string => !!x);
  const interactionIds = [...new Set([...factInteractionIds, ...topicInteractionIds])];

  const interactions = interactionIds.length
    ? await db.query.interactions.findMany({
        where: and(
          inArray(schema.interactions.id, interactionIds),
          eq(schema.interactions.userId, userId),
          isNull(schema.interactions.deletedAt),
        ),
        orderBy: desc(schema.interactions.capturedAt),
        limit: 5,
      })
    : [];

  const captures: Capture[] = interactions.map((i: any) => ({
    interactionId: i.id,
    capturedAt: (toDate(i.capturedAt) ?? new Date()).toISOString(),
    transcript: i.transcript ?? '',
  }));

  // Stats
  const edgesCount = ec.length + ee.length + et.length;
  const commits = interactionIds.length;
  const mostRecent = interactions[0] ? toDate(interactions[0].capturedAt) : null;
  const since = daysSince(mostRecent);

  // Related: other people sharing an event/company/topic with this person.
  const related = await findRelatedPeople(db, userId, entityId, {
    companyIds,
    eventIds,
    topicIds,
    companyById,
    eventById,
  });

  return {
    kind: 'person' as const,
    id: entity.id,
    name: entity.name,
    sub: {
      role: primaryEc?.role ?? null,
      companyId: primaryCompany?.id ?? null,
      companyName: primaryCompany?.name ?? null,
      warmFollowup: false,
    } satisfies DetailSub,
    stats: [
      { key: 'edges', value: String(edgesCount) },
      { key: 'commits', value: String(commits) },
      { key: 'since', value: since == null ? '—' : `${since}d` },
    ] satisfies DetailStats,
    captures,
    followups: [] as Array<{ id: string; body: string; dueHint?: string }>,
    related,
    topics: topics.map((t: any) => ({ id: t.id, name: t.name })),
  };
}

async function findRelatedPeople(
  db: DB,
  userId: string,
  selfEntityId: string,
  ctxInfo: {
    companyIds: string[];
    eventIds: string[];
    topicIds: string[];
    companyById: Map<string, any>;
    eventById: Map<string, any>;
  },
): Promise<Related[]> {
  const { companyIds, eventIds, topicIds, companyById, eventById } = ctxInfo;

  const [otherEc, otherEe, otherEt] = await Promise.all([
    companyIds.length
      ? db.query.entityCompanies.findMany({
          where: and(
            inArray(schema.entityCompanies.companyId, companyIds),
            eq(schema.entityCompanies.sourceDeleted, false),
          ),
        })
      : Promise.resolve([] as any[]),
    eventIds.length
      ? db.query.entityEvents.findMany({
          where: and(
            inArray(schema.entityEvents.eventId, eventIds),
            eq(schema.entityEvents.sourceDeleted, false),
          ),
        })
      : Promise.resolve([] as any[]),
    topicIds.length
      ? db.query.entityTopics.findMany({
          where: and(
            inArray(schema.entityTopics.topicId, topicIds),
            eq(schema.entityTopics.sourceDeleted, false),
          ),
        })
      : Promise.resolve([] as any[]),
  ]);

  const roleByEntityId = new Map<string, string>();
  const addRole = (eid: string, role: string) => {
    if (!roleByEntityId.has(eid)) roleByEntityId.set(eid, role);
  };
  for (const row of otherEc) {
    if (row.entityId === selfEntityId) continue;
    const c = companyById.get(row.companyId);
    addRole(row.entityId, c ? `works at ${c.name}` : 'shared company');
  }
  for (const row of otherEe) {
    if (row.entityId === selfEntityId) continue;
    const e = eventById.get(row.eventId);
    addRole(row.entityId, e ? `co-attended ${e.name}` : 'shared event');
  }
  for (const row of otherEt) {
    if (row.entityId === selfEntityId) continue;
    addRole(row.entityId, 'overlapping topic');
  }

  const ids = [...roleByEntityId.keys()].slice(0, 20);
  if (!ids.length) return [];

  const people = await db.query.entities.findMany({
    where: and(
      inArray(schema.entities.id, ids),
      eq(schema.entities.ownerUserId, userId),
      isNull(schema.entities.deletedAt),
    ),
  });

  return people
    .slice(0, 5)
    .map((p: any) => ({
      kind: 'person' as const,
      id: p.id,
      name: p.name,
      role: roleByEntityId.get(p.id) ?? null,
    }));
}

// ────────────────────────────────────────────────────────────────────
// Company
// ────────────────────────────────────────────────────────────────────

async function loadCompany(db: DB, userId: string, companyId: string) {
  const company = await db.query.companies.findFirst({
    where: eq(schema.companies.id, companyId),
  });
  if (!company) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'company not found' });
  }

  // Edges from this user's entities into this company.
  const ec = await db.query.entityCompanies.findMany({
    where: and(
      eq(schema.entityCompanies.companyId, companyId),
      eq(schema.entityCompanies.sourceDeleted, false),
    ),
  });

  const candidateEntityIds = [...new Set(ec.map((x: any) => x.entityId as string))];
  const myEntities: any[] = candidateEntityIds.length
    ? await db.query.entities.findMany({
        where: and(
          inArray(schema.entities.id, candidateEntityIds),
          eq(schema.entities.ownerUserId, userId),
          isNull(schema.entities.deletedAt),
        ),
      })
    : [];
  const myEntityIds = myEntities.map((e: any) => e.id);
  const ecMine = ec.filter((x: any) => myEntityIds.includes(x.entityId));
  const roleById = new Map<string, string | null>(
    ecMine.map((x: any) => [x.entityId, x.role ?? null]),
  );

  // Captures: interactions touching any of these entities.
  const [facts, topicLinks] = await Promise.all([
    myEntityIds.length
      ? db.query.entityFacts.findMany({
          where: inArray(schema.entityFacts.entityId, myEntityIds),
        })
      : Promise.resolve([] as any[]),
    myEntityIds.length
      ? db.query.entityTopics.findMany({
          where: and(
            inArray(schema.entityTopics.entityId, myEntityIds),
            eq(schema.entityTopics.sourceDeleted, false),
          ),
        })
      : Promise.resolve([] as any[]),
  ]);

  const interactionIds = [
    ...new Set(
      [
        ...facts.map((f: any) => f.sourceInteractionId),
        ...topicLinks.map((t: any) => t.sourceInteractionId),
      ].filter((x: string | null): x is string => !!x),
    ),
  ];

  const interactions = interactionIds.length
    ? await db.query.interactions.findMany({
        where: and(
          inArray(schema.interactions.id, interactionIds),
          eq(schema.interactions.userId, userId),
          isNull(schema.interactions.deletedAt),
        ),
        orderBy: desc(schema.interactions.capturedAt),
        limit: 5,
      })
    : [];

  const captures: Capture[] = interactions.map((i: any) => ({
    interactionId: i.id,
    capturedAt: (toDate(i.capturedAt) ?? new Date()).toISOString(),
    transcript: i.transcript ?? '',
  }));

  // Topics raised
  const topicIds = [...new Set(topicLinks.map((t: any) => t.topicId as string))];
  const topics = topicIds.length
    ? await db.query.topics.findMany({ where: inArray(schema.topics.id, topicIds) })
    : [];

  const mostRecent = interactions[0] ? toDate(interactions[0].capturedAt) : null;
  const youKnow = myEntities.length;

  return {
    kind: 'company' as const,
    id: company.id,
    name: company.name,
    sub: {
      industry: (company.industry as string[] | null | undefined)?.[0] ?? null,
      domain: company.domain ?? null,
    } satisfies DetailSub,
    stats: [
      { key: 'you know', value: String(youKnow) },
      { key: 'commits', value: String(interactionIds.length) },
      { key: 'last touch', value: daysSince(mostRecent) == null ? '—' : `${daysSince(mostRecent)}d` },
    ] satisfies DetailStats,
    captures,
    followups: [] as Array<{ id: string; body: string; dueHint?: string }>,
    related: myEntities.slice(0, 5).map((p: any) => ({
      kind: 'person' as const,
      id: p.id,
      name: p.name,
      role: roleById.get(p.id) ?? null,
    })) satisfies Related[],
    topics: topics.map((t: any) => ({ id: t.id, name: t.name })),
  };
}

// ────────────────────────────────────────────────────────────────────
// Event
// ────────────────────────────────────────────────────────────────────

async function loadEvent(db: DB, userId: string, eventId: string) {
  const event = await db.query.events.findFirst({
    where: eq(schema.events.id, eventId),
  });
  if (!event) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'event not found' });
  }

  const ee = await db.query.entityEvents.findMany({
    where: and(
      eq(schema.entityEvents.eventId, eventId),
      eq(schema.entityEvents.sourceDeleted, false),
    ),
  });

  const candidateEntityIds = [...new Set(ee.map((x: any) => x.entityId as string))];
  const myEntities: any[] = candidateEntityIds.length
    ? await db.query.entities.findMany({
        where: and(
          inArray(schema.entities.id, candidateEntityIds),
          eq(schema.entities.ownerUserId, userId),
          isNull(schema.entities.deletedAt),
        ),
      })
    : [];
  const myEntityIds = myEntities.map((e: any) => e.id);

  // Each person's primary company for role line.
  const myEcs: any[] = myEntityIds.length
    ? await db.query.entityCompanies.findMany({
        where: and(
          inArray(schema.entityCompanies.entityId, myEntityIds),
          eq(schema.entityCompanies.sourceDeleted, false),
        ),
      })
    : [];
  const myCompanyIds = [...new Set(myEcs.map((x: any) => x.companyId as string))];
  const myCompanies = myCompanyIds.length
    ? await db.query.companies.findMany({ where: inArray(schema.companies.id, myCompanyIds) })
    : [];
  const companyById = new Map<string, any>(myCompanies.map((c: any) => [c.id, c]));
  const roleByEntity = new Map<string, string>();
  for (const row of myEcs) {
    if (roleByEntity.has(row.entityId)) continue;
    const c = companyById.get(row.companyId);
    const parts: string[] = [];
    if (c?.name) parts.push(c.name);
    if (row.role) parts.push(row.role);
    if (parts.length) roleByEntity.set(row.entityId, parts.join(' · '));
  }

  const [facts, topicLinks] = await Promise.all([
    myEntityIds.length
      ? db.query.entityFacts.findMany({
          where: inArray(schema.entityFacts.entityId, myEntityIds),
        })
      : Promise.resolve([] as any[]),
    myEntityIds.length
      ? db.query.entityTopics.findMany({
          where: and(
            inArray(schema.entityTopics.entityId, myEntityIds),
            eq(schema.entityTopics.sourceDeleted, false),
          ),
        })
      : Promise.resolve([] as any[]),
  ]);

  const interactionIds = [
    ...new Set(
      [
        ...facts.map((f: any) => f.sourceInteractionId),
        ...topicLinks.map((t: any) => t.sourceInteractionId),
      ].filter((x: string | null): x is string => !!x),
    ),
  ];

  const interactions = interactionIds.length
    ? await db.query.interactions.findMany({
        where: and(
          inArray(schema.interactions.id, interactionIds),
          eq(schema.interactions.userId, userId),
          isNull(schema.interactions.deletedAt),
        ),
        orderBy: desc(schema.interactions.capturedAt),
        limit: 5,
      })
    : [];

  const captures: Capture[] = interactions.map((i: any) => ({
    interactionId: i.id,
    capturedAt: (toDate(i.capturedAt) ?? new Date()).toISOString(),
    transcript: i.transcript ?? '',
    eventName: event.name,
  }));

  const topicIds = [...new Set(topicLinks.map((t: any) => t.topicId as string))];
  const topics = topicIds.length
    ? await db.query.topics.findMany({ where: inArray(schema.topics.id, topicIds) })
    : [];

  const start = toDate(event.dateRangeStart);
  const end = toDate(event.dateRangeEnd);
  const durationDays =
    start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1) : null;

  return {
    kind: 'event' as const,
    id: event.id,
    name: event.name,
    sub: {
      date: start ? start.toISOString() : null,
      location: event.location ?? null,
      durationDays,
    } satisfies DetailSub,
    stats: [
      { key: 'people met', value: String(myEntities.length) },
      { key: 'commits', value: String(interactionIds.length) },
      { key: 'topics', value: String(topics.length) },
    ] satisfies DetailStats,
    captures,
    followups: [] as Array<{ id: string; body: string; dueHint?: string }>,
    related: myEntities.slice(0, 5).map((p: any) => ({
      kind: 'person' as const,
      id: p.id,
      name: p.name,
      role: roleByEntity.get(p.id) ?? null,
    })) satisfies Related[],
    topics: topics.map((t: any) => ({ id: t.id, name: t.name })),
  };
}

// EntityDetail is the resolved payload from caller.detail(...) — note the
// double ReturnType: outer one resolves the caller, inner one resolves the
// `detail` method's return value. Awaited unwraps the Promise.
export type EntityDetail = Awaited<
  ReturnType<ReturnType<typeof entityRouter.createCaller>['detail']>
>;
