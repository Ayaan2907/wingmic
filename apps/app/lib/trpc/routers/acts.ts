import { z } from 'zod';
import { and, desc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import { router, protectedProcedure } from '../trpc';
import { toPendingAct } from '@/lib/acts/mapAction';
import { polishDraft, type DraftIntent } from '@/lib/acts/draftAgent';

const actKindSchema = z.enum(['reminder', 'email', 'meeting', 'todo', 'intro']);
const draftIntentSchema = z.enum([
  'check-in',
  'follow-up',
  'intro',
  'recap',
  'warm-path',
  'reminder',
]);

/**
 * Acts — permission-first draft follow-ups from capture extraction +
 * entity CTAs. Mastra polishes createDraft bodies when OpenRouter is set.
 */
export const actsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['drafted', 'snoozed', 'sent', 'dismissed']).optional(),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .default({ limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      // Default inbox: drafted + snoozed that are due (runAt null or <= now).
      // Explicit status=snoozed still returns all snoozed (including future).
      const where =
        input.status === 'snoozed'
          ? and(eq(schema.acts.userId, ctx.user.id), eq(schema.acts.status, 'snoozed'))
          : input.status
            ? and(eq(schema.acts.userId, ctx.user.id), eq(schema.acts.status, input.status))
            : and(
                eq(schema.acts.userId, ctx.user.id),
                or(
                  eq(schema.acts.status, 'drafted'),
                  and(
                    eq(schema.acts.status, 'snoozed'),
                    or(isNull(schema.acts.runAt), lte(schema.acts.runAt, now)),
                  ),
                ),
              );

      const rows = await ctx.db.query.acts.findMany({
        where,
        orderBy: [desc(schema.acts.createdAt)],
        limit: input.limit,
      });

      const entityIds = [
        ...new Set(
          rows
            .flatMap((r) => [r.targetEntityId, r.secondaryEntityId])
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const entities =
        entityIds.length > 0
          ? await ctx.db.query.entities.findMany({
              where: and(
                inArray(schema.entities.id, entityIds),
                eq(schema.entities.ownerUserId, ctx.user.id),
                isNull(schema.entities.deletedAt),
              ),
              columns: { id: true, name: true },
            })
          : [];
      const nameById = new Map(entities.map((e) => [e.id, e.name]));

      const emailFacts =
        entityIds.length > 0
          ? await ctx.db.query.entityFacts.findMany({
              where: and(
                inArray(schema.entityFacts.entityId, entityIds),
                eq(schema.entityFacts.key, 'email'),
              ),
              columns: { entityId: true, value: true },
              orderBy: [desc(schema.entityFacts.confidence)],
            })
          : [];
      const emailByEntityId = new Map<string, string>();
      for (const fact of emailFacts) {
        if (!emailByEntityId.has(fact.entityId)) {
          emailByEntityId.set(fact.entityId, fact.value);
        }
      }

      return {
        acts: rows.map((r) => {
          const pending = toPendingAct({
            kind: r.kind,
            body: r.body,
            whenHint: r.whenHint,
            confidence: r.confidence,
            targetName: r.targetEntityId ? nameById.get(r.targetEntityId) ?? null : null,
            secondaryName: r.secondaryEntityId
              ? nameById.get(r.secondaryEntityId) ?? null
              : null,
          });
          const targetEmail = r.targetEntityId
            ? emailByEntityId.get(r.targetEntityId) ?? null
            : null;
          return {
            ...pending,
            id: r.id,
            subject: r.subject,
            whenHint: r.whenHint,
            body: r.body,
            status: r.status,
            createdAt: r.createdAt,
            targetEmail,
            targetEntityId: r.targetEntityId,
          };
        }),
      };
    }),

  /**
   * Create a drafted act from an entity / chat CTA (A6).
   * Mastra polishes subject/body when OPENROUTER_API_KEY is present.
   */
  createDraft: protectedProcedure
    .input(
      z.object({
        kind: actKindSchema.default('email'),
        intent: draftIntentSchema.default('check-in'),
        targetEntityId: z.string().min(1).optional(),
        secondaryEntityId: z.string().min(1).optional(),
        contextName: z.string().max(200).optional(),
        seedBody: z.string().max(2000).optional(),
        sourceInteractionId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let targetName: string | null = null;
      let secondaryName: string | null = null;

      if (input.targetEntityId) {
        const target = await ctx.db.query.entities.findFirst({
          where: and(
            eq(schema.entities.id, input.targetEntityId),
            eq(schema.entities.ownerUserId, ctx.user.id),
            isNull(schema.entities.deletedAt),
          ),
          columns: { id: true, name: true },
        });
        if (!target) return { ok: false as const, id: null };
        targetName = target.name;
      }

      if (input.secondaryEntityId) {
        const secondary = await ctx.db.query.entities.findFirst({
          where: and(
            eq(schema.entities.id, input.secondaryEntityId),
            eq(schema.entities.ownerUserId, ctx.user.id),
            isNull(schema.entities.deletedAt),
          ),
          columns: { id: true, name: true },
        });
        if (!secondary) return { ok: false as const, id: null };
        secondaryName = secondary.name;
      }

      if (input.sourceInteractionId) {
        const interaction = await ctx.db.query.interactions.findFirst({
          where: and(
            eq(schema.interactions.id, input.sourceInteractionId),
            eq(schema.interactions.userId, ctx.user.id),
          ),
          columns: { id: true },
        });
        if (!interaction) return { ok: false as const, id: null };
      }

      const polished = await polishDraft({
        kind: input.kind,
        intent: input.intent as DraftIntent,
        targetName,
        secondaryName,
        contextName: input.contextName ?? null,
        seedBody: input.seedBody ?? null,
      });

      const [row] = await ctx.db
        .insert(schema.acts)
        .values({
          userId: ctx.user.id,
          kind: input.kind,
          status: 'drafted',
          body: polished.body,
          subject: polished.subject,
          targetEntityId: input.targetEntityId ?? null,
          secondaryEntityId: input.secondaryEntityId ?? null,
          sourceInteractionId: input.sourceInteractionId ?? null,
          confidence: 85,
        })
        .returning({ id: schema.acts.id });

      return { ok: true as const, id: row?.id ?? null };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        body: z.string().min(1).max(4000).optional(),
        subject: z.string().max(200).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.acts.findFirst({
        where: and(eq(schema.acts.id, input.id), eq(schema.acts.userId, ctx.user.id)),
      });
      if (!existing) return { ok: false as const };
      if (existing.status !== 'drafted' && existing.status !== 'snoozed') {
        return { ok: false as const };
      }
      if (input.body === undefined && input.subject === undefined) {
        return { ok: true as const };
      }
      const updated = await ctx.db
        .update(schema.acts)
        .set({
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.subject !== undefined ? { subject: input.subject } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.acts.id, input.id),
            eq(schema.acts.userId, ctx.user.id),
            inArray(schema.acts.status, ['drafted', 'snoozed']),
          ),
        )
        .returning({ id: schema.acts.id });
      return { ok: updated.length > 0 };
    }),

  snooze: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        /** Hours from now until runAt. Default 24. */
        hours: z.number().int().min(1).max(24 * 30).default(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.acts.findFirst({
        where: and(eq(schema.acts.id, input.id), eq(schema.acts.userId, ctx.user.id)),
      });
      if (!existing) return { ok: false as const };
      if (existing.status !== 'drafted' && existing.status !== 'snoozed') {
        return { ok: false as const };
      }
      const runAt = new Date(Date.now() + input.hours * 60 * 60 * 1000);
      const updated = await ctx.db
        .update(schema.acts)
        .set({ status: 'snoozed', runAt, updatedAt: new Date() })
        .where(
          and(
            eq(schema.acts.id, input.id),
            eq(schema.acts.userId, ctx.user.id),
            inArray(schema.acts.status, ['drafted', 'snoozed']),
          ),
        )
        .returning({ id: schema.acts.id });
      if (updated.length === 0) return { ok: false as const };
      return { ok: true as const, runAt };
    }),

  markSent: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.acts.findFirst({
        where: and(eq(schema.acts.id, input.id), eq(schema.acts.userId, ctx.user.id)),
      });
      if (!existing) return { ok: false as const };
      if (existing.status !== 'drafted' && existing.status !== 'snoozed') {
        return { ok: false as const };
      }
      await ctx.db
        .update(schema.acts)
        .set({ status: 'sent', updatedAt: new Date() })
        .where(
          and(
            eq(schema.acts.id, input.id),
            eq(schema.acts.userId, ctx.user.id),
            inArray(schema.acts.status, ['drafted', 'snoozed']),
          ),
        );
      return { ok: true as const };
    }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.acts.findFirst({
        where: and(eq(schema.acts.id, input.id), eq(schema.acts.userId, ctx.user.id)),
      });
      if (!existing) return { ok: false as const };
      if (existing.status !== 'drafted' && existing.status !== 'snoozed') {
        return { ok: false as const };
      }
      await ctx.db
        .update(schema.acts)
        .set({ status: 'dismissed', updatedAt: new Date() })
        .where(
          and(
            eq(schema.acts.id, input.id),
            eq(schema.acts.userId, ctx.user.id),
            inArray(schema.acts.status, ['drafted', 'snoozed']),
          ),
        );
      return { ok: true as const };
    }),
});
