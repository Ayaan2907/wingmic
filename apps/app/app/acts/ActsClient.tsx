'use client';

/**
 * ActsClient — /acts inbox (visual mock, PR ζ-acts).
 *
 * The acts agent ships v0.3 (epic #11). Until then /acts is a pure preview:
 * a "coming soon · v0.3" banner + seeded draft cards rendered through the
 * shared ActCard (same markup as Home's 3-card preview). Every send CTA is
 * disabled — no backend, no tRPC, no draft generation here.
 *
 * Bottom-nav / desktop rail is owned by the shared AppShell (PR λ-shell);
 * this screen renders no nav of its own.
 */

import * as React from 'react';
import { ActCard, type PendingAct } from '@/app/_components/ActCard';

// Accent palette mirror (matches HomeClient / capture / entity tokens).
const accent = '#FFC452';
const blue = '#7DD3FC';
const violet = '#A78BFA';

// Seeded preview drafts. Fictional demo contacts, consistent with the home
// seeds (Sarah Chen / Marcus Rivera / Priya → Deepak) plus a couple more,
// spanning check-in / reminder / intro kinds. Real acts wire in v0.3 (#11).
const DRAFT_ACTS: PendingAct[] = [
  {
    kind: 'check-in',
    glyph: '↗',
    name: 'Sarah Chen',
    why: '7d since devconnect · you owe her a repo',
    conf: 92,
    accent: 'amber',
    color: accent,
  },
  {
    kind: 'reminder',
    glyph: '◷',
    name: 'Marcus Rivera',
    why: 'coffee mon · no invite sent',
    conf: 88,
    accent: 'blue',
    color: blue,
  },
  {
    kind: 'intro',
    glyph: '⇌',
    name: 'Priya → Deepak',
    why: 'both work on voice + mcp',
    conf: 74,
    accent: 'violet',
    color: violet,
  },
  {
    kind: 'check-in',
    glyph: '↗',
    name: 'Lena Okafor',
    why: '3w quiet · she shipped the rust crate',
    conf: 81,
    accent: 'amber',
    color: accent,
  },
  {
    kind: 'reminder',
    glyph: '◷',
    name: 'Tomas Vega',
    why: 'promised feedback on his demo · overdue',
    conf: 69,
    accent: 'blue',
    color: blue,
  },
];

export function ActsClient() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
      data-screen="acts"
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 30,
          gap: 12,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
        >
          acts
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1,
            color: 'var(--text-40)',
            textTransform: 'uppercase',
          }}
        >
          preview
        </span>
      </header>

      <section
        style={{
          padding: '20px 20px 0',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-testid="acts-banner"
          className="mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-85)',
            background: `linear-gradient(90deg, ${accent}1a, transparent)`,
            border: `1px solid ${accent}4d`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: accent,
              flexShrink: 0,
            }}
          />
          <span>
            <span style={{ color: accent, fontWeight: 700 }}>acts</span> arrives v0.3 — these are
            previews of what wingmic will draft from your graph. nothing sends yet.
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="acts-list">
          {DRAFT_ACTS.map((a) => (
            <ActCard key={a.name} act={a} />
          ))}
        </div>
      </section>
    </main>
  );
}
