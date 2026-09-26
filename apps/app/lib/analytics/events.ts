/**
 * Locked analytics event taxonomy — spec art_LkglG0Xb, "Analytics".
 *
 * Single source of truth for every PostHog event Wingmic emits. The locked
 * taxonomy is exactly these twelve events:
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
 * The bay funnel (merged-product spec, locked decision 7) measures the
 * anonymous stranger → claimed account path over the /bay map:
 *
 *   map_view          — the /bay map rendered for a visitor
 *   ask_run           — an accepted ask entered the bay pipeline (after the
 *                       rate/persona guards — 429 noise is not product signal)
 *   event_opened      — a bay event detail fetch resolved (a card read; live
 *                       or expired history)
 *   score_shown       — a bay score returned ok (a score was actually shown)
 *   claim_started     — a signed-in viewer started claiming a throwaway
 *                       profile into the graph
 *
 * `map_view` fires from the /bay server component render (apps/app/app/bay/
 * page.tsx) — the only funnel event driven outside a tRPC procedure, because
 * a render is what it measures.
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

import type { ProfileKind } from '@wingmic/bay';

export const ANALYTICS_EVENTS = {
  captureStarted: 'capture_started',
  captureCompleted: 'capture_completed',
  enrichmentRun: 'enrichment_run',
  entityCreated: 'entity_created',
  searchRun: 'search_run',
  apiCall: 'api_call',
  signup: 'signup',
  // bay funnel
  mapView: 'map_view',
  askRun: 'ask_run',
  eventOpened: 'event_opened',
  scoreShown: 'score_shown',
  claimStarted: 'claim_started',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Every taxonomy event name. The taxonomy test iterates this list and fails
 * when an event has no instrumentation point driving it. */
export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = Object.values(
  ANALYTICS_EVENTS,
);

/**
 * Every taxonomy event has a live server instrumentation point — this list is
 * empty and kept as the enforcement seam: a new event whose call site lands in
 * a later PR goes here until that PR ships. Typed as AnalyticsEventName so a
 * typo cannot sneak in.
 */
export const PENDING_INSTRUMENTATION: readonly AnalyticsEventName[] = [];

/**
 * Analytics distinctId for signed-out bay traffic. One fixed, PII-free
 * bucket: no per-visitor identity exists server-side, so PostHog funnels
 * chain anonymous steps under it while signed-in events key on the real
 * user id. Shared by the bay router and the /bay page render (map_view) —
 * dashboards can filter it out of user counts by name.
 */
export const BAY_ANONYMOUS_ID = 'bay_anonymous';

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

// ── Bay funnel property shapes ───────────────────────────────────────────
//
// The bay is anonymous-first (locked decision 3): signed-out funnel events
// aggregate under one fixed, PII-free distinctId bucket ('bay_anonymous',
// see the bay router) because no server principal exists before claim.

export type MapViewProperties = {
  signedIn: boolean;
  /** Validated persona view id, when the visitor arrived with one. */
  persona?: string;
};

export type AskRunProperties = {
  signedIn: boolean;
  /** The viewer handed the ask a browser-held profile (paste or fields). */
  hasClientProfile: boolean;
  persona?: string;
};

export type EventOpenedProperties = {
  /** Record provenance — the BAY_SOURCES enum from @wingmic/bay. */
  source: 'luma' | 'partiful' | 'web' | 'meetup' | 'ics' | 'submitted' | 'seed';
  /** false = the card read resolved to retained (expired) history. */
  live: boolean;
};

export type ScoreShownProperties = {
  signedIn: boolean;
  verdict: 'go' | 'maybe' | 'skip';
  /** typed = the deterministic anchor, llm = the clamped explainer. */
  scorer: 'typed' | 'llm';
  /** The score pipeline's resolved profile kind — the core's own taxonomy. */
  profileKind: ProfileKind;
  /** ok | thin | none — how much of a viewer the score had to work with. */
  profileQuality: 'ok' | 'thin' | 'none';
  /** The clamped LLM explainer produced the wording. */
  ai: boolean;
  persona?: string;
};

export type ClaimStartedProperties = {
  /** The submission shape — raw paste vs structured fields. The resolved
   * core kind lands on score_shown.profileKind (a claim fires before any
   * profile parses, so its shape is all a start attempt can honestly say). */
  submittedKind: 'text' | 'structured';
  /** The profile asserts an external identity (drives identity_claim rows). */
  hasLinks: boolean;
};
