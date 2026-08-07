'use client';

/**
 * HomeClient — v2 home / dashboard screen (PR α v9).
 *
 * Source of truth: design/v2/library/lib-screens.jsx ScreenHome.
 * Plan: docs/superpowers/plans/*.md §18 v9.
 *
 * Renders, top to bottom (order matches design/v2 proto-screens-a.jsx ScreenHome):
 *   1. Stats row — today + this week capture counts as italic-serif numerals.
 *   2. Agent stripe — mocked "wingmic read your graph" preview signal (PR ε).
 *   3. Acts pending — 3 mocked draft cards with disabled "coming soon · v0.3"
 *      send buttons (the acts agent ships v0.3, epic #11).
 *   4. Recent activity — last 5 interactions with time + transcript preview
 *      + entity-count badge (PersonAvatar where a person dominates the memo).
 *
 * Bottom-nav / desktop rail is owned by the shared AppShell (PR λ-shell),
 * mounted once in the root layout — this screen no longer renders it.
 * Real data: stats + activity come from the server page via `initialData`.
 * Mock data: the agent stripe + acts cards are seeded previews (PR ε) — they
 * swap for real `ctx.db` queries in the v0.1.3 backend-wireup phase.
 */

import * as React from 'react';
import Link from 'next/link';
import { PersonAvatar } from './_components/entity/EntityAvatar';
import { ActCard, type PendingAct } from './_components/ActCard';

// ── Tokens ──────────────────────────────────────────────────────────────
// Mirror the accent palette used elsewhere in apps/app (capture, entity).
const accent = '#FFC452';
const second = '#86efac';
const third = '#FF8FAB';
const blue = '#7DD3FC';
const violet = '#A78BFA';

// ── Types ───────────────────────────────────────────────────────────────

export interface HomeRecentItem {
  id: string;
  capturedAt: string; // ISO so it serializes through the server boundary cleanly.
  transcriptPreview: string;
  entityCount: number;
}

export interface HomeInitialData {
  todayCount: number;
  weekCount: number;
  pendingActs: number; // always 0 in v0.1.2 PR α (acts arrives v0.3).
  recent: HomeRecentItem[];
}

export interface HomeClientProps {
  userName: string | null;
  initialData: HomeInitialData;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function HomeClient({ userName, initialData }: HomeClientProps) {
  const { todayCount, weekCount, recent } = initialData;
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
      data-screen="home"
    >
      <Header userName={userName} />

      <section
        style={{
          padding: '20px 20px 0',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <StatsRow today={todayCount} week={weekCount} />
        <AgentStripe />
        <ActsPending />
        <ActivityList items={recent} />
      </section>
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function Header({ userName }: { userName: string | null }) {
  return (
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
      <Link
        href="/"
        className="mono"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
      >
        wingmic<span style={{ color: 'var(--text-30)' }}>.xyz</span>
      </Link>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: 'var(--text-40)',
          textTransform: 'uppercase',
        }}
      >
        home · {userName ?? 'you'}
      </span>
      <Link
        href="/settings"
        aria-label="settings"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-soft)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-55)',
          textDecoration: 'none',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        ⚙
      </Link>
    </header>
  );
}

// ─── Stats row ───────────────────────────────────────────────────────────

function StatsRow({ today, week }: { today: number; week: number }) {
  // v2 AtomsStats: big italic-serif numerals, mono label tracked uppercase.
  // Two-up grid: today + this week. Each cell is a small "brutal" card
  // (subtle surface + soft border) so the screen has texture even with low data.
  const cells: Array<{ v: number; l: string; c: string }> = [
    { v: today, l: 'today', c: accent },
    { v: week, l: 'this week', c: second },
  ];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 24,
      }}
      data-testid="home-stats"
    >
      {cells.map((s) => (
        <div
          key={s.l}
          style={{
            padding: '18px 16px 14px',
            borderRadius: 14,
            background: 'var(--surface-1, rgba(255,255,255,0.02))',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 56,
              lineHeight: 0.85,
              color: s.c,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.v}
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              color: 'var(--text-40)',
              textTransform: 'uppercase',
            }}
          >
            {s.l}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Activity list ───────────────────────────────────────────────────────

function ActivityList({ items }: { items: HomeRecentItem[] }) {
  return (
    <div style={{ marginBottom: 24 }} data-testid="home-activity">
      <div
        className="mono"
        style={{
          fontSize: 11,
          color: 'var(--text-55)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        ◆ recent commits
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'var(--surface-1, rgba(255,255,255,0.02))',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            color: 'var(--text-55)',
            fontSize: 13.5,
            lineHeight: 1.55,
          }}
          data-testid="home-activity-empty"
        >
          no commits yet. tap the mic to make your first one.
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            background: 'var(--surface-1, rgba(255,255,255,0.02))',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            borderRadius: 14,
          }}
        >
          {items.map((item, i) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderBottom:
                  i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              {/* Decorative: seeded from interaction id, not a real person — hide from SR
                  so the transcript preview is announced cleanly. */}
              <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                <PersonAvatar name={item.transcriptPreview || 'memo'} seed={item.id} size={32} />
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13.5,
                  lineHeight: 1.45,
                  color: 'var(--text-85)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.transcriptPreview || '— (no transcript)'}
              </span>
              <span
                className="mono"
                aria-label={`${item.entityCount} entities`}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: `${third}1f`,
                  color: third,
                  border: `1px solid ${third}40`,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {item.entityCount}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-30)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {timeOf(item.capturedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Agent stripe ────────────────────────────────────────────────────────

function AgentStripe() {
  // Mocked agent-activity stripe (PR ε, per design/v2 proto-screens-a.jsx
  // ScreenHome). Deliberately non-interactive: the acts surface (/acts) ships
  // as its own mock PR, so this is a static preview signal, not a link —
  // avoids dead navigation while the destination doesn't exist yet.
  return (
    <div
      data-testid="home-agent-stripe"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        marginBottom: 20,
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
          animation: 'wm-pulse-d 1.6s infinite',
          flexShrink: 0,
        }}
      />
      <div className="mono" style={{ flex: 1, fontSize: 12, color: 'var(--text-85)' }}>
        <span style={{ color: accent, fontWeight: 700 }}>wingmic</span> · read your graph 06:12 ·
        3 drafts pending
      </div>
    </div>
  );
}

// ─── Acts pending (mock) ───────────────────────────────────────────────────

// `PendingAct` + the card markup live in the shared ActCard (PR ζ-acts), so
// Home's 3-card preview and the /acts inbox stay byte-identical.

// Seeded preview data (PR ε). Fictional demo contacts, consistent with the
// design prototype. Real acts wire in v0.3 (epic #11); every CTA here is
// disabled "coming soon · v0.3" chrome — matching the entity-detail pattern.
const PENDING_ACTS: PendingAct[] = [
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
];

function ActsPending() {
  return (
    <div style={{ marginBottom: 24 }} data-testid="home-acts">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-55)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          ◆ acts · pending
        </span>
        <Link
          href="/acts"
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--text-40)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          preview · v0.3 · open →
        </Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PENDING_ACTS.map((a) => (
          <ActCard key={a.name} act={a} />
        ))}
      </div>
    </div>
  );
}
