// packages/bay/src/types.ts
// Shapes for the bay core. The contract is the merged product spec (locked decision 5
// and the scoring section) plus the module-by-module port map; this package is the
// typed source of truth for records, personas, profiles, and score cards.

/** The map's layers — the launch set from the spec. The db migration widens the
 * source enum separately; this pure core keeps the launch contract. */
export const BAY_CATEGORIES = [
  "housing",
  "sports",
  "tours",
  "hackathons",
  "offices",
  "startups",
  "events",
] as const;
export type BayCategory = (typeof BAY_CATEGORIES)[number];

export const BAY_TYPES = ["event", "place"] as const;
export type BayRecordType = (typeof BAY_TYPES)[number];

/** Per-source stable ids: "luma:<api_id>", "seed:<slug>". */
export const BAY_SOURCES = ["seed", "luma", "eventbrite"] as const;
export type BaySource = (typeof BAY_SOURCES)[number];

/** The normalized store record: allow-listed fields only. Dates are UTC ISO strings. */
export interface BayRecord {
  id: string;
  type: BayRecordType;
  category: BayCategory;
  title: string;
  source: BaySource;
  venue?: string;
  address?: string;
  note?: string;
  url?: string;
  sourceUrl?: string;
  lat?: number;
  lng?: number;
  startsAt?: string;
  endsAt?: string;
  expiresAt?: string;
  fetchedAt: string;
  firstSeenAt: string;
}

/** Loose input to normalizeRecord — junk in, { ok: false } out. */
export type RecordInput = {
  id?: unknown;
  type?: unknown;
  category?: unknown;
  title?: unknown;
  source?: unknown;
  venue?: unknown;
  address?: unknown;
  note?: unknown;
  url?: unknown;
  sourceUrl?: unknown;
  lat?: unknown;
  lng?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  expiresAt?: unknown;
  fetchedAt?: unknown;
  firstSeenAt?: unknown;
  [key: string]: unknown;
};

export type NormalizeResult = { ok: true; record: BayRecord } | { ok: false; error: string };

/** Records that can be persona-ranked: store records (plural `category`) and the
 * static places GeoJSON (singular `cat`). personaFit reads both. */
export interface PersonaFitRecord {
  id?: unknown;
  category?: string;
  cat?: string;
  title?: string;
  name?: string;
  note?: string;
  venue?: string;
  address?: string;
}

export interface Persona {
  id: string;
  label: string;
  button: string;
  intent: string;
  why: string;
  /** Every store category gets an explicit weight so a record type is never
   * silently read as something else. */
  categories: Record<BayCategory, number>;
  tokens: string[];
}

export interface PersonaFitEntry {
  id: string;
  fit: number;
}

export type ProfileKind = "pasted" | "throwaway" | "wingmic";

/** Structured viewer profile, allow-list only. `raw` carries the pasted text. */
export interface ViewerProfile {
  kind: ProfileKind;
  name?: string;
  headline?: string;
  roles: string[];
  topics: string[];
  goals: string[];
  links: Partial<Record<"linkedin" | "github" | "x" | "site", string>>;
  raw?: string;
}

export type ProfileQuality = "ok" | "thin" | "none";

export interface HeuristicResult {
  go: number;
  confidence: number;
  facts: { pFit: number; gFit: number; net: number; soon: number };
}

export type Verdict = "go" | "maybe" | "skip";

export interface Meet {
  who: string;
  why: string;
  starter?: string | null;
}

export interface ScoreCard {
  go: number;
  verdict: Verdict;
  confidence: number;
  outcome: string;
  reasons: string[];
  meet: Meet[];
  scorer: "typed" | "llm";
}

export interface FitRank {
  rank: number;
  of: number;
  fit: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatFn = (
  messages: ChatMessage[],
  opts?: { model?: string | null },
) => Promise<string>;

/** The internal service boundary (locked decision 5): the shape of the old
 * `_wingmic.js` client, kept so the score pipeline ports with minimal churn.
 * The signed-in implementation reads the graph directly (router task); the mock
 * client here is a test fixture, labeled as demo everywhere it surfaces. */
export interface WingmicClient {
  label: string;
  /** true when getProfile resolves a real profile (mock fixture); false when the
   * backing api has no self-profile read and scoring leans on networkOverlap. */
  selfProfile: boolean;
  getProfile(token: string): Promise<ViewerProfile | null>;
  networkOverlap(token: string, ctx: { event: BayRecord; k?: number }): Promise<Meet[]>;
  verify(token: string): Promise<VerifyResult>;
  capture(token: string, payload: { text: string; id?: string }): Promise<boolean>;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "unauthorized" | "missing_scope" | "rate_limited"; missingScope?: string };

/** The key is dead (unknown or revoked) — a credential problem, not an outage.
 * Callers surface it (the route maps it to 401) instead of scoring a silently
 * empty network. */
export class WingmicAuthError extends Error {
  constructor() {
    super("wingmic key did not resolve");
    this.name = "WingmicAuthError";
  }
}

export interface IngestSourceResult {
  name: string;
  records: BayRecord[];
  errors: string[];
  skipped?: string;
}

export interface IngestTypeSummary {
  total: number;
  created: number;
  updated: number;
  incoming: number;
  /** store-file records that failed the contract on read — surfaced, never swallowed. */
  readErrors?: string[];
}

export interface IngestSummary {
  dryRun: boolean;
  dataDir: string;
  ranAt: string;
  sources: { name: string; fetched: number; errors: string[]; skipped?: string }[];
  events: IngestTypeSummary | null;
  places: IngestTypeSummary | null;
}

export interface EventSummary {
  id: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  venue?: string;
  url?: string;
}

export type ScoreErrorKind =
  | "bad_request"
  | "bad_persona"
  | "bad_source"
  | "profile_needed"
  | "unknown_event"
  | "expired_event"
  | "wingmic_auth"
  | "wingmic_unavailable";

export type ScoreOutcome =
  | {
      ok: true;
      event: EventSummary;
      score: ScoreCard;
      fit: FitRank | null;
      profile: { kind: string; quality: ProfileQuality };
      ai: boolean;
    }
  | { ok: false; error: ScoreErrorKind; message?: string };

export interface BayRead {
  records: BayRecord[];
  total: number;
  expired: number;
  store: "store" | "seed";
  sources: string[];
  asOf: string;
}
