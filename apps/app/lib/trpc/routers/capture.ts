import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { extractHybrid, commit, ExtractionError, EmbeddingError } from '@wingmic/extractor';
import { TRPCError } from '@trpc/server';
import { transcribeEntities } from '@/lib/capture/transcribe-entities';
import { resolveIntroEntityIds } from '@/lib/acts/mapAction';
import { polishDraft } from '@/lib/acts/draftAgent';
import * as schema from '@wingmic/db/schema';

export const captureRouter = router({
  /**
   * Run the hybrid extraction + resolution pipeline on a transcript.
   *
   * v0.1.1 "Hosted Capture" (Task H4) — replaces the LLM-only `extract()`
   * with `extractHybrid({ transcript, providerEntities })`:
   *   1. transcribeEntities() re-runs AssemblyAI entity_detection on the
   *      (possibly user-edited) transcript per locked decision #11.
   *   2. extractHybrid() merges span-level entities + heuristics + Haiku
   *      relation linker into the existing ExtractionResult shape.
   *   3. commit() persists into the graph (resolution.ts unchanged).
   */
  commit: protectedProcedure
    .input(
      z.object({
        transcript: z
          .string()
          .min(1, 'transcript cannot be empty')
          .max(10000, 'transcripts longer than 10k chars need to be split'),
        capturedAt: z.coerce.date().optional(),
        /** Client-generated capture id for retry idempotency (wired into interactions). */
        clientCaptureId: z.string().min(1).max(128).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Idempotent retry: same clientCaptureId → return existing interaction.
        if (input.clientCaptureId) {
          const existing = await ctx.db.query.interactions.findFirst({
            where: and(
              eq(schema.interactions.userId, ctx.user.id),
              eq(schema.interactions.clientCaptureId, input.clientCaptureId),
            ),
            columns: { id: true },
          });
          if (existing) {
            const [factLinks, topicLinks] = await Promise.all([
              ctx.db.query.entityFacts.findMany({
                where: eq(schema.entityFacts.sourceInteractionId, existing.id),
                columns: { entityId: true },
              }),
              ctx.db.query.entityTopics.findMany({
                where: eq(schema.entityTopics.sourceInteractionId, existing.id),
                columns: { entityId: true },
              }),
            ]);
            const entityIds = [
              ...new Set([
                ...factLinks.map((f) => f.entityId),
                ...topicLinks.map((t) => t.entityId),
              ]),
            ];
            return {
              extracted: {
                persons: [],
                companies: [],
                events: [],
                topics: [],
                actions: [],
              },
              interactionId: existing.id,
              entityIds,
              duplicate: true as const,
            };
          }
        }

        const providerEntities = await transcribeEntities(input.transcript);

        const recentEntities = await ctx.db.query.entities.findMany({
          where: and(
            eq(schema.entities.ownerUserId, ctx.user.id),
            isNull(schema.entities.deletedAt),
          ),
          columns: { id: true, name: true, aliases: true, importSource: true },
          orderBy: desc(schema.entities.updatedAt),
          limit: 40,
        });

        const entityIds = recentEntities.map((e) => e.id);
        let companyNames: string[] = [];
        const emailByEntity = new Map<string, string>();
        if (entityIds.length > 0) {
          const [links, emailFacts] = await Promise.all([
            ctx.db.query.entityCompanies.findMany({
              where: inArray(schema.entityCompanies.entityId, entityIds),
              columns: { companyId: true },
              limit: 60,
            }),
            ctx.db.query.entityFacts.findMany({
              where: and(
                inArray(schema.entityFacts.entityId, entityIds),
                eq(schema.entityFacts.key, 'email'),
              ),
              columns: { entityId: true, value: true },
            }),
          ]);
          for (const f of emailFacts) {
            if (!emailByEntity.has(f.entityId)) {
              emailByEntity.set(f.entityId, f.value.trim().toLowerCase());
            }
          }
          const companyIds = [...new Set(links.map((l) => l.companyId))].slice(0, 20);
          if (companyIds.length > 0) {
            const companies = await ctx.db.query.companies.findMany({
              where: inArray(schema.companies.id, companyIds),
              columns: { name: true },
            });
            companyNames = companies.map((c) => c.name);
          }
        }

        const knownPersons = recentEntities.map((e) => {
          const aliases = Array.isArray(e.aliases) ? e.aliases.filter(Boolean) : [];
          const email = emailByEntity.get(e.id);
          const bits = [e.name, ...aliases.slice(0, 3)];
          if (email) bits.push(`<${email}>`);
          if (e.importSource && e.importSource !== 'voice-capture') bits.push('[imported]');
          return bits.join(' · ');
        });

        const extracted = await extractHybrid({
          transcript: input.transcript,
          providerEntities,
          knownContacts: {
            persons: knownPersons,
            companies: companyNames,
          },
        });

        const result = await commit(extracted, {
          db: ctx.db,
          userId: ctx.user.id,
          transcript: input.transcript,
          capturedAt: input.capturedAt ?? new Date(),
          clientCaptureId: input.clientCaptureId,
        });

        // Acts insert is best-effort after commit() — graph already persisted.
        // Soft-catch so a draft failure does not 500 a successful capture (retry
        // would duplicate the interaction). Full tx merge deferred.
        if (extracted.actions.length > 0) {
          try {
            const existingActs = await ctx.db.query.acts.findMany({
              where: eq(schema.acts.sourceInteractionId, result.interactionId),
              columns: { id: true },
              limit: 1,
            });
            if (existingActs.length === 0) {
              const ownedEntityIds = new Set(
                (
                  await ctx.db.query.entities.findMany({
                    where: and(
                      eq(schema.entities.ownerUserId, ctx.user.id),
                      isNull(schema.entities.deletedAt),
                    ),
                    columns: { id: true },
                  })
                ).map((e) => e.id),
              );

              const actRows = await Promise.all(
                extracted.actions.map(async (action) => {
                  const { targetEntityId, secondaryEntityId } = resolveIntroEntityIds(
                    action,
                    extracted.persons,
                    result.entityIds,
                  );
                  const ownedTarget =
                    targetEntityId && ownedEntityIds.has(targetEntityId) ? targetEntityId : null;
                  // Intro secondary only when we have an owned target (avoids "there → Alice").
                  const ownedSecondary =
                    ownedTarget &&
                    secondaryEntityId &&
                    ownedEntityIds.has(secondaryEntityId)
                      ? secondaryEntityId
                      : null;
                  const targetName =
                    ownedTarget != null
                      ? extracted.persons.find((_, i) => result.entityIds[i] === ownedTarget)?.name
                      : action.targetPersonName;
                  const intent =
                    action.kind === 'intro'
                      ? ('intro' as const)
                      : action.kind === 'reminder' || action.kind === 'meeting'
                        ? ('reminder' as const)
                        : ('follow-up' as const);
                  const polished = await polishDraft({
                    kind: action.kind,
                    intent,
                    targetName: targetName ?? null,
                    secondaryName:
                      ownedSecondary != null
                        ? extracted.persons.find((_, i) => result.entityIds[i] === ownedSecondary)
                            ?.name ?? null
                        : null,
                    seedBody: action.body,
                  });
                  return {
                    userId: ctx.user.id,
                    kind: action.kind,
                    status: 'drafted' as const,
                    body: polished.body,
                    subject: polished.subject,
                    whenHint: action.whenHint,
                    targetEntityId: ownedTarget,
                    secondaryEntityId: ownedSecondary,
                    sourceInteractionId: result.interactionId,
                    confidence: 80,
                  };
                }),
              );
              await ctx.db.insert(schema.acts).values(actRows);
            }
          } catch {
            // Capture committed; drafts can be created later via entity CTAs.
          }
        }

        return { extracted, ...result };
      } catch (err) {
        if (err instanceof ExtractionError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `extraction failed: ${err.message}`,
            cause: err,
          });
        }
        if (err instanceof EmbeddingError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `embedding failed: ${err.message}`,
            cause: err,
          });
        }
        throw err;
      }
    }),

  /**
   * Soft-delete a committed interaction (sets `deletedAt`). Scoped to the
   * calling user. Idempotent when already deleted.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.interactions.findFirst({
        where: and(
          eq(schema.interactions.id, input.id),
          eq(schema.interactions.userId, ctx.user.id),
          eq(schema.interactions.status, 'committed'),
        ),
        columns: { id: true, deletedAt: true },
      });
      if (!row) return { ok: false as const };
      if (row.deletedAt) return { ok: true as const };
      await ctx.db
        .update(schema.interactions)
        .set({ deletedAt: new Date() })
        .where(eq(schema.interactions.id, input.id));
      return { ok: true as const };
    }),

  /**
   * Undo a soft-delete within the client undo window (clears `deletedAt`).
   */
  restore: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.query.interactions.findFirst({
        where: and(
          eq(schema.interactions.id, input.id),
          eq(schema.interactions.userId, ctx.user.id),
          eq(schema.interactions.status, 'committed'),
        ),
        columns: { id: true, deletedAt: true },
      });
      if (!row) return { ok: false as const };
      if (!row.deletedAt) return { ok: true as const };
      await ctx.db
        .update(schema.interactions)
        .set({ deletedAt: null })
        .where(eq(schema.interactions.id, input.id));
      return { ok: true as const };
    }),
});
