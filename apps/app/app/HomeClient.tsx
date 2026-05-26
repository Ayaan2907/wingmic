'use client';

/**
 * HomeClient — v2 home / dashboard screen (PR α v9).
 *
 * Source of truth: design/v2/library/lib-screens.jsx ScreenHome.
 * Plan: docs/superpowers/plans/*.md §18 v9.
 *
 * Renders three sections:
 *   1. Stats row — today + this week capture counts as italic-serif numerals.
 *   2. Recent activity — last 5 interactions with time + transcript preview
 *      + entity-count badge (PersonAvatar where a person dominates the memo).
 *   3. Acts inbox — empty state ("the acts agent arrives v0.3 — coming soon.")
 *      because the acts table doesn't exist yet (v0.3 epic #11).
 *
 * Bottom-nav is the shared BottomTabBar with `active="home"`.
 * Pure presentation: all data comes from the server page via `initialData`.
 */

import * as React from 'react';
import { BottomTabBar } from './_components/BottomTabBar';
import { PersonAvatar } from './_components/entity/EntityAvatar';

// ── Tokens ──────────────────────────────────────────────────────────────
// Mirror the accent palette used elsewhere in apps/app (capture, entity).
const accent = '#FFC452';
const second = '#86efac';
const third = '#FF8FAB';

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

function previewOf(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57) + '…';
}

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
        paddingBottom: 110,
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
        <ActivityList items={recent} />
        <ActsEmpty />
      </section>

      <BottomTabBar active="home" />
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
      <a
        href="/"
        className="mono"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
      >
        wingmic<span style={{ color: 'var(--text-30)' }}>.xyz</span>
      </a>
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
          no commits yet. hold the mic to make your first one.
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
              <PersonAvatar name={item.transcriptPreview || 'memo'} seed={item.id} size={32} />
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

// ─── Acts empty ──────────────────────────────────────────────────────────

function ActsEmpty() {
  return (
    <div style={{ marginBottom: 24 }} data-testid="home-acts-empty">
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
        ◆ acts · pending
      </div>
      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: 'var(--surface-1, rgba(255,255,255,0.02))',
          border: '1px dashed var(--border-mid, rgba(255,255,255,0.12))',
          color: 'var(--text-55)',
          fontSize: 14,
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        the acts agent arrives v0.3 — coming soon.
      </div>
    </div>
  );
}
