/**
 * Typed contracts for the wingmic public REST API v1.
 * Shapes mirror docs/api.md (PR #180) — this client adds no fields of its own.
 */

export type ApiScope = 'graph:read' | 'capture:write' | 'search:read';

export type ApiErrorCode =
  | 'unauthorized'
  | 'insufficient_scope'
  | 'rate_limited'
  | 'bad_request'
  | 'not_found'
  | 'internal_error'
  // Client-side transport failure (DNS, connection refused, timeout) — not an
  // API-defined code, but surfaced through the same error type.
  | 'network_error';

export interface GraphNode {
  id: string;
  kind: string;
  label: string;
}

export interface GraphLink {
  source: string;
  target: string;
  rel: 'works_at' | 'attended' | 'discussed' | string;
  hub?: boolean;
}

export interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Person {
  id: string;
  name: string;
  importSource?: string;
}

export interface PeopleResponse {
  people: Person[];
}

export interface RecallCompany {
  id: string;
  name: string;
  domain: string | null;
  role?: string;
}

export interface RecallTopic {
  id: string;
  name: string;
}

export interface RecallEvent {
  id: string;
  name: string;
}

export interface RecallFact {
  key: string;
  value: string;
  confidence?: number;
}

export interface RecallEntity {
  id: string;
  name: string;
  aliases: string[];
  score: number;
  companies: RecallCompany[];
  events: RecallEvent[];
  topics: RecallTopic[];
  facts: RecallFact[];
}

export interface RecallResponse {
  entities: RecallEntity[];
  durationMs: number;
  mode: 'semantic' | 'text';
}

export interface CaptureAttachment {
  jpegBase64: string;
}

export interface CaptureInput {
  transcript: string;
  capturedAt?: string;
  clientCaptureId?: string;
  attachment?: CaptureAttachment;
}

/** Extraction buckets returned by POST /api/v1/capture. Buckets may be absent when empty. */
export interface CaptureExtracted {
  persons?: Array<Record<string, unknown>>;
  companies?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  topics?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
}

export interface CaptureResponse {
  extracted: CaptureExtracted;
  interactionId: string;
  entityIds: string[];
  attachments?: Array<Record<string, unknown>>;
}

export interface McpConfig {
  /** REST v1 base URL, no trailing slash (e.g. https://app.wingmic.xyz). */
  baseUrl: string;
  /** Bearer key of the form wk_live_<base64url>. Never logged. */
  apiKey: string;
}
