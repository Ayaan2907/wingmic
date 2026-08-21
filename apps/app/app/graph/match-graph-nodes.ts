import type { GraphNode } from './graph-types';

/** Case-insensitive label match over graph nodes already loaded from the db. */
export function matchGraphNodes(
  nodes: GraphNode[],
  query: string,
  limit = 8,
): GraphNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: GraphNode[] = [];
  for (const node of nodes) {
    if (!node.label.toLowerCase().includes(q)) continue;
    hits.push(node);
    if (hits.length >= limit) break;
  }
  return hits;
}
