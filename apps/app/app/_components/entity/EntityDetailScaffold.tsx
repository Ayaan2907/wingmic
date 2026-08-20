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
import { PersonAvatar, CompanyTile, EventDiamond } from './EntityAvatar';
import { accent, third, blue, violet } from '@/app/chat/_components/tokens';

export type EntityKind = 'person' | 'company' | 'event';

export interface EntityCapture {
  interactionId: string;
  capturedAt: string;
  transcript: string;
  topics?: string[];
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

export interface EntityPublicProfile {
  linkedin: string | null;
  url: string | null;
  sourceUrl: string | null;
}

export interface EntityPossibleMatch {
  id: string;
  name: string;
  role?: string | null;
  companyName?: string | null;
}

export interface EntityStat {
  key: string;
  value: string;
}

export interface EntityCta {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  title?: string;
}

export interface EntityDetailScaffoldProps {
  kind: EntityKind;
  hero: React.ReactNode;
  eyebrow: string;
  name: string;
  sub: React.ReactNode;
  tags?: string[];
  primaryCta: EntityCta;
  ghostCta: EntityCta;
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics?: Array<{ id: string; name: string }>;
  publicProfile?: EntityPublicProfile | null;
  possibleMatches?: EntityPossibleMatch[];
  onMergePossibleMatch?: (sourceId: string) => void;
  mergePendingId?: string | null;
  mergeUndo?: { mergeId: string; sourceName: string; expiresAt: number } | null;
  onUndoMerge?: () => void;
  /** Person entity id — used for public profile avatar seed. */
  entityId?: string;
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
    publicProfile,
    possibleMatches,
    onMergePossibleMatch,
    mergePendingId,
    mergeUndo,
    onUndoMerge,
    entityId,
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

        {mergeUndo && onUndoMerge ? (
          <div
            data-testid="entity-merge-undo"
            className="mono"
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,107,107,0.12)',
              border: '1px solid rgba(255,107,107,0.35)',
              fontSize: 12,
              color: 'var(--text-85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span>
              <span className="serif" style={{ fontStyle: 'italic' }}>
                {mergeUndo.sourceName}
              </span>{' '}
              merged
            </span>
            <button
              type="button"
              onClick={onUndoMerge}
              className="mono"
              style={{
                background: 'transparent',
                border: 'none',
                color: accent,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              ↶ undo
            </button>
          </div>
        ) : null}

        <StatTrio stats={stats} />

        {kind === 'person' && (
          <Section title="on the web" testid="entity-public-profile">
            <PublicProfileCard
              profile={publicProfile ?? null}
              name={name}
              sub={sub}
              entityId={entityId}
            />
          </Section>
        )}

        {kind === 'person' && possibleMatches && possibleMatches.length > 0 && (
          <Section title="also in your graph" testid="entity-possible-matches">
            <p
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-55)',
                margin: '0 0 10px',
                letterSpacing: 0.2,
              }}
            >
              same name — pick who you actually met.
            </p>
            {possibleMatches.map((m) => (
              <PossibleMatchCard
                key={m.id}
                match={m}
                onMerge={onMergePossibleMatch}
                pending={mergePendingId === m.id}
              />
            ))}
          </Section>
        )}

        <Section title="from your captures" testid="entity-captures">
          {captures.length === 0 ? (
            <EmptyCard>no captures yet for this one.</EmptyCard>
          ) : (
            captures.map((c) => <CaptureCard key={c.interactionId} capture={c} />)
          )}
        </Section>

        <Section title="follow-ups" testid="entity-followups">
          {followups.length === 0 ? (
            <EmptyCard>no follow-ups yet — draft one from a capture, or tap draft check-in.</EmptyCard>
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
            <EmptyCard>nothing connected yet — companies, events, and people from the same captures land here.</EmptyCard>
          ) : (
            related.map((r, i) => (
              <RelatedRow key={`${r.kind}-${r.id}`} item={r} isLast={i === related.length - 1} />
            ))
          )}
        </Section>
      </section>
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
        className="app-backlink"
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
  primary: EntityCta;
  ghost: EntityCta;
}) {
  // Enabled when an onClick handler is provided (A6 / acts agent).
  // Without a handler, keep the prior disabled chrome.
  const primaryInactive = !primary.onClick || Boolean(primary.disabled) || Boolean(primary.pending);
  const ghostInactive = !ghost.onClick || Boolean(ghost.disabled) || Boolean(ghost.pending);

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }} data-testid="entity-ctas">
      <button
        type="button"
        disabled={primaryInactive}
        title={primary.title}
        aria-busy={primary.pending || undefined}
        onClick={primary.onClick}
        style={{
          flex: 1,
          padding: 12,
          borderRadius: 10,
          background: accent,
          color: '#000',
          font: '700 13px Inter, system-ui, sans-serif',
          border: '1.5px solid #000',
          boxShadow: '4px 4px 0 #000',
          cursor: primaryInactive ? 'not-allowed' : 'pointer',
          opacity: primaryInactive ? 0.85 : 1,
        }}
      >
        {primary.pending ? 'drafting…' : primary.label}
      </button>
      <button
        type="button"
        disabled={ghostInactive}
        title={ghost.title}
        onClick={ghost.onClick}
        style={{
          padding: '12px 18px',
          borderRadius: 10,
          background: 'transparent',
          color: 'var(--ink)',
          font: '500 13px Inter, system-ui, sans-serif',
          border: '1.5px solid var(--border-mid, rgba(255,255,255,0.22))',
          cursor: ghostInactive ? 'not-allowed' : 'pointer',
          opacity: ghostInactive ? 0.7 : 1,
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
      {capture.topics && capture.topics.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {capture.topics.map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                background: `${violet}1f`,
                color: violet,
                border: `1px solid ${violet}40`,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
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

function safeHref(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function PublicProfileCard({
  profile,
  name,
  sub,
  entityId,
}: {
  profile: EntityPublicProfile | null;
  name: string;
  sub: React.ReactNode;
  entityId?: string;
}) {
  const linkedin = safeHref(profile?.linkedin);
  const url = safeHref(profile?.url);
  const sourceUrl = safeHref(profile?.sourceUrl);
  const pressUrl =
    url && url !== linkedin ? url : sourceUrl && sourceUrl !== linkedin ? sourceUrl : null;

  if (!linkedin && !pressUrl) {
    return <EmptyCard>no public sources yet.</EmptyCard>;
  }

  if (linkedin) {
    const subLine = typeof sub === 'string' ? sub : null;
    return (
      <div data-testid="entity-public-profile-card">
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: 'var(--surface-1, rgba(255,255,255,0.025))',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <PersonAvatar name={name} seed={entityId ?? name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 14px Inter, system-ui, sans-serif', color: 'var(--ink)' }}>
              {name}
            </div>
            {subLine && subLine !== 'no role yet' ? (
              <div
                className="mono"
                style={{
                  font: '400 11px JetBrains Mono, ui-monospace, monospace',
                  color: 'var(--text-55)',
                  marginTop: 4,
                }}
              >
                {subLine}
              </div>
            ) : null}
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{
                display: 'inline-block',
                marginTop: 10,
                color: accent,
                fontSize: 12,
                textDecoration: 'none',
              }}
            >
              show their linkedin →
            </a>
          </div>
        </div>
        {pressUrl ? (
          <a
            href={pressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{
              display: 'inline-block',
              marginTop: 8,
              marginLeft: 2,
              color: 'var(--text-55)',
              fontSize: 11,
              textDecoration: 'none',
            }}
          >
            press mention → {hostLabel(pressUrl)}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div data-testid="entity-public-profile-links">
      <a
        href={pressUrl!}
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
        style={{ color: 'var(--text-55)', fontSize: 11.5, textDecoration: 'none' }}
      >
        press mention → {hostLabel(pressUrl!)}
      </a>
    </div>
  );
}

function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return 'site';
  }
}

function PossibleMatchCard({
  match,
  onMerge,
  pending,
}: {
  match: EntityPossibleMatch;
  onMerge?: (sourceId: string) => void;
  pending?: boolean;
}) {
  const sub = [match.role, match.companyName].filter(Boolean).join(' · ');
  return (
    <div
      data-testid="entity-possible-match"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <PersonAvatar name={match.name} seed={match.id} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13.5px Inter, system-ui, sans-serif', color: 'var(--ink)' }}>
          {match.name}
        </div>
        {sub ? (
          <div
            className="mono"
            style={{
              font: '400 11px JetBrains Mono, ui-monospace, monospace',
              color: 'var(--text-40)',
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {onMerge ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                `merge ${match.name} into this person? captures and facts move over. this can't be undone after 30s.`,
              )
            ) {
              onMerge(match.id);
            }
          }}
          className="mono"
          style={{
            color: accent,
            fontSize: 11,
            background: 'transparent',
            border: 'none',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.5 : 1,
          }}
        >
          merge into this
        </button>
      ) : null}
      <a
        href={`/person/${encodeURIComponent(match.id)}`}
        className="mono"
        style={{ color: 'var(--text-40)', fontSize: 10, textDecoration: 'none' }}
      >
        open
      </a>
    </div>
  );
}

function relatedAvatar(item: EntityRelated): React.ReactNode {
  if (item.kind === 'person') return <PersonAvatar name={item.name} seed={item.id} size={28} />;
  if (item.kind === 'company') return <CompanyTile name={item.name} size={28} />;
  return <EventDiamond name={item.name} size={28} />;
}
