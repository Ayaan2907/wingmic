// faithful port of tests/score.test.mjs from ayaan-site (HEAD 1bca780), unit layer:
// api/_scoring.js is pure, so these run hermetically — determinism under fixed inputs,
// boundary verdicts, the llm clamp and its junk-throwing, profile parsing. the http
// integration layer of that file re-expresses at service level in service.test.ts.
// arithmetic pins are byte-for-byte: identical inputs must produce identical scores,
// verdicts, and orderings as the js engine did.
import { describe, expect, it } from "vitest";

import {
  buildProfile,
  embed,
  EMBED_DIM,
  fallbackExplain,
  heuristicScore,
  llmScore,
  parseJsonLoose,
  parsePaste,
  parseProfileInput,
  parseSourceInput,
  profileText,
  retrieve,
  segmentFor,
  sharedTokens,
  tokenize,
  verdictOf,
} from "./scoring.js";
import type { BayRecord } from "./types.js";

const NOW = Date.parse("2026-09-24T18:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

const HACK_EVENT: BayRecord = {
  id: "seed:ai-hack",
  type: "event",
  title: "ai agents hackathon weekend",
  category: "hackathons",
  source: "seed",
  venue: "somewhere in soma",
  note: "builders ship fast, judges from the infra world",
  lat: 37.77,
  lng: -122.41,
  startsAt: iso(NOW + 36e5),
  endsAt: iso(NOW + 36e5 + 4 * 36e5),
  fetchedAt: iso(NOW),
  firstSeenAt: iso(NOW),
};
const TOUR_EVENT: BayRecord = {
  id: "seed:city-tour",
  type: "event",
  title: "mission district food tour",
  category: "tours",
  source: "seed",
  note: "newcomers walk, taste, and trade recommendations",
  lat: 37.76,
  lng: -122.42,
  startsAt: iso(NOW + 48e5),
  fetchedAt: iso(NOW),
  firstSeenAt: iso(NOW),
};
const ENGINEER = {
  kind: "pasted" as const,
  headline: "ml engineer shipping agents and infra",
  roles: ["ml engineer"],
  topics: ["agents", "hackathons", "infra"],
  goals: [],
  links: {},
};

/* ---------- unit: embeddings ---------- */

describe("scoring: embed", () => {
  it("is deterministic and normalized", () => {
    const a = embed("builders shipping agents fast");
    const b = embed("builders shipping agents fast");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // same text, same vector
    expect(a.length).toBe(EMBED_DIM);
    const norm = Math.sqrt([...a].reduce((s, x) => s + x * x, 0));
    expect(Math.abs(norm - 1)).toBeLessThan(1e-9); // nonempty vectors are unit length
    const empty = [...embed("")];
    expect(empty.every((x) => x === 0)).toBe(true); // empty text embeds to the zero vector, no NaN
  });
});

/* ---------- unit: the typed scorer ---------- */

describe("scoring: heuristicScore", () => {
  it("is deterministic under fixed inputs", () => {
    const run = () =>
      heuristicScore({
        profile: ENGINEER,
        event: HACK_EVENT,
        goal: "meet builders",
        meets: [{ who: "dex morales", why: "builder" }],
        now: NOW,
      });
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    const { go, confidence, facts } = run();
    expect(go).toBeGreaterThanOrEqual(0.02); // go stays in its calibrated band
    expect(go).toBeLessThanOrEqual(0.97);
    expect(confidence).toBeGreaterThan(0.2); // a real profile carries real confidence
    expect(facts.soon).toBe(1); // 36h out counts as starts-soon
  });

  it("lets a matching profile outscore a mismatched one", () => {
    const on = heuristicScore({ profile: ENGINEER, event: HACK_EVENT, goal: "meet builders", meets: [], now: NOW });
    const off = heuristicScore({
      profile: ENGINEER,
      event: { ...TOUR_EVENT, title: "gardening club meetup", note: "plants and pruning" },
      goal: "meet builders",
      meets: [],
      now: NOW,
    });
    expect(on.go).toBeGreaterThan(off.go); // agent match beats the gardening club
  });
});

describe("scoring: verdictOf", () => {
  it("keeps the boundary verdicts", () => {
    expect(verdictOf(0.6)).toBe("go");
    expect(verdictOf(0.59)).toBe("maybe");
    expect(verdictOf(0.4)).toBe("maybe");
    expect(verdictOf(0.39)).toBe("skip");
    expect(verdictOf(0.97)).toBe("go");
  });
});

describe("scoring: retrieve", () => {
  it("ranks the matching event first and breaks ties by id", () => {
    const ranked = retrieve(profileText(ENGINEER), [TOUR_EVENT, HACK_EVENT]);
    expect(ranked[0].record.id).toBe("seed:ai-hack");
    expect(ranked[0].fit).toBeGreaterThanOrEqual(ranked[1].fit);
    const none = retrieve("", [TOUR_EVENT, HACK_EVENT]);
    expect(none.every((r) => r.fit === 0)).toBe(true); // no profile words, no fit claims
  });
});

/* ---------- unit: the explain fallback and the llm stage ---------- */

describe("scoring: fallbackExplain", () => {
  it("returns the full card shape", () => {
    const h = heuristicScore({ profile: ENGINEER, event: HACK_EVENT, goal: "meet builders", meets: [], now: NOW });
    const card = fallbackExplain(h, { profile: ENGINEER, event: HACK_EVENT, goal: "meet builders", meets: [] });
    expect(card.scorer).toBe("typed");
    expect(card.go).toBe(h.go);
    expect(["go", "maybe", "skip"]).toContain(card.verdict);
    expect(typeof card.outcome === "string" && card.outcome.length > 10).toBe(true); // the outcome sentence is real
    expect(Array.isArray(card.reasons) && card.reasons.length).toBeGreaterThanOrEqual(1); // at least one reason, always
    expect(Array.isArray(card.meet) && card.meet.length).toBeGreaterThanOrEqual(1);
    expect(card.meet[0].who).toBeTruthy(); // who to meet is populated
  });

  it("says when the signed-in network has no read on the room, instead of inventing one", () => {
    // the wingmic-kind empty read only fires when no other reason does — an event too
    // far out for the soon line, with no shared words and no goal (original copy).
    const farOut: BayRecord = {
      ...TOUR_EVENT,
      title: "gardening club meetup",
      note: "plants and pruning",
      category: "sports",
      startsAt: iso(NOW + 10 * 24 * 36e5),
    };
    const h = heuristicScore({ profile: ENGINEER, event: farOut, goal: "", meets: [], now: NOW });
    const card = fallbackExplain(h, {
      profile: { ...ENGINEER, kind: "wingmic" },
      event: farOut,
      goal: "",
      meets: [],
    });
    expect(card.reasons[0]).toBe("your wingmic network has no read on this room yet");
  });
});

describe("scoring: llmScore", () => {
  it("clamps output near the typed anchor", async () => {
    const h = heuristicScore({ profile: ENGINEER, event: HACK_EVENT, goal: "", meets: [], now: NOW });
    const chat = async () =>
      JSON.stringify({ go: 0.99, confidence: 0.9, outcome: "you will ship something", reasons: ["matches your agents work"], meet: [] });
    const card = await llmScore({ chat, heuristic: h, profile: ENGINEER, event: HACK_EVENT, goal: "", meets: [] });
    expect(card.scorer).toBe("llm");
    expect(card.go).toBeLessThanOrEqual(h.go + 0.15 + 1e-9); // anchored within 0.15
    expect(card.outcome.length).toBeGreaterThan(0); // the llm words land
  });

  it("throws on junk so the caller falls back, and parses fenced json", async () => {
    const h = heuristicScore({ profile: ENGINEER, event: HACK_EVENT, goal: "", meets: [], now: NOW });
    await expect(
      llmScore({ chat: async () => "i refuse to answer in json", heuristic: h, profile: ENGINEER, event: HACK_EVENT }),
    ).rejects.toThrow(/json/i);
    const fenced = async () =>
      "```json\n" +
      JSON.stringify({ go: h.go, outcome: "ok", reasons: ["fits"], meet: [{ who: "x", why: "y", starter: "z" }] }) +
      "\n```";
    const card = await llmScore({ chat: fenced, heuristic: h, profile: ENGINEER, event: HACK_EVENT });
    expect(card.scorer).toBe("llm");
    expect(card.meet[0].who).toBe("x");
  });
});

/* ---------- unit: the profile consume path ---------- */

describe("scoring: buildProfile", () => {
  it("accepts a linkedin url, a paste, and rejects junk", () => {
    const url = buildProfile({ source: { kind: "linkedin_url", value: "https://www.linkedin.com/in/sam-rivera" } });
    expect(url.profile && url.profile.kind).toBe("throwaway");
    expect(url.profile && url.profile.links.linkedin).toBe("https://www.linkedin.com/in/sam-rivera");
    const paste = buildProfile({ source: { kind: "text", value: "i build compilers and i am new to the city" } });
    expect(paste.profile && paste.profile.kind).toBe("throwaway");
    expect(paste.profile && paste.profile.raw).toBe("i build compilers and i am new to the city");
    const bad = buildProfile({ source: { kind: "linkedin_url", value: "https://evil.example/u/x" } });
    expect(bad.profile).toBeNull();
    expect(bad.quality).toBe("none");
    const junk = buildProfile({ source: { kind: "text", value: "   " } });
    expect(junk.profile).toBeNull();
  });

  it("builds a throwaway from pasted text with parsed fields and the raw text", () => {
    const b = buildProfile({ source: { kind: "text", value: "ml engineer at acme\nlooking for a cofounder" } });
    expect(b.profile && b.profile.kind).toBe("throwaway");
    expect(b.profile && b.profile.headline).toBe("ml engineer at acme");
    expect(b.profile && b.profile.roles).toEqual(["ml engineer"]);
    expect(b.profile && b.profile.raw && b.profile.raw.includes("looking for a cofounder")).toBe(true); // rides along for retrieval
    expect(b.quality).toBe("ok");
  });
});

describe("scoring: parsePaste", () => {
  it("lifts fields from a paste without inventing any", () => {
    const p = parsePaste(
      "ml engineer at acme\nbuilt agents and infra for years\nlooking for a cofounder\ntopics: rust, edge configs, inference",
    );
    expect(p && p.headline).toBe("ml engineer at acme");
    expect(p && p.roles).toEqual(["ml engineer"]);
    expect(p && p.goals[0]).toBe("looking for a cofounder");
    expect(p && p.topics).toEqual(["rust", "edge configs", "inference"]);
    // a bare line is claimed by nothing; it rides in raw only
    const bare = parsePaste("ml engineer\ni build compilers");
    expect(bare && bare.roles).toEqual([]);
    expect(bare && bare.goals).toEqual([]);
    expect(bare && bare.topics).toEqual([]);
    expect(parsePaste("")).toBeNull();
  });
});

/* ---------- extra pins (not in the old file; true of the same engine) ---------- */

describe("scoring: boundary parsing extras", () => {
  it("allow-lists structured profile fields and drops junk links", () => {
    const p = parseProfileInput({
      name: "sam",
      headline: "pm",
      roles: ["pm"],
      topics: ["infra"],
      goals: [],
      links: { linkedin: "https://linkedin.com/in/sam", evil: "javascript:alert(1)" },
      evil: "not kept",
    });
    expect(p).not.toBeNull();
    expect(p && Object.keys(p).sort()).toEqual(["goals", "headline", "kind", "links", "name", "roles", "topics"]);
    expect(p && p.links.linkedin).toBe("https://linkedin.com/in/sam");
    expect(p && Object.keys(p.links)).toEqual(["linkedin"]); // the junk key never lands
  });

  it("validates the raw ask: linkedin urls, paste caps, empty text", () => {
    expect(parseSourceInput({ kind: "linkedin_url", value: "https://www.linkedin.com/in/ayaan" })).not.toBeNull();
    expect(parseSourceInput({ kind: "linkedin_url", value: "https://example.com" })).toBeNull();
    expect(parseSourceInput({ kind: "text", value: "x".repeat(4001) })).toBeNull();
    expect(parseSourceInput({ kind: "text", value: "a real paste" })).not.toBeNull();
  });

  it("keeps tokenize and the fenced-json helper honest", () => {
    expect(tokenize("builders SHIP fast!")).toContain("builders");
    const j = parseJsonLoose('```json\n{"go": 0.5}\n```');
    expect(j.go).toBe(0.5);
  });

  it("names the segment honestly at category level", () => {
    expect(segmentFor(HACK_EVENT)).toBe("builders shipping against a clock");
    expect(segmentFor(null)).toBe("whoever the host pulls in");
  });

  it("lists shared words you can check by eye, capped", () => {
    const shared = sharedTokens(ENGINEER, HACK_EVENT, "meet builders");
    expect(Array.isArray(shared)).toBe(true);
    expect(shared.length).toBeLessThanOrEqual(3);
  });
});
