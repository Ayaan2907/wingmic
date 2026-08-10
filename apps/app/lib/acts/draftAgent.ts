/**
 * Acts draft agent — Mastra Agent over OpenRouter.
 *
 * Polishes terse extraction action bodies into permission-first email /
 * check-in drafts. Falls back to deterministic templates when the key is
 * missing, the model errors, or polish exceeds POLISH_TIMEOUT_MS.
 */
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { env } from '@/lib/config/env';

export const draftOutputSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

export type DraftOutput = z.infer<typeof draftOutputSchema>;

export type DraftIntent = 'check-in' | 'follow-up' | 'intro' | 'recap' | 'warm-path' | 'reminder';

export type PolishDraftInput = {
  kind: 'reminder' | 'email' | 'meeting' | 'todo' | 'intro';
  intent: DraftIntent;
  targetName?: string | null;
  secondaryName?: string | null;
  contextName?: string | null;
  seedBody?: string | null;
};

/** Hard cap so OpenRouter stalls never block capture / createDraft. */
export const POLISH_TIMEOUT_MS = 8_000;

const DRAFT_INSTRUCTIONS = `You draft short outbound follow-ups for wingmic, a voice-first networking memory app.
Permission-first: drafts are reviewed by the user; nothing auto-sends.

Rules:
1. Warm, lowercase-confident tone. No corporate fluff. No emojis.
2. Keep body under 120 words. Subject under 60 chars.
3. Never invent facts, emails, companies, or meeting details not in the prompt.
4. If the seed is already fine, lightly polish — do not rewrite into a novel.
5. For intros: mention both people only when both names are provided.
6. Output must match the structured schema (subject + body).`;

function actsDraftModelId(): string {
  const base = env.ACTS_DRAFT_MODEL ?? env.LINKER_MODEL ?? 'anthropic/claude-sonnet-4.6';
  return base.startsWith('openrouter/') ? base : `openrouter/${base}`;
}

/** Build (or reuse) the Mastra draft agent. */
export function createActsDraftAgent(): Agent {
  return new Agent({
    id: 'wingmic-acts-draft',
    name: 'wingmic acts draft',
    instructions: DRAFT_INSTRUCTIONS,
    model: actsDraftModelId(),
  });
}

function clampDraft(draft: { subject: string; body: string }): DraftOutput {
  const subject = draft.subject.trim().slice(0, 120) || 'follow-up';
  const body = draft.body.trim().slice(0, 2000) || 'follow up.';
  return { subject, body };
}

function clampSeed(seed: string | null | undefined): string | null {
  if (!seed?.trim()) return null;
  return seed.trim().slice(0, 2000);
}

/** Deterministic template used when LLM polish is unavailable. */
export function templateDraft(input: PolishDraftInput): DraftOutput {
  const name = input.targetName?.trim() || 'there';
  const secondary = input.secondaryName?.trim();
  const ctx = input.contextName?.trim();
  const seed = clampSeed(input.seedBody);

  switch (input.intent) {
    case 'intro': {
      const pair = secondary ? `${name} → ${secondary}` : name;
      return clampDraft({
        subject: `intro: ${pair}`,
        body:
          seed ||
          (secondary
            ? `wanted to intro ${name} and ${secondary}${ctx ? ` (via ${ctx})` : ''}. happy to connect you two.`
            : `wanted to make an intro${ctx ? ` around ${ctx}` : ''}.`),
      });
    }
    case 'recap':
      return clampDraft({
        subject: ctx ? `recap · ${ctx}` : 'event recap',
        body: seed || `quick recap notes from ${ctx ?? 'the event'} — capture follow-ups while they're fresh.`,
      });
    case 'warm-path':
      return clampDraft({
        subject: ctx ? `warm path · ${ctx}` : 'find a warm path',
        body:
          seed ||
          `look for a warm intro into ${ctx ?? 'this company'} from people already in your graph.`,
      });
    case 'reminder':
      return clampDraft({
        subject: ctx ? `remind · ${ctx}` : 'reminder',
        body: seed || `follow up with ${name}${ctx ? ` about ${ctx}` : ''}.`,
      });
    case 'check-in':
    case 'follow-up':
      return clampDraft({
        subject: `great meeting you${name !== 'there' ? `, ${name.split(/\s+/)[0]}` : ''}`,
        body:
          seed ||
          `hey ${name} — great meeting you${ctx ? ` at ${ctx}` : ''}. wanted to follow up while it's fresh.`,
      });
    default: {
      const _exhaustive: never = input.intent;
      return _exhaustive;
    }
  }
}

function buildPrompt(input: PolishDraftInput): string {
  return [
    `kind: ${input.kind}`,
    `intent: ${input.intent}`,
    `target: ${input.targetName ?? '(none)'}`,
    `secondary: ${input.secondaryName ?? '(none)'}`,
    `context: ${input.contextName ?? '(none)'}`,
    `seed body: ${input.seedBody ?? '(none)'}`,
    '',
    'Draft subject + body for the user to review and send themselves.',
  ].join('\n');
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Polish a draft via Mastra when OPENROUTER_API_KEY is set; otherwise template.
 * Never throws — always returns a usable DraftOutput within POLISH_TIMEOUT_MS.
 */
export async function polishDraft(
  input: PolishDraftInput,
  opts?: { agent?: Agent; timeoutMs?: number },
): Promise<DraftOutput> {
  const fallback = templateDraft(input);
  if (!env.OPENROUTER_API_KEY) return fallback;

  const timeoutMs = opts?.timeoutMs ?? POLISH_TIMEOUT_MS;
  try {
    const agent = opts?.agent ?? createActsDraftAgent();
    const polished = await withTimeout(
      (async () => {
        const response = await agent.generate(buildPrompt(input), {
          structuredOutput: {
            schema: draftOutputSchema,
            errorStrategy: 'fallback',
            fallbackValue: fallback,
          },
        });
        const object = response.object ?? fallback;
        const parsed = draftOutputSchema.safeParse(object);
        return parsed.success ? clampDraft(parsed.data) : fallback;
      })(),
      timeoutMs,
      fallback,
    );
    return polished;
  } catch {
    return fallback;
  }
}
