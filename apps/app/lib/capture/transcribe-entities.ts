/**
 * Server-side helper: re-runs AssemblyAI entity_detection on a (possibly
 * user-edited) transcript at commit time.
 *
 * Locked decision #11 (2026-05-23 eng review A1): entity_detection moved
 * out of the transcribe route and into capture.commit so entities are
 * derived from the actually-committed transcript, not the original audio
 * transcript. Closes the trust-boundary gap where a client could otherwise
 * tamper with provider entities.
 *
 * NOTE on AssemblyAI's API surface: their batch transcription API expects
 * audio input. There is no documented text-only entity_detection endpoint
 * in their Node SDK as of @4.33.3. LeMUR operates on transcript IDs, not
 * raw text. Until AssemblyAI ships a text-input entity_detection (or we
 * pivot to a different NER provider), this helper returns `[]` — the
 * hybrid extractor handles empty entities gracefully and falls back to
 * Layer-2 heuristics + Layer-3 LLM (which is itself capable of structural
 * NER, just at higher cost than a span-level model).
 *
 * TODO(v0.1.2): re-evaluate provider for text-only NER, or cache the
 * transcribe route's entities keyed by transcript hash. See plan TODO §A1.
 */
import type { AssemblyAIEntity } from '@wingmic/extractor';
import { env } from '@/lib/config/env';

export async function transcribeEntities(transcript: string): Promise<AssemblyAIEntity[]> {
  if (!env.ASSEMBLYAI_API_KEY) return [];
  if (!transcript.trim()) return [];

  // AssemblyAI's batch entity_detection requires audio input. The text-only
  // path is not yet exposed in the Node SDK. Returning empty so the hybrid
  // extractor falls back cleanly. The transcript itself is the source of
  // truth — Layer-2 (heuristics) + Layer-3 (Haiku) operate on it directly.
  return [];
}
