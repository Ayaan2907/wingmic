/**
 * Chat assistant — the conversation layer over capture turns (spec
 * art_LkglG0Xb "Chat-first capture").
 *
 * Mastra Agent over OpenRouter, same pattern as lib/acts/draftAgent.ts:
 * never throws, deterministic fallback when OPENROUTER_API_KEY is missing or
 * the model stalls, hard timeout so a capture turn is never blocked on the
 * LLM (capture invariant: enrichment/assistant work is asynchronous).
 *
 * The follow-up decision is a pure rule (`assistantFollowUp`) so the
 * behavior "ask one question when the capture is missing something, stay
 * quiet when it is not" is testable and stable without an LLM. The agent is
 * told to end its reply with that exact question when one is warranted —
 * the streamed prose may vary, the question does not.
 */
import { Agent } from '@mastra/core/agent';
import { env } from '@/lib/config/env';

/** Hard cap so OpenRouter stalls never hold a turn open. */
export const ASSISTANT_TIMEOUT_MS = 8_000;

export type TurnDiff = {
  persons: Array<{
    name: string;
    role: string | null;
    companyHint: string | null;
  }>;
  topics: string[];
  actions: Array<{ kind: string; body: string }>;
};

export type TurnHistoryItem = {
  transcript: string;
  /** One-line extraction summary, e.g. "person: sarah at acme". */
  summary: string;
};

export type AssistantFollowUp = {
  question: string;
  about: string;
};

export type AssistantTurnInput = {
  turnText: string;
  diff: TurnDiff;
  history: TurnHistoryItem[];
  /** Pre-decided follow-up; when omitted the pure rule decides. */
  followUp?: AssistantFollowUp | null;
};

export type AssistantTurnSource = 'llm' | 'fallback';

const ASSISTANT_INSTRUCTIONS = `You are the wingmic assistant inside a networking-capture chat. The user just logged a memo (typed, spoken, or photographed). Extraction has already run — you see what it captured.

Your job: acknowledge what landed in one or two short sentences, and when the capture is missing something worth knowing later, ask exactly ONE follow-up question. Stay quiet (no question) when nothing important is missing.

Rules:
1. Never invent facts. Use only what the extraction captured or the user said.
2. One or two sentences, max 40 words. Lowercase-confident tone, no corporate fluff, no emojis.
3. When told to ask a follow-up question, do NOT include the question in your reply — it is rendered separately below your message. Reply only with the acknowledgment.
4. When told to ask nothing, ask nothing. No "let me know if", no offers.
5. You are not a chatbot for small talk — you are the memory. Keep it terse.`;

export function createChatAssistantAgent(): Agent {
  const base = env.CHAT_ASSISTANT_MODEL ?? env.ACTS_DRAFT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const model = base.startsWith('openrouter/') ? base : `openrouter/${base}`;
  return new Agent({
    id: 'wingmic-chat-assistant',
    name: 'wingmic chat assistant',
    instructions: ASSISTANT_INSTRUCTIONS,
    model,
  });
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Pure follow-up rule: one question when a person is missing role or
 * company; quiet when the turn is complete or already queued a follow-up
 * action. Person[0] is the turn's subject — captures name one person at a
 * time in practice, and one question per turn is the UX contract.
 */
export function assistantFollowUp(diff: TurnDiff): AssistantFollowUp | null {
  if (diff.actions.length > 0) return null;
  const person = diff.persons[0];
  if (!person) return null;
  // Questions follow the product's lowercase voice (suggested queries read
  // "who was the rust person at acme?"); `about` keeps the real name.
  const first = firstName(person.name).toLowerCase();
  if (person.companyHint && !person.role) {
    return { question: `what does ${first} do at ${person.companyHint}?`, about: person.name };
  }
  if (person.role && !person.companyHint) {
    return { question: `where does ${first} work?`, about: person.name };
  }
  if (!person.role && !person.companyHint) {
    return { question: `what does ${first} do?`, about: person.name };
  }
  return null;
}

/**
 * Deterministic ack — the no-LLM assistant voice. The follow-up question is
 * deliberately NOT in the text: it renders separately (the ↪ line), one
 * surface per question.
 */
export function assistantFallbackReply(diff: TurnDiff): string {
  // A queued follow-up is the turn's salient commitment — ack it first.
  if (diff.actions.length > 0) {
    return 'noted — follow-up queued.';
  }
  const person = diff.persons[0];
  let ack = 'noted.';
  if (person) {
    const bits = [person.role, person.companyHint].filter(Boolean);
    ack = bits.length > 0 ? `noted — ${person.name}, ${bits.join(' at ')}.` : `noted — ${person.name}.`;
  } else if (diff.topics.length > 0) {
    ack = `noted — tagged ${diff.topics.slice(0, 3).join(', ')}.`;
  }
  return ack;
}

/** Pure prompt builder — turns the thread state into the agent prompt. */
export function buildAssistantPrompt(input: AssistantTurnInput): string {
  const followUp = input.followUp ?? assistantFollowUp(input.diff);
  const lines: string[] = [];
  lines.push(`user just logged: "${input.turnText.trim()}"`);
  lines.push('');
  lines.push('captured this turn:');
  if (input.diff.persons.length === 0 && input.diff.topics.length === 0 && input.diff.actions.length === 0) {
    lines.push('- nothing resolved from this turn');
  }
  for (const p of input.diff.persons) {
    const bits = [
      p.role ? `role: ${p.role}` : 'role: unknown',
      p.companyHint ? `company: ${p.companyHint}` : 'company: unknown',
    ];
    lines.push(`- person: ${p.name} — ${bits.join(' — ')}`);
  }
  if (input.diff.topics.length > 0) {
    lines.push(`- topics: ${input.diff.topics.join(', ')}`);
  }
  if (input.diff.actions.length > 0) {
    for (const a of input.diff.actions) {
      lines.push(`- follow-up queued: [${a.kind}] ${a.body}`);
    }
  }
  if (input.history.length > 0) {
    lines.push('');
    lines.push('earlier turns in this thread (oldest first):');
    for (const h of input.history) {
      lines.push(`- "${h.transcript}" → ${h.summary}`);
    }
  }
  lines.push('');
  if (followUp) {
    lines.push(
      `A follow-up question is already decided and renders separately: "${followUp.question}". Do NOT include the question in your reply — acknowledge only.`,
    );
  } else {
    lines.push('Ask no question — acknowledge only.');
  }
  return lines.join('\n');
}

/** One-line extraction summary for thread-history prompts. */
export function summarizeTurn(diff: TurnDiff): string {
  const bits: string[] = [];
  if (diff.persons.length > 0) {
    bits.push(diff.persons.map((p) => p.name).join(', '));
  }
  if (diff.topics.length > 0) {
    bits.push(`topics: ${diff.topics.slice(0, 3).join(', ')}`);
  }
  if (diff.actions.length > 0) {
    bits.push(`${diff.actions.length} follow-up${diff.actions.length === 1 ? '' : 's'}`);
  }
  return bits.length > 0 ? bits.join(' — ') : 'nothing resolved';
}

function singleChunk(text: string): AsyncIterable<string> {
  return (async function* () {
    yield text;
  })();
}

/**
 * Stream the assistant turn. Never throws: without a key, on agent error, or
 * on timeout the deterministic fallback streams instead. The caller aborts
 * via `signal` — a stalled stream is cut off at ASSISTANT_TIMEOUT_MS.
 */
export async function streamAssistantTurn(
  input: AssistantTurnInput,
  opts?: { agent?: Agent; timeoutMs?: number; signal?: AbortSignal },
): Promise<{ source: AssistantTurnSource; text: AsyncIterable<string> }> {
  const followUp = input.followUp ?? assistantFollowUp(input.diff);
  const fallbackText = assistantFallbackReply(input.diff);

  if (!env.OPENROUTER_API_KEY) {
    return { source: 'fallback', text: singleChunk(fallbackText) };
  }

  const timeoutMs = opts?.timeoutMs ?? ASSISTANT_TIMEOUT_MS;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const agent = opts?.agent ?? createChatAssistantAgent();
    const res = await agent.stream(buildAssistantPrompt({ ...input, followUp }), {
      abortSignal: controller.signal,
    });
    const textStream = res.textStream;
    return {
      source: 'llm',
      text: (async function* () {
        try {
          for await (const chunk of textStream) {
            if (controller.signal.aborted) return;
            if (chunk) yield chunk;
          }
        } catch (err) {
          // Mid-stream failure: the user keeps what arrived. Surface it in
          // the server log — never silently pretend the reply completed.
          console.error('[chat-assistant] mid-stream failure', err);
        } finally {
          clearTimeout(timer);
          opts?.signal?.removeEventListener('abort', onAbort);
        }
      })(),
    };
  } catch (err) {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onAbort);
    console.error('[chat-assistant] falling back to deterministic reply', err);
    return { source: 'fallback', text: singleChunk(fallbackText) };
  }
}
