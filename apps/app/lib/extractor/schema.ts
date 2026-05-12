import { z } from 'zod';

/**
 * The LLM returns this shape. Resolution.ts then decides which become
 * canonical Company/Event/Topic rows vs ownerUserId-scoped Entity rows.
 */

export const PersonCandidate = z.object({
  name: z
    .string()
    .min(1)
    .describe('full or partial name as captured. Preserve original casing.'),
  aliases: z.array(z.string()).default([]).describe('alternative spellings or nicknames mentioned'),
  role: z.string().nullable().describe('job title or role mentioned, or null'),
  companyHint: z.string().nullable().describe('company name as the speaker said it, or null'),
  topics: z
    .array(z.string())
    .default([])
    .describe('topics or interests mentioned in connection with this person'),
  email: z.string().email().nullable().describe('email if explicitly stated'),
  linkedin: z.string().nullable().describe('linkedin handle or URL if stated'),
  notes: z
    .string()
    .nullable()
    .describe('one-sentence summary of context, if helpful for recall later'),
});
export type PersonCandidate = z.infer<typeof PersonCandidate>;

export const CompanyCandidate = z.object({
  name: z.string().min(1),
  domainHint: z.string().nullable().describe("inferred domain like 'acme.dev' if obvious, else null"),
  industry: z.array(z.string()).default([]),
});
export type CompanyCandidate = z.infer<typeof CompanyCandidate>;

export const EventCandidate = z.object({
  name: z.string().min(1),
  dateHint: z
    .string()
    .nullable()
    .describe('ISO date or relative descriptor like "yesterday" or "last tuesday"'),
  location: z.string().nullable(),
});
export type EventCandidate = z.infer<typeof EventCandidate>;

export const ActionCandidate = z.object({
  kind: z.enum(['reminder', 'email', 'meeting', 'todo', 'intro']),
  body: z.string().min(1),
  whenHint: z
    .string()
    .nullable()
    .describe('ISO datetime or natural-language like "tomorrow morning"'),
  targetPersonName: z
    .string()
    .nullable()
    .describe('if this action is about a specific person mentioned, their name'),
});
export type ActionCandidate = z.infer<typeof ActionCandidate>;

export const ExtractionResult = z.object({
  persons: z.array(PersonCandidate).default([]),
  companies: z.array(CompanyCandidate).default([]),
  events: z.array(EventCandidate).default([]),
  topics: z.array(z.string()).default([]),
  actions: z.array(ActionCandidate).default([]),
});
export type ExtractionResult = z.infer<typeof ExtractionResult>;
