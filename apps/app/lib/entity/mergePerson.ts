import { and, eq } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { canonicalizeLinkedin } from '@wingmic/extractor/linkedin';

export type EntityMergeMoves = {
  facts: string[];
  companies: string[];
  events: string[];
  topics: string[];
  acts: string[];
  aliasAdded: string | null;
};

const UNDO_MS = 30_000;

function factValuesEqual(key: string, a: string, b: string): boolean {
  if (key === 'email') return a.trim().toLowerCase() === b.trim().toLowerCase();
  if (key === 'linkedin') {
    const ca = canonicalizeLinkedin(a);
    const cb = canonicalizeLinkedin(b);
    return ca !== null && ca === cb;
  }
  return a === b;
}

export async function mergePersonEntities(
  db: DB,
  userId: string,
  sourceId: string,
  targetId: string,
): Promise<{ mergeId: string; sourceName: string }> {
  return db.transaction(async (tx) => {
    const writeDb = tx as unknown as DB;
    const [source, target] = await Promise.all([
      writeDb.query.entities.findFirst({
        where: and(
          eq(schema.entities.id, sourceId),
          eq(schema.entities.ownerUserId, userId),
          eq(schema.entities.kind, 'person'),
        ),
      }),
      writeDb.query.entities.findFirst({
        where: and(
          eq(schema.entities.id, targetId),
          eq(schema.entities.ownerUserId, userId),
          eq(schema.entities.kind, 'person'),
        ),
      }),
    ]);

    if (!source || !target || source.deletedAt || target.deletedAt || sourceId === targetId) {
      throw new Error('MERGE_NOT_ALLOWED');
    }

    const moves: EntityMergeMoves = {
      facts: [],
      companies: [],
      events: [],
      topics: [],
      acts: [],
      aliasAdded: null,
    };

    const targetFacts = await writeDb.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, targetId),
    });

    const sourceFacts = await writeDb.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, sourceId),
    });
    for (const row of sourceFacts) {
      const dup = targetFacts.some((f) => factValuesEqual(row.key, f.value, row.value));
      if (dup) continue;
      await writeDb
        .update(schema.entityFacts)
        .set({ entityId: targetId })
        .where(eq(schema.entityFacts.id, row.id));
      moves.facts.push(row.id);
    }

    const targetEc = await writeDb.query.entityCompanies.findMany({
      where: eq(schema.entityCompanies.entityId, targetId),
    });
    const sourceEc = await writeDb.query.entityCompanies.findMany({
      where: eq(schema.entityCompanies.entityId, sourceId),
    });
    for (const row of sourceEc) {
      const dup = targetEc.find((e) => e.companyId === row.companyId);
      if (dup) {
        if (row.role && !dup.role) {
          await writeDb
            .update(schema.entityCompanies)
            .set({ role: row.role })
            .where(eq(schema.entityCompanies.id, dup.id));
        }
        continue;
      }
      await writeDb
        .update(schema.entityCompanies)
        .set({ entityId: targetId })
        .where(eq(schema.entityCompanies.id, row.id));
      moves.companies.push(row.id);
    }

    const targetEe = await writeDb.query.entityEvents.findMany({
      where: eq(schema.entityEvents.entityId, targetId),
    });
    const sourceEe = await writeDb.query.entityEvents.findMany({
      where: eq(schema.entityEvents.entityId, sourceId),
    });
    for (const row of sourceEe) {
      if (targetEe.some((e) => e.eventId === row.eventId)) continue;
      await writeDb
        .update(schema.entityEvents)
        .set({ entityId: targetId })
        .where(eq(schema.entityEvents.id, row.id));
      moves.events.push(row.id);
    }

    const targetEt = await writeDb.query.entityTopics.findMany({
      where: eq(schema.entityTopics.entityId, targetId),
    });
    const sourceEt = await writeDb.query.entityTopics.findMany({
      where: eq(schema.entityTopics.entityId, sourceId),
    });
    for (const row of sourceEt) {
      if (targetEt.some((e) => e.topicId === row.topicId)) continue;
      await writeDb
        .update(schema.entityTopics)
        .set({ entityId: targetId })
        .where(eq(schema.entityTopics.id, row.id));
      moves.topics.push(row.id);
    }

    const sourceActs = await writeDb.query.acts.findMany({
      where: eq(schema.acts.targetEntityId, sourceId),
    });
    for (const row of sourceActs) {
      await writeDb
        .update(schema.acts)
        .set({ targetEntityId: targetId, updatedAt: new Date() })
        .where(eq(schema.acts.id, row.id));
      moves.acts.push(row.id);
    }

    const aliases = target.aliases ?? [];
    if (!aliases.includes(source.name)) {
      await writeDb
        .update(schema.entities)
        .set({ aliases: [...aliases, source.name], updatedAt: new Date() })
        .where(eq(schema.entities.id, targetId));
      moves.aliasAdded = source.name;
    }

    const inserted = await writeDb
      .insert(schema.entityMerges)
      .values({
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        mergedByUserId: userId,
        moves: JSON.stringify(moves),
      })
      .returning({ id: schema.entityMerges.id });

    await writeDb
      .update(schema.entities)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.entities.id, sourceId));

    return { mergeId: inserted[0]!.id, sourceName: source.name };
  });
}

export async function undoPersonMerge(
  db: DB,
  userId: string,
  mergeId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const writeDb = tx as unknown as DB;
    const merge = await writeDb.query.entityMerges.findFirst({
      where: eq(schema.entityMerges.id, mergeId),
    });
    if (!merge || merge.mergedByUserId !== userId || merge.reversedAt) {
      throw new Error('MERGE_NOT_FOUND');
    }
    const mergedAt = merge.mergedAt instanceof Date ? merge.mergedAt : new Date(merge.mergedAt!);
    if (Date.now() - mergedAt.getTime() > UNDO_MS) {
      throw new Error('MERGE_UNDO_EXPIRED');
    }

    const moves = {
      facts: [] as string[],
      companies: [] as string[],
      events: [] as string[],
      topics: [] as string[],
      acts: [] as string[],
      aliasAdded: null as string | null,
      ...(JSON.parse(merge.moves ?? '{}') as Partial<EntityMergeMoves>),
    };
    const sourceId = merge.sourceEntityId;
    const targetId = merge.targetEntityId;

    for (const id of moves.facts) {
      await writeDb
        .update(schema.entityFacts)
        .set({ entityId: sourceId })
        .where(eq(schema.entityFacts.id, id));
    }
    for (const id of moves.companies) {
      await writeDb
        .update(schema.entityCompanies)
        .set({ entityId: sourceId })
        .where(eq(schema.entityCompanies.id, id));
    }
    for (const id of moves.events) {
      await writeDb
        .update(schema.entityEvents)
        .set({ entityId: sourceId })
        .where(eq(schema.entityEvents.id, id));
    }
    for (const id of moves.topics) {
      await writeDb
        .update(schema.entityTopics)
        .set({ entityId: sourceId })
        .where(eq(schema.entityTopics.id, id));
    }
    for (const id of moves.acts) {
      await writeDb
        .update(schema.acts)
        .set({ targetEntityId: sourceId, updatedAt: new Date() })
        .where(eq(schema.acts.id, id));
    }

    if (moves.aliasAdded) {
      const target = await writeDb.query.entities.findFirst({
        where: eq(schema.entities.id, targetId),
      });
      if (target) {
        const nextAliases = (target.aliases ?? []).filter((a) => a !== moves.aliasAdded);
        await writeDb
          .update(schema.entities)
          .set({ aliases: nextAliases, updatedAt: new Date() })
          .where(eq(schema.entities.id, targetId));
      }
    }

    await writeDb
      .update(schema.entities)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(schema.entities.id, sourceId));

    await writeDb
      .update(schema.entityMerges)
      .set({ reversedAt: new Date() })
      .where(eq(schema.entityMerges.id, mergeId));
  });
}
