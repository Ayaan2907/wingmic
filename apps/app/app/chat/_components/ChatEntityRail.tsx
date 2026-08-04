'use client';

// ChatEntityRail — desktop-only "in this thread" rail (proto-desktop.jsx
// ScreenDesktopChat, lines 176–206). Static mock at prototype fidelity;
// ponytail: wire to the live thread's extracted entities in v0.1.3.

import { PersonAvatar } from '@/app/_components/entity/EntityAvatar';
import { accent, blue, violet } from './tokens';

const label: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)',
  marginBottom: 12,
};

const EXTRACTED: Array<{ kind: string; name: string; color: string }> = [
  { kind: 'person', name: 'sarah chen', color: accent },
  { kind: 'company', name: 'acme corp', color: blue },
  { kind: 'event', name: 'DevConnect', color: 'rgba(255,255,255,0.5)' },
  { kind: 'concept', name: 'edge config', color: violet },
];

const SOURCES = ['↪ voice note · 14:32', '↪ commit · oct 14', '↪ follow-up · open'];

export function ChatEntityRail() {
  return (
    <aside
      className="desktop-pane entity-rail mono"
      style={{ padding: '20px 16px', background: 'rgba(255,255,255,0.01)' }}
      aria-label="entities in this thread"
    >
      <div style={label}>◆ in this thread</div>

      {/* Active person card */}
      <div
        style={{
          padding: 14,
          borderRadius: 12,
          background: `${accent}0a`,
          border: `1px solid ${accent}30`,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <PersonAvatar size={42} name="Sarah Chen" seed="sarah-chen" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontFamily: 'inherit' }}>
              Sarah Chen
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>Rust Lead · Acme Corp</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <span style={pill('rgba(255,255,255,0.5)')}>#rust</span>
          <span style={pill(accent)}>follow-up</span>
        </div>
      </div>

      {/* Extracted entities */}
      <div style={{ ...label, letterSpacing: 1.5 }}>extracted</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {EXTRACTED.map((e) => (
          <span
            key={e.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12,
              color: e.color,
            }}
          >
            <span style={{ opacity: 0.7 }}>{e.kind}</span>
            <span style={{ color: 'var(--ink)' }}>{e.name}</span>
          </span>
        ))}
      </div>

      {/* Sources */}
      <div style={{ ...label, letterSpacing: 1.5 }}>sources</div>
      {SOURCES.map((s) => (
        <div
          key={s}
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            padding: '7px 0',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            letterSpacing: 0.3,
          }}
        >
          {s}
        </div>
      ))}
    </aside>
  );
}

function pill(color: string): React.CSSProperties {
  return {
    padding: '3px 9px',
    borderRadius: 999,
    background: `${color}1a`,
    border: `1px solid ${color}40`,
    fontSize: 10,
    color,
  };
}
