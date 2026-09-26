// apps/app/app/bay/mapStyle.ts — the bay's MapLibre style, ported from
// ayaan-site assets/bay/map.js with the layer palette mapped onto
// design-tokens v3 (the app's dark warm canvas + amber signature). Pure
// module: no React, no maplibre import — the map component and the unit
// tests both consume it.

import { colors } from '@wingmic/design-tokens';
import type { BayRecord, Persona } from '@wingmic/bay/core';
import { personaFit } from '@wingmic/bay/core';
import type { ExpressionSpecification } from 'maplibre-gl';

export interface BayLayer {
  id: string;
  label: string;
  color: string;
}

// The five place layers, in launch order. Colors from the token palette:
// amber is the signature, mint/blue/violet the second/third/info hues, and
// offices take the warm ink-gray. The hues stay close to the original
// ayaan-site palette so the map reads the same; the values now come from one
// design system instead of ad-hoc hexes.
export const PLACE_LAYERS: BayLayer[] = [
  { id: 'startups', label: 'startups', color: colors.accent },
  { id: 'offices', label: 'offices', color: 'rgba(244,241,234,0.55)' },
  { id: 'housing', label: 'housing', color: colors.second },
  { id: 'sports', label: 'sports', color: colors.info.blue },
  { id: 'tours', label: 'tours', color: colors.info.violet },
];

// Events are a layer of their own — the red dots the intro promises.
export const EVENTS_LAYER: BayLayer = { id: 'events', label: 'events', color: colors.alarm };

export const ALL_LAYERS: BayLayer[] = [...PLACE_LAYERS, EVENTS_LAYER];
export const LAYER_IDS: string[] = ALL_LAYERS.map((l) => l.id);

/** paper = the dot stroke + background color; ink = label text. The app is
 * dark-first (night default); day swaps to openstreetmap's light canvas. */
export const paperFor = (night: boolean): string => (night ? colors.bg.page : '#faf9f6');
export const inkFor = (night: boolean): string => (night ? colors.ink.DEFAULT : '#1a1a18');

// Free raster tiles, no key: openstreetmap standard for day, esri dark gray
// canvas for night. carto is deliberately excluded — its legacy raster urls
// answer with an "api key required" watermark (ported rule).
const OSM_TILES = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
const ESRI_DARK_TILES = [
  'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
];

export interface BayRasterStyle {
  version: 8;
  glyphs: string;
  sources: {
    'tiles-light': { type: 'raster'; tiles: string[]; tileSize: number; maxzoom: number; attribution: string };
    'tiles-dark': { type: 'raster'; tiles: string[]; tileSize: number; maxzoom: number; attribution: string };
  };
  layers: Array<
    | { id: 'paper'; type: 'background'; paint: { 'background-color': string } }
    | { id: 'raster-light'; type: 'raster'; source: 'tiles-light'; paint: { 'raster-fade-duration': number } }
    | { id: 'raster-dark'; type: 'raster'; source: 'tiles-dark'; layout: { visibility: 'visible' | 'none' }; paint: { 'raster-fade-duration': number } }
  >;
}

export function styleFor(night: boolean): BayRasterStyle {
  return {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      'tiles-light': {
        type: 'raster',
        tiles: OSM_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution: '© openstreetmap contributors',
      },
      'tiles-dark': {
        type: 'raster',
        tiles: ESRI_DARK_TILES,
        tileSize: 256,
        maxzoom: 16,
        attribution: '© esri',
      },
    },
    layers: [
      { id: 'paper', type: 'background', paint: { 'background-color': paperFor(night) } },
      { id: 'raster-light', type: 'raster', source: 'tiles-light', paint: { 'raster-fade-duration': 150 } },
      {
        id: 'raster-dark',
        type: 'raster',
        source: 'tiles-dark',
        layout: { visibility: night ? 'visible' : 'none' },
        paint: { 'raster-fade-duration': 150 },
      },
    ],
  };
}

/** A feature property bag — what the map stores per dot and what the test
 * hook and cards read back. Mirrors the original properties shape (id, name,
 * note, cat) with the store's richer fields added. */
export interface BayFeatureProps {
  id: string;
  name: string;
  note: string;
  cat: string;
  venue: string;
  url: string;
  sourceUrl: string;
  startsAt: string;
  source: string;
  /** stamped by stampFits — the persona/ask emphasis, never rendered as a number */
  pf?: number;
}

export interface BayFeature {
  type: 'Feature';
  id?: number | string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: BayFeatureProps;
}

export interface BayFeatureCollection {
  type: 'FeatureCollection';
  features: BayFeature[];
}

const hasCoords = (r: BayRecord): boolean =>
  typeof r.lat === 'number' && Number.isFinite(r.lat) && typeof r.lng === 'number' && Number.isFinite(r.lng);

function featureOf(record: BayRecord): BayFeature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [record.lng ?? 0, record.lat ?? 0] },
    properties: {
      id: record.id,
      name: record.title,
      note: record.note ?? record.venue ?? '',
      cat: record.category,
      venue: record.venue ?? '',
      url: record.url ?? '',
      sourceUrl: record.sourceUrl ?? '',
      startsAt: record.startsAt ?? '',
      source: record.source,
    },
  };
}

export function placesToGeoJSON(records: BayRecord[]): BayFeatureCollection {
  return { type: 'FeatureCollection', features: records.filter(hasCoords).map(featureOf) };
}

export function eventsToGeoJSON(records: BayRecord[]): BayFeatureCollection {
  // events without coordinates don't render but still count (ported rule) —
  // the caller reports total separately; here only the geo ones become dots.
  return { type: 'FeatureCollection', features: records.filter(hasCoords).map(featureOf) };
}

// emphasis follows the fit. no emphasis: the launch defaults, byte for byte.
export const fitRadius = (lo: number, mid: number, hi: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'pf'], 0],
  0,
  lo,
  0.5,
  mid,
  1,
  hi,
];
export const fitOpacity = (): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'pf'], 0],
  0,
  0.35,
  0.5,
  0.85,
  1,
  1,
];

/** Stamp every feature with a fit from the map (persona view or ask emphasis).
 * The view reaches the map only through this property — data-driven
 * radius/opacity repaint it; nothing is hidden or moved (ported rule). */
export function stampFits(
  geojson: { type: 'FeatureCollection'; features: BayFeature[] },
  fits: Map<string, number> | null,
): void {
  for (const f of geojson.features) {
    const fit = fits?.get(f.properties.id);
    if (fit != null) f.properties.pf = fit;
    else delete f.properties.pf;
  }
}

/** Client-side persona fits for places (events carry ranked fits from the
 * server view). personaFit reads category-or-cat plus the record's own words. */
export function personaFitsFor(records: BayRecord[], persona: Persona | null): Map<string, number> | null {
  if (!persona) return null;
  const fits = new Map<string, number>();
  for (const r of records) {
    fits.set(r.id, personaFit(persona, r));
  }
  return fits;
}
