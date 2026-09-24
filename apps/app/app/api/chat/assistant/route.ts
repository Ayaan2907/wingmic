/**
 * POST /api/chat/assistant — the assistant turn of the capture conversation
 * (spec art_LkglG0Xb "Chat-first capture").
 *
 * Client flow per turn: `capture.commit` settles first (the locked tRPC
 * contract — caps, idempotency, enrichment scheduling stay there), then the
 * client calls this route with the committed interactionId. The route
 * rebuilds the turn's extraction diff from the graph (hydrateThreadItems —
 * the same join the prefetch uses), loads the recent thread turns as
 * history, and streams the assistant reply over Server-Sent Events:
 *
 *   data: {"type":"token","text":"..."}
 *   ...
 *   data: {"type":"done","followUp":{"question":"...","about":"..."},"source":"llm"}
 *
 * The followUp decision is the deterministic pure rule (assistantFollowUp) —
 * streamed prose may vary, the question does not. Without OPENROUTER_API_KEY
 * the deterministic fallback text streams instead of the LLM. Every stream
 * ends in `done` or `error` — the client never hangs.
 *
 * Auth + guardrails mirror /api/capture/transcribe: BetterAuth session,
 * per-user in-memory rate limit, ownership checks on the interaction.
 *
 * Next.js only allows specific exports from route handler files; helpers
 * live in @/lib/chat/assistant (unit-tested there).
 */
import { and, desc, eq, isNull, lte, ne } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { hydrateThreadItems } from '@/lib/chat/hydrateThread';
import { consumeDailyUsage, DAILY_LIMITS } from '@/lib/usage/dailyCap';
import {
  assistantFollowUp,
  streamAssistantTurn,
  summarizeTurn,
  type TurnDiff,
  type TurnHistoryItem,
} from '@/lib/chat/assistant';

export const runtime = 'nodejs';

/** Turns of conversation history the assistant sees (oldest first). */
const HISTORY_TURNS = 8;
/** In-memory sliding-window rate limit per user (assistant LLM calls). */
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateWindows = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateWindows.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateWindows.set(userId, hits);
    return true;
  }
  hits.push(now);
  rateWindows.set(userId, hits);
  return false;
}

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  // 1. session
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch {
    session = null;
  }
  const userId = session?.user?.id;
  if (!userId) {
    return errorResponse('unauthenticated', 'sign in to chat.', 401);
  }

  // 2. rate limit (in-memory burst control) + daily cap (DB-backed, survives
  // deploys) — every turn is an OpenRouter call, so replaying an interactionId
  // must still spend against a persistent counter.
  if (rateLimited(userId)) {
    return errorResponse('rate_limited', 'too many assistant turns in a minute — wait a beat.', 429);
  }
  if (!(await consumeDailyUsage(db, userId, 'assistant'))) {
    return errorResponse(
      'rate_limited',
      `that's ${DAILY_LIMITS.assistant} assistant turns today — the cap resets at midnight utc.`,
      429,
    );
  }

  // 3. body
  let interactionId: string;
  try {
    const body = (await req.json()) as { interactionId?: unknown };
    if (typeof body.interactionId !== 'string' || body.interactionId.length === 0) {
      return errorResponse('bad_request', 'interactionId is required.', 400);
    }
    interactionId = body.interactionId;
  } catch {
    return errorResponse('bad_request', 'body must be JSON.', 400);
  }

  // 4. the committed turn (owned, not deleted)
  const turn = await db.query.interactions.findFirst({
    where: and(
      eq(schema.interactions.id, interactionId),
      eq(schema.interactions.userId, userId),
      eq(schema.interactions.status, 'committed'),
      isNull(schema.interactions.deletedAt),
    ),
  });
  if (!turn) {
    return errorResponse('not_found', 'turn not found.', 404);
  }

  // 5. hydrate this turn + recent prior turns into diffs (same joins as the
  // chat prefetch — facts/topics/acts by sourceInteractionId).
  const priorRows = await db.query.interactions.findMany({
    where: and(
      eq(schema.interactions.userId, userId),
      ne(schema.interactions.id, turn.id),
      lte(schema.interactions.capturedAt, turn.capturedAt),
      // Failed/never-committed interactions have transcripts but no graph —
      // their raw text must not ride into the assistant's history.
      eq(schema.interactions.status, 'committed'),
      isNull(schema.interactions.deletedAt),
    ),
    columns: { id: true, transcript: true, capturedAt: true },
    orderBy: [desc(schema.interactions.capturedAt)],
    limit: HISTORY_TURNS,
  });

  const [hydratedTurn, hydratedPrior] = await Promise.all([
    hydrateThreadItems(db, userId, [turn]),
    hydrateThreadItems(
      db,
      userId,
      priorRows,
    ),
  ]);
  const hydrated = hydratedTurn[0];
  if (!hydrated) {
    return errorResponse('not_found', 'turn not found.', 404);
  }

  const diff: TurnDiff = {
    persons: hydrated.graphResult.extracted.persons.map((p) => ({
      name: p.name,
      role: p.role,
      companyHint: p.companyHint,
    })),
    topics: hydrated.graphResult.extracted.topics,
    actions: hydrated.graphResult.extracted.actions.map((a) => ({
      kind: a.kind,
      body: a.body,
    })),
  };

  const history: TurnHistoryItem[] = hydratedPrior
    .slice()
    .reverse()
    .map((item) => ({
      transcript: item.transcript,
      summary: summarizeTurn({
        persons: item.graphResult.extracted.persons.map((p) => ({
          name: p.name,
          role: p.role,
          companyHint: p.companyHint,
        })),
        topics: item.graphResult.extracted.topics,
        actions: item.graphResult.extracted.actions.map((a) => ({ kind: a.kind, body: a.body })),
      }),
    }));

  // 6. stream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (payload: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(sseChunk(payload));
      };
      req.signal.addEventListener('abort', () => {
        closed = true;
      });
      try {
        const followUp = assistantFollowUp(diff);
        const { source, text } = await streamAssistantTurn(
          { turnText: turn.transcript, diff, history, followUp },
          { signal: req.signal },
        );
        for await (const chunk of text) {
          if (closed) break;
          send({ type: 'token', text: chunk });
        }
        send({ type: 'done', source, followUp });
      } catch (err) {
        console.error('[chat-assistant] turn failed', err);
        if (!closed) {
          send({
            type: 'error',
            message: 'the assistant stalled on that one — your capture landed.',
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by an abort — nothing to do.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
