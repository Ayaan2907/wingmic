import type { ForceGraphMethods } from 'react-force-graph-2d';
import { NODE_PAINT_RADIUS } from './graph-style';
import type { GraphLink } from './graph-types';

/** d3-force tuning for readable, iterable entity graphs at product scale. */
export const GRAPH_WARMUP_TICKS = 120;
export const GRAPH_COOLDOWN_TICKS = 0;
export const GRAPH_VELOCITY_DECAY = 0.32;
export const GRAPH_CHARGE_STRENGTH = -260;
export const GRAPH_COLLIDE_RADIUS = NODE_PAINT_RADIUS + 16;
export const GRAPH_CENTER_STRENGTH = 0.12;
export const GRAPH_LINK_STRENGTH = 0.62;

export type GraphSpacingPreset = 'compact' | 'normal' | 'wide';

const SPACING_SCALE: Record<
  GraphSpacingPreset,
  { charge: number; distance: number; collide: number }
> = {
  compact: { charge: 0.82, distance: 0.88, collide: 0.92 },
  normal: { charge: 1, distance: 1, collide: 1 },
  wide: { charge: 1.28, distance: 1.22, collide: 1.08 },
};

export function graphLinkDistance(
  link: Pick<GraphLink, 'rel' | 'hub'>,
  spacing: GraphSpacingPreset = 'normal',
): number {
  const scale = SPACING_SCALE[spacing].distance;
  let base: number;
  if (link.hub) base = 110;
  else {
    switch (link.rel) {
      case 'discussed':
        base = 92;
        break;
      case 'works_at':
        base = 80;
        break;
      case 'attended':
        base = 76;
        break;
      default:
        base = 76;
    }
  }
  return Math.round(base * scale);
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
export function configureGraphForces(
  fg: ForceGraphWithD3 | undefined,
  spacing: GraphSpacingPreset = 'normal',
): void {
  if (!fg?.d3Force) return;

  const scale = SPACING_SCALE[spacing];

  fg.d3Force('charge')?.strength?.(GRAPH_CHARGE_STRENGTH * scale.charge);
  fg.d3Force('center')?.strength?.(GRAPH_CENTER_STRENGTH);

  const link = fg.d3Force('link');
  link?.distance?.((l: GraphLink) => graphLinkDistance(l, spacing));
  link?.strength?.(GRAPH_LINK_STRENGTH);

  const collide = fg.d3Force('collide');
  collide?.radius?.(() => GRAPH_COLLIDE_RADIUS * scale.collide);
  collide?.strength?.(0.9);
  collide?.iterations?.(3);
}
