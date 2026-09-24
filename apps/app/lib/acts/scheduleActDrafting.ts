/**
 * Deferred acts drafting — spec D2 (art_T0S63rV8).
 *
 * capture.commit inserts act rows in a 'drafting' placeholder state and
 * queues the per-action polishDraft LLM work here, off the request path —
 * the same fire-and-forget shape scheduleEnrich uses. Unlike scheduleEnrich,
 * failures are never swallowed: a failed run marks the affected rows
 * 'failed' so /acts can surface an honest draft-failed + retry state.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';
import { polishDraft, type DraftOutput } from '@/lib/acts/draftAgent';
import {
  chooseActChannel,
  hasUsableIdentityValue,
  intentForChannel,
} from '@/lib/acts/chooseActChannel';
import { linkedinProfileHref } from '@/lib/acts/linkedinHref';

/** Minimal act row shape the redraft path needs (subset of acts.$inferSelect). */
export type RedraftableAct = Pick<
  typeof schema.acts.$inferSelect,
  'id' | 'kind' | 'body' | 'targetEntityId' | 'secondaryEntityId' | 'sourceInteractionId'
>;

/**
 * Rebuild the polishDraft input from a stored act row and run it.
 *
 * The row's body doubles as the extractor seed while drafting, so a retry
 * reuses exactly the data capture committed — no draft-input column needed.
 * Channel derives from the target's entity facts, same as acts.createDraft;
 * contextName is not persisted so retry polishes without it.
 */
export async function redraftActRow(
  db: DB,
  userId: string,
  row: RedraftableAct,
  transcript: string | null,
): Promise<DraftOutput> {
  const nameIds = [row.targetEntityId, row.secondaryEntityId].filter(
    (id): id is string => Boolean(id),
  );
  const named = nameIds.length
    ? await db.query.entities.findMany({
        where: and(
          inArray(schema.entities.id, nameIds),
          eq(schema.entities.ownerUserId, userId),
          isNull(schema.entities.deletedAt),
        ),
        columns: { id: true, name: true },
      })
    : [];
  const nameById = new Map(named.map((e) => [e.id, e.name]));

  let hasEmail = false;
  let hasLinkedin = false;
  if (row.targetEntityId) {
    const facts = await db.query.entityFacts.findMany({
      where: and(
        inArray(schema.entityFacts.entityId, [row.targetEntityId]),
        inArray(schema.entityFacts.key, ['email', 'linkedin']),
      ),
      columns: { key: true, value: true },
    });
    hasEmail = facts.some((f) => f.key === 'email' && hasUsableIdentityValue(f.value));
    hasLinkedin = facts.some((f) => f.key === 'linkedin' && Boolean(linkedinProfileHref(f.value)));
  }

  const channel = chooseActChannel({ kind: row.kind, hasEmail, hasLinkedin });
  return polishDraft({
    kind: row.kind,
    intent: intentForChannel(channel),
    channel,
    targetName: row.targetEntityId ? (nameById.get(row.targetEntityId) ?? null) : null,
    secondaryName: row.secondaryEntityId ? (nameById.get(row.secondaryEntityId) ?? null) : null,
    contextName: null,
    seedBody: row.body,
    transcript,
  });
}

async function markActFailed(db: DB, actId: string): Promise<void> {
  await db
    .update(schema.acts)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(eq(schema.acts.id, actId));
}

/**
 * Draft every still-'drafting' act row for one interaction. Per-row failure
 * marks that row 'failed' and lets siblings finish; errors that escape the
 * loop propagate to scheduleActDrafting's catch, which fails the rest.
 */
export async function draftActsForInteraction(args: {
  db: DB;
  userId: string;
  interactionId: string;
  transcript: string;
}): Promise<void> {
  const rows = await args.db.query.acts.findMany({
    where: and(
      eq(schema.acts.userId, args.userId),
      eq(schema.acts.sourceInteractionId, args.interactionId),
      eq(schema.acts.status, 'drafting'),
    ),
  });
  for (const row of rows) {
    try {
      const polished = await redraftActRow(args.db, args.userId, row, args.transcript);
      await args.db
        .update(schema.acts)
        .set({
          status: 'drafted',
          body: polished.body,
          subject: polished.subject,
          updatedAt: new Date(),
        })
        .where(eq(schema.acts.id, row.id));
    } catch (err) {
      console.error('[acts] background draft failed — marking row failed', {
        actId: row.id,
        err,
      });
      await markActFailed(args.db, row.id);
    }
  }
}

/** Failure marker of last resort — fails every still-'drafting' row of the interaction. */
export async function markInteractionActsFailed(args: {
  db: DB;
  userId: string;
  interactionId: string;
}): Promise<void> {
  await args.db
    .update(schema.acts)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(
      and(
        eq(schema.acts.userId, args.userId),
        eq(schema.acts.sourceInteractionId, args.interactionId),
        eq(schema.acts.status, 'drafting'),
      ),
    );
}

/**
 * Fire-and-forget hook for capture.commit — must not be awaited. Mirrors
 * scheduleEnrich, but a failed run marks the affected rows 'failed' instead
 * of disappearing: the inbox renders the failure with a retry.
 */
export function scheduleActDrafting(args: {
  db: DB;
  userId: string;
  interactionId: string;
  transcript: string;
}): void {
  void draftActsForInteraction(args).catch((err) => {
    console.error('[acts] background drafting failed — marking rows failed', {
      interactionId: args.interactionId,
      err,
    });
    void markInteractionActsFailed(args).catch((markErr) => {
      console.error('[acts] could not mark acts failed', {
        interactionId: args.interactionId,
        markErr,
      });
    });
  });
}
