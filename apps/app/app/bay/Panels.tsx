'use client';

// apps/app/app/bay/Panels.tsx — the map's chrome: layer toggles with counts,
// the persona views block, the first-run intro dialog, and the honest HUD.
// Ported from ayaan-site map.js buildLayers/buildViews/buildIntro plus the
// HUD, re-expressed on the design system (44px hit targets everywhere).

import { useEffect, useRef, useState } from 'react';
import { COPY } from './copy';
import { ALL_LAYERS } from './mapStyle';
import type { Persona } from '@wingmic/bay';

// ---------- HUD ----------

export function Hud({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bay-hud" role="status" data-testid="bay-hud">
      {message}
    </div>
  );
}

// ---------- layer toggles ----------

export interface LayerCount {
  id: string;
  count: number;
}

export function LayerToggles({
  counts,
  hidden,
  onToggle,
}: {
  counts: LayerCount[];
  hidden: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="bay-layers" data-testid="bay-layers">
      {ALL_LAYERS.map((layer) => {
        const count = counts.find((c) => c.id === layer.id)?.count ?? 0;
        const isHidden = hidden.has(layer.id);
        return (
          <button
            key={layer.id}
            type="button"
            className={`bay-layer-toggle${isHidden ? ' is-off' : ''}`}
            style={{ ['--bay-layer-color' as string]: layer.color }}
            onClick={() => onToggle(layer.id)}
            aria-pressed={!isHidden}
            data-testid={`bay-layer-${layer.id}`}
          >
            <span className="bay-layer-dot" aria-hidden="true" />
            <span className="bay-layer-label">{layer.label}</span>
            <span className="bay-layer-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- persona views ----------

/** The persona list, resolved with the stored selection. A stale stored id
 * resolves to none (ported rule). */
export function resolveView(stored: string | null, personas: Persona[]): Persona | null {
  if (!stored) return null;
  return personas.find((p) => p.id === stored) ?? null;
}

export function ViewsPanel({
  personas,
  activeId,
  onSelect,
}: {
  personas: Persona[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!personas.length) return null;
  return (
    <div className="bay-views" data-testid="bay-views" role="radiogroup" aria-label={COPY.viewsTitle}>
      <div className="bay-views-title">{COPY.viewsTitle}</div>
      <div className="bay-views-row">
        <button
          type="button"
          role="radio"
          aria-checked={activeId === null}
          className={`bay-view${activeId === null ? ' is-active' : ''}`}
          onClick={() => onSelect(null)}
          data-testid="bay-view-none"
        >
          {COPY.viewNone}
        </button>
        {personas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={activeId === p.id}
            className={`bay-view${activeId === p.id ? ' is-active' : ''}`}
            onClick={() => onSelect(p.id)}
            data-testid={`bay-view-${p.id}`}
          >
            {p.button}
          </button>
        ))}
      </div>
      {activeId !== null && (
        <p className="bay-views-why">{personas.find((p) => p.id === activeId)?.why}</p>
      )}
    </div>
  );
}

/** useStoredView — localStorage-backed persona selection with stale-id
 * resolution against the live persona list. */
export function useStoredView(
  personas: Persona[],
): [Persona | null, (id: string | null) => void] {
  const [view, setView] = useState<Persona | null>(null);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !personas.length) return;
    loaded.current = true;
    try {
      const stored = window.localStorage.getItem('bay.view');
      setView(resolveView(stored, personas));
    } catch {
      setView(null);
    }
  }, [personas]);
  const select = (id: string | null) => {
    setView(id ? (personas.find((p) => p.id === id) ?? null) : null);
    try {
      if (id) window.localStorage.setItem('bay.view', id);
      else window.localStorage.removeItem('bay.view');
    } catch {
      // storage blocked — the view just won't persist
    }
  };
  return [view, select];
}

// ---------- first-run intro ----------

export function IntroDialog({ onDismiss }: { onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div
      className="bay-intro"
      role="dialog"
      aria-modal="false"
      aria-label={COPY.introTitle}
      ref={ref}
      tabIndex={-1}
      data-testid="bay-intro"
    >
      <div className="bay-intro-card">
        <h2 className="bay-intro-title">{COPY.introTitle}</h2>
        <ul className="bay-intro-lines">
          <li>{COPY.introNotes}</li>
          <li>{COPY.introEvents}</li>
          <li>{COPY.introViews}</li>
        </ul>
        <button
          type="button"
          className="bay-intro-dismiss"
          onClick={onDismiss}
          data-testid="bay-intro-dismiss"
        >
          {COPY.introDismiss}
        </button>
      </div>
    </div>
  );
}

/** useFirstRun — shows the intro until dismissed; persists in localStorage. */
export function useFirstRun(): [boolean, () => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(!window.localStorage.getItem('bay.intro'));
    } catch {
      setShow(true); // storage blocked — err toward showing the intro once
    }
  }, []);
  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem('bay.intro', '1');
    } catch {
      // storage blocked — the intro returns next visit, honestly harmless
    }
  };
  return [show, dismiss];
}
