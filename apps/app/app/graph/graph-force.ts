import type { ForceGraphMethods } from 'react-force-graph-2d';
import { NODE_PAINT_RADIUS } from './graph-style';
import type { GraphLink } from './graph-types';

/** d3-force tuning for readable, iterable entity graphs at product scale. */
export const GRAPH_WARMUP_TICKS = 80;
/** Must be > 0 — with 0, reheat stops before any tick (spacing presets do nothing). */
export const GRAPH_COOLDOWN_TICKS = 400;
export const GRAPH_VELOCITY_DECAY = 0.3;
export const GRAPH_CHARGE_STRENGTH = -220;
export const GRAPH_COLLIDE_RADIUS = NODE_PAINT_RADIUS + 16;
export const GRAPH_CENTER_STRENGTH = 0.14;
export const GRAPH_LINK_STRENGTH = 0.55;

export type GraphSpacingPreset = 'compact' | 'normal' | 'wide';

/** Dramatic scale so tight ↔ wide is obvious on canvas. */
export const SPACING_SCALE: Record<
  GraphSpacingPreset,
  { charge: number; distance: number }
> = {
  compact: { charge: 0.45, distance: 0.5 },
  normal: { charge: 1, distance: 1 },
  wide: { charge: 2.1, distance: 1.85 },
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

export function graphChargeStrength(spacing: GraphSpacingPreset = 'normal'): number {
  return GRAPH_CHARGE_STRENGTH * SPACING_SCALE[spacing].charge;
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
): boolean {
  if (!fg?.d3Force) return false;

  fg.d3Force('charge')?.strength?.(graphChargeStrength(spacing));
  fg.d3Force('center')?.strength?.(GRAPH_CENTER_STRENGTH);

  const link = fg.d3Force('link');
  if (!link?.distance || !link?.strength) return false;
  link.distance((l: GraphLink) => graphLinkDistance(l, spacing));
  link.strength(GRAPH_LINK_STRENGTH);

  // collide is not registered by default in force-graph — charge + distance drive spacing.
  return true;
}

/** Reconfigure forces and reheat so spacing presets animate immediately. */
export function applyGraphSpacing(
  fg: ForceGraphWithD3 | undefined,
  spacing: GraphSpacingPreset,
): boolean {
  if (!configureGraphForces(fg, spacing)) return false;
  fg?.d3ReheatSimulation?.();
  return true;
}
