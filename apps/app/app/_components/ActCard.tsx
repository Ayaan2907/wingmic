'use client';

/**
 * ActCard — shared agent-draft card (PR ζ-acts).
 *
 * Extracted verbatim from HomeClient's `ActsPending` map body so Home and the
 * new /acts inbox render the exact same card with zero visual drift. The acts
 * agent ships v0.3 (epic #11); until then every send CTA is disabled
 * "coming soon · v0.3" chrome — matching the entity-detail disabled pattern.
 *
 * `PendingAct` is the single source of truth for the card's shape; HomeClient
 * and ActsClient both import it from here.
 */

import * as React from 'react';
import { PersonAvatar } from './entity/EntityAvatar';

// Mirror the accent palette used elsewhere in apps/app (capture, entity, home).
const accent = '#FFC452';

export type PendingAct = {
  kind: string;
  glyph: string;
  name: string;
  why: string;
  conf: number;
  accent: 'amber' | 'blue' | 'violet';
  color: string;
};

export function ActCard({ act: a }: { act: PendingAct }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        <PersonAvatar name={a.name} accent={a.accent} size={36} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 2 }}>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: a.color,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {a.glyph} {a.kind}
          </span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-40)' }}>
            · {a.conf}%
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.name}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.3,
            color: 'var(--text-55)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.why}
        </div>
      </div>
      <button
        type="button"
        disabled
        title="coming soon · v0.3"
        aria-label={`send ${a.kind} for ${a.name} — coming soon, v0.3`}
        style={{
          padding: '7px 11px',
          borderRadius: 8,
          background: accent,
          color: '#000',
          border: '1.5px solid #000',
          boxShadow: '2px 2px 0 #000',
          font: '700 11px Inter, system-ui, sans-serif',
          cursor: 'not-allowed',
          opacity: 0.85,
          flexShrink: 0,
        }}
      >
        send →
      </button>
    </div>
  );
}
