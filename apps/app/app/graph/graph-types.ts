export type NodeKind = 'person' | 'company' | 'event' | 'topic';
export type LinkRel = 'works_at' | 'attended' | 'discussed';

export type GraphNode = { id: string; kind: NodeKind; label: string };
/** After the first simulation pass, force-graph replaces ends with node objects. */
export type GraphLink = {
  source: string | { id: string };
  target: string | { id: string };
  rel: LinkRel;
};
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };

/** Force-graph mutates link ends from id strings into node objects. */
export function graphEndId(end: string | { id: string }): string {
  return typeof end === 'object' ? end.id : end;
}
