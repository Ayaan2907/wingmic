/**
 * Rebuild GraphResult-shaped payloads for prefetched chat history.
 * Joins facts / topics / acts by sourceInteractionId so AgentReply
 * survives refresh (Stream A).
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import type { GraphResult } from '@/app/chat/_components/types';

export type HydratedThreadItem = {
  id: string;
  transcript: string;
  capturedAt: string;
  graphResult: GraphResult;
};

type InteractionRow = {
  id: string;
  transcript: string | null;
  capturedAt: Date | number;
};

export async function hydrateThreadItems(
  db: DB,
  userId: string,
  rows: InteractionRow[],
): Promise<HydratedThreadItem[]> {
  if (rows.length === 0) return [];

  const interactionIds = rows.map((r) => r.id);

  const [factRows, topicEdgeRows, actRows, attachmentRows] = await Promise.all([
    db
      .select({
        interactionId: schema.entityFacts.sourceInteractionId,
        entityId: schema.entityFacts.entityId,
        key: schema.entityFacts.key,
        value: schema.entityFacts.value,
      })
      .from(schema.entityFacts)
      .where(inArray(schema.entityFacts.sourceInteractionId, interactionIds)),
    db
      .select({
        interactionId: schema.entityTopics.sourceInteractionId,
        entityId: schema.entityTopics.entityId,
        topicId: schema.entityTopics.topicId,
      })
      .from(schema.entityTopics)
      .where(
        and(
          inArray(schema.entityTopics.sourceInteractionId, interactionIds),
          eq(schema.entityTopics.sourceDeleted, false),
        ),
      ),
    db
      .select({
        interactionId: schema.acts.sourceInteractionId,
        kind: schema.acts.kind,
        body: schema.acts.body,
        whenHint: schema.acts.whenHint,
        targetEntityId: schema.acts.targetEntityId,
      })
      .from(schema.acts)
      .where(
        and(
          eq(schema.acts.userId, userId),
          inArray(schema.acts.sourceInteractionId, interactionIds),
        ),
      ),
    db
      .select({
        interactionId: schema.interactionAttachments.interactionId,
        id: schema.interactionAttachments.id,
        entityId: schema.interactionAttachments.entityId,
        jpegBase64: schema.interactionAttachments.jpegBase64,
      })
      .from(schema.interactionAttachments)
      .where(inArray(schema.interactionAttachments.interactionId, interactionIds)),
  ]);

  const entityIds = [
    ...new Set([
      ...factRows.map((f) => f.entityId),
      ...topicEdgeRows.map((t) => t.entityId),
      ...actRows.map((a) => a.targetEntityId).filter((id): id is string => Boolean(id)),
    ]),
  ];

  const entities =
    entityIds.length > 0
      ? await db.query.entities.findMany({
          where: and(
            eq(schema.entities.ownerUserId, userId),
            isNull(schema.entities.deletedAt),
            inArray(schema.entities.id, entityIds),
          ),
        })
      : [];
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const companyEdges =
    entityIds.length > 0
      ? await db.query.entityCompanies.findMany({
          where: and(
            inArray(schema.entityCompanies.entityId, entityIds),
            eq(schema.entityCompanies.sourceDeleted, false),
          ),
        })
      : [];
  const eventEdges =
    entityIds.length > 0
      ? await db.query.entityEvents.findMany({
          where: and(
            inArray(schema.entityEvents.entityId, entityIds),
            eq(schema.entityEvents.sourceDeleted, false),
          ),
        })
      : [];

  const companyIds = [...new Set(companyEdges.map((e) => e.companyId))];
  const eventIds = [...new Set(eventEdges.map((e) => e.eventId))];
  const topicIds = [...new Set(topicEdgeRows.map((t) => t.topicId))];

  const [companies, events, topics] = await Promise.all([
    companyIds.length
      ? db.query.companies.findMany({ where: inArray(schema.companies.id, companyIds) })
      : Promise.resolve([]),
    eventIds.length
      ? db.query.events.findMany({ where: inArray(schema.events.id, eventIds) })
      : Promise.resolve([]),
    topicIds.length
      ? db.query.topics.findMany({ where: inArray(schema.topics.id, topicIds) })
      : Promise.resolve([]),
  ]);
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const topicById = new Map(topics.map((t) => [t.id, t]));

  const factsByIx = groupBy(factRows, (f) => f.interactionId);
  const topicsByIx = groupBy(topicEdgeRows, (t) => t.interactionId);
  const actsByIx = groupBy(actRows, (a) => a.interactionId);

  return rows.map((row) => {
    const facts = factsByIx.get(row.id) ?? [];
    const topicEdges = topicsByIx.get(row.id) ?? [];
    const acts = actsByIx.get(row.id) ?? [];

    const personIdOrder: string[] = [];
    const seenPerson = new Set<string>();
    for (const f of facts) {
      if (!entityById.has(f.entityId) || seenPerson.has(f.entityId)) continue;
      seenPerson.add(f.entityId);
      personIdOrder.push(f.entityId);
    }
    for (const t of topicEdges) {
      if (!entityById.has(t.entityId) || seenPerson.has(t.entityId)) continue;
      seenPerson.add(t.entityId);
      personIdOrder.push(t.entityId);
    }

    const roleByEntity = new Map<string, string | null>();
    const companyHintByEntity = new Map<string, string | null>();
    const linkedinByEntity = new Map<string, string | null>();
    for (const f of facts) {
      if (f.key === 'role' && !roleByEntity.has(f.entityId)) roleByEntity.set(f.entityId, f.value);
      if (f.key === 'linkedin' && !linkedinByEntity.has(f.entityId)) {
        linkedinByEntity.set(f.entityId, f.value);
      }
      if (f.key === 'company' && !companyHintByEntity.has(f.entityId)) {
        companyHintByEntity.set(f.entityId, f.value);
      }
    }

    const topicsByEntity = new Map<string, string[]>();
    const allTopicNames = new Set<string>();
    for (const t of topicEdges) {
      const name = topicById.get(t.topicId)?.name;
      if (!name) continue;
      allTopicNames.add(name);
      const list = topicsByEntity.get(t.entityId) ?? [];
      list.push(name);
      topicsByEntity.set(t.entityId, list);
    }

    const persons = personIdOrder.map((id) => {
      const ent = entityById.get(id)!;
      const companyEdge = companyEdges.find((e) => e.entityId === id);
      const companyName = companyEdge
        ? (companyById.get(companyEdge.companyId)?.name ?? null)
        : (companyHintByEntity.get(id) ?? null);
      return {
        name: ent.name,
        role: roleByEntity.get(id) ?? companyEdge?.role ?? null,
        companyHint: companyName,
        topics: topicsByEntity.get(id) ?? [],
        linkedin: linkedinByEntity.get(id) ?? null,
      };
    });

    const companyIdOrder: string[] = [];
    const seenCo = new Set<string>();
    for (const pid of personIdOrder) {
      for (const e of companyEdges) {
        if (e.entityId !== pid || seenCo.has(e.companyId)) continue;
        if (!companyById.has(e.companyId)) continue;
        seenCo.add(e.companyId);
        companyIdOrder.push(e.companyId);
      }
    }

    const eventIdOrder: string[] = [];
    const seenEv = new Set<string>();
    for (const pid of personIdOrder) {
      for (const e of eventEdges) {
        if (e.entityId !== pid || seenEv.has(e.eventId)) continue;
        if (!eventById.has(e.eventId)) continue;
        seenEv.add(e.eventId);
        eventIdOrder.push(e.eventId);
      }
    }

    const attachments = attachmentRows
      .filter((a) => a.interactionId === row.id)
      .map((a) => ({
        id: a.id,
        entityId: a.entityId,
        jpegBase64: a.jpegBase64,
      }));

    const graphResult: GraphResult = {
      extracted: {
        persons,
        companies: companyIdOrder.map((id) => ({ name: companyById.get(id)!.name })),
        events: eventIdOrder.map((id) => ({ name: eventById.get(id)!.name })),
        topics: [...allTopicNames],
        actions: acts.map((a) => ({
          kind: a.kind,
          body: a.body,
          whenHint: a.whenHint,
          targetPersonName: a.targetEntityId
            ? (entityById.get(a.targetEntityId)?.name ?? null)
            : null,
        })),
      },
      newEntities: persons.length,
      matchedEntities: 0,
      interactionId: row.id,
      entityIds: personIdOrder,
      companyIds: companyIdOrder,
      eventIds: eventIdOrder,
      attachments,
    };

    const capturedAt =
      row.capturedAt instanceof Date
        ? row.capturedAt
        : new Date(row.capturedAt as unknown as number);

    return {
      id: row.id,
      transcript: row.transcript ?? '',
      capturedAt: capturedAt.toISOString(),
      graphResult,
    };
  });
}

function groupBy<T>(rows: T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return map;
}
