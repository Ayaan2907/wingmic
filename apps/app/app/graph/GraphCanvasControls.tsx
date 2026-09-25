'use client';

import type { CSSProperties } from 'react';
import type { GraphSpacingPreset } from './graph-force';

const btnStyle: CSSProperties = {
  padding: '8px 10px',
  minHeight: 40,
  minWidth: 40,
  borderRadius: 12,
  border: '1px solid var(--border-soft)',
  background: 'var(--surface-2)',
  color: 'var(--text-55)',
  fontSize: 11,
  cursor: 'pointer',
  lineHeight: 1,
  transition: 'border-color 240ms var(--ease-relaxed, ease-out), background 240ms var(--ease-relaxed, ease-out)',
};

const activeBtnStyle: CSSProperties = {
  ...btnStyle,
  borderColor: 'rgba(255,196,82,0.35)',
  color: 'var(--accent)',
  background: 'rgba(255,196,82,0.08)',
};

type Props = {
  spacing: GraphSpacingPreset;
  onSpacingChange: (preset: GraphSpacingPreset) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
};

const SPACING_OPTIONS: Array<{ id: GraphSpacingPreset; label: string }> = [
  { id: 'compact', label: 'tight' },
  { id: 'normal', label: 'normal' },
  { id: 'wide', label: 'wide' },
];

export function GraphCanvasControls({
  spacing,
  onSpacingChange,
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
}: Props) {
  return (
    <div
      className="graph-canvas-controls mono"
      data-testid="graph-canvas-controls"
      style={{
        position: 'absolute',
        right: 10,
        bottom: 12,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'stretch',
        width: 'min(220px, calc(100% - 20px))',
      }}
    >
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button type="button" aria-label="zoom in" title="zoom in" style={btnStyle} onClick={onZoomIn}>
          +
        </button>
        <button type="button" aria-label="zoom out" title="zoom out" style={btnStyle} onClick={onZoomOut}>
          −
        </button>
        <button type="button" aria-label="reset layout" title="reset layout" style={btnStyle} onClick={onReset}>
          ↺
        </button>
        <button
          type="button"
          aria-label="fullscreen graph"
          title="fullscreen"
          style={btnStyle}
          onClick={onFullscreen}
        >
          ⛶
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          borderRadius: 12,
          border: '1px solid var(--border-soft)',
          background: 'var(--surface-2)',
        }}
        role="group"
        aria-label="node spacing"
      >
        {SPACING_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={spacing === id}
            onClick={() => onSpacingChange(id)}
            style={
              spacing === id
                ? { ...activeBtnStyle, flex: 1 }
                : { ...btnStyle, flex: 1, border: 'none', background: 'transparent' }
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
