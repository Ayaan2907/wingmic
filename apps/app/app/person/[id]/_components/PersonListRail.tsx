'use client';

// PersonListRail — desktop-only people list column (proto-desktop.jsx
// ScreenDesktopPerson, lines 305–329). Static mock at prototype fidelity;
// ponytail: wire to the real people list + active-row highlight in v0.1.3.

import { PersonAvatar } from '@/app/_components/entity/EntityAvatar';
import { accent } from '@/app/chat/_components/tokens';

const PEOPLE: Array<{ name: string; sub: string; warm: boolean; active: boolean }> = [
  { name: 'Sarah Chen', sub: 'Rust Lead · Acme', warm: true, active: true },
  { name: 'Marcus Rivera', sub: 'CTO · Dataweave', warm: false, active: false },
  { name: 'Priya Sharma', sub: 'ML Eng · NeuralPath', warm: true, active: false },
  { name: 'Jordan Kim', sub: 'Founder · Glitch', warm: false, active: false },
  { name: 'Alex Novak', sub: 'Eng · Stripe', warm: false, active: false },
];

export function PersonListRail() {
  return (
    <aside
      className="desktop-pane people-rail"
      style={{ background: 'rgba(255,255,255,0.01)' }}
      aria-label="people"
    >
      <div style={{ padding: '16px 14px 8px' }}>
        <div
          className="mono"
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: 13,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          filter people…
        </div>
      </div>
      {PEOPLE.map((p) => (
        <div
          key={p.name}
          style={{
            padding: '10px 14px',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: p.active ? `${accent}14` : 'transparent',
            borderLeft: `3px solid ${p.active ? accent : 'transparent'}`,
          }}
        >
          <PersonAvatar size={32} name={p.name} seed={p.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                color: p.active ? 'var(--ink)' : 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {p.sub}
            </div>
          </div>
          {p.warm && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accent,
                flexShrink: 0,
              }}
            />
          )}
        </div>
      ))}
    </aside>
  );
}
