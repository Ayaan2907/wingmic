import { and, eq, inArray, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import * as schema from '@wingmic/db/schema';

// graph.get — whole-graph payload for the signed-in user, shaped for a
// force-directed canvas (react-force-graph-2d). Source of truth:
// docs/superpowers/plans/2026-06-06-v0.1.2-pr-iota-graph.md (PR ι-graph).
//
// Mirrors entity.ts's edge-loading + soft-delete discipline:
//   entities.deletedAt IS NULL · ownerUserId = ctx.user.id ·
//   entity{Companies,Events,Topics}.sourceDeleted = false.
// People are owner-scoped `entities`. companies/events/topics are canonical
// (no per-user ownership) — we only surface rows reachable through THIS
// user's entities, exactly like loadCompany/loadEvent.

type NodeKind = 'person' | 'company' | 'event' | 'topic';
type LinkRel = 'works_at' | 'attended' | 'discussed';

export type GraphNode = { id: string; kind: NodeKind; label: string };
export type GraphLink = { source: string; target: string; rel: LinkRel; hub?: boolean };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

/**
 * When a person both works at a company (or attended an event) and discussed
 * a topic, also draw company/event → topic so shared subjects form a hub
 * instead of a lone spoke off one person.
 */
export function discussedHubLinks(
  ec: Array<{ entityId: string; companyId: string }>,
  ee: Array<{ entityId: string; eventId: string }>,
  et: Array<{ entityId: string; topicId: string }>,
): GraphLink[] {
  const topicsByEntity = new Map<string, string[]>();
  for (const row of et) {
    const list = topicsByEntity.get(row.entityId) ?? [];
    list.push(row.topicId);
    topicsByEntity.set(row.entityId, list);
  }
  const seen = new Set<string>();
  const links: GraphLink[] = [];
  const add = (source: string, target: string) => {
    const key = `${source}|${target}|discussed`;
    if (seen.has(key) || source === target) return;
    seen.add(key);
    links.push({ source, target, rel: 'discussed', hub: true });
  };
  for (const row of ec) {
    for (const topicId of topicsByEntity.get(row.entityId) ?? []) add(row.companyId, topicId);
  }
  for (const row of ee) {
    for (const topicId of topicsByEntity.get(row.entityId) ?? []) add(row.eventId, topicId);
  }
  return links;
}

export const graphRouter = router({
  get: protectedProcedure.query(async ({ ctx }): Promise<GraphData> => {
    const userId = ctx.user.id;
    const db = ctx.db;

    // People = the user's own, non-deleted entities.
    const people = await db.query.entities.findMany({
      where: and(
        eq(schema.entities.ownerUserId, userId),
        isNull(schema.entities.deletedAt),
      ),
    });

    if (people.length === 0) {
      return { nodes: [], links: [] };
    }

    const entityIds = people.map((p: any) => p.id as string);

    // Live edges out of those people (sourceDeleted = false).
    const [ec, ee, et] = await Promise.all([
      db.query.entityCompanies.findMany({
        where: and(
          inArray(schema.entityCompanies.entityId, entityIds),
          eq(schema.entityCompanies.sourceDeleted, false),
        ),
      }),
      db.query.entityEvents.findMany({
        where: and(
          inArray(schema.entityEvents.entityId, entityIds),
          eq(schema.entityEvents.sourceDeleted, false),
        ),
      }),
      db.query.entityTopics.findMany({
        where: and(
          inArray(schema.entityTopics.entityId, entityIds),
          eq(schema.entityTopics.sourceDeleted, false),
        ),
      }),
    ]);

    const companyIds = [...new Set(ec.map((x: any) => x.companyId as string))];
    const eventIds = [...new Set(ee.map((x: any) => x.eventId as string))];
    const topicIds = [...new Set(et.map((x: any) => x.topicId as string))];

    // Canonical rows referenced by those (live) edges only.
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

    const nodes: GraphNode[] = [
      ...people.map((p: any) => ({ id: p.id as string, kind: 'person' as const, label: p.name as string })),
      ...companies.map((c: any) => ({ id: c.id as string, kind: 'company' as const, label: c.name as string })),
      ...events.map((e: any) => ({ id: e.id as string, kind: 'event' as const, label: e.name as string })),
      ...topics.map((t: any) => ({ id: t.id as string, kind: 'topic' as const, label: t.name as string })),
    ];

    const links: GraphLink[] = [
      ...ec.map((x: any) => ({ source: x.entityId as string, target: x.companyId as string, rel: 'works_at' as const })),
      ...ee.map((x: any) => ({ source: x.entityId as string, target: x.eventId as string, rel: 'attended' as const })),
      ...et.map((x: any) => ({ source: x.entityId as string, target: x.topicId as string, rel: 'discussed' as const })),
      ...discussedHubLinks(ec, ee, et),
    ];

    return { nodes, links };
  }),
});
