// pins from tests/places.test.mjs (5 tests): every curated place carries a first-person
// note - "never a bare pin" - and the vocabulary stays normalizable.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CANON, canonCat } from "./personas.js";
import { normalizeRecord } from "./contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "data", "places.json");
const geo = JSON.parse(readFileSync(file, "utf8")) as { features?: unknown[] };

describe("places.json", () => {
  it("is a GeoJSON FeatureCollection with features", () => {
    expect(Array.isArray(geo.features)).toBe(true);
    expect(geo.features.length).toBeGreaterThan(0);
  });

  it("carries the required core fields on every feature", () => {
    for (const f of geo.features) {
      const p = f as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
      expect(p.properties, "feature missing properties").toBeTruthy();
      expect(p.geometry && Array.isArray(p.geometry.coordinates), "feature missing coordinates").toBe(true);
    }
  });

  it("never ships a bare pin: every place has a first-person note", () => {
    for (const f of geo.features) {
      const p = f as { properties: { note?: unknown; name?: unknown } };
      expect(typeof p.properties.note).toBe("string");
      expect((p.properties.note as string).length).toBeGreaterThan(0);
      expect(typeof p.properties.name).toBe("string");
    }
  });

  it("uses the singular vocabulary the CANON fold expects", () => {
    const cats = new Set(
      geo.features.map((f) => (f as { properties: { cat: string } }).properties.cat),
    );
    for (const c of cats) expect(CANON[c as keyof typeof CANON] || canonCat(c)).toBeTruthy();
  });

  it("every feature normalizes into the contract as a place", () => {
    for (const f of geo.features) {
      const p = f as {
        properties: { id?: string; name: string; cat: string; note: string; source?: string };
        geometry: { coordinates: [number, number] };
      };
      const n = normalizeRecord({
        id: p.properties.id || `seed:${p.properties.name}`,
        type: "place",
        category: canonCat(p.properties.cat),
        title: p.properties.name,
        note: p.properties.note,
        source: p.properties.source || "seed",
        lat: p.geometry.coordinates[1],
        lng: p.geometry.coordinates[0],
        fetchedAt: "2026-01-09T00:00:00.000Z",
        firstSeenAt: "2026-01-09T00:00:00.000Z",
      });
      expect(n.ok, `place ${p.properties.name} failed: ${!n.ok && n.error}`).toBe(true);
    }
  });
});
