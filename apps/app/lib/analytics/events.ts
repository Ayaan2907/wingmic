/**
 * Locked analytics event taxonomy — spec art_LkglG0Xb, "Analytics".
 *
 * Single source of truth for every PostHog event Wingmic emits. The locked
 * taxonomy is exactly these seven events:
 *
 *   capture_started   — a capture turn entered the commit pipeline
 *   capture_completed — the capture committed to the graph (or resolved as an
 *                       idempotent retry of an already-committed capture)
 *   enrichment_run    — one background enrichment unit finished (person web
 *                       lookup, or event field patch)
 *   entity_created    — the graph grew: per-capture entity volume counts
 *   search_run        — one recall.query completed (semantic or text mode)
 *   api_call          — one authenticated /api/v1 request completed
 *   signup            — a BetterAuth user row was created
 *
 * Every event is captured server-side (posthog-node) — no taxonomy event
 * originates in the browser, so no client SDK ships. See docs/analytics.md
 * for the reasoning and the dashboard setup.
 *
 * Properties are deliberately bounded: booleans, small counts, and fixed
 * enums only. Never add free text, emails, names, or message/transcript
 * content — `sanitizeAnalyticsProperties` in ./server drops non-primitives
 * as a backstop, but the guarantee starts here at the call sites.
 */

export const ANALYTICS_EVENTS = {
  captureStarted: 'capture_started',
  captureCompleted: 'capture_completed',
  enrichmentRun: 'enrichment_run',
  entityCreated: 'entity_created',
  searchRun: 'search_run',
  apiCall: 'api_call',
  signup: 'signup',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Every taxonomy event name. The taxonomy test iterates this list and fails
 * when an event has no instrumentation point driving it. */
export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = Object.values(
  ANALYTICS_EVENTS,
);

// ── Per-event property shapes (all bounded, all PII-free) ────────────────

export type CaptureStartedProperties = {
  hasAttachment: boolean;
  hasParent: boolean;
  hasTarget: boolean;
};

export type CaptureCompletedProperties = {
  duplicate: boolean;
  hasAttachment: boolean;
  newEntities: number;
  matchedEntities: number;
  actions: number;
  actsPending: number;
  durationMs: number;
};

export type EntityCreatedProperties = {
  newEntities: number;
  matchedEntities: number;
  persons: number;
  companies: number;
  events: number;
  topics: number;
};

export type EnrichmentRunProperties = {
  /** Which enrichment unit ran. Extending this enum is a spec change. */
  kind: 'person' | 'event';
  status: 'ok' | 'error';
  /** Facts written (person) or fields patched (event). 0 on error. */
  fields: number;
};

export type SearchRunProperties = {
  mode: 'semantic' | 'text';
  results: number;
  durationMs: number;
};

export type ApiCallProperties = {
  method: string;
  /** Static route path (no dynamic segments on /api/v1). */
  route: string;
  scope: string;
  status: number;
};

export type SignupProperties = {
  method: 'magic_link';
};
