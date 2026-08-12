import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';
import { router, protectedProcedure } from '../trpc';
import {
  IMPORT_MAX_BATCH,
  formatImportSource,
  importContactDraftSchema,
  importSourceKindSchema,
  resolveMatch,
  registerIdentifiers,
  filterSafeIdentifierFacts,
  type ImportContactDraft,
  type MatchIndexes,
} from '@/lib/imports';

const resolutionSchema = z.object({
  /** Index into `contacts`. */
  index: z.number().int().nonnegative(),
  /** Explicit entity id, or `null` to force create. */
  entityId: z.string().min(1).nullable(),
});

/**
 * Contact imports — LinkedIn CSV / vCard upsert into private person entities.
 * Always userId-scoped; never reads another user's graph.
 */
export const importsRouter = router({
  /**
   * Dry-run match for a batch so the UI can surface ambiguous email/LinkedIn/name
   * collisions and let the user pick a target (or create new).
   */
  previewBatch: protectedProcedure
    .input(
      z.object({
        contacts: z.array(importContactDraftSchema).min(1).max(IMPORT_MAX_BATCH),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { indexes, nameById } = await loadMatchIndexesWithNames(ctx.db, ctx.user.id);

      const rows = input.contacts.map((contact, index) => {
        const match = resolveMatch(contact, indexes);
        if (match.kind === 'none') {
          return {
            index,
            status: 'new' as const,
            contactName: contact.name,
            entityId: null as string | null,
            candidates: [] as Array<{
              entityId: string;
              name: string;
              reasons: Array<'email' | 'linkedin' | 'name'>;
            }>,
          };
        }
        if (match.kind === 'match') {
          return {
            index,
            status: 'match' as const,
            contactName: contact.name,
            entityId: match.entityId,
            candidates: [
              {
                entityId: match.entityId,
                name: nameById.get(match.entityId) ?? 'unknown',
                reasons: match.reasons,
              },
            ],
          };
        }
        return {
          index,
          status: 'ambiguous' as const,
          contactName: contact.name,
          entityId: null as string | null,
          candidates: match.candidates.map((c) => ({
            entityId: c.entityId,
            name: nameById.get(c.entityId) ?? 'unknown',
            reasons: c.reasons,
          })),
        };
      });

      return {
        rows,
        ambiguousCount: rows.filter((r) => r.status === 'ambiguous').length,
        matchCount: rows.filter((r) => r.status === 'match').length,
        newCount: rows.filter((r) => r.status === 'new').length,
      };
    }),

  upsertBatch: protectedProcedure
    .input(
      z.object({
        kind: importSourceKindSchema,
        batchId: z.string().min(8).max(64).optional(),
        contacts: z.array(importContactDraftSchema).min(1).max(IMPORT_MAX_BATCH),
        /** User choices for ambiguous (or overridden) rows. */
        resolutions: z.array(resolutionSchema).max(IMPORT_MAX_BATCH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const batchId =
        input.batchId ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const importSource = formatImportSource(input.kind, batchId);

      const resolutionByIndex = new Map<number, string | null>();
      for (const r of input.resolutions ?? []) {
        if (r.index >= input.contacts.length) {
          throw new Error('resolution index out of range');
        }
        resolutionByIndex.set(r.index, r.entityId);
      }

      let created = 0;
      let matched = 0;
      const entityIds: string[] = [];

      const indexes = await loadMatchIndexes(ctx.db, ctx.user.id);
      const ownedIds = new Set(
        [...indexes.byName.values(), ...indexes.byEmail.values(), ...indexes.byLinkedIn.values()],
      );

      for (let i = 0; i < input.contacts.length; i++) {
        const contact = input.contacts[i]!;
        const override = resolutionByIndex.get(i);
        const match = resolveMatch(contact, indexes);

        let targetId: string | null = null;
        let forceCreate = false;

        if (override !== undefined) {
          if (override === null) {
            forceCreate = true;
          } else {
            if (!ownedIds.has(override)) {
              // Verify ownership against DB in case indexes missed a person with no facts yet.
              const owned = await ctx.db.query.entities.findFirst({
                where: and(
                  eq(schema.entities.id, override),
                  eq(schema.entities.ownerUserId, ctx.user.id),
                  isNull(schema.entities.deletedAt),
                ),
                columns: { id: true },
              });
              if (!owned) throw new Error('resolution targets an entity you do not own');
              ownedIds.add(owned.id);
            }
            targetId = override;
          }
        } else if (match.kind === 'match') {
          targetId = match.entityId;
        } else if (match.kind === 'ambiguous') {
          // Without an explicit choice, create new rather than guessing wrong.
          forceCreate = true;
        }

        if (targetId && !forceCreate) {
          await mergeFacts(ctx.db, indexes, targetId, contact);
          await ctx.db
            .update(schema.entities)
            .set({ updatedAt: new Date() })
            .where(
              and(
                eq(schema.entities.id, targetId),
                eq(schema.entities.ownerUserId, ctx.user.id),
              ),
            );
          registerIdentifiers(indexes, targetId, contact);
          matched++;
          entityIds.push(targetId);
          continue;
        }

        const [inserted] = await ctx.db
          .insert(schema.entities)
          .values({
            ownerUserId: ctx.user.id,
            kind: 'person',
            name: contact.name.trim(),
            aliases: [
              ...(contact.company ? [contact.company.trim()] : []),
              ...(contact.role ? [contact.role.trim()] : []),
            ].filter(Boolean),
            importSource,
          })
          .returning({ id: schema.entities.id });
        if (!inserted) {
          throw new Error('failed to insert imported contact');
        }
        ownedIds.add(inserted.id);
        await mergeFacts(ctx.db, indexes, inserted.id, contact);
        registerIdentifiers(indexes, inserted.id, contact);
        created++;
        entityIds.push(inserted.id);
      }

      return {
        batchId,
        importSource,
        created,
        matched,
        total: input.contacts.length,
        entityIds,
      };
    }),

  /**
   * Soft-delete every entity created in a batch (`importSource = kind:batchId`).
   * Matched (pre-existing) people are left alone — they never received that stamp.
   */
  undoBatch: protectedProcedure
    .input(
      z.object({
        kind: importSourceKindSchema,
        batchId: z.string().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const importSource = formatImportSource(input.kind, input.batchId);
      const now = new Date();
      const removed = await ctx.db
        .update(schema.entities)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(schema.entities.ownerUserId, ctx.user.id),
            eq(schema.entities.importSource, importSource),
            isNull(schema.entities.deletedAt),
          ),
        )
        .returning({ id: schema.entities.id });
      return { removed: removed.length, importSource };
    }),
});

async function loadMatchIndexes(db: DB, userId: string): Promise<MatchIndexes> {
  const { indexes } = await loadMatchIndexesWithNames(db, userId);
  return indexes;
}

async function loadMatchIndexesWithNames(
  db: DB,
  userId: string,
): Promise<{ indexes: MatchIndexes; nameById: Map<string, string> }> {
  const owned = await db.query.entities.findMany({
    where: and(eq(schema.entities.ownerUserId, userId), isNull(schema.entities.deletedAt)),
    columns: { id: true, name: true },
  });
  const byName = new Map<string, string>();
  const nameById = new Map<string, string>();
  for (const e of owned) {
    byName.set(e.name.trim().toLowerCase(), e.id);
    nameById.set(e.id, e.name);
  }

  const ownedIds = owned.map((e) => e.id);
  const factRows =
    ownedIds.length > 0
      ? await db.query.entityFacts.findMany({
          where: and(
            inArray(schema.entityFacts.entityId, ownedIds),
            inArray(schema.entityFacts.key, ['email', 'linkedin']),
          ),
          columns: { entityId: true, key: true, value: true },
        })
      : [];
  const byEmail = new Map<string, string>();
  const byLinkedIn = new Map<string, string>();
  for (const f of factRows) {
    const v = f.value.trim().toLowerCase();
    if (f.key === 'email' && !byEmail.has(v)) byEmail.set(v, f.entityId);
    if (f.key === 'linkedin' && !byLinkedIn.has(v)) byLinkedIn.set(v, f.entityId);
  }
  return { indexes: { byEmail, byLinkedIn, byName }, nameById };
}

async function mergeFacts(
  db: DB,
  indexes: MatchIndexes,
  entityId: string,
  contact: ImportContactDraft,
) {
  const existing = await db.query.entityFacts.findMany({
    where: eq(schema.entityFacts.entityId, entityId),
    columns: { key: true, value: true },
  });
  const have = new Set(existing.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`));

  const candidates: Array<{ key: string; value: string }> = [
    ...filterSafeIdentifierFacts(indexes, entityId, contact),
  ];
  if (contact.company) candidates.push({ key: 'company', value: contact.company.trim() });
  if (contact.role) candidates.push({ key: 'role', value: contact.role.trim() });
  if (contact.phone) candidates.push({ key: 'phone', value: contact.phone.trim() });
  if (contact.notes) candidates.push({ key: 'notes', value: contact.notes.trim() });

  const toInsert = candidates.filter(
    (c) => !have.has(`${c.key}:${c.value.toLowerCase()}`),
  );
  if (toInsert.length === 0) return;

  await db.insert(schema.entityFacts).values(
    toInsert.map((c) => ({
      entityId,
      key: c.key,
      value: c.value,
      confidence: 90,
    })),
  );
}
