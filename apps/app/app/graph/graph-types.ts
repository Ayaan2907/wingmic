export type NodeKind = 'person' | 'company' | 'event' | 'topic';
export type LinkRel = 'works_at' | 'attended' | 'discussed';

export type GraphNode = { id: string; kind: NodeKind; label: string };
export type GraphLink = { source: string; target: string; rel: LinkRel };
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

/** Force-graph mutates link ends from id strings into node objects. */
export function graphEndId(end: string | { id: string }): string {
  return typeof end === 'object' ? end.id : end;
}
