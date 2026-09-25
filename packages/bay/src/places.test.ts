// pins from tests/places.test.mjs (5 tests), ported faithfully: the map eats this
// file at open. keep the shape honest: real geojson points, bay area bounds, a fixed
// category enum, and a note on every dot. never a bare pin.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "data", "places.json");
const places = JSON.parse(readFileSync(file, "utf8")) as {
  type?: string;
  features?: Array<{
    type?: string;
    geometry?: { type?: string; coordinates?: unknown[] };
    properties?: Record<string, unknown>;
  }>;
};
const features = places.features ?? [];
const CATS = ["startup", "office", "housing", "sports", "tour"];
const BOUNDS = { lng: [-123.6, -121.6], lat: [36.8, 38.4] };

describe("places.json", () => {
  it("is a geojson featurecollection of point features", () => {
    expect(places.type).toBe("FeatureCollection");
    expect(Array.isArray(features) && features.length >= 10, "a map with three dots is a stub").toBe(true);
    for (const f of features) {
      expect(f.type).toBe("Feature");
      expect(f.geometry?.type).toBe("Point");
      expect(
        Array.isArray(f.geometry?.coordinates) && (f.geometry?.coordinates?.length ?? 0) === 2,
        "coordinates are [lng, lat]",
      ).toBe(true);
    }
  });

  it("every coordinate is a real bay area lng/lat, in bounds", () => {
    for (const f of features) {
      const [lng, lat] = (f.geometry?.coordinates ?? []) as [number, number];
      expect(typeof lng === "number" && typeof lat === "number", `non-numeric coordinate on ${f.properties?.id}`).toBe(true);
      expect(lng > BOUNDS.lng[0]! && lng < BOUNDS.lng[1]!, `lng ${lng} out of the bay (${f.properties?.id})`).toBe(true);
      expect(lat > BOUNDS.lat[0]! && lat < BOUNDS.lat[1]!, `lat ${lat} out of the bay (${f.properties?.id})`).toBe(true);
    }
  });

  it("every place has a category from the layer enum and a real note", () => {
    for (const f of features) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      expect(p && typeof p === "object", "every feature carries properties").toBe(true);
      expect(CATS.includes(String(p.cat)), `bad category "${p.cat}" on ${p.id}`).toBe(true);
      expect(typeof p.name === "string" && (p.name as string).trim().length > 0, `nameless place: ${p.id}`).toBe(true);
      expect(typeof p.note === "string" && (p.note as string).trim().length >= 20, `bare pin: ${p.id} needs a real note`).toBe(true);
      if (p.source !== undefined) expect(typeof p.source, `bad source on ${p.id}`).toBe("string");
    }
  });

  it("ids are unique so the map can address every dot", () => {
    const ids = features.map((f) => f.properties && f.properties.id);
    for (const id of ids) {
      expect(typeof id === "string" && (id as string).length > 0, "every place needs an id").toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length); // duplicate ids
  });

  it("every category in the enum is used, so no layer ships empty", () => {
    const used = new Set(features.map((f) => f.properties?.cat));
    for (const c of CATS) {
      expect(used.has(c), `layer "${c}" has no places`).toBe(true);
    }
  });
});
