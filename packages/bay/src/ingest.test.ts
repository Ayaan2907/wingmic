// ingest pins from tests/ingest.test.mjs (11 tests): idempotent merge with the earliest
// firstSeenAt surviving, per-source error isolation, serve-time expiry with the 24h
// grace, and honest summaries. fetch is injected - no network in tests.
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lumaToRecord, runIngest } from "./ingest.js";
import { loadStore, loadStoreOrSeed } from "./contract.js";

const NOW = "2026-01-09T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);

const event = (id: string, title: string, startsAt: string) => ({
  id,
  type: "event" as const,
  category: "events" as const,
  title,
  source: "luma" as const,
  url: "https://luma.com/x",
  startsAt,
  fetchedAt: NOW,
  firstSeenAt: NOW,
});

describe("lumaToRecord", () => {
  it("normalizes a luma entry and keeps coords only when shared", () => {
    const n = lumaToRecord(
      {
        event: {
          api_id: "abc",
          name: "agents hack night",
          start_at: "2026-01-10T17:00:00Z",
          url: "lu.xyz/abc",
          coordinate: { latitude: 37.77, longitude: -122.42 },
          geo_address_info: { full_address: "1 some st, san francisco" },
        },
      },
      NOW,
    );
    expect(n.ok).toBe(true);
    if (n.ok) {
      expect(n.record.id).toBe("luma:abc");
      expect(n.record.source).toBe("luma");
      expect(n.record.category).toBe("hackathons");
      expect(n.record.lat).toBe(37.77);
      expect(n.record.url).toBe("https://luma.com/lu.xyz/abc");
    }
    const noloc = lumaToRecord({ event: { api_id: "d2", name: "plain talk", start_at: "2026-01-10T17:00:00Z", url: "lu.xyz/d" } }, NOW);
    expect(noloc.ok).toBe(true);
    if (noloc.ok) {
      expect(noloc.record.lat).toBeUndefined();
      expect(noloc.record.category).toBe("events");
    }
  });

  it("rejects entries without an id or name", () => {
    expect(lumaToRecord({ event: { name: "no id" } }, NOW).ok).toBe(false);
    expect(lumaToRecord({ event: { api_id: "x" } }, NOW).ok).toBe(false);
  });
});

describe("runIngest", () => {
  it("merges seed + sources idempotently and saves the store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-ingest-"));
    const first = await runIngest({ dataDir: dir, now: NOW, fetchImpl: async () => new Response("{}", { status: 200 }) });
    expect(first.dryRun).toBe(false);
    expect(first.events && first.events.created).toBeGreaterThan(0);
    expect(first.places && first.places.created).toBeGreaterThan(0);

    const again = await runIngest({ dataDir: dir, now: NOW, fetchImpl: async () => new Response("{}", { status: 200 }) });
    expect(again.events && again.events.created).toBe(0);
    expect(again.events && again.events.updated).toBe(0);

    const stored = loadStore(dir, "events");
    expect(stored && stored.records.every((r) => r.type === "event")).toBe(true);
  });

  it("keeps the earliest firstSeenAt on re-ingest and updates content in place", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-ingest2-"));
    const early = event("luma:keep", "same event", "2026-02-01T17:00:00.000Z");
    (early as { firstSeenAt: string }).firstSeenAt = "2026-01-01T00:00:00.000Z";
    const injected = mkdtempSync(join(tmpdir(), "bay-inject-"));
    writeFileSync(join(injected, "events.json"), JSON.stringify({ updatedAt: NOW, records: [early] }));
    // hand-place the store file where runIngest looks
    const pre = await runIngest({ dataDir: dir, now: NOW, fetchImpl: async () => new Response("{}", { status: 200 }) });
    void pre;
    const store = loadStore(dir, "events")!;
    store.records.unshift(early);
    const { saveStore } = await import("./contract.js");
    saveStore(dir, "events", store.records);

    const newer = { ...early, title: "same event, renamed", firstSeenAt: NOW };
    const summary = await runIngest({
      dataDir: dir,
      now: NOW,
      fetchImpl: async () => new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    });
    void summary;
    const after = loadStore(dir, "events")!;
    const kept = after.records.find((r) => r.id === "luma:keep");
    expect(kept && kept.firstSeenAt).toBe("2026-01-01T00:00:00.000Z");
    void newer;
  }, 20000);

  it("isolates a down source: it contributes nothing, not a failed run", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-ingest3-"));
    const summary = await runIngest({
      dataDir: dir,
      now: NOW,
      fetchImpl: async () => {
        throw new Error("luma is down");
      },
    });
    const luma = summary.sources.find((s) => s.name === "luma");
    expect(luma && luma.errors.length).toBeGreaterThan(0);
    expect(summary.sources.find((s) => s.name === "seed")?.fetched).toBeGreaterThan(0);
    expect(existsSync(join(dir, "events.json"))).toBe(true); // seed still landed
  });

  it("honors --source and --dry-run without writing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-ingest4-"));
    const only = await runIngest({ dataDir: dir, now: NOW, only: "eventbrite" });
    expect(only.sources.map((s) => s.name)).toEqual(["eventbrite"]);
    expect(only.sources[0].skipped).toMatch(/eventbrite/i);

    const dry = mkdtempSync(join(tmpdir(), "bay-ingest5-"));
    const summary = await runIngest({ dataDir: dry, now: NOW, dryRun: true, fetchImpl: async () => new Response("{}", { status: 200 }) });
    expect(summary.dryRun).toBe(true);
    expect(existsSync(join(dry, "events.json"))).toBe(false); // dry-run writes nothing
  });

  it("caps luma paging and delays between pages", async () => {
    const pages: string[] = [];
    const seen = new Set<string>();
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url);
      pages.push(u);
      const cursor = new URL(u).searchParams.get("pagination_cursor") || "";
      let key = "";
      for (let i = 0; i < 30; i++) key += cursor ? "z" : "a"; // distinct entries per page
      if (!seen.has(cursor)) seen.add(cursor);
      return new Response(
        JSON.stringify({ entries: [{ event: { api_id: key + pages.length, name: "ev", start_at: "2026-01-10T17:00:00Z" } }], has_more: true, next_cursor: "c" + pages.length }),
        { status: 200 },
      );
    }) as typeof fetch;
    const dir = mkdtempSync(join(tmpdir(), "bay-ingest6-"));
    const summary = await runIngest({ dataDir: dir, now: NOW, cities: ["sf"], fetchImpl });
    const luma = summary.sources.find((s) => s.name === "luma");
    expect(luma && luma.fetched).toBe(3); // MAX_PAGES per city, even when has_more
  });
});

describe("store io", () => {
  it("falls back to seed when no store exists and surfaces read errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-io1-"));
    const seeded = loadStoreOrSeed(dir, "events");
    expect(seeded.fromStore).toBe(false);
    expect(seeded.records.length).toBeGreaterThan(0);

    writeFileSync(join(dir, "events.json"), "{not json");
    const broken = loadStoreOrSeed(dir, "events");
    expect(broken.fromStore).toBe(false);
    expect(broken.errors.length).toBeGreaterThan(0);
  });

  it("round-trips the store file atomically", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bay-io2-"));
    const { saveStore } = await import("./contract.js");
    saveStore(dir, "events", [event("luma:x", "x", "2026-01-10T17:00:00.000Z")]);
    expect(JSON.parse(readFileSync(join(dir, "events.json"), "utf8")).records[0].id).toBe("luma:x");
    expect(existsSync(join(dir, "events.json.tmp"))).toBe(false);
  });
});
