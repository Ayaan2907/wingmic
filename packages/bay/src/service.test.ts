// service-level pins (from tests/link.test.mjs and the score-route behaviors):
// the boundary semantics the ported core must keep even though the http shape moves
// to the router task. two score pins live here so the wingmic-viewer path stays
// covered at this level (18 in scoring.test.ts + 2 here = the 20 score pins).
import { describe, expect, it, vi } from "vitest";

import { MockWingmicClient, MOCK_PEOPLE, MOCK_PROFILE, WingmicAuthError } from "./client.js";
import { capabilities, readBay, scoreEvent } from "./service.js";
import type { BayRecord, WingmicClient } from "./types.js";

const NOW = Date.parse("2026-01-09T12:00:00.000Z");
const STALE = Date.parse("2025-12-01T00:00:00.000Z");

const EVENT: BayRecord = {
  id: "luma:demo-night",
  type: "event",
  category: "hackathons",
  title: "hackathon demo night",
  note: "builders show what shipped",
  venue: "soma",
  source: "luma",
  startsAt: "2026-01-10T17:00:00.000Z",
  fetchedAt: "2026-01-09T00:00:00.000Z",
  firstSeenAt: "2026-01-09T00:00:00.000Z",
};

const OTHER: BayRecord = {
  id: "seed:coffee",
  type: "event",
  category: "events",
  title: "founders coffee",
  note: "small room, real talk",
  source: "seed",
  startsAt: "2026-01-10T15:00:00.000Z",
  fetchedAt: "2026-01-09T00:00:00.000Z",
  firstSeenAt: "2026-01-09T00:00:00.000Z",
};

const PASTE = "ml engineer at an infra startup. shipping agents. want to meet builders.";

describe("scoreEvent: the throwaway profile path", () => {
  it("needs a viewer and says what kind", async () => {
    const noViewer = await scoreEvent(
      { eventId: "luma:demo-night" },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(noViewer).toMatchObject({ ok: false, error: "profile_needed" });

    const withViewer = await scoreEvent(
      { eventId: "luma:demo-night", profile: PASTE },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(withViewer.ok).toBe(true);
    if (withViewer.ok) {
      expect(withViewer.profile.kind).toBe("throwaway");
      expect(withViewer.profile.quality).toBe("ok");
      expect(withViewer.ai).toBe(false);
      expect(withViewer.fit && withViewer.fit.of).toBe(2);
    }
  });

  it("rejects a non-linkedin source string as bad_source", async () => {
    const out = await scoreEvent(
      { eventId: "luma:demo-night", source: "https://example.com/not-linkedin" },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(out).toMatchObject({ ok: false, error: "bad_source" });
  });

  it("404s an unknown event and 410s an expired one", async () => {
    const unknown = await scoreEvent({ eventId: "nope", profile: PASTE }, { events: [EVENT], now: NOW });
    expect(unknown).toMatchObject({ ok: false, error: "unknown_event" });

    const expired: BayRecord = {
      ...EVENT,
      id: "luma:old",
      title: "an old thing",
      startsAt: "2025-12-01T10:00:00.000Z",
    };
    const out = await scoreEvent({ eventId: "luma:old", profile: PASTE }, { events: [expired], now: NOW });
    expect(out).toMatchObject({ ok: false, error: "expired_event" });
  });

  it("400s an unknown persona and 400s a missing id", async () => {
    const bad = await scoreEvent(
      { eventId: "luma:demo-night", profile: PASTE, personaId: "wizard" },
      { events: [EVENT], now: NOW },
    );
    expect(bad).toMatchObject({ ok: false, error: "bad_persona" });

    const missing = await scoreEvent({ eventId: "  ", profile: PASTE }, { events: [EVENT], now: NOW });
    expect(missing).toMatchObject({ ok: false, error: "bad_request" });
  });
});

describe("scoreEvent: the wingmic boundary path", () => {
  it("resolves the viewer through the client and surfaces network overlap", async () => {
    const client = new MockWingmicClient();
    const out = await scoreEvent(
      { eventId: "luma:demo-night", wingmicToken: "wk_live_demo_key_000" },
      { events: [EVENT, OTHER], client, now: NOW },
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.profile.kind).toBe("wingmic");
      expect(out.score.meet.length).toBeGreaterThan(0);
      expect(out.score.meet[0].who).toBe("dex morales");
    }
  });

  it("maps a dead key to wingmic_auth and degrades other client failures to []", async () => {
    const dead: WingmicClient = {
      label: "real",
      selfProfile: true,
      getProfile: async () => {
        throw new WingmicAuthError("unauthorized");
      },
      networkOverlap: async () => {
        throw new Error("should not be reached");
      },
      verify: async () => ({ ok: false, reason: "unauthorized" }),
      capture: async () => false,
    };
    const auth = await scoreEvent(
      { eventId: "luma:demo-night", wingmicToken: "wk_live_demo_key_000" },
      { events: [EVENT], client: dead, now: NOW },
    );
    expect(auth).toMatchObject({ ok: false, error: "wingmic_auth" });

    const flaky: WingmicClient = {
      label: "real",
      selfProfile: true,
      getProfile: async () => {
        throw new Error("socket hung up");
      },
      networkOverlap: async () => [],
      verify: async () => ({ ok: true }),
      capture: async () => false,
    };
    const degraded = await scoreEvent(
      { eventId: "luma:demo-night", wingmicToken: "wk_live_demo_key_000" },
      { events: [EVENT], client: flaky, now: NOW },
    );
    expect(degraded).toMatchObject({ ok: false, error: "wingmic_unavailable" });

    // network trouble on an otherwise-good viewer degrades the meet list, not the score
    const partial: WingmicClient = {
      ...dead,
      getProfile: async () => ({ ...MOCK_PROFILE }),
      networkOverlap: async () => {
        throw new Error("timeout");
      },
    };
    const okScore = await scoreEvent(
      { eventId: "luma:demo-night", wingmicToken: "wk_live_demo_key_000" },
      { events: [EVENT], client: partial, now: NOW },
    );
    expect(okScore.ok).toBe(true);
  });

  it("marks the mock demo network honestly", async () => {
    const client = new MockWingmicClient();
    expect(client.label).toBe("mock");
    expect(client.selfProfile).toBe(true);
    expect(MOCK_PEOPLE.length).toBe(3);
  });

  it("keeps the mock overlap capped at three", async () => {
    const client = new MockWingmicClient();
    const meets = await client.networkOverlap("k", { event: EVENT, k: 99 });
    expect(meets.length).toBeLessThanOrEqual(3);
  });
});

describe("scoreEvent: the explain path", () => {
  it("uses the llm when configured and falls back when it fails", async () => {
    const chat = vi.fn(async () => JSON.stringify({ go: 0.5, confidence: 0.7, outcome: "worth it", reasons: ["close", "timely"] }));
    const ai = await scoreEvent(
      { eventId: "luma:demo-night", profile: PASTE },
      { events: [EVENT], chat, model: "test-model", now: NOW },
    );
    expect(ai.ok && ai.ai).toBe(true);
    expect(chat).toHaveBeenCalledOnce();

    const bomb = vi.fn(async () => {
      throw new Error("gateway down");
    });
    const fb = await scoreEvent(
      { eventId: "luma:demo-night", profile: PASTE },
      { events: [EVENT], chat: bomb, now: NOW },
    );
    expect(fb.ok).toBe(true);
    if (fb.ok) {
      expect(fb.ai).toBe(false);
      expect(fb.score.scorer).toBe("typed");
    }
  });
});

describe("readBay", () => {
  it("filters expired events at serve time and reports honestly", () => {
    const dir = makeStore([EVENT, { ...OTHER, startsAt: "2025-11-01T10:00:00.000Z" }], []);
    const read = readBay("events", { dataDir: dir, now: NOW });
    expect(read.total).toBe(1);
    expect(read.expired).toBe(1);
    expect(read.store).toBe("store");
    expect(read.sources).toEqual(["luma"]);
    const seedOnly = readBay("places", { dataDir: dir, now: NOW });
    expect(seedOnly.store).toBe("seed");
  });
});

describe("capabilities", () => {
  it("reports what this deployment can do", () => {
    expect(capabilities({})).toMatchObject({ ai: false, wingmic: "unavailable" });
    expect(capabilities({ chat: async () => "x", model: "m", client: new MockWingmicClient() })).toMatchObject({
      ai: true,
      model: "m",
      wingmic: "mock",
    });
  });
});

/* helper: materialize a temp store dir */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveStore } from "./contract.js";

function makeStore(events: BayRecord[], places: BayRecord[]): string {
  const dir = mkdtempSync(join(tmpdir(), "bay-test-"));
  if (events.length) saveStore(dir, "events", events);
  if (places.length) saveStore(dir, "places", places);
  return dir;
}
