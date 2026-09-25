'use client';

import { shadows } from '@wingmic/design-tokens';
import { KIND_COLOR } from './graph-style';
import { GraphNodeAvatar } from './GraphNodeAvatar';
import type { GraphNode } from './graph-types';

export function GraphHoverCard({
  node,
  x,
  y,
}: {
  node: GraphNode | null;
  x: number;
  y: number;
}) {
  if (!node) return null;

  return (
    <div
      data-testid="graph-hover-card"
      role="tooltip"
      style={{
        position: 'absolute',
        left: x + 14,
        top: y + 14,
        zIndex: 6,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px 10px 10px',
        borderRadius: 14,
        background: 'rgba(14,14,18,0.94)',
        border: '1px solid var(--border-soft)',
        boxShadow: shadows.raised,
        maxWidth: 240,
      }}
    >
      <GraphNodeAvatar node={node} size={36} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.018em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {node.label}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: KIND_COLOR[node.kind],
            marginTop: 2,
          }}
        >
          {node.kind}
        </div>
      </div>
    </div>
  );
}
