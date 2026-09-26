// packages/bay/src/meetup.ts
// meetup — the oauth-gated rung of the source ladder. graphql over
// api.meetup.com/gql2 with a bearer token; the token comes from the oauth2
// client-credentials exchange at secure.meetup.com/oauth2/access (or an
// operator-minted MEETUP_ACCESS_TOKEN — meetup's own docs only clearly document
// the authorization-code exchange, so the pre-minted override is the escape
// hatch if the client-credentials grant is refused for a given client).
//
// rate budget: meetup documents ~500 points per 60 seconds. the per-request
// cost below is a conservative placeholder until a live credential can measure
// the real query complexity — the limiter is the part that must be right, and
// its budget and window are configurable.
//
// absence contract (locked decision 4): no credentials → the source is SKIPPED
// with a summary line, not an error. luma and the feeds must work without it.

import { normalizeRecord } from "./contract.js";
import type { BayRecord, IngestSourceResult, NormalizeResult, RecordInput } from "./types.js";

export const MEETUP_GRAPHQL_URL = "https://api.meetup.com/gql2";
export const MEETUP_TOKEN_URL = "https://secure.meetup.com/oauth2/access";
export const MEETUP_QUERY_COST = 25; // points per page request (placeholder, see header)
export const MEETUP_BUDGET_POINTS = 500; // documented api budget per window
export const MEETUP_BUDGET_WINDOW_MS = 60_000;
export const MEETUP_PAGE_SIZE = 25;
export const MEETUP_MAX_PAGES = 3;
export const MEETUP_FETCH_TIMEOUT_MS = 15_000;
// the bay area read: sf center + a radius over the whole peninsula band
export const MEETUP_BAY = { lat: 37.7749, lon: -122.4194, radius: 50 };

export interface MeetupCredentials {
  clientId: string;
  clientSecret: string;
  /** Operator-minted token — skips the client-credentials exchange entirely. */
  accessToken?: string | null;
}

export const hasMeetupCredentials = (creds: MeetupCredentials | null | undefined): creds is MeetupCredentials =>
  !!creds && (!!creds.accessToken || (!!creds.clientId && !!creds.clientSecret));

export class MeetupRateBudgetError extends Error {
  constructor(waitMs: number) {
    super(`meetup point budget exhausted — would need to wait ${Math.ceil(waitMs / 1000)}s`);
    this.name = "MeetupRateBudgetError";
  }
}

/** Rolling-window point budget. spend() resolves once the points are consumed,
 * sleeping until the window rolls far enough; throws MeetupRateBudgetError when
 * that wait would exceed maxWaitMs. now/sleep are injectable so tests pin the
 * waits without real clocks. */
export class PointBudget {
  private readonly spent: { at: number; points: number }[] = [];

  constructor(
    private readonly opts: {
      limit?: number;
      windowMs?: number;
      maxWaitMs?: number;
      now?: () => number;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ) {}

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private sleep(ms: number): Promise<void> {
    return (this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))))(ms);
  }

  private pruneAndSum(now: number): number {
    const windowStart = now - (this.opts.windowMs ?? MEETUP_BUDGET_WINDOW_MS);
    // entries are chronological, so the stale ones are a prefix — prune it in
    // one terminal pass (a reverse loop that splices the whole array empty
    // mid-iteration crashes the recovery path in spend()).
    while (this.spent.length > 0 && this.spent[0].at <= windowStart) this.spent.shift();
    return this.spent.reduce((sum, s) => sum + s.points, 0);
  }

  async spend(points: number = MEETUP_QUERY_COST): Promise<void> {
    const limit = this.opts.limit ?? MEETUP_BUDGET_POINTS;
    const maxWaitMs = this.opts.maxWaitMs ?? MEETUP_BUDGET_WINDOW_MS;
    const deadline = this.now() + maxWaitMs;
    for (;;) {
      const now = this.now();
      const sum = this.pruneAndSum(now);
      if (sum + points <= limit) {
        this.spent.push({ at: now, points });
        return;
      }
      const oldest = this.spent[0]?.at;
      const waitMs = oldest ? oldest + (this.opts.windowMs ?? MEETUP_BUDGET_WINDOW_MS) - now : 0;
      if (waitMs < 0 || now + waitMs > deadline) {
        throw new MeetupRateBudgetError(Math.max(waitMs, 0));
      }
      await this.sleep(Math.max(waitMs, 1));
    }
  }
}

/* ---------- token ---------- */

export async function fetchMeetupToken(
  creds: MeetupCredentials,
  fetchImpl: typeof fetch,
  timeoutMs: number = MEETUP_FETCH_TIMEOUT_MS,
): Promise<string> {
  const res = await fetchImpl(MEETUP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`meetup token http ${res.status}`);
  const data = (await res.json()) as { access_token?: unknown };
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("meetup token response missing access_token");
  }
  return data.access_token;
}

/* ---------- graphql ---------- */

// the documented eventsSearch surface with an upcoming-only filter. the query is
// a constant on purpose: when the registered client's first live credential
// arrives, smoke-test it against the playground and adjust HERE ONLY — the
// mapper below reads tolerantly (unknown fields → undefined, not a crash).
export const MEETUP_EVENTS_QUERY = `
query EventsSearch($lat: Float!, $lon: Float!, $radius: Float, $first: Int, $after: String) {
  eventsSearch(
    input: { first: $first, after: $after, filter: { lat: $lat, lon: $lon, radius: $radius, status: UPCOMING } }
  ) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node { id title eventUrl dateTime endTime description venue { name lat lon } group { name urlname } } }
  }
}`;

export interface MeetupEventNode {
  id?: unknown;
  title?: unknown;
  eventUrl?: unknown;
  dateTime?: unknown;
  endTime?: unknown;
  description?: unknown;
  venue?: { name?: unknown; lat?: unknown; lon?: unknown } | null;
  group?: { name?: unknown; urlname?: unknown } | null;
}

export interface MeetupEventsSearchResponse {
  data?: {
    eventsSearch?: {
      totalCount?: number;
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: { node?: MeetupEventNode | null }[] | null;
    } | null;
  };
  errors?: { message?: string }[];
}

// one meetup node -> a raw contract input. same category rule as luma: a hack in
// the name is a hackathon, everything else stays the honest "events" bucket.
export function meetupNodeToRecordInput(node: MeetupEventNode, now: string): NormalizeResult {
  const id = typeof node.id === "string" ? node.id.trim() : "";
  const title = typeof node.title === "string" ? node.title.trim() : "";
  if (!id || !title) return { ok: false, error: "meetup node missing id or title" };
  const venueName = typeof node.venue?.name === "string" ? node.venue.name.trim() : undefined;
  const lat = typeof node.venue?.lat === "number" ? node.venue.lat : undefined;
  const lon = typeof node.venue?.lon === "number" ? node.venue.lon : undefined;
  return normalizeRecord(
    {
      id: `meetup:${id}`,
      type: "event",
      category: /hack/i.test(title) ? "hackathons" : "events",
      title,
      source: "meetup",
      url: typeof node.eventUrl === "string" && node.eventUrl ? node.eventUrl : undefined,
      venue: venueName,
      lat,
      lng: lon,
      startsAt: typeof node.dateTime === "string" && node.dateTime ? node.dateTime : undefined,
      endsAt: typeof node.endTime === "string" && node.endTime ? node.endTime : undefined,
      fetchedAt: now,
      firstSeenAt: now,
    },
    { now },
  );
}

/* ---------- the meetup source ---------- */

export interface MeetupSourceOptions {
  credentials: MeetupCredentials | null;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  budget?: PointBudget;
  pageSize?: number;
  maxPages?: number;
  location?: { lat: number; lon: number; radius: number };
  now?: string;
}

export async function meetupSource({
  credentials,
  fetchImpl = fetch,
  fetchTimeoutMs = MEETUP_FETCH_TIMEOUT_MS,
  budget = new PointBudget(),
  pageSize = MEETUP_PAGE_SIZE,
  maxPages = MEETUP_MAX_PAGES,
  location = MEETUP_BAY,
  now = new Date().toISOString(),
}: MeetupSourceOptions): Promise<IngestSourceResult> {
  if (!hasMeetupCredentials(credentials)) {
    return {
      name: "meetup",
      records: [],
      errors: [],
      skipped:
        "MEETUP_CLIENT_ID / MEETUP_CLIENT_SECRET not set — the meetup source lands behind the key; " +
        "luma and the feeds run without it.",
    };
  }

  const out: IngestSourceResult = { name: "meetup", records: [], errors: [] };
  let token: string;
  try {
    token = credentials.accessToken || (await fetchMeetupToken(credentials, fetchImpl, fetchTimeoutMs));
  } catch (e) {
    out.errors.push(`token: ${(e as Error).message}`);
    return out;
  }

  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    let payload: MeetupEventsSearchResponse;
    try {
      await budget.spend();
      const res = await fetchImpl(MEETUP_GRAPHQL_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: MEETUP_EVENTS_QUERY,
          variables: { lat: location.lat, lon: location.lon, radius: location.radius, first: pageSize, after: cursor },
        }),
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      if (!res.ok) throw new Error(`meetup graphql http ${res.status}`);
      payload = (await res.json()) as MeetupEventsSearchResponse;
    } catch (e) {
      out.errors.push(`meetup page ${page + 1}: ${(e as Error).message}`);
      break;
    }
    if (payload.errors?.length) {
      out.errors.push(`meetup page ${page + 1}: graphql ${payload.errors.map((e) => e.message).join("; ")}`);
      break;
    }
    const search = payload.data?.eventsSearch;
    for (const edge of search?.edges ?? []) {
      if (!edge?.node) continue;
      const n = meetupNodeToRecordInput(edge.node, now);
      if (n.ok) out.records.push(n.record as BayRecord);
      else out.errors.push(`meetup page ${page + 1}: ${n.error}`);
    }
    if (!search?.pageInfo?.hasNextPage || !search.pageInfo.endCursor) break;
    cursor = search.pageInfo.endCursor;
  }
  return out;
}

// exposed for tests and for the job's type surface
export type { RecordInput };
