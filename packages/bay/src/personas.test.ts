// persona pins from tests/personas.test.mjs (11 tests): deterministic weights, the
// CANON fold, goal fusion, and stable id tie-breaks. determinism here is what lets
// server ranking and map emphasis agree.
import { describe, expect, it } from "vitest";

import { BAY_PERSONAS, CANON, canonCat, combineGoal, personas, personaFit, rank, resolvePersona, topMatches } from "./personas.js";
import type { BayRecord } from "./types.js";

const rec = (over: Partial<BayRecord> & { id: string }): BayRecord => ({
  type: "event",
  category: "events",
  title: over.id,
  source: "seed",
  fetchedAt: "2026-01-09T00:00:00.000Z",
  firstSeenAt: "2026-01-09T00:00:00.000Z",
  ...over,
});

const STARTUP = rec({ id: "e1", category: "startups", title: "founders coffee", note: "raise and hire talk" });
const HACK = rec({ id: "e2", category: "hackathons", title: "agents hackathon", note: "ship a demo in a weekend" });
const SPORTS = rec({ id: "e3", category: "sports", title: "pickup soccer", note: "newcomers welcome" });

describe("personas + resolvePersona", () => {
  it("keeps the exact ids and labels", () => {
    expect(personas.map((p) => p.id)).toEqual(["hiring", "raising", "new"]);
    expect(personas.map((p) => p.label)).toEqual(["hiring", "raising", "new in town"]);
  });

  it("resolves valid ids and none", () => {
    expect(resolvePersona("hiring") && resolvePersona("hiring").id).toBe("hiring");
    expect(resolvePersona("")).toBeNull();
  });

  it("rejects unknown ids outright - never a silent unranked fallback", () => {
    expect(resolvePersona("wizard")).toBeNull();
  });

  it("matches the legacy window global shape", () => {
    expect(Object.keys(BAY_PERSONAS).sort()).toEqual(["hiring", "new", "raising"]);
    expect(BAY_PERSONAS.hiring.weight).toBe(1);
  });
});

describe("CANON", () => {
  it("folds singular categories to the store plural", () => {
    expect(CANON.startup).toBe("startups");
    expect(CANON.office).toBe("offices");
    expect(CANON.housing).toBe("housing");
    expect(CANON.sports).toBe("sports");
    expect(CANON.tour).toBe("tours");
    expect(canonCat("startup")).toBe("startups");
    expect(canonCat("startups")).toBe("startups");
    expect(canonCat("weird")).toBe("weird");
  });
});

describe("personaFit", () => {
  it("ranks a category hit over a miss", () => {
    const hiring = resolvePersona("hiring")!;
    expect(personaFit(hiring, STARTUP)).toBeGreaterThan(personaFit(hiring, SPORTS));
    expect(personaFit(hiring, STARTUP)).toBeGreaterThan(0);
  });

  it("stays inside 0..1 and tolerates missing records", () => {
    const hiring = resolvePersona("hiring")!;
    for (const r of [STARTUP, HACK, SPORTS]) {
      expect(personaFit(hiring, r)).toBeGreaterThanOrEqual(0);
      expect(personaFit(hiring, r)).toBeLessThanOrEqual(1);
    }
    expect(personaFit(hiring, rec({ id: "empty", note: "", title: "" }))).toBeGreaterThanOrEqual(0);
  });

  it("is deterministic: same persona, same record, same fit", () => {
    const raising = resolvePersona("raising")!;
    expect(personaFit(raising, STARTUP)).toBe(personaFit(raising, STARTUP));
    expect(personaFit(raising, HACK)).toBe(personaFit(raising, HACK));
  });
});

describe("rank", () => {
  it("orders by fit with id tie-breaks, and is stable across runs", () => {
    const hiring = resolvePersona("hiring")!;
    const input = [SPORTS, HACK, STARTUP];
    const a = rank(hiring, input);
    const b = rank(hiring, input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.map((x) => x.record.id)).toEqual(["e1", "e2", "e3"]); // startup talk > hackathon > sports
    expect(a[0].fit).toBeGreaterThanOrEqual(a[1].fit);

    const ties = [rec({ id: "b", category: "startups", title: "t", note: "n" }), rec({ id: "a", category: "startups", title: "t", note: "n" })];
    const r = rank(hiring, ties);
    expect(r.map((x) => x.record.id)).toEqual(["a", "b"]);
  });
});

describe("topMatches", () => {
  it("caps at three, includes events and places, no numeric claims", () => {
    const hiring = resolvePersona("hiring")!;
    const many = [
      STARTUP,
      rec({ id: "e4", category: "startups", title: "another", note: "n" }),
      rec({ id: "e5", category: "startups", title: "third", note: "n" }),
      rec({ id: "e6", category: "startups", title: "fourth", note: "n" }),
    ];
    const top = topMatches(hiring, many);
    expect(top.length).toBe(3);
    expect(top.every((t) => !/\d/.test(t.label))).toBe(true);
  });
});

describe("combineGoal", () => {
  it("fuses persona goal with the ask and never mutates weights", () => {
    const hiring = resolvePersona("hiring")!;
    const before = JSON.stringify(personas);
    expect(combineGoal("hiring", "")).toBe(hiring.goal);
    expect(combineGoal("hiring", "find a cofounder")).toContain(hiring.goal);
    expect(combineGoal("hiring", "find a cofounder")).toContain("find a cofounder");
    expect(combineGoal(null, "where tonight?")).toBe("where tonight?");
    expect(JSON.stringify(personas)).toBe(before);
  });
});
