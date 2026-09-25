// packages/bay/src/service.ts
// the score pipeline, re-expressed at service level from the old score route: resolve
// the viewer (wingmic boundary or the throwaway client-side profile), rank, type, and
// explain. the http shape (status codes, headers) is the router task's job (todo_8CudacYO);
// this module returns typed outcomes the router maps 1:1.
// ported from ayaan-site api/score.js (1bca780) - same resolution order, same error
// kinds and copy, same degrade rules.

import type {
  BayRead,
  BayRecord,
  ChatFn,
  FitRank,
  Meet,
  PersonaFitEntry,
  ScoreCard,
  ScoreOutcome,
  ViewerProfile,
  WingmicClient,
} from "./types.js";
import { WingmicAuthError } from "./types.js";
import {
  buildProfile,
  fallbackExplain,
  heuristicScore,
  llmScore,
  profileText,
  retrieve,
  tokenize,
} from "./scoring.js";
import { combineGoal, rank as rankRecords, resolvePersona } from "./personas.js";
import { loadStoreOrSeed, liveFilter, sourcesOf } from "./contract.js";
import { overlapSafely } from "./client.js";

// serve-time cache hint the read routes advertise (carried from the old handler).
export const READ_CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,256}$/;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/* ---------- the read model (the old storeHandler, minus http) ---------- */

// the live bay for one type: serve-time expiry applied, sources and asOf honest.
export function readBay(
  type: "events" | "places",
  options: { dataDir: string; now?: number },
): BayRead {
  const now = options.now ?? Date.now();
  const store = loadStoreOrSeed(options.dataDir, type);
  const { live, expiredCount } = liveFilter(store.records, now);
  return {
    records: live,
    total: live.length,
    expired: expiredCount,
    store: store.fromStore ? "store" : "seed",
    sources: sourcesOf(live),
    asOf: new Date(now).toISOString(),
  };
}

// persona view over a record set: the ranked block the map and ask read. unknown
// personas are an error, never a silent unranked 200.
export function personaView(
  personaId: string,
  records: BayRecord[],
): { ok: true; persona: { id: string; label: string; ranked: PersonaFitEntry[] } } | { ok: false; error: "bad_persona" } {
  const persona = resolvePersona(personaId);
  if (!persona) return { ok: false, error: "bad_persona" };
  return {
    ok: true,
    persona: { id: persona.id, label: persona.label, ranked: rankRecords(persona, records) },
  };
}

/* ---------- capabilities (the old GET /api/score probe, as data) ---------- */

export interface Capabilities {
  ai: boolean;
  provider: string;
  model: string | null;
  wingmic: string;
}

export function capabilities({
  chat = null,
  model = null,
  client = null,
}: { chat?: ChatFn | null; model?: string | null; client?: WingmicClient | null } = {}): Capabilities {
  return {
    ai: chat != null,
    provider: chat ? "configured" : "none",
    model: chat ? model : null,
    wingmic: client ? client.label : "unavailable",
  };
}

/* ---------- the score pipeline (the old POST /api/score) ---------- */

export interface ScoreEventInput {
  eventId: unknown;
  wingmicToken?: unknown;
  profile?: unknown;
  source?: unknown;
  goal?: unknown;
  personaId?: unknown;
}

export interface ScoreEventDeps {
  /** live event records (already loaded - the router owns the store read). */
  events: BayRecord[];
  client?: WingmicClient | null;
  chat?: ChatFn | null;
  model?: string | null;
  now?: number;
}

// one event, one viewer. typed outcome; the router maps error kinds to statuses
// (400 / 401 / 404 / 410 / 503) exactly as the old route did.
export async function scoreEvent(input: ScoreEventInput, deps: ScoreEventDeps): Promise<ScoreOutcome> {
  const now = deps.now ?? Date.now();

  // 1. the ask: event id, viewer, goal.
  if (typeof input.eventId !== "string" || !input.eventId.trim())
    return { ok: false, error: "bad_request" };
  const eventId = input.eventId.trim();

  const token =
    typeof input.wingmicToken === "string" && TOKEN_RE.test(input.wingmicToken)
      ? input.wingmicToken
      : null;

  const personaId = typeof input.personaId === "string" && input.personaId ? input.personaId : null;
  if (input.personaId != null && input.personaId !== "" && !resolvePersona(personaId))
    return { ok: false, error: "bad_persona" };
  const goal = typeof input.goal === "string" ? input.goal.slice(0, 400) : "";

  // 2. the event. 404 unknown; 410 known-but-over - nothing is silently deleted.
  const live = deps.events.filter((e) => e.type === "event");
  const event = live.find((e) => e.id === eventId);
  if (!event) return { ok: false, error: "unknown_event" };

  // 3. the viewer: wingmic boundary first, then the throwaway client-side profile.
  let profile: ViewerProfile | null = null;
  let kind = "throwaway";
  if (token) {
    const client = deps.client;
    if (!client) return { ok: false, error: "wingmic_unavailable" };
    let wp: ViewerProfile | null;
    try {
      wp = await client.getProfile(token);
    } catch (e) {
      if (e instanceof WingmicAuthError) return { ok: false, error: "wingmic_auth" };
      throw e;
    }
    if (!wp && client.selfProfile !== false)
      return { ok: false, error: "wingmic_auth", message: "that wingmic key did not resolve; sign in again" };
    profile = wp;
    kind = "wingmic";
  } else {
    const built = buildProfile({ profile: input.profile, source: input.source });
    if (!built.profile) {
      return {
        ok: false,
        error: input.source && !input.profile ? "bad_source" : "profile_needed",
        message:
          input.source && !input.profile
            ? "that does not look like a linkedin url; paste a few lines about yourself instead"
            : "paste your profile or a linkedin url so the score means something",
      };
    }
    profile = built.profile;
  }

  // 4. rank: fit of this event across the live set, so "why this one" has a number
  // that means something. no profile words -> no rank claim.
  const pText = profileText(profile);
  const ranked = retrieve(pText, live);
  const rank = ranked.findIndex((r) => r.record.id === eventId) + 1;
  const fit: FitRank | null = tokenize(pText).length
    ? { rank, of: live.length, fit: ranked[Math.max(0, rank - 1)].fit }
    : null;

  // 5. network overlap for signed-in viewers; degrade-to-[] on trouble, dead key cuts through.
  let meets: Meet[] = [];
  if (token && deps.client) {
    try {
      meets = await overlapSafely(deps.client, token, { event, k: 3 });
    } catch (e) {
      if (e instanceof WingmicAuthError)
        return { ok: false, error: "wingmic_auth", message: "that wingmic key did not resolve; sign in again" };
      throw e;
    }
  }

  // 6. type first, then explain: the llm may move the words, never the anchor beyond
  // its clamp. no key (or a failed call) -> deterministic templates.
  const goalText = combineGoal(personaId, goal);
  const h = heuristicScore({ profile, event, goal: goalText, meets, now, fit: fit ? fit.fit : null });
  let score: ScoreCard;
  let ai = false;
  if (deps.chat) {
    try {
      score = await llmScore({
        chat: deps.chat,
        model: deps.model,
        heuristic: h,
        profile,
        event,
        goal: goalText,
        meets,
        fitRank: fit,
      });
      ai = true;
    } catch {
      // a score never fails because the explainer did
      score = fallbackExplain(h, { profile, event, goal: goalText, meets });
    }
  } else {
    score = fallbackExplain(h, { profile, event, goal: goalText, meets });
  }

  return {
    ok: true,
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: event.venue,
      url: event.url,
    },
    score,
    fit,
    profile: { kind, quality: profileQualityOf(profile) },
    ai,
  };
}

// duplicated quality math would be drift; reuse the scorer's own calibration.
function profileQualityOf(p: ViewerProfile | null) {
  const q = p || ({} as ViewerProfile);
  const signals =
    (q.topics || []).length +
    (q.roles || []).length +
    (q.goals || []).length +
    (q.headline ? 1 : 0) +
    (q.raw && q.raw.length > 40 ? 2 : 0);
  return signals >= 3 ? ("ok" as const) : ("thin" as const);
}

// round-trip helper the router may use to normalize numbers in responses.
export const roundFor = (n: number): number => round2(n);
