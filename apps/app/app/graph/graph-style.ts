import { accent, blue, violet } from '@/app/chat/_components/tokens';
import {
  graphNodeCaption,
  graphNodeInitials,
  graphLinkNeighborhoodAlpha,
  graphNeighborhoodAlpha,
  isHighlightedGraphNode,
  shouldShowGraphNodeCaption,
} from './graph-node-label';
import type { GraphNode, LinkRel, NodeKind } from './graph-types';

// Canvas 2d cannot resolve CSS variables — keep hex only.
export const KIND_COLOR: Record<NodeKind, string> = {
  person: accent,
  company: blue,
  event: '#9ca3af',
  topic: violet,
};

export const LINK_COLOR: Record<LinkRel, string> = {
  works_at: '#5a8fb0',
  attended: '#6b7280',
  discussed: '#7c6a9e',
};

/** Resting edge opacity when nothing is selected. */
export const GRAPH_LINK_REST_ALPHA = 0.2;
/** Edge opacity for selected neighborhood. */
export const GRAPH_LINK_FOCUS_ALPHA = 0.55;

export const LINK_WIDTH = 1;
export const LINK_WIDTH_FOCUS = 1.35;
export const NODE_REL_SIZE = 8;
export const NODE_PAINT_RADIUS = 14;

export const FILTERS: Array<{ kind: NodeKind; label: string }> = [
  { kind: 'person', label: 'people' },
  { kind: 'company', label: 'orgs' },
  { kind: 'event', label: 'events' },
  { kind: 'topic', label: 'topics' },
];

export function linkColorOf(rel: LinkRel | undefined): string {
  if (!rel) return '#a1a1aa';
  return LINK_COLOR[rel];
}

export function linkWidthOf(
  rel: LinkRel | undefined,
  neighborhood: Set<string>,
  sourceId: string,
  targetId: string,
): number {
  if (neighborhood.size === 0) return LINK_WIDTH;
  const focused =
    neighborhood.has(sourceId) && neighborhood.has(targetId);
  return focused ? LINK_WIDTH_FOCUS : LINK_WIDTH * 0.85;
}

export function paintGraphLinkColor(
  rel: LinkRel | undefined,
  sourceId: string,
  targetId: string,
  neighborhood: Set<string>,
): string {
  const base = linkColorOf(rel);
  const hex = base.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (neighborhood.size === 0) {
    return `rgba(${r},${g},${b},${GRAPH_LINK_REST_ALPHA})`;
  }
  const alpha = graphLinkNeighborhoodAlpha(sourceId, targetId, neighborhood);
  const painted =
    alpha >= 1 ? GRAPH_LINK_FOCUS_ALPHA : Math.min(alpha, GRAPH_LINK_REST_ALPHA * 0.75);
  return `rgba(${r},${g},${b},${painted})`;
}

type CanvasNode = GraphNode & { x?: number; y?: number };

/** Paint a node with initials inside the disc; caption when zoom/hover/select. */
export function paintGraphNode(
  node: CanvasNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  selectedId: string | null,
  hoveredId: string | null,
  neighborhood: Set<string>,
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const highlighted = isHighlightedGraphNode(node.id, selectedId);
  const alpha = graphNeighborhoodAlpha(node.id, neighborhood);
  const r = highlighted ? NODE_PAINT_RADIUS * 1.35 : NODE_PAINT_RADIUS;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = KIND_COLOR[node.kind] ?? accent;
  ctx.fill();
  if (highlighted) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6 / Math.max(globalScale, 0.4);
    ctx.stroke();
  }
  ctx.fillStyle = '#000000';
  ctx.font = `700 ${Math.max(9, r * 0.72)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(graphNodeInitials(node.label), x, y);

  if (shouldShowGraphNodeCaption(node.id, selectedId, hoveredId, globalScale)) {
    const fontSize = Math.max(10, 12 / Math.max(globalScale, 0.7));
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = highlighted ? '#ffffff' : 'rgba(255,255,255,0.88)';
    ctx.textBaseline = 'top';
    ctx.fillText(graphNodeCaption(node.label), x, y + r + 4);
  }
  ctx.restore();
}

export function paintGraphNodePointerArea(
  node: CanvasNode,
  color: string,
  ctx: CanvasRenderingContext2D,
  selectedId: string | null,
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const highlighted = isHighlightedGraphNode(node.id, selectedId);
  const r = (highlighted ? NODE_PAINT_RADIUS * 1.35 : NODE_PAINT_RADIUS) + 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}
