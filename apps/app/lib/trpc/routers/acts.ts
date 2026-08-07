import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import { router, protectedProcedure } from '../trpc';
import { toPendingAct } from '@/lib/acts/mapAction';

/**
 * Acts — permission-first draft follow-ups from capture extraction.
 * list → home ActCards + /acts; markSent / dismiss update status.
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
      const statuses = input.status
        ? [input.status]
        : (['drafted', 'snoozed'] as const);

      const rows = await ctx.db.query.acts.findMany({
        where: and(
          eq(schema.acts.userId, ctx.user.id),
          inArray(schema.acts.status, [...statuses]),
        ),
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
          };
        }),
      };
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
