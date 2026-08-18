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
import { useRouter } from 'next/navigation';
import { accent } from '@/app/chat/_components/tokens';
import { trpc } from '@/lib/trpc/client';
import { GraphHoverCard } from './GraphHoverCard';
import { GraphSearch } from './GraphSearch';
import {
  FILTERS,
  KIND_COLOR,
  NODE_REL_SIZE,
  linkColorOf,
  linkWidthOf,
} from './graph-style';
import type { GraphData, GraphLink, GraphNode, LinkRel, NodeKind } from './graph-types';
import { graphEndId } from './graph-types';

export type { GraphData, GraphLink, GraphNode, LinkRel, NodeKind };

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export function GraphClient({ data }: { data: GraphData }) {
  const router = useRouter();
  const createDraft = trpc.acts.createDraft.useMutation({
    onSuccess: (res) => {
      if (res.ok) router.push('/acts');
    },
  });
  const [active, setActive] = useState<Set<NodeKind>>(
    () => new Set<NodeKind>(['person', 'company', 'event', 'topic']),
  );
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

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
    const links = data.links.filter(
      (l) => visibleIds.has(l.source) && visibleIds.has(l.target),
    );
    return { nodes, links };
  }, [data, active]);

  // Edges touching the selected node, for the desktop detail rail. Real data,
  // derived from data.links. react-force-graph mutates link.source/target from
  // id strings into node objects after first render, so normalise both.
  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const selectedEdges = useMemo(() => {
    if (!selected) return [] as Array<{ rel: LinkRel; label: string }>;
    return data.links
      .filter((l) => graphEndId(l.source) === selected.id || graphEndId(l.target) === selected.id)
      .map((l) => {
        const otherId =
          graphEndId(l.source) === selected.id ? graphEndId(l.target) : graphEndId(l.source);
        return { rel: l.rel, label: nodeById.get(otherId)?.label ?? otherId };
      });
  }, [selected, data.links, nodeById]);

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
              tap the mic to capture someone.
            </span>
          </p>
        </div>
      </main>
    );
  }

  return (
    // Desktop (≥1120px) splits into [canvas | detail rail]; on mobile the
    // rail is display:none and the selected node uses the floating card.
    <div className="surface-split">
    <main
      className="surface-primary"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
        overflow: 'hidden',
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      {/* Filter chips + in-canvas search. Dropdown overflows the canvas. */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 4,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
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
        <GraphSearch nodes={data.nodes} onSelect={setSelected} />
      </div>

      <ForceGraph2D
        graphData={filtered}
        nodeColor={(n: any) => KIND_COLOR[(n as GraphNode).kind] ?? accent}
        nodeRelSize={NODE_REL_SIZE}
        nodeLabel={() => ''}
        linkColor={(l: any) => linkColorOf((l as GraphLink).rel)}
        linkWidth={(l: any) => linkWidthOf((l as GraphLink).rel)}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        onNodeClick={(n: any) => setSelected(n as GraphNode)}
        onNodeHover={(n: any) => setHovered(n ? (n as GraphNode) : null)}
        backgroundColor="rgba(0,0,0,0)"
      />

      <GraphHoverCard node={hovered} x={pointer.x} y={pointer.y} />

      {/* Selected-node floating card (above the nav on mobile). Hidden on
          desktop — the persistent detail rail replaces it there. */}
      {selected && (
        <div
          className="graph-mobile-card"
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

      {/* Desktop detail rail (proto-desktop.jsx ScreenDesktopGraph 265–291). */}
      <aside
        className="desktop-pane detail-rail"
        style={{ padding: '20px 18px', background: 'rgba(255,255,255,0.01)' }}
        aria-label="selected node"
      >
        {selected ? (
          <>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 14,
              }}
            >
              ◉ selected
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: selected.kind === 'company' ? 12 : '50%',
                  background: KIND_COLOR[selected.kind],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {selected.label.charAt(0).toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {selected.label}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}
                >
                  {selected.kind}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                disabled={
                  createDraft.isPending ||
                  selected.kind === 'topic' ||
                  (selected.kind !== 'person' &&
                    selected.kind !== 'company' &&
                    selected.kind !== 'event')
                }
                title={
                  selected.kind === 'topic'
                    ? 'topics have no check-in draft'
                    : `draft from ${selected.kind}`
                }
                className="serif"
                onClick={() => {
                  if (selected.kind === 'person') {
                    createDraft.mutate({
                      kind: 'email',
                      intent: 'check-in',
                      targetEntityId: selected.id,
                    });
                    return;
                  }
                  if (selected.kind === 'company') {
                    createDraft.mutate({
                      kind: 'todo',
                      intent: 'warm-path',
                      contextName: selected.label,
                    });
                    return;
                  }
                  if (selected.kind === 'event') {
                    createDraft.mutate({
                      kind: 'reminder',
                      intent: 'reminder',
                      contextName: selected.label,
                      seedBody: `send check-ins after ${selected.label}`,
                    });
                    return;
                  }
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  background: accent,
                  color: '#000',
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: '1.5px solid #000',
                  boxShadow: '3px 3px 0 #000',
                  opacity: selected.kind === 'topic' || createDraft.isPending ? 0.55 : 1,
                  cursor:
                    selected.kind === 'topic' || createDraft.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {createDraft.isPending
                  ? 'drafting…'
                  : selected.kind === 'company'
                    ? 'warm path →'
                    : selected.kind === 'event'
                      ? 'check-in →'
                      : 'draft check-in →'}
              </button>
              <a
                href={
                  selected.kind === 'topic'
                    ? undefined
                    : '/' + selected.kind + '/' + selected.id
                }
                aria-disabled={selected.kind === 'topic' || undefined}
                onClick={(e) => {
                  if (selected.kind === 'topic') e.preventDefault();
                }}
                title={
                  selected.kind === 'topic'
                    ? 'topics have no detail page yet'
                    : `open ${selected.kind}`
                }
                className="mono"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  color:
                    selected.kind === 'topic'
                      ? 'rgba(255,255,255,0.25)'
                      : 'rgba(255,255,255,0.55)',
                  fontSize: 12,
                  textDecoration: 'none',
                  border: '1px solid var(--hair)',
                  cursor: selected.kind === 'topic' ? 'not-allowed' : 'pointer',
                  pointerEvents: selected.kind === 'topic' ? 'none' : 'auto',
                }}
              >
                open
              </a>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 10,
              }}
            >
              ◆ edges · {selectedEdges.length}
            </div>
            {selectedEdges.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span
                  className="mono"
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${accent}26`,
                    fontSize: 9,
                    color: accent,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {e.rel}
                </span>
                <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>{e.label}</span>
              </div>
            ))}
          </>
        ) : (
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              marginTop: 40,
              textAlign: 'center',
            }}
          >
            tap a node to inspect
          </div>
        )}
      </aside>
    </div>
  );
}
