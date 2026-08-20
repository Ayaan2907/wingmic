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
  subject: z.string().min(1).max(60),
  body: z.string().min(1).max(2000),
});

export type DraftOutput = z.infer<typeof draftOutputSchema>;

export type DraftIntent =
  | 'check-in'
  | 'follow-up'
  | 'intro'
  | 'recap'
  | 'warm-path'
  | 'reminder'
  | 'linkedin-note'
  | 'memo';

export type PolishDraftInput = {
  kind: 'reminder' | 'email' | 'meeting' | 'todo' | 'intro';
  intent: DraftIntent;
  targetName?: string | null;
  secondaryName?: string | null;
  contextName?: string | null;
  seedBody?: string | null;
  /** Committed memo — the conversation the draft must be grounded in. */
  transcript?: string | null;
  /** Email / linkedin / reminder / memo / intro / meeting. */
  channel?: 'email' | 'linkedin' | 'reminder' | 'meeting' | 'intro' | 'memo';
};

/** Hard cap so OpenRouter stalls never block capture / createDraft. */
export const POLISH_TIMEOUT_MS = 8_000;

const DRAFT_INSTRUCTIONS = `You draft short outbound follow-ups for wingmic, a voice-first networking memory app.
Permission-first: drafts are reviewed by the user; nothing auto-sends.

The committed memo is the source of truth. Pull 1–2 concrete details from it.

Channel:
- email: sendable email. greeting, specifics from the memo, one clear ask, no signature block.
- linkedin: pasteable LinkedIn message. shorter than email. no "dear" / "best regards".
- reminder: calendar reminder. subject is the title; body is what to remember and why.
- meeting: same as reminder, framed as a meeting.
- intro: email introducing two people. only name both when both are provided.
- memo: private note to self. not outbound. capture the beat so the user can come back to it.

Rules:
1. Warm, lowercase-confident tone. No corporate fluff. No emojis.
2. Keep body under 120 words. Subject under 60 chars.
3. Never invent facts, emails, companies, dates, or meeting details not in the prompt.
4. Do not return the extractor seed unchanged — write a real draft for the channel.
5. Output must match the structured schema (subject + body).`;

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
  const subject = draft.subject.trim().slice(0, 60) || 'follow-up';
  const body = draft.body.trim().slice(0, 2000) || 'follow up.';
  return { subject, body };
}

function clampSeed(seed: string | null | undefined): string | null {
  if (!seed?.trim()) return null;
  return seed.trim().slice(0, 2000);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function excerpt(text: string | null | undefined, max = 280): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastStop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf(' '));
  return `${(lastStop > 80 ? slice.slice(0, lastStop) : slice).trim()}…`;
}

/** Deterministic template used when LLM polish is unavailable. */
export function templateDraft(input: PolishDraftInput): DraftOutput {
  const name = input.targetName?.trim() || 'there';
  const first = name === 'there' ? 'there' : firstName(name);
  const secondary = input.secondaryName?.trim();
  const ctx = input.contextName?.trim();
  const seed = clampSeed(input.seedBody);
  const memo = excerpt(input.transcript);
  const story = memo || seed;
  const ask =
    seed &&
    memo &&
    !memo.toLowerCase().includes(seed.toLowerCase().slice(0, Math.min(48, seed.length)))
      ? seed
      : null;
  const channel = input.channel ?? 'email';

  switch (input.intent) {
    case 'intro': {
      const pair = secondary ? `${name} → ${secondary}` : name;
      return clampDraft({
        subject: `intro: ${pair}`,
        body: secondary
          ? `wanted to intro you two${ctx ? ` (${ctx})` : ''}.\n\n${name} — ${story || 'you crossed paths recently'}.\n${secondary} — sharing this so you can take it from here.`
          : `wanted to make an intro${ctx ? ` around ${ctx}` : ''}.${story ? `\n\n${story}` : ''}`,
      });
    }
    case 'recap':
      return clampDraft({
        subject: ctx ? `recap · ${ctx}` : 'event recap',
        body: story || `quick recap notes from ${ctx || 'the event'} — capture follow-ups while they're fresh.`,
      });
    case 'warm-path':
      return clampDraft({
        subject: ctx ? `warm path · ${ctx}` : 'find a warm path',
        body:
          story ||
          `look for a warm intro into ${ctx || 'this company'} from people already in your graph.`,
      });
    case 'reminder':
      return clampDraft({
        subject: (
          ctx
            ? `${channel === 'meeting' ? 'meet' : 'remind'} · ${ctx}`
            : channel === 'meeting'
              ? `meet · ${first}`
              : `follow up · ${first}`
        ).slice(0, 60),
        body: [
          channel === 'meeting'
            ? `meeting with ${name}${ctx ? ` (${ctx})` : ''}.`
            : `follow up with ${name}${ctx ? ` (${ctx})` : ''}.`,
          story,
          ask,
        ]
          .filter(Boolean)
          .join('\n\n'),
      });
    case 'linkedin-note':
      return clampDraft({
        subject: `linkedin · ${first}`,
        body: [`hey ${first} — ${story || 'great crossing paths'}${ctx ? ` (${ctx})` : ''}.`, ask, 'would love to stay in touch.']
          .filter(Boolean)
          .join('\n\n'),
      });
    case 'memo':
      return clampDraft({
        subject: name !== 'there' ? `memo · ${first}` : 'memo',
        body: [story, ask].filter(Boolean).join('\n\n') || 'note this while it is fresh.',
      });
    case 'check-in':
    case 'follow-up': {
      if (channel === 'linkedin') {
        return clampDraft({
          subject: `linkedin · ${first}`,
          body: [`hey ${first} — ${story || 'great meeting you'}${ctx ? ` at ${ctx}` : ''}.`, ask]
            .filter(Boolean)
            .join('\n\n'),
        });
      }
      if (channel === 'memo') {
        return clampDraft({
          subject: name !== 'there' ? `memo · ${first}` : 'memo',
          body: [story, ask].filter(Boolean).join('\n\n') || 'note this while it is fresh.',
        });
      }
      return clampDraft({
        subject: `great meeting you${name !== 'there' ? `, ${first}` : ''}`,
        body: [
          `hey ${name} — ${story || 'great meeting you'}${ctx ? ` at ${ctx}` : ''}.`,
          ask,
          'wanted to follow up while it is fresh — ping me if useful to keep going.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      });
    }
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
    `channel: ${input.channel ?? 'email'}`,
    `target: ${input.targetName ?? '(none)'}`,
    `secondary: ${input.secondaryName ?? '(none)'}`,
    `context: ${input.contextName ?? '(none)'}`,
    `extractor seed: ${input.seedBody ?? '(none)'}`,
    '',
    'committed memo:',
    input.transcript?.trim() || '(none)',
    '',
    'Draft subject + body for the user to review. Ground every concrete detail in the memo.',
  ].join('\n');
}

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(fallback);
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Polish a draft via Mastra when OPENROUTER_API_KEY is set; otherwise template.
 * Never throws — always returns a usable DraftOutput within POLISH_TIMEOUT_MS.
 * On timeout the AbortSignal cancels the in-flight generate when the SDK honors it.
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
    return await withTimeout(
      async (signal) => {
        const response = await agent.generate(buildPrompt(input), {
          abortSignal: signal,
          structuredOutput: {
            schema: draftOutputSchema,
            errorStrategy: 'fallback',
            fallbackValue: fallback,
          },
        });
        const object = response.object ?? fallback;
        // Clamp before safeParse so slightly-oversize LLM output is truncated
        // instead of discarded for the deterministic template.
        const candidate = clampDraft({
          subject: typeof object.subject === 'string' ? object.subject : fallback.subject,
          body: typeof object.body === 'string' ? object.body : fallback.body,
        });
        const parsed = draftOutputSchema.safeParse(candidate);
        return parsed.success ? candidate : fallback;
      },
      timeoutMs,
      fallback,
    );
  } catch {
    return fallback;
  }
}
