/**
 * POST /api/demo/capture
 *
 * Public landing-page demo. Accepts multipart:
 *   - `audio` → AssemblyAI transcribe + extractHybrid (production path)
 *   - `transcript` → extractHybrid only (local dev fallback via browser STT)
 * Nothing is saved to the graph.
 */
import { extractHybrid } from '@wingmic/extractor';
import {
  MAX_AUDIO_BYTES,
  MAX_DURATION_SECONDS,
  clientIp,
  corsHeaders,
  errorBody,
  getClient,
  jsonWithCors,
  rateLimit,
} from './_internals';

export const runtime = 'nodejs';

const MAX_TRANSCRIPT_CHARS = 10_000;

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function respond(origin: string | null, transcript: string) {
  const extracted = await extractHybrid({ transcript });
  return jsonWithCors({ transcript, extracted }, { status: 200, origin });
}

export async function POST(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');

  if (!rateLimit(clientIp(req))) {
    return jsonWithCors(errorBody('rate_limited', 'too many demo tries — wait a minute.'), {
      status: 429,
      origin,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonWithCors(
      errorBody('bad_request', 'expected multipart/form-data with audio or transcript.'),
      { status: 400, origin },
    );
  }

  const transcriptField = form.get('transcript');
  if (typeof transcriptField === 'string' && transcriptField.trim()) {
    const text = transcriptField.trim();
    if (text.length > MAX_TRANSCRIPT_CHARS) {
      return jsonWithCors(errorBody('bad_request', 'transcript is too long.'), {
        status: 400,
        origin,
      });
    }
    return respond(origin, text);
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return jsonWithCors(errorBody('bad_request', 'missing audio or transcript.'), {
      status: 400,
      origin,
    });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return jsonWithCors(errorBody('too_big', 'recording is too large — keep it under 30 seconds.'), {
      status: 413,
      origin,
    });
  }

  let client;
  try {
    client = getClient();
  } catch {
    return jsonWithCors(
      errorBody('unavailable', 'transcribe offline — use Chrome and speak clearly.'),
      { status: 503, origin },
    );
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  let transcript: { text?: string | null; audio_duration?: number | null };
  try {
    transcript = await client.transcripts.transcribe({
      audio: buffer,
      speech_models: ['universal-2'],
      format_text: true,
      punctuate: true,
    });
  } catch (err) {
    console.error('[demo/capture] AssemblyAI error:', err);
    return jsonWithCors(
      errorBody('provider_error', "couldn't transcribe that — try again, closer to the mic."),
      { status: 502, origin },
    );
  }

  const audioDuration = transcript.audio_duration ?? 0;
  if (audioDuration > MAX_DURATION_SECONDS) {
    return jsonWithCors(errorBody('too_long', 'keep demo clips under 30 seconds.'), {
      status: 413,
      origin,
    });
  }

  const text = (transcript.text ?? '').trim();
  if (!text) {
    return jsonWithCors(
      errorBody('transcript_empty', "didn't catch speech — tap the mic and try again."),
      { status: 422, origin },
    );
  }

  return respond(origin, text);
}
