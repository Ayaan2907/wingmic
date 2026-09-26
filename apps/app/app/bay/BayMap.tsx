'use client';

// apps/app/app/bay/BayMap.tsx — the map renderer, ported from ayaan-site
// assets/bay/map.js. Every honest behavior carried over: keyless tiles (osm
// day / esri dark night), per-category layers with visibility owned by the
// parent's toggles, persona/ask emphasis via data-driven radius+opacity
// (nothing hidden, nothing moved), 12px hit slop with events winning ties,
// nearest-dot wins, easeTo skipped under prefers-reduced-motion, honest HUD
// on tile/library failure, and the window.__bay test hook.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, LngLatLike, Map as MLMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { BayRecord } from '@wingmic/bay/core';
import {
  ALL_LAYERS,
  eventsToGeoJSON,
  fitOpacity,
  fitRadius,
  inkFor,
  paperFor,
  placesToGeoJSON,
  stampFits,
  styleFor,
  type BayFeatureCollection,
  type BayFeatureProps,
} from './mapStyle';

const EMPTY: BayFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};
const CENTER_SFO: [number, number] = [-122.4194, 37.7749];

/** What a picked dot hands to the card layer: the feature's properties and
 * where it is, so the card can offer "ask about this place" deep links. */
export interface BayPick {
  kind: 'event' | 'place';
  props: BayFeatureProps;
  lng: number;
  lat: number;
}

export interface BayTestHook {
  map: MLMap | null;
  addEvents: (records: BayRecord[]) => void;
  applyFits: (fits: Map<string, number> | null) => void;
  setNight: (night: boolean) => void;
  hudNote: (message: string | null) => void;
  pick: (id: string) => void;
  onEventClick: ((pick: BayPick) => void) | null;
}

declare global {
  interface Window {
    __bay?: BayTestHook;
  }
}

interface BayMapProps {
  night: boolean;
  places: BayRecord[];
  events: BayRecord[];
  /** per-record fit stamps (persona view or ask emphasis) — 0..1; null clears */
  fits: Map<string, number> | null;
  hiddenLayers: ReadonlySet<string>;
  collapsed: boolean;
  onPick: (pick: BayPick) => void;
  onNextEvent: () => void;
  onHud: (message: string | null) => void;
  onTilesFailed: () => void;
}

type PickedFeature = {
  properties: BayFeatureProps;
  layer: { id: string };
  geometry: { coordinates: [number, number] };
};

export default function BayMap({
  night,
  places,
  events,
  fits,
  hiddenLayers,
  collapsed,
  onPick,
  onNextEvent,
  onHud,
  onTilesFailed,
}: BayMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  // latest-value refs so map event handlers read current props without
  // re-binding (the original closures read module-level state)
  const stateRef = useRef({ onPick, onNextEvent, onHud, onTilesFailed });
  stateRef.current = { onPick, onNextEvent, onHud, onTilesFailed };
  const nightRef = useRef(night);
  nightRef.current = night;
  const fitsRef = useRef(fits);
  fitsRef.current = fits;

  const placesGeo = useMemo(() => placesToGeoJSON(places), [places]);
  const eventsGeo = useMemo(() => eventsToGeoJSON(events), [events]);
  const geoRef = useRef({ placesGeo, eventsGeo });
  geoRef.current = { placesGeo, eventsGeo };

  // ---- mount: dynamic import keeps maplibre out of the app shell bundle ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        // v6 spawns its worker from a sibling file of the bundle's own URL —
        // no bundler serves that (webpack inlines the main bundle), so point
        // it at the copy in public/ that predev/prebuild vendor from the
        // installed package
        maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
        if (cancelled || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: styleFor(nightRef.current),
          center: CENTER_SFO as LngLatLike,
          zoom: 11.4,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.on('error', (e: unknown) => {
          const msg = (e as { error?: Error })?.error?.message ?? '';
          if (/tile|raster|failed to fetch|network/i.test(msg)) {
            stateRef.current.onTilesFailed(); // honest hud: the dots still work
          } else if (msg) {
            stateRef.current.onHud(`map error: ${msg.slice(0, 80)}`);
          }
        });
        map.on('load', () => {
          if (cancelled) return;
          addSourcesAndLayers(map);
          setReady(true);
        });
        map.on('click', (e: MapMouseEvent) => handlePick(map, e));
        wireTestHook(map);
      } catch {
        // the cdn-failure path of the original: an honest message, not a dead page
        stateRef.current.onHud('the map library did not load — the list still works');
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      delete window.__bay;
    };
    // mount only — night/data/visibility ride their own effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- night toggle: mutate paint/visibility in place (ported rule) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty('paper', 'background-color', paperFor(night));
    map.setLayoutProperty('raster-light', 'visibility', night ? 'none' : 'visible');
    map.setLayoutProperty('raster-dark', 'visibility', night ? 'visible' : 'none');
    for (const layer of ALL_LAYERS) {
      map.setPaintProperty(`dot-${layer.id}`, 'circle-stroke-color', paperFor(night));
      map.setPaintProperty(`label-${layer.id}`, 'text-color', inkFor(night));
      map.setPaintProperty(`label-${layer.id}`, 'text-halo-color', paperFor(night));
    }
  }, [night, ready]);

  // ---- data: re-set on places/events change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource('places') as GeoJSONSource | undefined)?.setData(
      geoRef.current.placesGeo as never,
    );
    (map.getSource('events') as GeoJSONSource | undefined)?.setData(
      geoRef.current.eventsGeo as never,
    );
  }, [places, events, ready]);

  // ---- emphasis: stamp fits, switch paint to data-driven radius/opacity ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyFits(map, fitsRef.current, geoRef.current.placesGeo, geoRef.current.eventsGeo);
  }, [fits, ready]);

  // ---- layer visibility: toggles own it, always ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const layer of ALL_LAYERS) {
      map.setLayoutProperty(
        `dot-${layer.id}`,
        'visibility',
        hiddenLayers.has(layer.id) ? 'none' : 'visible',
      );
      map.setLayoutProperty(
        `label-${layer.id}`,
        'visibility',
        hiddenLayers.has(layer.id) ? 'none' : 'visible',
      );
    }
  }, [hiddenLayers, ready]);

  // keyboard: n cycles events (ported); escape belongs to the card layer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea/i.test(target.tagName)) return;
      stateRef.current.onNextEvent();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className={collapsed ? 'bay-map bay-map--collapsed' : 'bay-map'}
      role="application"
      aria-label="map of the bay area"
    />
  );

  // ---- helpers: defined below the component body, closing over refs only ----

  function addSourcesAndLayers(map: MLMap): void {
    map.addSource('places', { type: 'geojson', data: geoRef.current.placesGeo as never });
    map.addSource('events', { type: 'geojson', data: geoRef.current.eventsGeo as never });
    for (const layer of ALL_LAYERS) {
      const src = layer.id === 'events' ? 'events' : 'places';
      const cat = layer.id === 'events' ? 'events' : layer.id;
      map.addLayer({
        id: `dot-${layer.id}`,
        type: 'circle',
        source: src,
        filter: ['==', ['get', 'cat'], cat],
        paint: {
          // launch defaults; a view or the ask replaces these with the fit
          // expressions (radius/opacity only — never move or hide)
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            layer.id === 'events' ? 5 : 4,
            14,
            layer.id === 'events' ? 9 : 7,
          ],
          'circle-color': layer.color,
          'circle-stroke-width': 2,
          'circle-stroke-color': paperFor(nightRef.current),
        },
      });
      map.addLayer({
        id: `label-${layer.id}`,
        type: 'symbol',
        source: src,
        filter: ['==', ['get', 'cat'], cat],
        minzoom: layer.id === 'events' ? 11 : 10,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          visibility: hiddenLayers.has(layer.id) ? 'none' : 'visible',
        },
        paint: {
          'text-color': inkFor(nightRef.current),
          'text-halo-color': paperFor(nightRef.current),
          'text-halo-width': 1.2,
        },
      });
    }
  }

  function handlePick(map: MLMap, e: MapMouseEvent): void {
    const px = e.point;
    const slop = 12; // the original's hit slop
    const bbox: [[number, number], [number, number]] = [
      [px.x - slop, px.y - slop],
      [px.x + slop, px.y + slop],
    ];
    const liveLayers = ALL_LAYERS.filter((l) => !hiddenLayers.has(l.id)).map(
      (l) => `dot-${l.id}`,
    );
    const feats = map.queryRenderedFeatures(bbox, {
      layers: liveLayers,
    }) as unknown as PickedFeature[];
    if (!feats.length) return;
    const winner = pickNearest(feats, map, px.x, px.y);
    // easeTo unless the visitor asked for reduced motion (ported rule)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.easeTo({
        center: winner.geometry.coordinates,
        zoom: Math.max(map.getZoom(), 12.5),
        duration: 350,
      });
    }
    stateRef.current.onPick({
      kind: winner.layer.id === 'dot-events' ? 'event' : 'place',
      props: winner.properties,
      lng: winner.geometry.coordinates[0],
      lat: winner.geometry.coordinates[1],
    });
  }

  function wireTestHook(map: MLMap): void {
    window.__bay = {
      map,
      addEvents: (records) => {
        geoRef.current = { ...geoRef.current, eventsGeo: eventsToGeoJSON(records) };
        (map.getSource('events') as GeoJSONSource | undefined)?.setData(
          geoRef.current.eventsGeo as never,
        );
      },
      applyFits: (fitMap) =>
        applyFits(map, fitMap, geoRef.current.placesGeo, geoRef.current.eventsGeo),
      setNight: (n) => {
        nightRef.current = n;
        map.setPaintProperty('paper', 'background-color', paperFor(n));
        map.setLayoutProperty('raster-light', 'visibility', n ? 'none' : 'visible');
        map.setLayoutProperty('raster-dark', 'visibility', n ? 'visible' : 'none');
      },
      hudNote: (message) => stateRef.current.onHud(message),
      pick: (id) => {
        const all = [
          ...geoRef.current.placesGeo.features,
          ...geoRef.current.eventsGeo.features,
        ];
        const f = all.find((x) => x.properties.id === id);
        if (!f) return;
        const [lng, lat] = f.geometry.coordinates;
        stateRef.current.onPick({
          kind: f.properties.cat === 'events' ? 'event' : 'place',
          props: f.properties,
          lng,
          lat,
        });
      },
      onEventClick: null,
    };
  }
}

/** nearest dot wins; events win ties (ported rule). a tie is anything within
 * 0.5px of the best distance. */
export function pickNearest(
  feats: PickedFeature[],
  map: MLMap,
  x: number,
  y: number,
): PickedFeature {
  let best = feats[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of feats) {
    const pt = map.project(f.geometry.coordinates);
    const d = Math.hypot(pt.x - x, pt.y - y);
    const bestIsEvent = best.layer.id === 'dot-events';
    const isEvent = f.layer.id === 'dot-events';
    if (d < bestDist - 0.5) {
      best = f;
      bestDist = d;
    } else if (isEvent && !bestIsEvent && d <= bestDist + 0.5) {
      best = f;
      bestDist = Math.min(d, bestDist);
    }
  }
  return best;
}

function applyFits(
  map: MLMap,
  fitMap: Map<string, number> | null,
  placesGeo: BayFeatureCollection,
  eventsGeo: BayFeatureCollection,
): void {
  stampFits(placesGeo as never, fitMap);
  stampFits(eventsGeo as never, fitMap);
  (map.getSource('places') as GeoJSONSource | undefined)?.setData(placesGeo as never);
  (map.getSource('events') as GeoJSONSource | undefined)?.setData(eventsGeo as never);
  for (const layer of ALL_LAYERS) {
    if (fitMap) {
      map.setPaintProperty(`dot-${layer.id}`, 'circle-radius', fitRadius(5, 12, 18));
      map.setPaintProperty(`dot-${layer.id}`, 'circle-opacity', fitOpacity());
    } else {
      // back to the launch defaults, byte for byte
      map.setPaintProperty(`dot-${layer.id}`, 'circle-radius', [
        'interpolate',
        ['linear'],
        ['zoom'],
        9,
        layer.id === 'events' ? 5 : 4,
        14,
        layer.id === 'events' ? 9 : 7,
      ]);
      map.setPaintProperty(`dot-${layer.id}`, 'circle-opacity', 1);
    }
  }
}
