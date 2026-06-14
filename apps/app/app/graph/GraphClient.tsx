'use client';

// GraphClient — force-directed canvas of the user's entity graph (PR ι-graph).
// Source of truth: docs/superpowers/plans/2026-06-06-v0.1.2-pr-iota-graph.md,
// design/v2/proto-screens-b.jsx ScreenGraph + design.md §14.3.
//
// react-force-graph-2d touches `window`/canvas, so it MUST be dynamically
// imported with `ssr: false` — a static import breaks SSR/build. The test
// mocks `next/dynamic` so jsdom never instantiates the real canvas.

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { accent, blue, violet } from '@/app/chat/_components/tokens';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type NodeKind = 'person' | 'company' | 'event' | 'topic';
type LinkRel = 'works_at' | 'attended' | 'discussed';

export type GraphNode = { id: string; kind: NodeKind; label: string };
export type GraphLink = { source: string; target: string; rel: LinkRel };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

// Node palette by kind — entity colors lifted from chat/_components/tokens.
// event has no dedicated token; the grey --text-55 keeps it recessive.
const KIND_COLOR: Record<NodeKind, string> = {
  person: accent, // #FFC452
  company: blue, // #7DD3FC
  event: 'var(--text-55)',
  topic: violet, // #A78BFA
};

const FILTERS: Array<{ kind: NodeKind; label: string }> = [
  { kind: 'person', label: 'people' },
  { kind: 'company', label: 'orgs' },
  { kind: 'event', label: 'events' },
  { kind: 'topic', label: 'topics' },
];

export function GraphClient({ data }: { data: GraphData }) {
  const [active, setActive] = useState<Set<NodeKind>>(
    () => new Set<NodeKind>(['person', 'company', 'event', 'topic']),
  );
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const toggle = (kind: NodeKind) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  // Filter nodes by active kinds; drop links whose endpoints fell away.
  const filtered = useMemo(() => {
    const nodes = data.nodes.filter((n) => active.has(n.kind));
    const visibleIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => {
      const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      return visibleIds.has(sourceId) && visibleIds.has(targetId);
    });
    return { nodes, links };
  }, [data, active]);

  if (data.nodes.length === 0) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          background: 'var(--bg-page)',
          color: 'var(--ink)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: accent,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            graph
          </div>
          <p style={{ color: 'var(--text-55)', fontSize: 15, lineHeight: 1.55 }}>
            no connections yet.{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent }}>
              hold the mic to capture someone.
            </span>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
        overflow: 'hidden',
      }}
    >
      {/* Filter chips */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 2,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {FILTERS.map(({ kind, label }) => {
          const on = active.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggle(kind)}
              aria-pressed={on}
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                padding: '5px 11px',
                borderRadius: 999,
                border: `1px solid ${on ? KIND_COLOR[kind] : 'var(--hair)'}`,
                background: on ? `${KIND_COLOR[kind]}22` : 'transparent',
                color: on ? KIND_COLOR[kind] : 'var(--text-55)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ForceGraph2D
        graphData={filtered}
        nodeColor={(n: any) => KIND_COLOR[(n as GraphNode).kind] ?? accent}
        nodeLabel={(n: any) => (n as GraphNode).label}
        onNodeClick={(n: any) => setSelected(n as GraphNode)}
        backgroundColor="rgba(0,0,0,0)"
      />

      {/* Selected-node floating card (above the nav on mobile). */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 96,
            zIndex: 3,
            maxWidth: 360,
            margin: '0 auto',
            padding: 16,
            borderRadius: 14,
            background: 'var(--bg-elev, #111)',
            border: '1px solid var(--hair)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="close"
            className="mono"
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-55)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ×
          </button>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: KIND_COLOR[selected.kind],
              marginBottom: 6,
            }}
          >
            {selected.kind}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            {selected.label}
          </div>
          <a
            href={'/' + selected.kind + '/' + selected.id}
            style={{
              color: accent,
              fontSize: 14,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            → open
          </a>
        </div>
      )}
    </main>
  );
}
