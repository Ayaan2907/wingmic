/**
 * POST /api/capture/transcribe
 *
 * Hosted capture transcribe endpoint. Accepts a single `audio` blob via
 * multipart/form-data, ships it to AssemblyAI, and returns the transcript.
 *
 * v0.1.1 "Hosted Capture" — Task H2.
 *
 * Locked decisions enforced here:
 *   #1  AssemblyAI direct (not via OpenRouter).
 *   #11 entity_detection does NOT run here — moved to capture.commit
 *       so entities are derived from the (possibly user-edited) transcript.
 *   #13 Server-side guardrails (constants in `_internals.ts`):
 *         - 3 MB byte cap on uploaded audio
 *         - 90 s duration cap (refuse to commit if AssemblyAI reports >90s)
 *         - 10 transcribes / minute per user (in-memory sliding window)
 *
 * Module-scoped state (rate limiter, lazy AssemblyAI client) and helpers
 * live in `./_internals.ts`. Next.js only allows specific exports from
 * route handler files; custom exports break `next build`.
 *
 * See: docs/superpowers/plans/2026-05-23-v0.1.1-hosted-capture.md §"Step 1"
 */
import { auth } from '@/lib/auth';
import {
  MAX_AUDIO_BYTES,
  MAX_DURATION_SECONDS,
  rateLimit,
  getClient,
  errorBody,
} from './_internals';

export const runtime = 'nodejs';

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
    return Response.json(
      errorBody('unauthenticated', 'sign in to record.'),
      { status: 401 },
    );
  }

  // 2. rate limit (check BEFORE reading body so abusive clients can't drain bandwidth)
  if (!rateLimit(userId)) {
    return Response.json(
      errorBody('rate_limited', 'too many transcribes in the last minute. wait a beat.'),
      { status: 429 },
    );
  }

  // 3. parse multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      errorBody('bad_request', 'expected multipart/form-data with an audio field.'),
      { status: 400 },
    );
  }
  const audio = form.get('audio');
  if (!(audio instanceof Blob)) {
    return Response.json(
      errorBody('bad_request', 'missing audio field.'),
      { status: 400 },
    );
  }

  // 4. byte cap
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json(
      errorBody('too_big', 'recording is over the 3 MB cap. trim it or re-record shorter.'),
      { status: 413 },
    );
  }

  // 5. AssemblyAI call
  const client = getClient();
  const buffer = Buffer.from(await audio.arrayBuffer());

  const t0 = performance.now();
  let transcript: { text?: string | null; audio_duration?: number | null; status?: string };
  try {
    transcript = await client.transcripts.transcribe({
      audio: buffer,
      speech_models: ['universal-2'],
      format_text: true,
      punctuate: true,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    console.error('[transcribe] AssemblyAI error:', err);
    return Response.json(
      errorBody(
        'provider_error',
        'transcribe failed upstream. the recording is still here — try again.',
        { provider: 'assemblyai', code },
      ),
      { status: 502 },
    );
  }
  const durationMs = Math.round(performance.now() - t0);

  // 6. duration cap (we paid for the call but refuse to commit)
  const audioDuration = transcript.audio_duration ?? 0;
  if (audioDuration > MAX_DURATION_SECONDS) {
    return Response.json(
      errorBody(
        'too_long',
        'clip is over the 90s cap. trim it or re-record shorter.',
      ),
      { status: 413 },
    );
  }

  // 7. empty transcript guard
  const text = (transcript.text ?? '').trim();
  if (!text) {
    return Response.json(
      errorBody(
        'transcript_empty',
        'the transcript came back blank. try again, closer to the mic.',
      ),
      { status: 422 },
    );
  }

  // 8. success
  return Response.json({ transcript: text, durationMs }, { status: 200 });
}
