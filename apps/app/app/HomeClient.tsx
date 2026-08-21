'use client';

/**
 * HomeClient — v2 home / dashboard screen (PR α v9).
 *
 * Source of truth: design/v2/library/lib-screens.jsx ScreenHome.
 *
 * Renders, top to bottom:
 *   1. Stats row — today + this week capture counts as italic-serif numerals.
 *   2. Agent stripe — live pending draft count from acts.list.
 *   3. Acts pending — real drafts from capture extraction (permission-first send).
 *   4. Recent activity — last 5 interactions with time + transcript preview
 *      + entity-count badge.
 *
 * Bottom-nav / desktop rail is owned by the shared AppShell (PR λ-shell).
 */

import * as React from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { PersonAvatar } from './_components/entity/EntityAvatar';
import { ActCard } from './_components/ActCard';

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
  /** Server-side drafted+snoozed count; client refreshes via acts.list. */
  pendingActs: number;
  recent: HomeRecentItem[];
}

export interface HomeClientProps {
  userName: string | null;
  initialData: HomeInitialData;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function firstNameOf(userName: string | null): string {
  const trimmed = userName?.trim();
  if (!trimmed) return 'you';
  return trimmed.split(/\s+/)[0]!;
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
  const { todayCount, weekCount, pendingActs, recent } = initialData;
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
        className="surface-wrap surface-wrap-compact"
        style={{
          paddingTop: 16,
          paddingBottom: 8,
          boxSizing: 'border-box',
        }}
      >
        <h1
          data-testid="home-greeting"
          style={{
            font: '800 clamp(28px, 8.2vw, 38px)/1.05 var(--font-sans)',
            letterSpacing: '-0.03em',
            margin: '0 0 16px',
          }}
        >
          hey,{' '}
          <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
            {firstNameOf(userName)}.
          </span>
        </h1>
        <StatsRow today={todayCount} week={weekCount} />
        <HomeActsPanel fallbackCount={pendingActs} />
        <ActivityList items={recent} />
        <ImportsCue />
      </section>
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function Header({ userName }: { userName: string | null }) {
  return (
    <header
      className="surface-header"
      style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        aria-hidden="true"
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: 'var(--text-40)',
          textTransform: 'uppercase',
          flex: 1,
          textAlign: 'center',
        }}
      >
        home · {userName ?? 'you'}
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link
          href="/search"
          aria-label="search"
          className="mono"
          style={{
            minWidth: 48,
            minHeight: 48,
            padding: '0 12px',
            borderRadius: 8,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
            color: 'var(--text-55)',
            textDecoration: 'none',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          search
        </Link>
        <Link
          href="/settings"
          aria-label="settings"
          className="mono"
          style={{
            minWidth: 48,
            minHeight: 48,
            borderRadius: 8,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-55)',
            textDecoration: 'none',
            fontSize: 10,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          set
        </Link>
      </div>
    </header>
  );
}

// ─── Imports cue ─────────────────────────────────────────────────────────

function ImportsCue() {
  return (
    <Link
      href="/imports"
      data-testid="home-imports-cue"
      style={{
        display: 'block',
        marginBottom: 20,
        padding: '16px',
        borderRadius: 14,
        border: `1.5px dashed ${accent}66`,
        background: `${accent}0d`,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        import contacts →
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-55)', lineHeight: 1.4 }}>
        LinkedIn Connections.csv or a .vcf — cold-start your graph.
      </div>
    </Link>
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
        gap: 10,
        marginBottom: 20,
      }}
      data-testid="home-stats"
    >
      {cells.map((s) => (
        <div
          key={s.l}
          style={{
            padding: '16px 14px 12px',
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
              fontSize: 'clamp(44px, 12vw, 56px)',
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
                borderBottom:
                  i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <Link
                href="/chat"
                data-testid={`home-activity-row-${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  minHeight: 56,
                  padding: '12px 14px',
                  textDecoration: 'none',
                  color: 'inherit',
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
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                }}
              >
                {item.transcriptPreview || '— (no transcript)'}
              </span>
              <span
                className="mono"
                aria-label={`${item.entityCount} entities`}
                style={{
                  marginTop: 2,
                  padding: '3px 8px',
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
                  marginTop: 3,
                  fontSize: 10,
                  color: 'var(--text-30)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {timeOf(item.capturedAt)}
              </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Acts (stripe + pending cards — single list query) ───────────────────

function HomeActsPanel({ fallbackCount }: { fallbackCount: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading, isError, refetch } = trpc.acts.list.useQuery({ limit: 50 });
  const [markErrors, setMarkErrors] = React.useState<Record<string, string>>({});

  const markSent = trpc.acts.markSent.useMutation({
    onSuccess: (_data, vars) => {
      setMarkErrors((prev) => {
        if (!prev[vars.id]) return prev;
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      void utils.acts.list.invalidate();
    },
    onError: (_err, vars) => {
      setMarkErrors((prev) => ({
        ...prev,
        [vars.id]: 'could not mark done — tap send again',
      }));
    },
  });

  const acts = data?.acts ?? [];
  const previewActs = acts.slice(0, 3);
  const atCap = acts.length >= 50;
  const count =
    isLoading || !data ? fallbackCount : atCap ? Math.max(fallbackCount, acts.length) : acts.length;
  const draftLabel =
    count === 0 ? 'no drafts pending' : `${count} draft${count === 1 ? '' : 's'} pending`;

  function handleMarkSent(id: string) {
    markSent.mutate({ id });
  }

  return (
    <>
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
          <span style={{ color: accent, fontWeight: 700 }}>wingmic</span> · read your graph ·{' '}
          {draftLabel}
        </div>
      </div>

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
            inbox · open →
          </Link>
        </div>
        {isLoading ? (
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-40)' }}>
            loading drafts…
          </p>
        ) : isError ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
            }}
          >
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-55)', margin: 0 }}>
              could not load drafts.
            </p>
            <button
              type="button"
              className="mono"
              onClick={() => void refetch()}
              style={{
                marginTop: 8,
                fontSize: 11,
                color: accent,
                minHeight: 40,
                padding: '0 10px',
                borderRadius: 8,
                background: `${accent}12`,
                border: `1px solid ${accent}4d`,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              retry →
            </button>
          </div>
        ) : previewActs.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: 'var(--surface-1, rgba(255,255,255,0.02))',
              border: '1px dashed var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-55)',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
            data-testid="home-acts-empty"
          >
            no drafts yet — capture a memo that mentions a follow-up.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {previewActs.map((a) => (
              <ActCard
                key={a.id}
                act={a}
                sendError={markErrors[a.id ?? ''] ?? null}
                onSent={handleMarkSent}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
