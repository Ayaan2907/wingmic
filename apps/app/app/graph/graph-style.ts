import { accent, blue, violet } from '@/app/chat/_components/tokens';
import {
  graphNodeCaption,
  graphNodeInitials,
  isHighlightedGraphNode,
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
  works_at: blue,
  attended: '#d4d4d8',
  discussed: violet,
};

export const LINK_WIDTH = 1.8;
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

export function linkWidthOf(_rel?: LinkRel): number {
  return LINK_WIDTH;
}

type CanvasNode = GraphNode & { x?: number; y?: number };

/** Paint a node with initials inside the disc and a short name beside it. */
export function paintGraphNode(
  node: CanvasNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  selectedId: string | null,
): void {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const highlighted = isHighlightedGraphNode(node.id, selectedId);
  const r = highlighted ? NODE_PAINT_RADIUS * 1.35 : NODE_PAINT_RADIUS;
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

  const fontSize = Math.max(10, 12 / Math.max(globalScale, 0.7));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = highlighted ? '#ffffff' : 'rgba(255,255,255,0.88)';
  ctx.textBaseline = 'top';
  ctx.fillText(graphNodeCaption(node.label), x, y + r + 4);
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
