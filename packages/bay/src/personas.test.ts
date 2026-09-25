// pins from tests/personas.test.mjs (the 7 unit tests; the 4 "persona api" http
// tests boot the old server and belong to the wingmic router task, todo_8CudacYO).
// the persona weights module is pure and shared by both surfaces, so the tests pin
// its behavior directly. determinism here is what lets server ranking and map
// emphasis agree.
import { describe, expect, it } from "vitest";

import { combineGoal, PERSONA_IDS, personaFit, rank, resolvePersona } from "./personas.js";
import type { Persona, PersonaFitRecord } from "./types.js";

const S = (id: string, cat: string, text: string): PersonaFitRecord & { id: string } => ({
  id,
  category: cat,
  title: text,
  venue: "",
  note: text,
});

describe("personas + resolvePersona", () => {
  it("three launch personas, stable ids", () => {
    expect(PERSONA_IDS).toEqual(["hiring", "raising", "newcomer"]);
    for (const id of PERSONA_IDS) {
      const p = resolvePersona(id) as Persona;
      expect(p.label && p.button && p.why && p.intent, `${id} carries its ui words`).toBeTruthy();
      expect(p.intent.length <= 80, "the intent leads the goal channel, so it stays short").toBe(true);
    }
    expect(resolvePersona("nope")).toBeNull();
  });

  it("category canon folds both vocabularies to one", () => {
    // a store record (plural) and a static place feature (singular) for the same
    // kind of dot must weigh the same, or the map would rank them apart
    const hiring = resolvePersona("hiring");
    const storeRecord = { id: "luma:hack", category: "hackathons", title: "ai hackathon weekend", note: "builders ship fast" };
    const placeFeature = { id: "hack-venue", cat: "startup", name: "a startup office", note: "engineers everywhere" };
    expect(personaFit(hiring, storeRecord)).toBe(
      personaFit(hiring, { ...storeRecord, category: undefined, cat: "hackathons" }),
    );
    const fit = personaFit(hiring, placeFeature);
    expect(fit > 0, `a startup office reads as hiring ground, got ${fit}`).toBe(true);
    expect(personaFit(hiring, { ...placeFeature, cat: "startups" })).toBe(fit); // singular and plural categories agree
  });

  it("fit is deterministic, bounded, and reads both record shapes", () => {
    const hiring = resolvePersona("hiring");
    const r = S("luma:x", "hackathons", "ai agents hackathon weekend, builders ship fast");
    expect(personaFit(hiring, r)).toBe(personaFit(hiring, r)); // same inputs, same fit
    for (const id of PERSONA_IDS) {
      for (const rec of [r, S("p:y", "tours", "food tour for newcomers")]) {
        const f = personaFit(resolvePersona(id), rec);
        expect(f >= 0 && f <= 1, `fit stays in 0..1, got ${f}`).toBe(true);
      }
    }
    expect(personaFit(hiring, null)).toBe(0);
    expect(personaFit(null, r)).toBe(0);
  });

  it("each persona ranks its own world first (fixed store)", () => {
    const store = [
      S("luma:hackathon", "hackathons", "ai agents hackathon weekend, builders ship fast, recruiters watch"),
      S("luma:demo-night", "events", "founder demo night, eight startups pitch to a panel of investors"),
      S("luma:food-tour", "tours", "mission district food tour for newcomers, walk and taste"),
      S("luma:pickup-soccer", "sports", "casual pickup soccer in the park, newcomers welcome"),
    ];
    const top = (id: string): string => rank(resolvePersona(id), store)[0]!.id;
    expect(top("hiring")).toBe("luma:hackathon");
    expect(top("raising")).toBe("luma:demo-night");
    expect(top("newcomer")).toBe("luma:food-tour");

    // the cross-checks that make it a ranking layer and not a label: each persona
    // puts its own room above the others' rooms
    const order = (id: string): string[] => rank(resolvePersona(id), store).map((r) => r.id);
    const h = order("hiring");
    const r = order("raising");
    const n = order("newcomer");
    expect(h.indexOf("luma:hackathon")).toBeLessThan(h.indexOf("luma:food-tour"));
    expect(r.indexOf("luma:demo-night")).toBeLessThan(r.indexOf("luma:hackathon"));
    expect(n.indexOf("luma:food-tour")).toBeLessThan(n.indexOf("luma:demo-night"));
    expect(n.indexOf("luma:pickup-soccer")).toBeLessThan(n.indexOf("luma:demo-night"));
  });

  it("rank is stable, sorted by fit, ties break by id", () => {
    const hiring = resolvePersona("hiring");
    const store = [
      S("luma:b-event", "events", "a plain listing"),
      S("luma:a-event", "events", "a plain listing"), // same category, same words: pure id tie
      S("luma:hack", "hackathons", "hackathon for engineers"),
    ];
    const a = rank(hiring, store);
    const b = rank(hiring, store);
    expect(a).toEqual(b); // rank twice, same order
    expect(a[0]!.id).toBe("luma:hack");
    expect(a[1]!.id).toBe("luma:a-event"); // ties break by id, not insertion order
    expect(a[2]!.id).toBe("luma:b-event");
    expect(a[0]!.fit).toBeGreaterThan(a[1]!.fit);
    for (const entry of a) {
      expect(Number.isFinite(entry.fit) && entry.fit >= 0 && entry.fit <= 1).toBe(true);
    }
  });

  it("rank drops id-less records and empty stores", () => {
    const newcomer = resolvePersona("newcomer");
    expect(rank(newcomer, [])).toEqual([]);
    expect(rank(newcomer, [{ category: "tours", title: "no id here" }])).toEqual([]);
    expect(rank(newcomer, null)).toEqual([]);
  });

  it("combineGoal feeds the scorer's goal channel only", () => {
    expect(combineGoal(null, "meet builders")).toBe("meet builders"); // no persona, no change
    expect(combineGoal("nope", "meet builders")).toBe("meet builders");
    const hiring = resolvePersona("hiring")!;
    expect(combineGoal("hiring", "")).toBe(hiring.intent); // persona alone fills the goal
    expect(combineGoal("hiring", "meet rust devs")).toBe(`${hiring.intent}. meet rust devs`); // persona leads, user words follow
    expect(combineGoal("raising", "   ")).toBe(resolvePersona("raising")!.intent); // a whitespace goal counts as none
  });
});
