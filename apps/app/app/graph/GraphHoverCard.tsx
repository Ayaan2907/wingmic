'use client';

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
        padding: '8px 12px 8px 8px',
        borderRadius: 12,
        background: 'rgba(17,17,17,0.94)',
        border: '1px solid var(--hair)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        maxWidth: 240,
      }}
    >
      <GraphNodeAvatar node={node} size={36} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '-0.02em',
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
