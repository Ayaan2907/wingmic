// The db boundary of the ingest job: core BayRecords → bay rows through the
// seed module's normalize → merge path. Pins the behaviors the nightly cron
// depends on: per-record rejections never block the run, a re-run lands on the
// same rows (idempotent), the earliest firstSeenAt survives, and expired
// records are retained — nothing is silently deleted.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { applyBayRecords, bayEventInputFor, bayPlaceInputFor } from "./ingest-store";
import { bayEvents, places } from "../schema";
import { freshDb } from "./testing";
import type { BayRecord } from "@wingmic/bay";

const NOW = "2026-02-01T12:00:00.000Z";

const eventRecord = (over: Partial<BayRecord> = {}): BayRecord =>
  ({
    id: "luma:fix-001",
    type: "event",
    category: "hackathons",
    title: "agents hack night",
    source: "luma",
    url: "https://luma.com/fix-001",
    venue: "The Foundry",
    lat: 37.7749,
    lng: -122.4194,
    startsAt: "2026-02-02T18:00:00.000Z",
    endsAt: "2026-02-02T21:00:00.000Z",
    fetchedAt: NOW,
    firstSeenAt: NOW,
    ...over,
  }) as BayRecord;

const placeRecord = (over: Partial<BayRecord> = {}): BayRecord =>
  ({
    id: "seed:the-foundry",
    type: "place",
    category: "offices",
    title: "The Foundry",
    source: "seed",
    note: "co-working with a real lobby conversation",
    lat: 37.7749,
    lng: -122.4194,
    fetchedAt: NOW,
    ...over,
  }) as BayRecord;

describe("boundary mapping", () => {
  it("rejects an event with no url — the db requires one", () => {
    const mapped = bayEventInputFor(eventRecord({ url: undefined, sourceUrl: undefined }));
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) expect(mapped.error).toMatch(/no url/);
  });

  it("accepts a sourceUrl when the source spoke that key (the seed rows do)", () => {
    const mapped = bayEventInputFor(eventRecord({ url: undefined, sourceUrl: "https://x.example/e" }));
    expect(mapped.ok).toBe(true);
    if (mapped.ok) expect(mapped.input.url).toBe("https://x.example/e");
  });

  it("rejects a place with no note — never a bare pin — or no coords", () => {
    const bare = bayPlaceInputFor(placeRecord({ note: undefined }));
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error).toMatch(/no note/);

    const lost = bayPlaceInputFor(placeRecord({ lat: undefined, lng: undefined }));
    expect(lost.ok).toBe(false);
    if (!lost.ok) expect(lost.error).toMatch(/lat\/lng/);
  });

  it("routes each record type to its own normalizer", () => {
    expect(bayEventInputFor(eventRecord()).ok).toBe(true);
    expect(bayPlaceInputFor(placeRecord()).ok).toBe(true);
  });
});

describe("applyBayRecords", () => {
  it("lands mapped records through the seed normalize path", async () => {
    const { db, client } = await freshDb();
    const summary = await applyBayRecords(db, [eventRecord(), placeRecord()]);
    expect(summary.rejected).toEqual([]);
    expect(summary.events.created).toBe(1);
    expect(summary.places.created).toBe(1);

    const event = await db.select().from(bayEvents).where(eq(bayEvents.id, "luma:fix-001"));
    expect(event[0].title).toBe("agents hack night");
    expect(event[0].expiresAt).toBeTruthy(); // endsAt + 24h grace, computed at the boundary
    const place = await db.select().from(places).where(eq(places.id, "seed:the-foundry"));
    expect(place[0].note).toBe("co-working with a real lobby conversation");
    client.close();
  });

  it("collects per-record rejections without blocking the rest of the run", async () => {
    const { db, client } = await freshDb();
    const summary = await applyBayRecords(db, [
      eventRecord({ id: "luma:bad", url: undefined }), // no url → rejected at the boundary
      eventRecord({ id: "luma:good" }),
      placeRecord(),
    ]);
    expect(summary.events.created).toBe(1); // the good event landed
    expect(summary.places.created).toBe(1);
    expect(summary.rejected).toHaveLength(1);
    expect(summary.rejected[0]).toMatch(/luma:bad.*no url/);
    client.close();
  });

  it("re-runs idempotently: same records, second run creates nothing", async () => {
    const { db, client } = await freshDb();
    const records = [eventRecord(), placeRecord()];
    const first = await applyBayRecords(db, records);
    expect(first.events.created).toBe(1);
    expect(first.places.created).toBe(1);

    const second = await applyBayRecords(db, records);
    expect(second.events.created).toBe(0);
    expect(second.events.updated).toBe(0);
    expect(second.places.created).toBe(0);

    const rows = await db.select().from(bayEvents);
    expect(rows).toHaveLength(1);
    client.close();
  });

  it("keeps the earliest firstSeenAt when a re-run carries a newer stamp", async () => {
    const { db, client } = await freshDb();
    await applyBayRecords(db, [eventRecord()]);
    const newer = eventRecord({ fetchedAt: "2026-03-01T12:00:00.000Z", firstSeenAt: "2026-03-01T12:00:00.000Z" });
    await applyBayRecords(db, [newer]);

    const rows = await db.select().from(bayEvents).where(eq(bayEvents.id, "luma:fix-001"));
    expect(rows[0].firstSeenAt.toISOString()).toBe("2026-02-01T12:00:00.000Z");
    expect(rows[0].fetchedAt.toISOString()).toBe("2026-03-01T12:00:00.000Z"); // content refreshed
    client.close();
  });

  it("retains expired records — nothing is silently deleted", async () => {
    const { db, client } = await freshDb();
    // a february event, applied "now" in march: already expired at write time
    await applyBayRecords(db, [eventRecord()]);
    await applyBayRecords(db, [eventRecord({ title: "agents hack night (renamed)" })]);

    const rows = await db.select().from(bayEvents);
    expect(rows).toHaveLength(1); // updated in place, never duplicated or dropped
    expect(rows[0].title).toBe("agents hack night (renamed)");
    client.close();
  });
});
