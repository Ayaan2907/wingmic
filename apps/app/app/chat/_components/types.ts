// Shared types for the chat surface (PR β₁-A split).
//
// Lifted from CaptureClient verbatim — same shapes the recorder hook +
// the capture pipeline have always used. Centralized here so ChatClient,
// ChatThread, ChatHeader, and CaptureDock all import from one place.

export type BubbleStatus =
  | 'queued'
  | 'uploading'
  | 'transcribing'
  | 'linking'
  | 'committed'
  | 'answering'
  | 'answered'
  | 'failed'
  | 'deleted';

export type FailureCode =
  | 'provider_error'
  | 'rate_limited'
  | 'too_big'
  | 'too_long'
  | 'transcript_empty'
  | 'NotAllowedError'
  | 'network'
  | 'commit_failed'
  | 'ask_failed'
  | 'unknown_error';

export interface AskMatch {
  id: string;
  name: string;
  role: string;
  company: string;
  topics: string[];
  score: number;
}

/**
 * Per-field provenance (spec: every entity field carries provenance).
 * `source` is who produced the value — 'user' (said in the capture),
 * 'enrichment' (web/enrichment facts), 'import' (vcard/linkedin import).
 * `confidence` is the entity_fact confidence the field came from.
 */
export interface FieldProvenance {
  source: 'user' | 'enrichment' | 'import';
  confidence: number;
}

export interface AskResult {
  matches: AskMatch[];
  durationMs: number;
  mode?: 'semantic' | 'text';
}

export interface GraphResult {
  extracted: {
    persons: Array<{
      name: string;
      role: string | null;
      companyHint: string | null;
      topics: string[];
      linkedin?: string | null;
      /** Per-field provenance when known (hydrated from entity_fact confidences). */
      fieldProvenance?: {
        role?: FieldProvenance;
        companyHint?: FieldProvenance;
        linkedin?: FieldProvenance;
      };
    }>;
    companies: Array<{ name: string }>;
    events: Array<{ name: string }>;
    topics: string[];
    actions: Array<{
      kind: string;
      body: string;
      whenHint: string | null;
      targetPersonName?: string | null;
    }>;
  };
  newEntities: number;
  matchedEntities: number;
  interactionId: string;
  /**
   * IDs surfaced by the commit pipeline (resolution.ts). Positional with
   * `extracted.persons`. Companies/events are deduped by name on the server,
   * so we ship `[...map.values()]` alongside the extracted arrays — the
   * scaffold matches by index in the response, not by name. Optional for
   * back-compat with past-prefetch bubbles and tests.
   */
  entityIds?: string[];
  companyIds?: string[];
  eventIds?: string[];
  attachments?: Array<{
    id: string;
    entityId: string | null;
    jpegBase64: string | null;
  }>;
  /**
   * Entity-level provenance from capture.commit (live) or hydration
   * (prefetch). Live captures are 'user'; per-field detail rides on the
   * person rows above.
   */
  provenance?: {
    source: 'user' | 'enrichment' | 'import';
    persons: Array<{ entityId: string; created: boolean; confidence: number }>;
  };
}

export interface ThreadMessage {
  id: string;
  status: BubbleStatus;
  audioBlob: Blob | null;
  transcript: string | null;
  /** recording duration in ms */
  duration: number;
  transcribeMs: number | null;
  commitMs: number | null;
  graphResult: GraphResult | null;
  error: { code: FailureCode; message: string } | null;
  createdAt: Date;
  /** when transcribing started — for live elapsed counter */
  transcribingStartedAt: number | null;
  /** local-only paste fallback flag */
  fromPaste: boolean;
  /** memo vs ask routing (#59) */
  intent?: 'memo' | 'ask';
  ask?: AskResult | null;
  /** Local preview of a pending / just-committed JPEG. */
  previewJpegBase64?: string | null;
  /**
   * The current-event session this capture was bound to — frozen when the
   * pipeline entered `linking`, rendered as the bubble's inline chip
   * ("→ at NEXA summit", D2 visual half). Optional for seeded bubbles.
   */
  boundEvent?: { eventId: string; name: string } | null;
  /** 'assistant' bubbles stream the capture-conversation reply (default 'user'). */
  role?: 'user' | 'assistant';
  /** Assistant-only: streamed reply text so far. */
  streamText?: string;
  /** Assistant-only: true once the done/error SSE event arrived. */
  streamDone?: boolean;
  /** Assistant-only: the deterministic follow-up question, when one is warranted. */
  followUp?: string | null;
}

export interface ChatInitialItem {
  id: string;
  transcript: string;
  /** ISO string — `capturedAt` from the interactions table, serialized for the client. */
  capturedAt: string;
  /** Rebuilt from facts/topics/acts on prefetch so AgentReply survives refresh. */
  graphResult?: GraphResult | null;
}
