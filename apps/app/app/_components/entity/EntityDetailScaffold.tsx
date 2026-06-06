'use client';

// EntityDetailScaffold — shared layout for /person/[id], /company/[id], /event/[id].
//
// Source of truth:
//   - design/v2/proto-screens-b.jsx ScreenPerson / ScreenCompany (lines 192-350)
//   - design/v2/proto-screens-c.jsx ScreenEvent (lines 8-93)
//   - design/v2/design.md §13 (entity detail spec: hero glyphs, scaffold, routing)
//
// Single layout, three kinds. Hero atom + eyebrow + name + sub vary by kind;
// the rest (CTAs, stat trio, captures, follow-ups, related) shares one shape.
// Tokens come from chat/_components/tokens.ts to keep parity with the rest of
// apps/app (v2 design-tokens consolidate in PR γ).

import * as React from 'react';
import Link from 'next/link';
import { BottomTabBar } from '../BottomTabBar';
import { PersonAvatar, CompanyTile, EventDiamond } from './EntityAvatar';
import { accent, third, blue, violet } from '@/app/chat/_components/tokens';

export type EntityKind = 'person' | 'company' | 'event';

export interface EntityCapture {
  interactionId: string;
  capturedAt: string;
  transcript: string;
  eventName?: string | null;
}

export interface EntityFollowup {
  id: string;
  body: string;
  dueHint?: string;
}

export interface EntityRelated {
  kind: EntityKind;
  id: string;
  name: string;
  role?: string | null;
}

export interface EntityStat {
  key: string;
  value: string;
}

export interface EntityDetailScaffoldProps {
  kind: EntityKind;
  hero: React.ReactNode;
  eyebrow: string;
  name: string;
  sub: React.ReactNode;
  tags?: string[];
  primaryCta: { label: string };
  ghostCta: { label: string };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics?: Array<{ id: string; name: string }>;
}

const STAT_COLORS = [accent, '#86efac', third];

export function EntityDetailScaffold(props: EntityDetailScaffoldProps) {
  const {
    kind,
    hero,
    eyebrow,
    name,
    sub,
    tags,
    primaryCta,
    ghostCta,
    stats,
    captures,
    followups,
    related,
    topics,
  } = props;

  return (
    <main
      data-screen={`entity-${kind}`}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
        paddingBottom: 110,
      }}
    >
      <TopRow />
      <section
        style={{
          padding: '4px 20px 0',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <Hero kind={kind} hero={hero} eyebrow={eyebrow} name={name} sub={sub} />

        {tags && tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              marginBottom: 16,
            }}
            data-testid="entity-tags"
          >
            {tags.map((t) => (
              <span
                key={t}
                className="mono"
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: 'var(--surface-2, rgba(255,255,255,0.04))',
                  border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
                  fontSize: 11,
                  color: 'var(--text-70)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <CtaRow primary={primaryCta} ghost={ghostCta} />

        <StatTrio stats={stats} />

        <Section title="from your captures" testid="entity-captures">
          {captures.length === 0 ? (
            <EmptyCard>no captures yet for this one.</EmptyCard>
          ) : (
            captures.map((c) => <CaptureCard key={c.interactionId} capture={c} />)
          )}
        </Section>

        <Section title="follow-ups" testid="entity-followups">
          {followups.length === 0 ? (
            <EmptyCard>no follow-ups yet. acts agent arrives v0.3.</EmptyCard>
          ) : (
            followups.map((f) => <FollowupCard key={f.id} followup={f} />)
          )}
        </Section>

        {topics && topics.length > 0 && (
          <Section title="topics" testid="entity-topics-list">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {topics.map((t) => (
                <span
                  key={t.id}
                  className="mono"
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: `${violet}1f`,
                    color: violet,
                    border: `1px solid ${violet}40`,
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  ◇ {t.name}
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="related" testid="entity-related" last>
          {related.length === 0 ? (
            <EmptyCard>nothing connected yet.</EmptyCard>
          ) : (
            related.map((r, i) => (
              <RelatedRow key={`${r.kind}-${r.id}`} item={r} isLast={i === related.length - 1} />
            ))
          )}
        </Section>
      </section>

      <BottomTabBar active="graph" />
    </main>
  );
}

// ─── pieces ────────────────────────────────────────────────────────────

function TopRow() {
  return (
    <div
      style={{
        padding: '10px 20px 6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Link
        href="/chat"
        aria-label="back"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text-55)',
          textDecoration: 'none',
          font: '500 12px Inter, system-ui, sans-serif',
        }}
      >
        ← back
      </Link>
      <div style={{ display: 'flex', gap: 6 }}>
        <ChromeBtn href="/" label="graph">
          ◈
        </ChromeBtn>
        <ChromeBtn href="/" label="settings">
          ⚙
        </ChromeBtn>
      </div>
    </div>
  );
}

function ChromeBtn({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      // Plain <a> matches BottomTabBar + ChatThread chip convention. typedRoutes
      // can't infer dynamic strings; native <a> dodges the cast without losing
      // anything meaningful at this scale.
      href={href}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background: 'var(--surface-1, rgba(255,255,255,0.03))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        color: 'var(--text-55)',
        textDecoration: 'none',
        fontSize: 14,
      }}
    >
      {children}
    </a>
  );
}

function Hero({
  kind,
  hero,
  eyebrow,
  name,
  sub,
}: {
  kind: EntityKind;
  hero: React.ReactNode;
  eyebrow: string;
  name: string;
  sub: React.ReactNode;
}) {
  const eyebrowColor = kind === 'person' ? accent : kind === 'company' ? blue : 'var(--text-55)';
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        marginBottom: 16,
        marginTop: 4,
      }}
      data-testid="entity-hero"
    >
      <div>{hero}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="mono"
          style={{
            font: '700 10px JetBrains Mono, ui-monospace, monospace',
            color: eyebrowColor,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            font: '800 22px/1 Inter, system-ui, sans-serif',
            letterSpacing: '-0.025em',
            margin: 0,
          }}
        >
          {name}
        </h1>
        <div
          className="mono"
          style={{
            font: '400 12px JetBrains Mono, ui-monospace, monospace',
            color: 'var(--text-55)',
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function CtaRow({
  primary,
  ghost,
}: {
  primary: { label: string };
  ghost: { label: string };
}) {
  // β₂: CTAs are surfaced but inert (acts agent ships v0.3). They click but do
  // nothing — keeps the visual contract while we wait for the wire-up.
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }} data-testid="entity-ctas">
      <button
        type="button"
        disabled
        style={{
          flex: 1,
          padding: 12,
          borderRadius: 10,
          background: accent,
          color: '#000',
          font: '700 13px Inter, system-ui, sans-serif',
          border: '1.5px solid #000',
          boxShadow: '4px 4px 0 #000',
          cursor: 'not-allowed',
          opacity: 0.85,
        }}
      >
        {primary.label}
      </button>
      <button
        type="button"
        disabled
        style={{
          padding: '12px 18px',
          borderRadius: 10,
          background: 'transparent',
          color: 'var(--ink)',
          font: '500 13px Inter, system-ui, sans-serif',
          border: '1.5px solid var(--border-mid, rgba(255,255,255,0.22))',
          cursor: 'not-allowed',
          opacity: 0.7,
        }}
      >
        {ghost.label}
      </button>
    </div>
  );
}

function StatTrio({ stats }: { stats: EntityStat[] }) {
  return (
    <div
      style={{ display: 'flex', gap: 28, marginBottom: 24 }}
      data-testid="entity-stats"
    >
      {stats.map((s, i) => (
        <div key={s.key}>
          <div
            className="serif"
            style={{
              font: '400 32px/0.9 Instrument Serif, Georgia, serif',
              fontStyle: 'italic',
              color: STAT_COLORS[i % STAT_COLORS.length],
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {s.value}
          </div>
          <div
            className="mono"
            style={{
              font: '500 9px JetBrains Mono, ui-monospace, monospace',
              color: 'var(--text-40)',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            {s.key}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  children,
  testid,
  last,
}: {
  title: string;
  children: React.ReactNode;
  testid?: string;
  last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 8 : 20 }} data-testid={testid}>
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
        ◆ {title}
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px dashed var(--border-mid, rgba(255,255,255,0.12))',
        color: 'var(--text-55)',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function CaptureCard({ capture }: { capture: EntityCapture }) {
  const date = new Date(capture.capturedAt);
  const meta = `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${date
    .toLocaleDateString([], { month: 'short', day: '2-digit' })
    .toUpperCase()}${capture.eventName ? ` · ${capture.eventName.toUpperCase()}` : ''}`;
  const excerpt =
    capture.transcript.length > 240 ? capture.transcript.slice(0, 240) + '…' : capture.transcript;
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1, rgba(255,255,255,0.025))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        marginBottom: 10,
      }}
      data-testid="entity-capture"
    >
      <div
        className="mono"
        style={{
          font: '500 10px JetBrains Mono, ui-monospace, monospace',
          color: 'var(--text-40)',
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        {meta}
      </div>
      <div
        style={{
          font: '400 13.5px/1.55 Inter, system-ui, sans-serif',
          color: 'var(--text-85)',
        }}
      >
        {excerpt}
      </div>
    </div>
  );
}

function FollowupCard({ followup }: { followup: EntityFollowup }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1, rgba(255,255,255,0.025))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
      }}
      data-testid="entity-followup"
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: accent,
          border: '1.5px solid #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          font: '700 12px Inter, sans-serif',
          color: '#000',
        }}
      >
        ✓
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ font: '500 13px Inter, system-ui, sans-serif', color: 'var(--ink)' }}>
          {followup.body}
        </div>
        {followup.dueHint && (
          <div
            className="mono"
            style={{
              font: '400 10.5px JetBrains Mono, ui-monospace, monospace',
              color: 'var(--text-40)',
              marginTop: 2,
            }}
          >
            due · {followup.dueHint}
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedRow({ item, isLast }: { item: EntityRelated; isLast: boolean }) {
  const href = relatedHref(item);
  const avatar = relatedAvatar(item);
  return (
    <a
      // Plain <a> for the dynamic /{kind}/{id} href — matches BottomTabBar +
      // ChatThread chip convention; avoids the typedRoutes cast workaround.
      href={href}
      data-testid="entity-related-row"
      data-related-href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span aria-hidden="true">{avatar}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: '500 13.5px Inter, system-ui, sans-serif',
            color: 'var(--ink)',
          }}
        >
          {item.name}
        </div>
        {item.role && (
          <div
            className="mono"
            style={{
              font: '400 11px JetBrains Mono, ui-monospace, monospace',
              color: 'var(--text-40)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.role}
          </div>
        )}
      </div>
      <span style={{ color: 'var(--text-40)', fontSize: 14 }}>→</span>
    </a>
  );
}

function relatedHref(item: EntityRelated): string {
  return `/${item.kind}/${encodeURIComponent(item.id)}`;
}

function relatedAvatar(item: EntityRelated): React.ReactNode {
  if (item.kind === 'person') return <PersonAvatar name={item.name} seed={item.id} size={28} />;
  if (item.kind === 'company') return <CompanyTile name={item.name} size={28} />;
  return <EventDiamond name={item.name} size={28} />;
}
