import type { ForceGraphMethods } from 'react-force-graph-2d';
import { NODE_PAINT_RADIUS } from './graph-style';
import type { GraphLink } from './graph-types';

/** d3-force tuning for readable, iterable entity graphs at product scale. */
export const GRAPH_WARMUP_TICKS = 120;
export const GRAPH_COOLDOWN_TICKS = 0;
export const GRAPH_VELOCITY_DECAY = 0.28;
export const GRAPH_CHARGE_STRENGTH = -420;
export const GRAPH_COLLIDE_RADIUS = NODE_PAINT_RADIUS + 18;

export function graphLinkDistance(link: Pick<GraphLink, 'rel' | 'hub'>): number {
  if (link.hub) return 130;
  switch (link.rel) {
    case 'discussed':
      return 100;
    case 'works_at':
      return 88;
    case 'attended':
      return 84;
    default:
      return 84;
  }
}

type ForceGraphWithD3 = ForceGraphMethods & {
  d3Force?: (name: string) => {
    strength?: (n: number) => void;
    distance?: (d: number | ((link: GraphLink) => number)) => void;
    radius?: (d: number | ((node: unknown) => number)) => void;
    iterations?: (n: number) => void;
  } | undefined;
  d3ReheatSimulation?: () => void;
};

/** Apply d3-force parameters on the mounted force-graph instance. */
export function configureGraphForces(fg: ForceGraphWithD3 | undefined): void {
  if (!fg?.d3Force) return;

  fg.d3Force('charge')?.strength?.(GRAPH_CHARGE_STRENGTH);

  const link = fg.d3Force('link');
  link?.distance?.((l: GraphLink) => graphLinkDistance(l));
  link?.strength?.(0.45);

  const collide = fg.d3Force('collide');
  collide?.radius?.(() => GRAPH_COLLIDE_RADIUS);
  collide?.strength?.(0.85);
  collide?.iterations?.(3);
}
