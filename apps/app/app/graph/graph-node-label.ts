/** Canvas-facing label helpers for graph nodes. */

export function graphNodeInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0]!.charAt(0).toUpperCase();
  }
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
}

export function graphNodeCaption(label: string, max = 14): string {
  const t = label.trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const first = t.split(/\s+/)[0]!;
  if (first.length <= max) return first;
  return `${first.slice(0, Math.max(1, max - 1))}…`;
}

export function isHighlightedGraphNode(
  nodeId: string,
  selectedId: string | null,
): boolean {
  return selectedId !== null && nodeId === selectedId;
}

export function shouldShowGraphNodeCaption(
  nodeId: string,
  selectedId: string | null,
  hoveredId: string | null,
  _globalScale: number,
): boolean {
  return selectedId === nodeId || hoveredId === nodeId;
}

/** Selected node + 1-hop neighbors; empty when nothing selected. */
export function graphNeighborhoodIds(
  selectedId: string | null,
  links: Array<{ source: string | { id: string }; target: string | { id: string } }>,
): Set<string> {
  if (!selectedId) return new Set();
  const endId = (end: string | { id: string }) =>
    typeof end === 'object' ? end.id : end;
  const ids = new Set<string>([selectedId]);
  for (const link of links) {
    const a = endId(link.source);
    const b = endId(link.target);
    if (a === selectedId) ids.add(b);
    if (b === selectedId) ids.add(a);
  }
  return ids;
}

export function graphNeighborhoodAlpha(nodeId: string, neighborhood: Set<string>): number {
  if (neighborhood.size === 0) return 1;
  return neighborhood.has(nodeId) ? 1 : 0.22;
}

export function graphLinkNeighborhoodAlpha(
  sourceId: string,
  targetId: string,
  neighborhood: Set<string>,
): number {
  if (neighborhood.size === 0) return 1;
  return neighborhood.has(sourceId) && neighborhood.has(targetId) ? 1 : 0.15;
}
