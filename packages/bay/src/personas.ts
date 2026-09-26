// packages/bay/src/personas.ts: persona views: query weights over the event and place
// store. one module serves both sides: the server ranks the live store with it, and the
// map surface re-ranks what it emphasizes with the same import. one weights file, so
// the two can never drift apart.
//
// a persona is a ranking layer, not a scorer: it reorders which dots surface
// first. the per-event go/no-go still comes from the one scorer in scoring.ts; a
// persona reaches scoring only through that scorer's goal channel (combineGoal
// below), so the calibration stays in exactly one place.
// everything here is pure and deterministic: fixed store, fixed ranking.
// ported from ayaan-site assets/bay/personas.js (1bca780): identical weights, ids,
// and copy — the old dual-env global (window.BAY_PERSONAS) dies; in one app it is
// a plain import on both sides.

import type { BayCategory, Persona, PersonaFitEntry, PersonaFitRecord } from "./types.js";
import { BAY_CATEGORIES } from "./types.js";

// the store speaks plural categories; the static places geojson predates it with
// singular ones. canon folds both vocabularies to one, so a startup dot and a
// startups record weigh the same.
export const CANON: Record<string, BayCategory> = {
  // the store's own plural vocabulary
  housing: "housing",
  sports: "sports",
  tours: "tours",
  hackathons: "hackathons",
  offices: "offices",
  startups: "startups",
  events: "events",
  // the static places geojson predates the store and speaks singular
  startup: "startups",
  office: "offices",
  tour: "tours",
};

// same tokenizer idea as scoring.ts, kept self-contained so this file
// imports nothing and loads anywhere.
const STOP = new Set(
  "a an and are as at be but by for from in is it its of on or that the this to with".split(" "),
);
const tokenize = (text: unknown): string[] =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

const textOf = (r: PersonaFitRecord | null | undefined): string =>
  [r && r.title, r && r.name, r && r.note, r && r.venue, r && r.address]
    .filter(Boolean)
    .join(". ");

export const PERSONAS: Record<string, Persona> = {
  hiring: {
    id: "hiring",
    label: "founder hiring",
    button: "hiring",
    intent: "meet engineers and people i could hire",
    why: "puts hackathons, startup rooms and offices first",
    // category weights carry the layer; every store category gets an explicit
    // weight so a record type is never silently read as something else.
    categories: { hackathons: 1, startups: 0.8, offices: 0.7, events: 0.5, sports: 0.2, tours: 0.1, housing: 0.1 },
    tokens: ["hiring", "recruiting", "engineers", "developers", "cofounder", "candidates", "hackathon", "builders", "careers", "devs"],
  },
  raising: {
    id: "raising",
    label: "founder raising",
    button: "raising",
    intent: "meet investors and founders who have raised",
    why: "puts investor and founder rooms first",
    categories: { startups: 1, offices: 0.7, hackathons: 0.5, events: 0.5, sports: 0.1, tours: 0.1, housing: 0 },
    tokens: ["investors", "vc", "venture", "pitch", "raising", "seed", "demo", "founders", "angels", "fund"],
  },
  newcomer: {
    id: "newcomer",
    label: "new in town",
    button: "new in town",
    intent: "get to know the city and meet new people",
    why: "puts tours, housing and sports first",
    categories: { tours: 1, housing: 0.8, sports: 0.7, events: 0.5, startups: 0.3, offices: 0.2, hackathons: 0.2 },
    tokens: ["tour", "walk", "newcomers", "neighbors", "market", "park", "food", "pickup", "museum", "free"],
  },
};

export const PERSONA_IDS: string[] = Object.keys(PERSONAS);
const round2 = (n: number): number => Math.round(n * 100) / 100;

export const resolvePersona = (id: string | null | undefined): Persona | null =>
  (id && PERSONAS[id]) || null;

// one record, one persona, one fit in 0..1. category weight carries 60%, token
// overlap in the record's own words carries 40%. reads both record shapes: store
// records (category/title/venue/note) and static place features (cat/name/note).
export function personaFit(
  persona: Persona | null | undefined,
  record: PersonaFitRecord | null | undefined,
): number {
  if (!persona || !record || typeof record !== "object") return 0;
  const cat = CANON[String(record.category ?? record.cat)] || "events";
  const catW = persona.categories[cat] != null ? persona.categories[cat] : 0.3;
  const words = new Set(tokenize(textOf(record)));
  const hits = persona.tokens.filter((t) => words.has(t)).length;
  const textScore = persona.tokens.length ? hits / persona.tokens.length : 0;
  return round2(Math.min(1, Math.max(0, 0.6 * catW + 0.4 * textScore)));
}

// rank records for one persona: fit desc, ties break by id so the order is
// stable across runs and across the server and browser copies of this module.
// records without an id cannot be ranked onto the map, so they drop out.
export function rank(persona: Persona | null | undefined, records: unknown): PersonaFitEntry[] {
  const list = Array.isArray(records) ? (records as PersonaFitRecord[]) : [];
  return list
    .filter((r) => r && r.id != null)
    .map((r) => ({ id: String(r.id), fit: personaFit(persona, r) }))
    .sort((a, b) => b.fit - a.fit || a.id.localeCompare(b.id));
}

// the persona reaches the scorer through the goal channel only: the intent line
// leads, the visitor's own words follow. no persona, no change. the user goal
// arrives already capped (the score pipeline slices to 400 before calling this).
export function combineGoal(
  personaId: string | null | undefined,
  goal: string | null | undefined,
): string {
  const p = resolvePersona(personaId);
  const user = String(goal || "").trim();
  if (!p) return user;
  return [p.intent, user].filter(Boolean).join(". ");
}

// guard the runtime shape: every persona covers every store category explicitly.
export const assertPersonaWeightsCoverCategories = (): void => {
  for (const id of PERSONA_IDS) {
    for (const cat of BAY_CATEGORIES) {
      const w = PERSONAS[id].categories[cat];
      if (typeof w !== "number" || w < 0 || w > 1)
        throw new Error(`persona ${id} is missing a 0..1 weight for category ${cat}`);
    }
  }
};
