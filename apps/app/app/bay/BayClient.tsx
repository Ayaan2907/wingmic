'use client';

// apps/app/app/bay/BayClient.tsx — the composition: data, persona state, ask,
// score cards, and the map. The map itself is dynamically imported (ssr:
// false) so MapLibre never enters the app-shell bundle (maplibre-gl touches
// window at import). Ported roles: map.js's boot + HUD + wiring, score.js's
// profile flow, and the page shell from bay.html — re-expressed in React.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useSession } from '@/lib/auth-client';
import { PERSONAS, rank, type BayRecord, type Persona } from '@wingmic/bay/core';
import { ALL_LAYERS, LAYER_IDS, eventsToGeoJSON, placesToGeoJSON } from './mapStyle';
import { Hud, IntroDialog, LayerToggles, ViewsPanel, useFirstRun, useStoredView } from './Panels';
import { AskBar, useAsk } from './AskBar';
import { ScorePanel } from './Cards';
import { COPY } from './copy';
import {
  clearClientProfile,
  loadClientProfile,
  saveClientProfile,
  type ClientProfile,
} from './clientProfile';
import type { BayPick } from './BayMap';
import './bay.css';

// MapLibre is browser-only — keep it out of the server bundle and the
// app-shell chunk graph entirely.
const BayMap = dynamic(() => import('./BayMap'), {
  ssr: false,
  loading: () => <div className="bay-map-loading">{COPY.hudLoading}</div>,
});

const PERSONA_LIST: Persona[] = Object.values(PERSONAS);

/** Browser-held profile (locked decision 3): localStorage state with an
 * explicit ready gate so the first render is honest about storage. */
function useClientProfile() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProfile(loadClientProfile());
    setReady(true);
  }, []);
  const save = (p: ClientProfile) => {
    saveClientProfile(p);
    setProfile(p);
  };
  const clear = () => {
    clearClientProfile();
    setProfile(null);
  };
  return { profile, ready, save, clear };
}

/** Night mode rides localStorage like the ported theme-before-paint script. */
function useNight(): [boolean, () => void] {
  const [night, setNight] = useState(false);
  useEffect(() => {
    try {
      setNight(window.localStorage.getItem('bay.night') === '1');
    } catch {
      setNight(false);
    }
  }, []);
  const toggle = () => {
    setNight((n) => {
      const next = !n;
      try {
        window.localStorage.setItem('bay.night', next ? '1' : '0');
      } catch {
        // storage blocked — the toggle works, it just won't persist
      }
      return next;
    });
  };
  return [night, toggle];
}

export default function BayClient() {
  const { data: sessionData } = useSession();
  const signedIn = Boolean(sessionData?.user);

  const [night, toggleNight] = useNight();
  const [view, selectView] = useStoredView(PERSONA_LIST);
  const [showIntro, dismissIntro] = useFirstRun();
  const { profile: clientProfile, ready: profileReady, save: saveProfile, clear: clearProfile } =
    useClientProfile();

  const placesQ = trpc.bay.places.useQuery();
  const eventsQ = trpc.bay.events.useQuery(view ? { persona: view.id } : undefined);

  const [pick, setPick] = useState<BayPick | null>(null);
  const [askEmphasis, setAskEmphasis] = useState<Map<string, number> | null>(null);
  const [scoreEmphasis, setScoreEmphasis] = useState<Map<string, number> | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<ReadonlySet<string>>(new Set());
  const [mapHud, setMapHud] = useState<string | null>(null);

  const ask = useAsk(clientProfile, view?.id ?? null);

  // a fresh ask repaints the map; picking a new view clears the old answer's
  // emphasis (it ranked for a different question); hiding the answer takes
  // its emphasis with it
  useEffect(() => {
    if (!ask.result) {
      setAskEmphasis(null);
      return;
    }
    setAskEmphasis(new Map(ask.result.emphasis.map((e) => [e.id, e.fit])));
    setScoreEmphasis(null);
  }, [ask.result]);

  const selectViewAndClear = (id: string | null) => {
    setAskEmphasis(null);
    setScoreEmphasis(null);
    selectView(id);
  };

  const places: BayRecord[] = placesQ.data?.records ?? [];
  const events: BayRecord[] = eventsQ.data?.records ?? [];

  /** Persona fits: places re-ranked client-side with the shared weights module,
   * events from the server's ranked block — one weights file, both sides. */
  const personaFits = useMemo(() => {
    if (!view) return null;
    const fits = new Map<string, number>();
    for (const entry of rank(view, places)) fits.set(entry.id, entry.fit);
    if (eventsQ.data?.persona) {
      for (const entry of eventsQ.data.persona.ranked) fits.set(entry.id, entry.fit);
    }
    return fits;
  }, [view, places, eventsQ.data]);

  // precedence: an explicit ask owns the canvas; otherwise the persona view;
  // a lone score card emphasizes only its own event under either.
  const fits = useMemo(() => {
    if (askEmphasis) return askEmphasis;
    if (personaFits) return scoreEmphasis ? new Map([...personaFits, ...scoreEmphasis]) : personaFits;
    return scoreEmphasis;
  }, [askEmphasis, personaFits, scoreEmphasis]);

  const layerCounts = useMemo(() => {
    const counts = new Map<string, number>(LAYER_IDS.map((id) => [id, 0]));
    for (const p of places) {
      if (counts.has(p.category)) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    counts.set('events', events.length);
    return ALL_LAYERS.map((layer) => ({ id: layer.id, count: counts.get(layer.id) ?? 0 }));
  }, [places, events]);

  const liveOnMap = events.filter((e) => e.lat != null && e.lng != null).length;

  const hud = useMemo(() => {
    if (mapHud) return mapHud;
    if (placesQ.error) return COPY.hudPlacesFailed;
    if (eventsQ.error) return eventsQ.error.message || COPY.hudEventsFailed;
    if (placesQ.isPending || eventsQ.isPending) return COPY.hudLoading;
    return `${places.length} ${COPY.hudPlaces} · ${liveOnMap} ${COPY.hudOfEvents} ${events.length} ${COPY.hudEvents}`;
  }, [mapHud, placesQ.error, eventsQ.error, placesQ.isPending, eventsQ.isPending, places.length, liveOnMap, events.length]);

  const toggleLayer = (id: string) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // window.__bay — the data-level half of the test hook; BayMap mounts the
  // map-level half (map ref, pick handlers) on the same object.
  useEffect(() => {
    const w = window as unknown as { __bay?: Record<string, unknown> };
    w.__bay = {
      ...(w.__bay ?? {}),
      placeCount: places.length,
      eventCount: events.length,
      liveOnMap,
      personaId: view?.id ?? null,
      signedIn,
      profileSaved: clientProfile != null,
      emphasis: fits ? Object.fromEntries(fits) : null,
      // pick(id) opens the same card a dot click opens — built through the
      // same geo converters, so the card reads identical properties. an
      // unknown or expired id does nothing, honestly.
      pick: (id: string) => {
        const place = places.find((r) => r.id === id);
        const record = place ?? events.find((r) => r.id === id);
        if (!record) return;
        const feature = place
          ? placesToGeoJSON([place]).features[0]
          : eventsToGeoJSON([record]).features[0];
        setPick({
          kind: place ? 'place' : 'event',
          props: feature.properties,
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1],
        });
      },
    };
  }, [places, events, liveOnMap, view?.id, signedIn, clientProfile, fits]);

  return (
    <main className={`bay-page${night ? ' is-night' : ''}`} data-testid="bay-page">
      <BayMap
        night={night}
        places={places}
        events={events}
        fits={fits}
        hiddenLayers={hiddenLayers}
        collapsed={false}
        onPick={setPick}
        onNextEvent={() => setPick(null)}
        onHud={setMapHud}
        onTilesFailed={() => setMapHud(COPY.hudTilesFailed)}
      />

      <header className="bay-top">
        <Link href="/" className="bay-home" data-testid="bay-home-link">
          ← wingmic
        </Link>
        <h1 className="bay-title">the bay</h1>
        <button
          type="button"
          className="bay-night-toggle"
          onClick={toggleNight}
          aria-pressed={night}
          data-testid="bay-night-toggle"
        >
          {night ? COPY.day : COPY.night}
        </button>
      </header>

      <div className="bay-side">
        <LayerToggles counts={layerCounts} hidden={hiddenLayers} onToggle={toggleLayer} />
        <ViewsPanel personas={PERSONA_LIST} activeId={view?.id ?? null} onSelect={selectViewAndClear} />
      </div>

      <div className="bay-ask-dock">
        <AskBar ask={ask} onAsk={(q) => void ask.run(q)} signedIn={signedIn} />
      </div>

      <Hud message={hud} />

      <ScorePanel
        pick={pick}
        clientProfile={clientProfile}
        personaId={view?.id ?? null}
        signedIn={signedIn}
        viewerEmail={sessionData?.user?.email ?? null}
        onEmphasis={setScoreEmphasis}
        onClosed={() => setPick(null)}
        onCleared={clearProfile}
        onProfileSaved={saveProfile}
      />

      {showIntro && <IntroDialog onDismiss={dismissIntro} />}
    </main>
  );
}
