'use client';

// GraphClient — force-directed canvas of the user's entity graph (PR ι-graph).
// Source of truth: docs/superpowers/plans/2026-06-06-v0.1.2-pr-iota-graph.md,
// design/v2/proto-screens-b.jsx ScreenGraph + design.md §14.3.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { accent } from '@/app/chat/_components/tokens';
import { trpc } from '@/lib/trpc/client';
import { GraphCanvasControls } from './GraphCanvasControls';
import { GraphHoverCard } from './GraphHoverCard';
import { GraphSearch } from './GraphSearch';
import {
  FILTERS,
  KIND_COLOR,
  NODE_REL_SIZE,
  linkWidthOf,
  paintGraphLinkColor,
  paintGraphNode,
  paintGraphNodePointerArea,
} from './graph-style';
import type { GraphData, GraphLink, GraphNode, LinkRel, NodeKind } from './graph-types';
import { graphEndId } from './graph-types';
import { graphNeighborhoodIds } from './graph-node-label';
import {
  applyGraphSpacing,
  GRAPH_COOLDOWN_TICKS,
  GRAPH_VELOCITY_DECAY,
  GRAPH_WARMUP_TICKS,
  type GraphSpacingPreset,
} from './graph-force';

export type { GraphData, GraphLink, GraphNode, LinkRel, NodeKind };

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const ZOOM_STEP = 1.28;

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
  const [spacing, setSpacing] = useState<GraphSpacingPreset>('normal');
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 480 });
  const hoveredRef = useRef<GraphNode | null>(null);
  const pointerRef = useRef(pointer);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hasFitRef = useRef(false);

  const selectNode = (node: GraphNode) => {
    setActive((prev) => {
      if (prev.has(node.kind)) return prev;
      const next = new Set(prev);
      next.add(node.kind);
      return next;
    });
    setSelected(node);
  };

  const toggle = (kind: NodeKind) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const nodes = data.nodes.filter((n) => active.has(n.kind));
    const visibleIds = new Set(nodes.map((n) => n.id));
    const links = data.links
      .filter(
        (l) => visibleIds.has(graphEndId(l.source)) && visibleIds.has(graphEndId(l.target)),
      )
      .map((l) => ({
        source: graphEndId(l.source),
        target: graphEndId(l.target),
        rel: l.rel,
        hub: l.hub,
      }));
    return { nodes, links };
  }, [data, active]);

  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const neighborhood = useMemo(
    () => graphNeighborhoodIds(selected?.id ?? null, data.links),
    [selected?.id, data.links],
  );
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
  const selectedHref = selected ? `/${selected.kind}/${selected.id}` : null;

  const fitGraphToCanvas = useCallback(() => {
    if (filtered.nodes.length === 0) return;
    fgRef.current?.zoomToFit(400, 48);
    hasFitRef.current = true;
  }, [filtered.nodes.length]);

  const reheatLayout = useCallback(() => {
    hasFitRef.current = false;
    applyGraphSpacing(fgRef.current, spacing);
  }, [spacing]);

  const handleSpacingChange = (preset: GraphSpacingPreset) => {
    setSpacing(preset);
  };

  const handleZoomIn = () => {
    const fg = fgRef.current as (ForceGraphMethods & { zoom?: () => number }) | undefined;
    if (!fg?.zoom) return;
    fg.zoom(fg.zoom() * ZOOM_STEP, 280);
  };

  const handleZoomOut = () => {
    const fg = fgRef.current as (ForceGraphMethods & { zoom?: () => number }) | undefined;
    if (!fg?.zoom) return;
    fg.zoom(fg.zoom() / ZOOM_STEP, 280);
  };

  const handleReset = () => {
    hasFitRef.current = false;
    reheatLayout();
    window.setTimeout(() => fitGraphToCanvas(), 520);
  };

  const handleFullscreen = () => {
    const el = viewportRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void el.requestFullscreen?.();
  };

  useEffect(() => {
    const graph = fgRef.current as (ForceGraphMethods & { refresh?: () => void }) | undefined;
    graph?.refresh?.();
    if (!selected) return;
    const node = filtered.nodes.find((n) => n.id === selected.id) as
      | (GraphNode & { x?: number; y?: number })
      | undefined;
    if (node?.x == null || node.y == null) return;
    fgRef.current?.centerAt(node.x, node.y, 480);
    fgRef.current?.zoom(2.2, 480);
  }, [selected, filtered.nodes]);

  useEffect(() => {
    hasFitRef.current = false;
    // ForceGraph mounts async (dynamic import) — retry until ref is ready.
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (applyGraphSpacing(fgRef.current, spacing) || tries >= 40) {
        window.clearInterval(id);
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [filtered.nodes.length, filtered.links.length, spacing]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') {
      setViewportSize({ width: 800, height: 520 });
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setViewportSize({ width: Math.floor(width), height: Math.floor(height) });
        hasFitRef.current = false;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.nodes.length === 0) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(24px, 7vw, 36px) clamp(14px, 5vw, 20px)',
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
    <div className="surface-split graph-shell">
      <main className="surface-primary graph-surface">
        <header className="graph-toolbar" data-testid="graph-toolbar">
          <div className="graph-toolbar-filters">
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
                    minHeight: 32,
                    borderRadius: 999,
                    border: `1px solid ${on ? KIND_COLOR[kind] : 'var(--border-soft)'}`,
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
          <GraphSearch nodes={data.nodes} onSelect={selectNode} />
        </header>

        <div
          ref={viewportRef}
          className="graph-viewport"
          data-testid="graph-canvas"
          data-highlighted-id={selected?.id ?? ''}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            if (hoveredRef.current) setPointer(pointerRef.current);
          }}
        >
          <ForceGraph2D
            ref={fgRef}
            width={viewportSize.width}
            height={viewportSize.height}
            graphData={filtered}
            warmupTicks={GRAPH_WARMUP_TICKS}
            cooldownTicks={GRAPH_COOLDOWN_TICKS}
            d3VelocityDecay={GRAPH_VELOCITY_DECAY}
            onEngineStop={fitGraphToCanvas}
            nodeColor={(n: any) => KIND_COLOR[(n as GraphNode).kind] ?? accent}
            nodeRelSize={NODE_REL_SIZE}
            nodeLabel={() => ''}
            nodeCanvasObjectMode={() => 'replace'}
            nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, scale: number) =>
              paintGraphNode(
                n as GraphNode,
                ctx,
                scale,
                selected?.id ?? null,
                hovered?.id ?? null,
                neighborhood,
              )
            }
            nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) =>
              paintGraphNodePointerArea(n as GraphNode, color, ctx, selected?.id ?? null)
            }
            linkColor={(l: any) =>
              paintGraphLinkColor(
                (l as GraphLink).rel,
                graphEndId((l as GraphLink).source),
                graphEndId((l as GraphLink).target),
                neighborhood,
              )
            }
            linkWidth={(l: any) =>
              linkWidthOf(
                (l as GraphLink).rel,
                neighborhood,
                graphEndId((l as GraphLink).source),
                graphEndId((l as GraphLink).target),
              )
            }
            linkDirectionalArrowLength={0}
            onNodeClick={(n: any) => selectNode(n as GraphNode)}
            onNodeHover={(n: any) => {
              const next = n ? (n as GraphNode) : null;
              hoveredRef.current = next;
              setHovered(next);
              if (next) setPointer(pointerRef.current);
            }}
            backgroundColor="rgba(0,0,0,0)"
          />

          <GraphCanvasControls
            spacing={spacing}
            onSpacingChange={handleSpacingChange}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleReset}
            onFullscreen={handleFullscreen}
          />

          <GraphHoverCard node={hovered} x={pointer.x} y={pointer.y} />

          {selected && (
            <div
              className="graph-mobile-card"
              style={{
                position: 'absolute',
                left: 'clamp(10px, 4vw, 16px)',
                right: 'clamp(10px, 4vw, 16px)',
                bottom: 86,
                zIndex: 3,
                maxWidth: 360,
                margin: '0 auto',
                padding: 14,
                borderRadius: 14,
                background: 'var(--bg-elev, #111)',
                border: '1px solid var(--border-soft)',
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
                href={selectedHref ?? '#'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 32,
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
        </div>
      </main>

      <aside
        className="desktop-pane detail-rail"
        style={{
          padding: 'clamp(14px, 3vw, 20px) clamp(12px, 2vw, 18px)',
          background: 'rgba(255,255,255,0.01)',
        }}
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
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
                  flex: '1 1 190px',
                  minHeight: 42,
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
                href={selectedHref ?? '#'}
                title={`open ${selected.kind}`}
                className="mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 42,
                  padding: '10px 14px',
                  borderRadius: 10,
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 12,
                  textDecoration: 'none',
                  border: '1px solid var(--border-soft)',
                  cursor: 'pointer',
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
