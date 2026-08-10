import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';
import { router, protectedProcedure } from '../trpc';
import {
  formatImportSource,
  importContactDraftSchema,
  importSourceKindSchema,
  type ImportContactDraft,
} from '@/lib/imports';

const MAX_BATCH = 1000;

/**
 * Contact imports — LinkedIn CSV / vCard upsert into private person entities.
 * Always userId-scoped; never reads another user's graph.
 */
export const importsRouter = router({
  upsertBatch: protectedProcedure
    .input(
      z.object({
        kind: importSourceKindSchema,
        batchId: z.string().min(8).max(64).optional(),
        contacts: z.array(importContactDraftSchema).min(1).max(MAX_BATCH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const batchId =
        input.batchId ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const importSource = formatImportSource(input.kind, batchId);

      let created = 0;
      let matched = 0;
      const entityIds: string[] = [];

      const owned = await ctx.db.query.entities.findMany({
        where: and(
          eq(schema.entities.ownerUserId, ctx.user.id),
          isNull(schema.entities.deletedAt),
        ),
        columns: { id: true, name: true },
      });
      const byName = new Map<string, string>();
      for (const e of owned) {
        byName.set(e.name.trim().toLowerCase(), e.id);
      }

      const ownedIds = owned.map((e) => e.id);
      const factRows =
        ownedIds.length > 0
          ? await ctx.db.query.entityFacts.findMany({
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

      const registerIdentifiers = (entityId: string, contact: ImportContactDraft) => {
        byName.set(contact.name.trim().toLowerCase(), entityId);
        if (contact.email) byEmail.set(contact.email.trim().toLowerCase(), entityId);
        if (contact.linkedinUrl) {
          byLinkedIn.set(contact.linkedinUrl.trim().toLowerCase(), entityId);
        }
      };

      for (const contact of input.contacts) {
        const resolved = resolveMatch(contact, { byEmail, byLinkedIn, byName });
        if (resolved) {
          await mergeFacts(ctx.db, resolved, contact);
          await ctx.db
            .update(schema.entities)
            .set({ updatedAt: new Date() })
            .where(
              and(
                eq(schema.entities.id, resolved),
                eq(schema.entities.ownerUserId, ctx.user.id),
              ),
            );
          registerIdentifiers(resolved, contact);
          matched++;
          entityIds.push(resolved);
          continue;
        }

        const [inserted] = await ctx.db
          .insert(schema.entities)
          .values({
            ownerUserId: ctx.user.id,
            kind: 'person',
            name: contact.name.trim(),
            aliases: [],
            importSource,
          })
          .returning({ id: schema.entities.id });
        if (!inserted) {
          throw new Error('failed to insert imported contact');
        }
        await mergeFacts(ctx.db, inserted.id, contact);
        registerIdentifiers(inserted.id, contact);
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
});

function resolveMatch(
  contact: ImportContactDraft,
  indexes: {
    byEmail: Map<string, string>;
    byLinkedIn: Map<string, string>;
    byName: Map<string, string>;
  },
): string | null {
  if (contact.email) {
    const id = indexes.byEmail.get(contact.email.trim().toLowerCase());
    if (id) return id;
  }
  if (contact.linkedinUrl) {
    const id = indexes.byLinkedIn.get(contact.linkedinUrl.trim().toLowerCase());
    if (id) return id;
  }
  return indexes.byName.get(contact.name.trim().toLowerCase()) ?? null;
}

async function mergeFacts(db: DB, entityId: string, contact: ImportContactDraft) {
  const existing = await db.query.entityFacts.findMany({
    where: eq(schema.entityFacts.entityId, entityId),
    columns: { key: true, value: true },
  });
  const have = new Set(existing.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`));

  const candidates: Array<{ key: string; value: string }> = [];
  if (contact.email) candidates.push({ key: 'email', value: contact.email.trim() });
  if (contact.linkedinUrl) {
    candidates.push({ key: 'linkedin', value: contact.linkedinUrl.trim() });
  }
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
