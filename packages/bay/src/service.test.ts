// service-level re-expression of the score-route integration pins (tests/score.test.mjs,
// the http half) plus the link.test.mjs boundary semantics. the http shape (status codes,
// headers, capability probe wiring) is the router task's job (todo_8CudacYO); here the
// same pipeline runs against typed deps: the wingmic-viewer path, the anonymous paths,
// the error taxonomy, and the explain stage — the part the ported core must keep.
import { describe, expect, it, vi } from "vitest";

import { MockWingmicClient, MOCK_PEOPLE, MOCK_PROFILE, WingmicAuthError } from "./client.js";
import { capabilities, readBay, scoreEvent } from "./service.js";
import type { BayRecord, WingmicClient } from "./types.js";

const NOW = Date.parse("2026-01-09T12:00:00.000Z");

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

// the structured viewer the old route accepted (tests/score.test.mjs used exactly this
// shape); a bare string was never a valid profile — the paste path is `source`.
const VIEWER = {
  headline: "ml engineer at an infra startup",
  roles: ["ml engineer"],
  topics: ["agents", "infra"],
  goals: ["meet builders"],
  links: {},
};

describe("scoreEvent: the throwaway/profile path", () => {
  it("needs a viewer and says what kind resolved", async () => {
    const noViewer = await scoreEvent({ eventId: "luma:demo-night" }, { events: [EVENT, OTHER], now: NOW });
    expect(noViewer).toMatchObject({ ok: false, error: "profile_needed" });

    const withViewer = await scoreEvent(
      { eventId: "luma:demo-night", profile: VIEWER },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(withViewer.ok).toBe(true);
    if (withViewer.ok) {
      expect(withViewer.profile.kind).toBe("pasted"); // the structured profile's own kind
      expect(withViewer.profile.quality).toBe("ok");
      expect(withViewer.ai).toBe(false); // no chat configured -> the typed fallback ran
      expect(withViewer.fit && withViewer.fit.of).toBe(2);
    }
  });

  it("accepts a pasted text source and rejects a non-linkedin one", async () => {
    const paste = await scoreEvent(
      { eventId: "luma:demo-night", source: { kind: "text", value: "ml engineer shipping agents, new to the city" } },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(paste.ok).toBe(true);
    if (paste.ok) expect(paste.profile.kind).toBe("throwaway"); // no signup between paste and answer

    const out = await scoreEvent(
      { eventId: "luma:demo-night", source: { kind: "linkedin_url", value: "https://example.com/not-linkedin" } },
      { events: [EVENT, OTHER], now: NOW },
    );
    expect(out).toMatchObject({ ok: false, error: "bad_source" });
  });

  it("404s an unknown event and 410s a known-but-over one", async () => {
    const unknown = await scoreEvent({ eventId: "nope", profile: VIEWER }, { events: [EVENT], now: NOW });
    expect(unknown).toMatchObject({ ok: false, error: "unknown_event" });

    const expired: BayRecord = {
      ...EVENT,
      id: "luma:old",
      title: "an old thing",
      startsAt: "2025-12-01T10:00:00.000Z",
    };
    const out = await scoreEvent({ eventId: "luma:old", profile: VIEWER }, { events: [expired], now: NOW });
    expect(out).toMatchObject({ ok: false, error: "expired_event" }); // retained history answers honestly
  });

  it("400s an unknown persona and 400s a malformed id", async () => {
    const bad = await scoreEvent(
      { eventId: "luma:demo-night", profile: VIEWER, personaId: "wizard" },
      { events: [EVENT], now: NOW },
    );
    expect(bad).toMatchObject({ ok: false, error: "bad_persona" });

    const missing = await scoreEvent({ eventId: "  ", profile: VIEWER }, { events: [EVENT], now: NOW });
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
      expect(out.score.meet[0].who).toBe("dex morales"); // the mock network surfaces dex for a hackathon
    }
  });

  it("maps a dead key to wingmic_auth and client outages to wingmic_unavailable", async () => {
    const dead: WingmicClient = {
      label: "real",
      selfProfile: true,
      getProfile: async () => {
        throw new WingmicAuthError();
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

    // infra trouble resolving the viewer is an outage (503-shaped), never a 500
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

  it("keeps the same ask and the same answer (typed determinism)", async () => {
    const ask = { eventId: "luma:demo-night", profile: VIEWER } as const;
    const a = await scoreEvent(ask, { events: [EVENT, OTHER], now: NOW });
    const b = await scoreEvent(ask, { events: [EVENT, OTHER], now: NOW });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.score.go).toBe(b.score.go);
      expect(a.score.reasons).toEqual(b.score.reasons);
    }
  });

  it("marks the mock demo network honestly", () => {
    const client = new MockWingmicClient();
    expect(client.label).toBe("mock");
    expect(client.selfProfile).toBe(true);
    expect(MOCK_PEOPLE.length).toBe(3);
  });

  it("keeps the mock overlap capped at three and honest about misses", async () => {
    const client = new MockWingmicClient();
    const meets = await client.networkOverlap("k", { event: EVENT, k: 99 });
    expect(meets.length).toBeLessThanOrEqual(3);
    // an event none of the fixture people connect to -> an empty meet list, not padding
    const noHits = await client.networkOverlap("k", {
      event: { ...EVENT, title: "gardening club meetup", note: "plants and pruning", category: "sports" },
      k: 3,
    });
    expect(noHits).toEqual([]);
  });
});

describe("scoreEvent: the explain path", () => {
  it("uses the llm when configured and falls back to typed when it fails", async () => {
    const chat = vi.fn(async () =>
      JSON.stringify({ go: 0.5, confidence: 0.7, outcome: "worth it", reasons: ["close", "timely"] }),
    );
    const ai = await scoreEvent(
      { eventId: "luma:demo-night", profile: VIEWER },
      { events: [EVENT], chat, model: "test-model", now: NOW },
    );
    expect(ai.ok && ai.ai).toBe(true); // ai reflects configuration, as the old route reported it
    expect(chat).toHaveBeenCalledOnce();

    const bomb = vi.fn(async () => {
      throw new Error("gateway down");
    });
    const fb = await scoreEvent(
      { eventId: "luma:demo-night", profile: VIEWER },
      { events: [EVENT], chat: bomb, now: NOW },
    );
    expect(fb.ok).toBe(true);
    if (fb.ok) {
      // a score never fails because the explainer did; the honest signal is the card's scorer
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
