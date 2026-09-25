// pins from the old scoring engine (tests/score.test.mjs, 20 tests). the arithmetic
// assertions are ported byte-for-byte: identical inputs must produce identical scores,
// verdicts, and orderings as the js engine did.
import { describe, expect, it } from "vitest";

import {
  buildProfile,
  embed,
  EMBED_DIM,
  eventText,
  fallbackExplain,
  heuristicScore,
  llmScore,
  parseJsonLoose,
  parsePaste,
  parseProfileInput,
  profileText,
  qualityOf,
  retrieve,
  segmentFor,
  sharedTokens,
  verdictOf,
} from "./scoring.js";
import type { BayRecord } from "./types.js";

const EVENT: BayRecord = {
  id: "luma:test-event",
  type: "event",
  category: "hackathons",
  title: "ai agents hackathon weekend",
  note: "builders ship fast, judges from the infra world",
  venue: "somewhere in soma",
  source: "luma",
  startsAt: "2026-01-10T17:00:00.000Z",
  endsAt: "2026-01-12T02:00:00.000Z",
  fetchedAt: "2026-01-09T00:00:00.000Z",
  firstSeenAt: "2026-01-09T00:00:00.000Z",
};

const OTHER: BayRecord = {
  id: "seed:pickup-soccer",
  type: "event",
  category: "sports",
  title: "pickup soccer at the park",
  note: "cleats optional, newcomers welcome",
  venue: "dolores park",
  source: "seed",
  startsAt: "2026-01-10T18:00:00.000Z",
  fetchedAt: "2026-01-09T00:00:00.000Z",
  firstSeenAt: "2026-01-09T00:00:00.000Z",
};

const NOW = Date.parse("2026-01-09T12:00:00.000Z");

const PROFILE = {
  kind: "throwaway" as const,
  name: undefined,
  headline: "ml engineer at an infra startup",
  roles: ["ml engineer"],
  topics: ["agents", "infra", "startups"],
  goals: ["meet builders before our raise"],
  links: {},
  raw: "i ship agents. infra all the way down.",
};

describe("embed", () => {
  it("is stable for the same input", () => {
    const a = embed("ai agents hackathon weekend soma");
    const b = embed("ai agents hackathon weekend soma");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBe(EMBED_DIM);
  });
});

describe("retrieve", () => {
  it("ranks the matching record first", () => {
    const ranked = retrieve(profileText(PROFILE), [OTHER, EVENT]);
    expect(ranked[0].record.id).toBe("luma:test-event");
    expect(ranked[0].fit).toBeGreaterThan(0);
  });
});

describe("heuristicScore", () => {
  it("is deterministic given fixed inputs", () => {
    const a = heuristicScore({ profile: PROFILE, event: EVENT, goal: "find agents people", now: NOW });
    const b = heuristicScore({ profile: PROFILE, event: EVENT, goal: "find agents people", now: NOW });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("blends goal and network facts into the score", () => {
    const h = heuristicScore({
      profile: PROFILE,
      event: EVENT,
      goal: "find agents people",
      meets: [{ who: "a", why: "w" }, { who: "b", why: "w" }, { who: "c", why: "w" }],
      now: NOW,
    });
    expect(h.go).toBeGreaterThanOrEqual(0.6);
    expect(h.facts.net).toBe(1);
    expect(h.facts.soon).toBe(1);
  });
});

describe("verdictOf", () => {
  it("keeps the calibration thresholds", () => {
    expect(verdictOf(0.6)).toBe("go");
    expect(verdictOf(0.59)).toBe("maybe");
    expect(verdictOf(0.4)).toBe("maybe");
    expect(verdictOf(0.39)).toBe("skip");
  });
});

describe("parseProfileInput", () => {
  it("allow-lists structured fields", () => {
    const p = parseProfileInput({
      name: "sam",
      headline: "pm",
      roles: ["pm"],
      topics: ["infra"],
      goals: [],
      links: { linkedin: "https://linkedin.com/in/sam" },
      evil: "not kept",
    });
    expect(p).not.toBeNull();
    expect(p && Object.keys(p).sort()).toEqual(["goals", "headline", "kind", "links", "name", "roles", "topics"]);
    expect(p && p.links.linkedin).toBe("https://linkedin.com/in/sam");
  });

  it("rejects junk urls in links", () => {
    const p = parseProfileInput({ name: "sam", links: { linkedin: "javascript:alert(1)" } });
    expect(p && p.links.linkedin).toBeUndefined();
  });
});

describe("parseSourceInput", () => {
  it("accepts a real linkedin url and rejects a bare one", () => {
    expect(parseSourceInput({ kind: "linkedin_url", value: "https://www.linkedin.com/in/ayaan" })).not.toBeNull();
    expect(parseSourceInput({ kind: "linkedin_url", value: "https://example.com" })).toBeNull();
  });

  it("caps the paste size", () => {
    expect(parseSourceInput({ kind: "text", value: "x".repeat(4001) })).toBeNull();
    expect(parseSourceInput({ kind: "text", value: "a real paste" })).not.toBeNull();
  });
});

describe("parsePaste", () => {
  it("lifts roles and goals from the paste", () => {
    const parsed = parsePaste("ml engineer at acme\nlooking for cofounders\ntopics: agents, infra");
    expect(parsed).not.toBeNull();
    expect(parsed && parsed.roles).toContain("ml engineer");
    expect(parsed && parsed.goals.length).toBeGreaterThan(0);
    expect(parsed && parsed.topics).toContain("agents");
  });
});

describe("buildProfile + qualityOf", () => {
  it("marks a bare linkedin url as thin and a rich paste as ok", () => {
    const thin = buildProfile({ source: { kind: "linkedin_url", value: "https://linkedin.com/in/xyz" } });
    expect(thin.quality).toBe("thin");
    const ok = buildProfile({ profile: PROFILE });
    expect(ok.quality).toBe("ok");
    expect(buildProfile({}).profile).toBeNull();
  });
});

describe("fallbackExplain", () => {
  it("writes honest reasons and a meet block from the segment", () => {
    const h = heuristicScore({ profile: PROFILE, event: EVENT, now: NOW });
    const card = fallbackExplain(h, { profile: PROFILE, event: EVENT, meets: [{ who: "dex", why: "you share: agents" }] });
    expect(card.scorer).toBe("typed");
    expect(card.meet[0].who).toBe("dex");
    expect(card.reasons.some((r) => r.includes("dex"))).toBe(true);
  });

  it("nudges for a thin profile instead of pretending", () => {
    const h = heuristicScore({ profile: null, event: OTHER, now: NOW });
    const card = fallbackExplain(h, { profile: null, event: OTHER });
    expect(card.reasons[0]).toMatch(/not enough profile yet/);
  });
});

describe("llmScore", () => {
  it("clamps the llm number near the typed anchor", async () => {
    const h = heuristicScore({ profile: PROFILE, event: EVENT, now: NOW });
    const card = await llmScore({
      chat: async () =>
        JSON.stringify({ go: 0.99, confidence: 0.9, outcome: "fine", reasons: ["r1", "r2"] }),
      heuristic: h,
      profile: PROFILE,
      event: EVENT,
    });
    expect(card.go).toBeLessThanOrEqual(h.go + 0.15 + 1e-9);
    expect(card.go).toBeGreaterThanOrEqual(h.go - 0.15 - 1e-9);
    expect(card.scorer).toBe("llm");
  });

  it("throws on a non-numeric go so the caller falls back", async () => {
    const h = heuristicScore({ profile: PROFILE, event: EVENT, now: NOW });
    await expect(
      llmScore({
        chat: async () => "not json at all",
        heuristic: h,
        profile: PROFILE,
        event: EVENT,
      }),
    ).rejects.toThrow(/no json object|non-numeric|no usable reasons/);
  });
});

describe("copy helpers", () => {
  it("names the segment honestly at category level", () => {
    expect(segmentFor(EVENT)).toBe("builders shipping against a clock");
    expect(segmentFor(null)).toBe("whoever the host pulls in");
  });

  it("finds shared words you can check by eye", () => {
    const shared = sharedTokens(PROFILE, EVENT);
    expect(Array.isArray(shared)).toBe(true);
    expect(shared.length).toBeLessThanOrEqual(3);
  });

  it("parses loose json from a fenced model reply", () => {
    const j = parseJsonLoose('```json\n{"go": 0.5}\n```');
    expect(j.go).toBe(0.5);
  });
});
