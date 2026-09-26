// packages/bay/src/ingest.ts
// the ingest pipeline: sources feed records through the contract into the store.
// per the port map: the sources and merge logic port; the output target swaps for
// the data layer behind the same contract functions, and the in-process refresh
// timer retires (the wingmic runtime schedules the run — a cron in production).
// ported from ayaan-site scripts/ingest.mjs (1bca780): same ids, same grace rules,
// same idempotent merge, same per-source error isolation.
//
// fetch is injectable (fetchImpl) so tests can pin behavior without a network; in
// production the runtime injects the global fetch. the summary rides back as data —
// the caller logs it (keep the ingest.run summary line and the non-zero-exit
// convention so cron alerting keeps working).

import type { IngestSourceResult, IngestSummary, NormalizeResult } from "./types.js";
import { loadStore, mergeRecords, normalizeRecord, saveStore, seedRecords } from "./contract.js";
import type { StoreFileKey } from "./contract.js";

export type FetchImpl = typeof fetch;

// luma's keyless public discover endpoint — the one source that works with no account.
export const LUMA_HOST = "https://api.luma.com";
export const PAGE_SIZE = 25;
export const MAX_PAGES = 3;
export const PAGE_DELAY_MS = 1000;
// bounds every source fetch: a hung connection (half-open socket, no response) must
// reject into the per-source error path instead of pinning the run — the module-level
// single-flight flag only clears in the finally, so an unbounded await would wedge
// every later runIngest in the process behind "ingest already running".
export const FETCH_TIMEOUT_MS = 15_000;

interface LumaPage {
  entries?: unknown[];
  has_more?: boolean;
  next_cursor?: string;
}

async function getJson(url: string, fetchImpl: FetchImpl, timeoutMs: number): Promise<LumaPage> {
  const res = await fetchImpl(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`luma http ${res.status}`);
  return (await res.json()) as LumaPage;
}

// one luma entry -> a contract record. coords survive only when the host shared them;
// an unknown venue is never invented from the address line.
export function lumaToRecord(entry: unknown, now: string): NormalizeResult {
  const e = (entry ?? {}) as {
    event?: {
      api_id?: unknown;
      name?: unknown;
      start_at?: unknown;
      end_at?: unknown;
      url?: unknown;
      coordinate?: { latitude?: unknown; longitude?: unknown };
      geo_address_info?: { city_state?: unknown; full_address?: unknown };
    };
  };
  const ev = e.event || {};
  const name = typeof ev.name === "string" ? ev.name.trim() : "";
  if (!ev.api_id || !name) return { ok: false, error: "luma entry missing api_id or name" };
  const category = /hack/i.test(name) ? "hackathons" : "events";
  const address =
    typeof ev.geo_address_info?.full_address === "string" && ev.geo_address_info.full_address
      ? ev.geo_address_info.full_address
      : undefined;
  return normalizeRecord(
    {
      id: `luma:${ev.api_id}`,
      type: "event",
      category,
      title: name,
      source: "luma",
      url: ev.url ? `https://luma.com/${ev.url}` : undefined,
      venue: address,
      address,
      lat: ev.coordinate?.latitude ?? undefined,
      lng: ev.coordinate?.longitude ?? undefined,
      startsAt: typeof ev.start_at === "string" ? ev.start_at : undefined,
      endsAt: typeof ev.end_at === "string" ? ev.end_at : undefined,
      fetchedAt: now,
      firstSeenAt: now,
    },
    { now },
  );
}

// page through luma's discover endpoint for each city. a failing page is an error on
// the source result — the run keeps going, other cities and sources still land.
export async function lumaSource({
  fetchImpl = fetch,
  now,
  cities,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
}: {
  fetchImpl?: FetchImpl;
  now: string;
  cities: string[];
  fetchTimeoutMs?: number;
}): Promise<IngestSourceResult> {
  const out: IngestSourceResult = { name: "luma", records: [], errors: [] };
  for (const city of cities) {
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      let data: LumaPage;
      try {
        const url =
          `${LUMA_HOST}/discover/get-paginated-events?pagination_limit=${PAGE_SIZE}` +
          `&city_slug=${encodeURIComponent(city)}` +
          (cursor ? `&pagination_cursor=${encodeURIComponent(cursor)}` : "");
        data = await getJson(url, fetchImpl, fetchTimeoutMs);
      } catch (e) {
        out.errors.push(`luma ${city} page ${page + 1}: ${(e as Error).message}`);
        break;
      }
      for (const entry of data.entries || []) {
        const n = lumaToRecord(entry, now);
        if (n.ok) out.records.push(n.record);
        else out.errors.push(`luma ${city}: ${n.error}`);
      }
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
      await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }
  }
  return out;
}

// eventbrite: a documented stub. public search closed in 2019; the stub keeps the
// source interface so a tokened v3 path slots in without touching store/merge/handlers.
export async function eventbriteSource(): Promise<IngestSourceResult> {
  return {
    name: "eventbrite",
    records: [],
    errors: [],
    skipped:
      "no public keyless search endpoint (eventbrite removed public search in 2019). " +
      "stub behind the source interface; a documented oauth path can replace it later.",
  };
}

// the committed curated seed, normalized like any source. keeps the bay real before
// the first live ingest lands.
export async function seedSource(): Promise<IngestSourceResult> {
  return {
    name: "seed",
    records: [...seedRecords("events"), ...seedRecords("places")],
    errors: [],
  };
}

export interface RunIngestOptions {
  dryRun?: boolean;
  only?: string | null;
  fetchImpl?: FetchImpl;
  fetchTimeoutMs?: number;
  dataDir: string;
  now?: string;
  cities?: string[];
}

// the orchestrator: one run, every enabled source, both types merged and saved.
// idempotent end to end — re-running with the same inputs reports zero created/updated.
let running = false;

export async function runIngest({
  dryRun = false,
  only = null,
  fetchImpl = fetch,
  fetchTimeoutMs = FETCH_TIMEOUT_MS,
  dataDir,
  now = new Date().toISOString(),
  cities = ["sf"],
}: RunIngestOptions): Promise<IngestSummary> {
  if (running) throw new Error("ingest already running");
  running = true;
  try {
    const sources: Record<string, () => Promise<IngestSourceResult>> = {
      seed: () => seedSource(),
      luma: () => lumaSource({ fetchImpl, now, cities, fetchTimeoutMs }),
      eventbrite: () => eventbriteSource(),
    };
    const names = only ? [only] : Object.keys(sources);
    const results: IngestSourceResult[] = [];
    for (const name of names) {
      const fn = sources[name];
      if (!fn) {
        results.push({ name, records: [], errors: [`unknown source "${name}"`] });
        continue;
      }
      try {
        results.push(await fn());
      } catch (e) {
        // a down source contributes nothing, not a failed run
        results.push({ name, records: [], errors: [String((e as Error)?.message || e)] });
      }
    }

    const summary: IngestSummary = {
      dryRun,
      dataDir,
      ranAt: now,
      sources: results.map((r) => ({
        name: r.name,
        fetched: r.records.length,
        errors: r.errors,
        ...(r.skipped ? { skipped: r.skipped } : {}),
      })),
      events: null,
      places: null,
    };

    const flat = results.flatMap((r) => r.records);
    const summaryOf = (type: StoreFileKey, want: "event" | "place") => {
      const loaded = loadStore(dataDir, type);
      const current = loaded ? loaded.records : [];
      const readErrors = loaded ? loaded.errors : [];
      const incoming = flat.filter((r) => r.type === want);
      const merged = mergeRecords(current, incoming);
      if (!dryRun && merged.created + merged.updated > 0) saveStore(dataDir, type, merged.records);
      return {
        total: merged.records.length,
        created: merged.created,
        updated: merged.updated,
        incoming: incoming.length,
        readErrors,
      };
    };
    summary.events = summaryOf("events", "event");
    summary.places = summaryOf("places", "place");
    return summary;
  } finally {
    running = false;
  }
}
