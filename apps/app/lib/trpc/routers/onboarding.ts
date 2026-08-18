import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import * as schema from '@wingmic/db/schema';
import { normalizeLinkedInUrl } from '@/lib/imports';

const optionalLabel = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined));

const optionalLinkedIn = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((s) => (s && s.length > 0 ? s : undefined));

const acknowledgeInput = z.object({
  firstName: optionalLabel,
  lastName: optionalLabel,
  linkedinUrl: optionalLinkedIn,
});

function joinDisplayName(first?: string, last?: string): string | null {
  const name = [first, last].filter((p): p is string => Boolean(p)).join(' ').trim();
  return name.length > 0 ? name : null;
}

// onboarding.acknowledge — flip the caller's first-run privacy flag. Called by
// the /onboarding flow on "get started" and on skip. SECURITY: the write is
// scoped `WHERE id = ctx.user.id`; a userId is NEVER accepted from input.
//
// Optional profile: first+last compose `user.name` (BetterAuth already has
// this column — no schema change). LinkedIn URL writes a self-asserted
// identity_claim(kind='linkedin', verified=false). Skip may send empty input.

export const onboardingRouter = router({
  acknowledge: protectedProcedure.input(acknowledgeInput.optional()).mutation(async ({ ctx, input }) => {
    const firstName = input?.firstName;
    const lastName = input?.lastName;
    if (Boolean(firstName) !== Boolean(lastName)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'first and last name are both required',
      });
    }
    const displayName = joinDisplayName(firstName, lastName);

    let linkedin: string | null = null;
    if (input?.linkedinUrl) {
      linkedin = normalizeLinkedInUrl(input.linkedinUrl);
      if (!linkedin) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'linkedin url must be a linkedin.com profile',
        });
      }
    }

    await ctx.db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({
          acknowledgedPrivacy: true,
          ...(displayName ? { name: displayName } : {}),
        })
        .where(eq(schema.users.id, ctx.user.id));

      if (!linkedin) return;

      const existingRows = await tx
        .select()
        .from(schema.identityClaims)
        .where(
          and(eq(schema.identityClaims.userId, ctx.user.id), eq(schema.identityClaims.kind, 'linkedin')),
        )
        .limit(1);
      const existing = existingRows[0];
      if (existing) {
        await tx
          .update(schema.identityClaims)
          .set({
            value: linkedin,
            ...(existing.value !== linkedin ? { verified: false, public: false } : {}),
          })
          .where(eq(schema.identityClaims.id, existing.id));
      } else {
        await tx.insert(schema.identityClaims).values({
          userId: ctx.user.id,
          kind: 'linkedin',
          value: linkedin,
          verified: false,
          public: false,
        });
      }
    });

    return { ok: true as const };
  }),
});
