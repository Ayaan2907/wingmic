import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';
import { extractHybrid, commit, ExtractionError, EmbeddingError } from '@wingmic/extractor';
import { TRPCError } from '@trpc/server';
import { transcribeEntities } from '@/lib/capture/transcribe-entities';
import { resolveIntroEntityIds, collapseActionsForCapture } from '@/lib/acts/mapAction';
import { polishDraft } from '@/lib/acts/draftAgent';
import { chooseActChannel, hasUsableIdentityValue, intentForChannel } from '@/lib/acts/chooseActChannel';
import { linkedinProfileHref } from '@/lib/acts/linkedinHref';
import { webSearchProviderFromEnv } from '@/lib/web-search';
import { enrichPersonsAfterCommit } from '@/lib/enrich/enrichPersons';
import { enrichEventsAfterCommit } from '@/lib/enrich/enrichEvents';
import { scheduleEnrich } from '@/lib/enrich/schedule';
import { MAX_ATTACHMENT_BYTES } from '@/lib/chat/compressImage';
import { mergePhotoSignals } from '@/lib/capture/photoSignals';
import { readPhotoSignals } from '@/lib/capture/readPhotoSignals';
import * as schema from '@wingmic/db/schema';
import type { DB } from '@wingmic/db';

export type CaptureAttachment = {
  id: string;
  entityId: string | null;
  jpegBase64: string;
};

type ValidatedCaptureAttachment = {
  jpegBase64: string;
  byteSize: number;
};

function validateCaptureAttachment(
  jpegBase64: string | undefined,
): ValidatedCaptureAttachment | undefined {
  if (!jpegBase64) return undefined;
  const canonicalBase64 =
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!canonicalBase64.test(jpegBase64)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'photo couldnt be read' });
  }

  const bytes = Buffer.from(jpegBase64, 'base64');
  if (bytes.toString('base64') !== jpegBase64) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'photo couldnt be read' });
  }
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'photo is too large — try a closer crop' });
  }
  const isJpeg =
    bytes.byteLength >= 32 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.byteLength - 2] === 0xff &&
    bytes[bytes.byteLength - 1] === 0xd9;
  if (!isJpeg) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'photo couldnt be read' });
  }

  return { jpegBase64, byteSize: bytes.byteLength };
}

async function persistCaptureAttachment(args: {
  db: DB;
  interactionId: string;
  entityId: string | null;
  eventId: string | null;
  attachment: ValidatedCaptureAttachment | undefined;
}): Promise<CaptureAttachment[]> {
  const existing = await args.db.query.interactionAttachments.findMany({
    where: eq(schema.interactionAttachments.interactionId, args.interactionId),
    columns: { id: true, entityId: true, jpegBase64: true },
  });
  if (existing.length > 0 || !args.attachment) return existing;

  const inserted = await args.db
    .insert(schema.interactionAttachments)
    .values({
      interactionId: args.interactionId,
      entityId: args.entityId,
      eventId: args.eventId,
      mimeType: 'image/jpeg',
      jpegBase64: args.attachment.jpegBase64,
      byteSize: args.attachment.byteSize,
    })
    .returning({
      id: schema.interactionAttachments.id,
      entityId: schema.interactionAttachments.entityId,
      jpegBase64: schema.interactionAttachments.jpegBase64,
    });
  return inserted;
}

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
        /** Prior capture this memo replies to. Must be owned by the caller. */
        parentInteractionId: z.string().min(1).max(128).optional(),
        /** Person the user opened in chat. Must be an owned, living person. */
        targetEntityId: z.string().min(1).max(128).optional(),
        /** Event session still open in chat. */
        targetEventId: z.string().min(1).max(128).optional(),
        attachment: z
          .object({
            jpegBase64: z.string().min(32).max(600_000),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const attachment = validateCaptureAttachment(input.attachment?.jpegBase64);

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
            const attachmentRows = await persistCaptureAttachment({
              db: ctx.db,
              interactionId: existing.id,
              entityId: entityIds.length === 1 ? entityIds[0]! : null,
              eventId: null,
              attachment,
            });
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
              attachments: attachmentRows,
            };
          }
        }

        let parentInteractionId: string | undefined;
        let threadRootId: string | undefined;
        let preferredEntity: {
          id: string;
          name: string;
          aliases: string[] | null;
          importSource: string | null;
        } | null = null;
        let preferredEventId: string | undefined;

        if (input.parentInteractionId) {
          const parent = await ctx.db.query.interactions.findFirst({
            where: and(
              eq(schema.interactions.id, input.parentInteractionId),
              eq(schema.interactions.userId, ctx.user.id),
            ),
            columns: { id: true, threadRootId: true, deletedAt: true },
          });
          if (!parent || parent.deletedAt) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'parent capture not found' });
          }
          parentInteractionId = parent.id;
          threadRootId = parent.threadRootId ?? parent.id;
        }

        if (input.targetEntityId) {
          const target = await ctx.db.query.entities.findFirst({
            where: and(
              eq(schema.entities.id, input.targetEntityId),
              eq(schema.entities.ownerUserId, ctx.user.id),
              eq(schema.entities.kind, 'person'),
              isNull(schema.entities.deletedAt),
            ),
            columns: { id: true, name: true, aliases: true, importSource: true },
          });
          if (!target) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'target person not found' });
          }
          preferredEntity = target;
        }

        if (input.targetEventId) {
          const targetEvent = await ctx.db.query.events.findFirst({
            where: eq(schema.events.id, input.targetEventId),
            columns: { id: true },
          });
          if (!targetEvent) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'target event not found' });
          }
          preferredEventId = targetEvent.id;
        }

        let transcript = input.transcript;
        if (attachment) {
          const signals = await readPhotoSignals(attachment.jpegBase64);
          transcript = mergePhotoSignals(transcript, signals);
        }

        const providerEntities = await transcribeEntities(transcript);

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
        const linkedinByEntity = new Map<string, string>();
        if (entityIds.length > 0) {
          const [links, idFacts] = await Promise.all([
            ctx.db.query.entityCompanies.findMany({
              where: inArray(schema.entityCompanies.entityId, entityIds),
              columns: { companyId: true },
              limit: 60,
            }),
            ctx.db.query.entityFacts.findMany({
              where: and(
                inArray(schema.entityFacts.entityId, entityIds),
                inArray(schema.entityFacts.key, ['email', 'linkedin']),
              ),
              columns: { entityId: true, key: true, value: true },
            }),
          ]);
          for (const f of idFacts) {
            if (f.key === 'email' && !emailByEntity.has(f.entityId)) {
              emailByEntity.set(f.entityId, f.value.trim().toLowerCase());
            }
            if (f.key === 'linkedin' && !linkedinByEntity.has(f.entityId)) {
              linkedinByEntity.set(f.entityId, f.value.trim());
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

        const contactEntities = preferredEntity
          ? [preferredEntity, ...recentEntities.filter((e) => e.id !== preferredEntity.id)]
          : recentEntities;

        const knownPersons = contactEntities.map((e) => {
          const aliases = Array.isArray(e.aliases) ? e.aliases.filter(Boolean) : [];
          const email = emailByEntity.get(e.id);
          const bits = [e.name, ...aliases.slice(0, 3)];
          if (email) bits.push(`<${email}>`);
          if (e.importSource && e.importSource !== 'voice-capture') bits.push('[imported]');
          return bits.join(' · ');
        });

        const extracted = await extractHybrid({
          transcript,
          providerEntities,
          knownContacts: {
            persons: knownPersons,
            companies: companyNames,
          },
        });

        const result = await commit(extracted, {
          db: ctx.db,
          userId: ctx.user.id,
          transcript,
          capturedAt: input.capturedAt ?? new Date(),
          clientCaptureId: input.clientCaptureId,
          parentInteractionId,
          threadRootId,
          preferredEntityId: preferredEntity?.id,
          preferredEventId,
        });

        const attachmentEntityId =
          preferredEntity?.id ?? (result.entityIds.length === 1 ? result.entityIds[0]! : null);
        const attachmentEventId =
          preferredEventId ?? (result.eventIds.length === 1 ? result.eventIds[0]! : null);
        const attachments = await persistCaptureAttachment({
          db: ctx.db,
          interactionId: result.interactionId,
          entityId: attachmentEntityId,
          eventId: attachmentEventId,
          attachment,
        });

        // Acts insert is best-effort after commit() — graph already persisted.
        // Soft-catch so a draft failure does not 500 a successful capture (retry
        // would duplicate the interaction). Full tx merge deferred.
        const captureActions = collapseActionsForCapture(extracted.actions, extracted.persons);
        if (captureActions.length > 0) {
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

              const committedIds = result.entityIds.filter((id) => ownedEntityIds.has(id));
              const committedFacts =
                committedIds.length > 0
                  ? await ctx.db.query.entityFacts.findMany({
                      where: and(
                        inArray(schema.entityFacts.entityId, committedIds),
                        inArray(schema.entityFacts.key, ['email', 'linkedin']),
                      ),
                      columns: { entityId: true, key: true, value: true },
                    })
                  : [];
              const emailByCommitted = new Set(
                committedFacts
                  .filter((f) => f.key === 'email' && hasUsableIdentityValue(f.value))
                  .map((f) => f.entityId),
              );
              const linkedinByCommitted = new Set(
                committedFacts
                  .filter((f) => f.key === 'linkedin' && Boolean(linkedinProfileHref(f.value)))
                  .map((f) => f.entityId),
              );

              const actRows = await Promise.all(
                captureActions.map(async (action) => {
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
                  const targetPerson = extracted.persons.find(
                    (_, i) => result.entityIds[i] === ownedTarget,
                  );
                  const channel = chooseActChannel({
                    kind: action.kind,
                    hasEmail: Boolean(ownedTarget && emailByCommitted.has(ownedTarget)),
                    hasLinkedin: Boolean(ownedTarget && linkedinByCommitted.has(ownedTarget)),
                  });
                  const polished = await polishDraft({
                    kind: action.kind,
                    intent: intentForChannel(channel),
                    channel,
                    targetName: targetName ?? null,
                    secondaryName:
                      ownedSecondary != null
                        ? extracted.persons.find((_, i) => result.entityIds[i] === ownedSecondary)
                            ?.name ?? null
                        : null,
                    contextName: targetPerson?.companyHint ?? null,
                    seedBody: action.body,
                    transcript,
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

        const callerRow = await ctx.db.query.users.findFirst({
          where: eq(schema.users.id, ctx.user.id),
          columns: { calendarIcsUrl: true },
        });
        const calendarIcsUrl = callerRow?.calendarIcsUrl ?? null;
        const provider = webSearchProviderFromEnv();
        if (provider || calendarIcsUrl) {
          const capturedAt = input.capturedAt ?? new Date();
          scheduleEnrich(async () => {
            await Promise.all([
              provider
                ? enrichPersonsAfterCommit({
                    db: ctx.db,
                    userId: ctx.user.id,
                    interactionId: result.interactionId,
                    extractedPersons: extracted.persons,
                    persons: result.persons,
                    provider,
                  })
                : Promise.resolve(),
              enrichEventsAfterCommit({
                db: ctx.db,
                eventIds: result.eventIds,
                capturedAt,
                provider,
                calendarIcsUrl,
              }),
            ]);
          });
        }

        return { extracted, ...result, attachments };
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
