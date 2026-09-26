// apps/app/app/bay/__tests__/mapStyle.test.ts — pins the ported map style
// rules: keyless tiles only (carto is deliberately excluded), day/night
// visibility flips, honest GeoJSON conversion (events without coordinates
// don't render), emphasis stamping, and the fit expressions' shape.

import { describe, expect, it } from 'vitest';
import type { BayRecord } from '@wingmic/bay/core';
import {
  ALL_LAYERS,
  EVENTS_LAYER,
  eventsToGeoJSON,
  fitOpacity,
  fitRadius,
  inkFor,
  paperFor,
  placesToGeoJSON,
  stampFits,
  styleFor,
} from '../mapStyle';

let n = 0;
function record(over: Partial<BayRecord> = {}): BayRecord {
  n += 1;
  return {
    id: `seed:r${n}`,
    type: 'place',
    category: 'startups',
    title: `place ${n}`,
    source: 'seed',
    url: 'https://example.com',
    fetchedAt: '2026-09-26T00:00:00.000Z',
    firstSeenAt: '2026-09-26T00:00:00.000Z',
    ...over,
  };
}

describe('styleFor', () => {
  it('day uses openstreetmap standard raster, visible', () => {
    const style = styleFor(false);
    expect(style.sources['tiles-light'].tiles[0]).toContain('tile.openstreetmap.org');
    const visibility = (layerId: string): string | undefined =>
      (style.layers.find((l) => l.id === layerId) as { layout?: { visibility?: string } } | undefined)?.layout
        ?.visibility;
    expect(visibility('raster-light')).toBeUndefined();
    expect(visibility('raster-dark')).toBe('none');
  });

  it('night uses the esri dark canvas, visible', () => {
    const style = styleFor(true);
    expect(style.sources['tiles-dark'].tiles[0]).toContain('services.arcgisonline.com');
    expect(style.layers.find((l) => l.id === 'raster-dark')?.layout).toEqual({ visibility: 'visible' });
  });

  it('never ships a keyed tile provider (carto excluded by rule)', () => {
    const style = styleFor(true);
    const urls = JSON.stringify(style);
    expect(urls).not.toContain('carto');
    expect(urls).not.toContain('api key');
  });

  it('paper and ink flip with the theme', () => {
    expect(paperFor(true)).not.toBe(paperFor(false));
    expect(inkFor(true)).not.toBe(inkFor(false));
  });
});

describe('layers', () => {
  it('five place layers plus events, ids stable for the toggles', () => {
    expect(ALL_LAYERS.map((l) => l.id)).toEqual(['startups', 'offices', 'housing', 'sports', 'tours', 'events']);
    expect(EVENTS_LAYER.color).toBeTruthy();
  });
});

describe('geojson conversion', () => {
  it('places with coordinates become point features with the ported properties', () => {
    const geo = placesToGeoJSON([record({ lat: 37.77, lng: -122.41, note: 'a note' })]);
    expect(geo.type).toBe('FeatureCollection');
    expect(geo.features).toHaveLength(1);
    const f = geo.features[0]!;
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [-122.41, 37.77] });
    expect(f.properties.note).toBe('a note');
    expect(f.properties.cat).toBe('startups');
  });

  it('events without coordinates do not render (but still count upstream)', () => {
    const geo = eventsToGeoJSON([
      record({ type: 'event', category: 'events', lat: 37.7, lng: -122.4 }),
      record({ type: 'event', category: 'events' }),
      record({ type: 'event', category: 'events', lat: Number.NaN, lng: -122.4 }),
    ]);
    expect(geo.features).toHaveLength(1);
  });
});

describe('emphasis stamping', () => {
  it('stamps pf on matching ids and clears it when the view ends', () => {
    const geo = placesToGeoJSON([record({ lat: 1, lng: 1 })]);
    const id = geo.features[0]!.properties.id;
    stampFits(geo, new Map([[id, 0.7]]));
    expect(geo.features[0]!.properties.pf).toBe(0.7);
    stampFits(geo, new Map([['someone-else', 0.7]]));
    expect(geo.features[0]!.properties.pf).toBeUndefined();
  });

  it('null fits clears every stamp', () => {
    const geo = placesToGeoJSON([record({ lat: 1, lng: 1 }), record({ lat: 2, lng: 2 })]);
    stampFits(geo, new Map([[geo.features[0]!.properties.id, 0.4]]));
    stampFits(geo, null);
    for (const f of geo.features) expect(f.properties.pf).toBeUndefined();
  });
});

describe('fit expressions', () => {
  it('radius interpolates on the stamped pf, opacity floors at 0.35 — never hidden', () => {
    expect(fitRadius(4, 8, 13)[0]).toBe('interpolate');
    expect(fitOpacity()[0]).toBe('interpolate');
    // opacity endpoints: 0.35 low, 1 high — emphasis dims, never disappears
    const opacity = fitOpacity() as unknown as unknown[];
    expect(opacity).toContain(0.35);
    expect(opacity).toContain(1);
  });
});
