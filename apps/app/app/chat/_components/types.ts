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
  | 'unknown_error';

export interface GraphResult {
  extracted: {
    persons: Array<{
      name: string;
      role: string | null;
      companyHint: string | null;
      topics: string[];
    }>;
    companies: Array<{ name: string }>;
    events: Array<{ name: string }>;
    topics: string[];
    actions: Array<{ kind: string; body: string; whenHint: string | null }>;
  };
  newEntities: number;
  matchedEntities: number;
  interactionId: string;
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
}

export interface ChatInitialItem {
  id: string;
  transcript: string;
  /** ISO string — `capturedAt` from the interactions table, serialized for the client. */
  capturedAt: string;
}
