import { z } from 'zod';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { linkedinProfileHref } from '@/lib/acts/linkedinHref';
import { namesOverlap } from '@/lib/entity/namesOverlap';
import { mergePersonEntities, undoPersonMerge } from '@/lib/entity/mergePerson';

// entity.detail — single procedure powering /person/[id], /company/[id],
// /event/[id], /topic/[id]. Source of truth: docs/superpowers/plans/2026-05-23-...md §18
// PR β₂ and design/v2/design.md §13.
//
// id semantics differ by kind:
//   - person:  id = entities.id (private, owner-scoped)
//   - company: id = companies.id (canonical, global)
//   - event:   id = events.id   (canonical, global)
//   - topic:   id = topics.id   (canonical, global)
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
  topics: string[];
  eventName?: string | null;
  jpegBase64?: string | null;
};

type Related = {
  kind: 'person' | 'company' | 'event';
  id: string;
  name: string;
  role?: string | null;
};

type PossibleMatch = {
  id: string;
  name: string;
  role: string | null;
  companyName: string | null;
};

type PublicProfile = {
  linkedin: string | null;
  url: string | null;
  sourceUrl: string | null;
};

type DetailSub = Record<string, unknown>;
type DetailStats = Array<{ key: string; value: string }>;

export const entityRouter = router({
  detail: protectedProcedure
    .input(
      z.object({
        kind: z.enum(['person', 'company', 'event', 'topic']),
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
      if (kind === 'event') {
        return await loadEvent(db, userId, id);
      }
      return await loadTopic(db, userId, id);
    }),

  merge: protectedProcedure
    .input(z.object({ sourceId: z.string().min(1), targetId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await mergePersonEntities(
          ctx.db,
          ctx.user.id,
          input.sourceId,
          input.targetId,
        );
      } catch (e) {
        if (e instanceof Error && e.message === 'MERGE_NOT_ALLOWED') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'cannot merge these people' });
        }
        throw e;
      }
    }),

  undoMerge: protectedProcedure
    .input(z.object({ mergeId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await undoPersonMerge(ctx.db, ctx.user.id, input.mergeId);
        return { ok: true as const };
      } catch (e) {
        if (e instanceof Error && e.message === 'MERGE_UNDO_EXPIRED') {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'undo window closed' });
        }
        if (e instanceof Error && e.message === 'MERGE_NOT_FOUND') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'merge not found' });
        }
        throw e;
      }
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
  const interactionIds = [
    ...new Set([...factInteractionIds, ...topicInteractionIds]),
  ];
  interactionIds.push(
    ...(await extraAttachmentInteractionIds(db, { entityIds: [entityId] })),
  );
  const uniqueInteractionIds = [...new Set(interactionIds)];

  const interactions = await loadOwnedInteractions(db, userId, uniqueInteractionIds);
  const topicById = new Map(topics.map((t: any) => [t.id as string, t.name as string]));
  const topicsByInteraction = new Map<string, string[]>();
  for (const link of et) {
    const iid = (link as { sourceInteractionId?: string | null }).sourceInteractionId;
    if (!iid) continue;
    const name = topicById.get((link as { topicId: string }).topicId);
    if (!name) continue;
    const list = topicsByInteraction.get(iid) ?? [];
    if (!list.includes(name)) list.push(name);
    topicsByInteraction.set(iid, list);
  }
  const captures = await attachCaptureMedia(db, interactions, {
    entityId,
    topicsByInteraction,
  });

  // Stats
  const edgesCount = ec.length + ee.length + et.length;
  const commits = interactions.length;
  const mostRecent = interactions[0] ? toDate(interactions[0].capturedAt) : null;
  const since = daysSince(mostRecent);

  const related = await findRelatedPeople(db, userId, entityId, {
    companyIds,
    eventIds,
    companyById,
    eventById,
  });

  const possibleMatches = await findPossibleMatches(db, userId, entityId, entity.name);
  const publicProfile = publicProfileFromFacts(facts);

  // Captures + pending acts targeted at this person (follow-ups strip).
  const followupRows = await db.query.acts.findMany({
    where: and(
      eq(schema.acts.userId, userId),
      eq(schema.acts.targetEntityId, entityId),
      or(eq(schema.acts.status, 'drafted'), eq(schema.acts.status, 'snoozed')),
    ),
    orderBy: [desc(schema.acts.createdAt)],
    limit: 10,
  });

  return {
    kind: 'person' as const,
    id: entity.id,
    name: entity.name,
    importSource: entity.importSource ?? null,
    sub: {
      role: primaryEc?.role ?? null,
      companyId: primaryCompany?.id ?? null,
      companyName: primaryCompany?.name ?? null,
      warmFollowup: followupRows.length > 0,
    } satisfies DetailSub,
    stats: [
      { key: 'edges', value: String(edgesCount) },
      { key: 'commits', value: String(commits) },
      { key: 'since', value: since == null ? '—' : `${since}d` },
    ] satisfies DetailStats,
    captures,
    followups: followupRows.map((a) => ({
      id: a.id,
      body: a.subject ? `${a.subject} — ${a.body}` : a.body,
      dueHint: a.whenHint ?? undefined,
    })),
    related,
    topics: topics.map((t: any) => ({ id: t.id, name: t.name })),
    publicProfile,
    possibleMatches,
  };
}

async function findRelatedPeople(
  db: DB,
  userId: string,
  selfEntityId: string,
  ctxInfo: {
    companyIds: string[];
    eventIds: string[];
    companyById: Map<string, any>;
    eventById: Map<string, any>;
  },
): Promise<Related[]> {
  const { companyIds, eventIds, companyById, eventById } = ctxInfo;

  const [otherEc, otherEe] = await Promise.all([
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
  interactionIds.push(
    ...(await extraAttachmentInteractionIds(db, { entityIds: myEntityIds })),
  );
  const uniqueInteractionIds = [...new Set(interactionIds)];

  const interactions = await loadOwnedInteractions(db, userId, uniqueInteractionIds);
  const captures = await attachCaptureMedia(db, interactions, {});

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
      { key: 'commits', value: String(interactions.length) },
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
  interactionIds.push(
    ...(await extraAttachmentInteractionIds(db, {
      entityIds: myEntityIds,
      eventId,
    })),
  );
  const uniqueInteractionIds = [...new Set(interactionIds)];

  const interactions = await loadOwnedInteractions(db, userId, uniqueInteractionIds);
  const captures = await attachCaptureMedia(db, interactions, {
    eventName: event.name,
    eventId,
  });

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
      url: event.url ?? null,
    } satisfies DetailSub,
    stats: [
      { key: 'people met', value: String(myEntities.length) },
      { key: 'commits', value: String(interactions.length) },
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

async function extraAttachmentInteractionIds(
  db: DB,
  opts: { entityIds?: string[]; eventId?: string },
): Promise<string[]> {
  const ids: string[] = [];
  if (opts.entityIds && opts.entityIds.length > 0) {
    const rows = await db.query.interactionAttachments.findMany({
      where: inArray(schema.interactionAttachments.entityId, opts.entityIds),
      columns: { interactionId: true },
    });
    ids.push(...rows.map((r) => r.interactionId));
  }
  if (opts.eventId) {
    const rows = await db.query.interactionAttachments.findMany({
      where: eq(schema.interactionAttachments.eventId, opts.eventId),
      columns: { interactionId: true },
    });
    ids.push(...rows.map((r) => r.interactionId));
  }
  return ids;
}

async function loadOwnedInteractions(
  db: DB,
  userId: string,
  interactionIds: string[],
) {
  if (interactionIds.length === 0) return [];
  return db.query.interactions.findMany({
    where: and(
      inArray(schema.interactions.id, interactionIds),
      eq(schema.interactions.userId, userId),
      isNull(schema.interactions.deletedAt),
    ),
    orderBy: desc(schema.interactions.capturedAt),
    limit: 5,
  });
}

async function attachCaptureMedia(
  db: DB,
  interactions: Array<{ id: string; capturedAt: Date | number | null; transcript: string | null }>,
  opts: {
    eventName?: string;
    entityId?: string;
    eventId?: string;
    topicsByInteraction?: Map<string, string[]>;
  },
): Promise<Capture[]> {
  if (interactions.length === 0) return [];
  const rows = await db.query.interactionAttachments.findMany({
    where: inArray(
      schema.interactionAttachments.interactionId,
      interactions.map((i) => i.id),
    ),
    columns: {
      interactionId: true,
      entityId: true,
      eventId: true,
      jpegBase64: true,
    },
  });
  const byInteraction = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byInteraction.get(row.interactionId) ?? [];
    list.push(row);
    byInteraction.set(row.interactionId, list);
  }
  return interactions.map((i) => {
    const atts = byInteraction.get(i.id) ?? [];
    const preferred =
      atts.find((a) => opts.entityId && a.entityId === opts.entityId) ??
      atts.find((a) => opts.eventId && a.eventId === opts.eventId) ??
      atts[0];
    return {
      interactionId: i.id,
      capturedAt: (toDate(i.capturedAt) ?? new Date()).toISOString(),
      transcript: i.transcript ?? '',
      topics: opts.topicsByInteraction?.get(i.id) ?? [],
      ...(opts.eventName ? { eventName: opts.eventName } : {}),
      jpegBase64: preferred?.jpegBase64 ?? null,
    };
  });
}

// ────────────────────────────────────────────────────────────────────
// Topic
// ────────────────────────────────────────────────────────────────────

async function loadTopic(db: DB, userId: string, topicId: string) {
  const topic = await db.query.topics.findFirst({
    where: eq(schema.topics.id, topicId),
  });
  if (!topic) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'topic not found' });
  }

  const etAll = await db.query.entityTopics.findMany({
    where: and(
      eq(schema.entityTopics.topicId, topicId),
      eq(schema.entityTopics.sourceDeleted, false),
    ),
  });

  const candidateEntityIds = [...new Set(etAll.map((x: any) => x.entityId as string))];
  const myEntities: any[] = candidateEntityIds.length
    ? await db.query.entities.findMany({
        where: and(
          inArray(schema.entities.id, candidateEntityIds),
          eq(schema.entities.ownerUserId, userId),
          isNull(schema.entities.deletedAt),
        ),
      })
    : [];

  if (myEntities.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'topic not found' });
  }

  const myEntityIds = myEntities.map((e: any) => e.id);
  const etMine = etAll.filter((x: any) => myEntityIds.includes(x.entityId));

  const interactionIds = [
    ...new Set(
      etMine
        .map((t: any) => t.sourceInteractionId as string | null)
        .filter((x): x is string => !!x),
    ),
  ];

  const interactions = await loadOwnedInteractions(db, userId, interactionIds);
  const topicsByInteraction = new Map<string, string[]>();
  for (const i of interactions) {
    topicsByInteraction.set(i.id, [topic.name]);
  }
  const captures = await attachCaptureMedia(db, interactions, { topicsByInteraction });

  const [ec, ee] = await Promise.all([
    db.query.entityCompanies.findMany({
      where: and(
        inArray(schema.entityCompanies.entityId, myEntityIds),
        eq(schema.entityCompanies.sourceDeleted, false),
      ),
    }),
    db.query.entityEvents.findMany({
      where: and(
        inArray(schema.entityEvents.entityId, myEntityIds),
        eq(schema.entityEvents.sourceDeleted, false),
      ),
    }),
  ]);

  const companyIds = [...new Set(ec.map((x: any) => x.companyId as string))];
  const eventIds = [...new Set(ee.map((x: any) => x.eventId as string))];
  const [companies, events] = await Promise.all([
    companyIds.length
      ? db.query.companies.findMany({ where: inArray(schema.companies.id, companyIds) })
      : Promise.resolve([] as any[]),
    eventIds.length
      ? db.query.events.findMany({ where: inArray(schema.events.id, eventIds) })
      : Promise.resolve([] as any[]),
  ]);

  const companyById = new Map<string, any>(companies.map((c: any) => [c.id, c]));
  const roleByEntity = new Map<string, string>();
  for (const row of ec) {
    if (roleByEntity.has(row.entityId)) continue;
    const c = companyById.get(row.companyId);
    const parts: string[] = [];
    if (c?.name) parts.push(c.name);
    if (row.role) parts.push(row.role);
    if (parts.length) roleByEntity.set(row.entityId, parts.join(' · '));
  }

  const related: Related[] = [
    ...myEntities.map((p: any) => ({
      kind: 'person' as const,
      id: p.id,
      name: p.name,
      role: roleByEntity.get(p.id) ?? 'discussed this',
    })),
    ...companies.map((c: any) => ({
      kind: 'company' as const,
      id: c.id,
      name: c.name,
      role: 'shared topic',
    })),
    ...events.map((e: any) => ({
      kind: 'event' as const,
      id: e.id,
      name: e.name,
      role: 'shared topic',
    })),
  ].slice(0, 15);

  const mostRecent = interactions[0] ? toDate(interactions[0].capturedAt) : null;

  return {
    kind: 'topic' as const,
    id: topic.id,
    name: topic.name,
    sub: { slug: topic.slug ?? null } satisfies DetailSub,
    stats: [
      { key: 'people', value: String(myEntities.length) },
      { key: 'commits', value: String(interactionIds.length) },
      {
        key: 'last touch',
        value: daysSince(mostRecent) == null ? '—' : `${daysSince(mostRecent)}d`,
      },
    ] satisfies DetailStats,
    captures,
    followups: [] as Array<{ id: string; body: string; dueHint?: string }>,
    related,
    topics: [] as Array<{ id: string; name: string }>,
  };
}

function firstFactValue(
  facts: Array<{ key: string; value: string; confidence?: number }>,
  key: string,
): string | null {
  const rows = facts.filter((f) => f.key === key);
  rows.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const value = rows[0]?.value?.trim();
  return value || null;
}

function safeHttpUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function publicProfileFromFacts(
  facts: Array<{ key: string; value: string; confidence?: number }>,
): PublicProfile {
  const linkedin = linkedinProfileHref(firstFactValue(facts, 'linkedin'));
  let url = safeHttpUrl(firstFactValue(facts, 'url'));
  const sourceUrl = safeHttpUrl(firstFactValue(facts, 'source_url'));
  if (url && linkedin && url.replace(/\/$/, '') === linkedin.replace(/\/$/, '')) {
    url = null;
  }
  return { linkedin, url, sourceUrl };
}

async function findPossibleMatches(
  db: DB,
  userId: string,
  selfEntityId: string,
  name: string,
): Promise<PossibleMatch[]> {
  const others = await db.query.entities.findMany({
    where: and(
      eq(schema.entities.ownerUserId, userId),
      isNull(schema.entities.deletedAt),
      eq(schema.entities.kind, 'person'),
    ),
    columns: { id: true, name: true },
    limit: 200,
  });
  const hits = others
    .filter((p) => p.id !== selfEntityId && namesOverlap(name, p.name))
    .slice(0, 5);
  if (hits.length === 0) return [];

  const ids = hits.map((h) => h.id);
  const ecs = await db.query.entityCompanies.findMany({
    where: and(
      inArray(schema.entityCompanies.entityId, ids),
      eq(schema.entityCompanies.sourceDeleted, false),
    ),
  });
  const companyIds = [...new Set(ecs.map((row: { companyId: string }) => row.companyId))];
  const companies = companyIds.length
    ? await db.query.companies.findMany({ where: inArray(schema.companies.id, companyIds) })
    : [];
  const companyById = new Map(companies.map((c: { id: string; name: string }) => [c.id, c]));
  const metaByEntity = new Map<string, { role: string | null; companyName: string | null }>();
  for (const row of ecs) {
    if (metaByEntity.has(row.entityId)) continue;
    const c = companyById.get(row.companyId);
    metaByEntity.set(row.entityId, {
      role: row.role ?? null,
      companyName: c?.name ?? null,
    });
  }
  return hits.map((h) => ({
    id: h.id,
    name: h.name,
    role: metaByEntity.get(h.id)?.role ?? null,
    companyName: metaByEntity.get(h.id)?.companyName ?? null,
  }));
}

// EntityDetail is the resolved payload from caller.detail(...) — note the
// double ReturnType: outer one resolves the caller, inner one resolves the
// `detail` method's return value. Awaited unwraps the Promise.
export type EntityDetail = Awaited<
  ReturnType<ReturnType<typeof entityRouter.createCaller>['detail']>
>;
