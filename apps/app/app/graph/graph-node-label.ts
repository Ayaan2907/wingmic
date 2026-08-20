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
