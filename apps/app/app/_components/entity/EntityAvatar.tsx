// EntityAvatar — per-kind visual templates (PR α v16)
//
// Source of truth: design/v2/library/lib-entities.jsx + lib-shared.jsx Avatar/EntityTag.
// Plan reference: docs/superpowers/plans/* §18 v16.
//
// These are static primitives. v9 (home) and PR β (detail pages, graph, search)
// will consume them. Do not wire into screens here.

import * as React from 'react';

type Accent = 'amber' | 'mint' | 'pink' | 'blue' | 'violet';

const ACCENT_HEX: Record<Accent, string> = {
  amber: '#ffc452', // --accent
  mint: '#86efac', // --second
  pink: '#ff8fab', // --third
  blue: '#7dd3fc', // --info-blue
  violet: '#a78bfa', // --info-violet
};

const ACCENT_ORDER: Accent[] = ['amber', 'mint', 'pink', 'blue', 'violet'];

const FONT_SANS =
  "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_SERIF = "'Instrument Serif', Georgia, serif";
const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// Deterministic accent pick from a seed/name. Stable across renders.
function pickAccent(seed: string): Accent {
  if (!seed) return 'amber';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return ACCENT_ORDER[Math.abs(h) % ACCENT_ORDER.length]!;
}

function firstLetter(name: string): string {
  return (name?.trim()[0] ?? '?').toLowerCase();
}

// ────────────────────────────────────────────────────────────────────
// PersonAvatar — round 72px, italic-serif initial, brutal shadow.
// Consumed in v9 home contact rows + PR β person detail hero.
// ────────────────────────────────────────────────────────────────────
export interface PersonAvatarProps {
  name: string;
  size?: number;
  accent?: Accent;
  /** seed for deterministic accent when `accent` is not provided */
  seed?: string;
  style?: React.CSSProperties;
}

export function PersonAvatar({
  name,
  size = 72,
  accent,
  seed,
  style,
}: PersonAvatarProps) {
  const a = accent ?? pickAccent(seed ?? name);
  const initial = firstLetter(name);
  return (
    <div
      data-entity-kind="person"
      data-testid="entity-person"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: ACCENT_HEX[a],
        color: '#000',
        border: '1.5px solid #000',
        boxShadow: '3px 3px 0 #000',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `italic 400 ${Math.round(size * 0.5)}px/1 ${FONT_SERIF}`,
        letterSpacing: '-0.02em',
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// CompanyTile — 64×64 brutal square, mono uppercase initial.
// Consumed in PR β company detail hero + graph nodes.
// ────────────────────────────────────────────────────────────────────
export interface CompanyTileProps {
  name: string;
  size?: number;
  accent?: Accent;
  domain?: string;
  style?: React.CSSProperties;
}

export function CompanyTile({ name, size = 64, accent = 'blue', domain, style }: CompanyTileProps) {
  const initial = firstLetter(name).toUpperCase();
  return (
    <div
      data-entity-kind="company"
      data-testid="entity-company"
      data-domain={domain ?? undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: ACCENT_HEX[accent],
        color: '#000',
        border: '1.5px solid #000',
        boxShadow: '3px 3px 0 #000',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `700 ${Math.round(size * 0.42)}px/1 ${FONT_MONO}`,
        letterSpacing: 1,
        textTransform: 'uppercase',
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// EventDiamond — square rotated 45°, accent fill, upright initial.
// Consumed in PR β event detail hero + graph nodes.
// ────────────────────────────────────────────────────────────────────
export interface EventDiamondProps {
  name: string;
  size?: number;
  accent?: Accent;
  style?: React.CSSProperties;
}

export function EventDiamond({
  name,
  size = 64,
  accent = 'amber',
  style,
}: EventDiamondProps) {
  const initial = firstLetter(name);
  // The outer box is a square rotated 45deg. Inner letter is counter-rotated
  // so it reads upright.
  return (
    <div
      data-entity-kind="event"
      data-testid="entity-event"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: ACCENT_HEX[accent],
          border: '1.5px solid #000',
          boxShadow: '3px 3px 0 #000',
          transform: 'rotate(45deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            transform: 'rotate(-45deg)',
            color: '#000',
            font: `800 ${Math.round(size * 0.35)}px/1 ${FONT_SANS}`,
            letterSpacing: '-0.02em',
          }}
        >
          {initial}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// TopicGlyph — inline ◇ lozenge for tag/pill form.
// Consumed wherever topics are listed inline (PR β person/company/event detail).
// ────────────────────────────────────────────────────────────────────
export interface TopicGlyphProps {
  name: string;
  size?: number;
  style?: React.CSSProperties;
}

export function TopicGlyph({ name, size = 24, style }: TopicGlyphProps) {
  return (
    <span
      data-entity-kind="topic"
      data-testid="entity-topic"
      data-topic-name={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: 'var(--surface-2, rgba(255,255,255,0.04))',
        color: '#a78bfa',
        borderRadius: 4,
        font: `500 ${Math.round(size * 0.55)}px/1 ${FONT_MONO}`,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      {'◇'}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// PinTile — 32×32 pin/anchor tile for "pinned" entity decoration.
// Consumed by PR β search results + pinned-entity surfaces.
// ────────────────────────────────────────────────────────────────────
export interface PinTileProps {
  size?: number;
  style?: React.CSSProperties;
}

export function PinTile({ size = 32, style }: PinTileProps) {
  return (
    <span
      data-entity-kind="pin"
      data-testid="entity-pin"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: 'var(--surface-2, rgba(255,255,255,0.04))',
        color: '#ffc452',
        border: '1.5px solid #000',
        boxShadow: '3px 3px 0 #000',
        borderRadius: 4,
        font: `500 ${Math.round(size * 0.55)}px/1 ${FONT_MONO}`,
        flexShrink: 0,
        ...style,
      }}
      aria-label="pinned"
    >
      {'📌'}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// EntityAvatar — switch by kind. Single entry point for consumers.
// ────────────────────────────────────────────────────────────────────
export type EntityKind = 'person' | 'company' | 'event' | 'topic' | 'pin';

export type EntityAvatarProps =
  | ({ kind: 'person' } & PersonAvatarProps)
  | ({ kind: 'company' } & CompanyTileProps)
  | ({ kind: 'event' } & EventDiamondProps)
  | ({ kind: 'topic' } & TopicGlyphProps)
  | ({ kind: 'pin' } & PinTileProps);

export function EntityAvatar(props: EntityAvatarProps) {
  switch (props.kind) {
    case 'person': {
      const { kind: _k, ...rest } = props;
      return <PersonAvatar {...rest} />;
    }
    case 'company': {
      const { kind: _k, ...rest } = props;
      return <CompanyTile {...rest} />;
    }
    case 'event': {
      const { kind: _k, ...rest } = props;
      return <EventDiamond {...rest} />;
    }
    case 'topic': {
      const { kind: _k, ...rest } = props;
      return <TopicGlyph {...rest} />;
    }
    case 'pin': {
      const { kind: _k, ...rest } = props;
      return <PinTile {...rest} />;
    }
    default: {
      const _exhaustive: never = props;
      return null;
    }
  }
}
