import { and, eq, isNull } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';

/** Merge a mistaken import duplicate into the user-chosen person; soft-delete the duplicate. */
export async function mergeImportedDuplicate(
  db: DB,
  userId: string,
  opts: { createdEntityId: string; targetEntityId: string },
): Promise<{ merged: true }> {
  const { createdEntityId, targetEntityId } = opts;
  if (createdEntityId === targetEntityId) {
    throw new Error('cannot merge an entity into itself');
  }

  const [created, target] = await Promise.all([
    db.query.entities.findFirst({
      where: and(
        eq(schema.entities.id, createdEntityId),
        eq(schema.entities.ownerUserId, userId),
        isNull(schema.entities.deletedAt),
      ),
      columns: { id: true, importSource: true },
    }),
    db.query.entities.findFirst({
      where: and(
        eq(schema.entities.id, targetEntityId),
        eq(schema.entities.ownerUserId, userId),
        isNull(schema.entities.deletedAt),
      ),
      columns: { id: true },
    }),
  ]);

  if (!created?.importSource) {
    throw new Error('source is not an import-created row');
  }
  if (!target) {
    throw new Error('target entity not found');
  }

  const facts = await db.query.entityFacts.findMany({
    where: eq(schema.entityFacts.entityId, createdEntityId),
    columns: { key: true, value: true, confidence: true },
  });

  if (facts.length > 0) {
    const existing = await db.query.entityFacts.findMany({
      where: eq(schema.entityFacts.entityId, targetEntityId),
      columns: { key: true, value: true },
    });
    const have = new Set(existing.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`));
    const toInsert = facts.filter(
      (f) => !have.has(`${f.key}:${f.value.trim().toLowerCase()}`),
    );
    if (toInsert.length > 0) {
      await db.insert(schema.entityFacts).values(
        toInsert.map((f) => ({
          entityId: targetEntityId,
          key: f.key,
          value: f.value,
          confidence: f.confidence,
        })),
      );
    }
  }

  const now = new Date();
  await db
    .update(schema.entities)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(schema.entities.id, createdEntityId),
        eq(schema.entities.ownerUserId, userId),
      ),
    );

  await db
    .update(schema.entities)
    .set({ updatedAt: now })
    .where(and(eq(schema.entities.id, targetEntityId), eq(schema.entities.ownerUserId, userId)));

  return { merged: true };
}
