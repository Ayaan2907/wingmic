import { describe, expect, it, vi } from 'vitest';
import {
  applyGraphSpacing,
  configureGraphForces,
  graphChargeStrength,
  graphLinkDistance,
  GRAPH_LINK_STRENGTH,
  SPACING_SCALE,
} from '../graph-force';

describe('graphLinkDistance', () => {
  it('uses the longest distance for hub edges', () => {
    expect(graphLinkDistance({ rel: 'discussed', hub: true })).toBeGreaterThan(
      graphLinkDistance({ rel: 'discussed' }),
    );
  });

  it('scales distance dramatically across spacing presets', () => {
    const compact = graphLinkDistance({ rel: 'works_at' }, 'compact');
    const normal = graphLinkDistance({ rel: 'works_at' }, 'normal');
    const wide = graphLinkDistance({ rel: 'works_at' }, 'wide');
    expect(compact).toBeLessThan(normal);
    expect(normal).toBeLessThan(wide);
    expect(wide / compact).toBeGreaterThan(2);
  });
});

describe('graphChargeStrength', () => {
  it('repels more on wide than compact', () => {
    expect(Math.abs(graphChargeStrength('wide'))).toBeGreaterThan(
      Math.abs(graphChargeStrength('compact')),
    );
    expect(SPACING_SCALE.wide.distance).toBeGreaterThan(SPACING_SCALE.compact.distance);
  });
});

describe('configureGraphForces', () => {
  it('sets charge and link distance for the spacing preset', () => {
    const charge = { strength: vi.fn() };
    const center = { strength: vi.fn() };
    const link = { distance: vi.fn(), strength: vi.fn() };
    const fg = {
      d3Force: (name: string) => {
        if (name === 'charge') return charge;
        if (name === 'center') return center;
        if (name === 'link') return link;
        return undefined;
      },
    };

    expect(configureGraphForces(fg as Parameters<typeof configureGraphForces>[0], 'wide')).toBe(
      true,
    );

    expect(charge.strength).toHaveBeenCalledWith(graphChargeStrength('wide'));
    expect(center.strength).toHaveBeenCalled();
    expect(link.distance).toHaveBeenCalled();
    expect(link.strength).toHaveBeenCalledWith(GRAPH_LINK_STRENGTH);

    const distanceFn = link.distance.mock.calls[0]![0] as (l: {
      rel: 'works_at';
    }) => number;
    expect(distanceFn({ rel: 'works_at' })).toBe(graphLinkDistance({ rel: 'works_at' }, 'wide'));
  });

  it('returns false when the graph ref is not ready', () => {
    expect(configureGraphForces(undefined, 'normal')).toBe(false);
  });
});

describe('applyGraphSpacing', () => {
  it('configures forces then reheats the simulation', () => {
    const charge = { strength: vi.fn() };
    const center = { strength: vi.fn() };
    const link = { distance: vi.fn(), strength: vi.fn() };
    const reheat = vi.fn();
    const fg = {
      d3Force: (name: string) => {
        if (name === 'charge') return charge;
        if (name === 'center') return center;
        if (name === 'link') return link;
        return undefined;
      },
      d3ReheatSimulation: reheat,
    };

    expect(applyGraphSpacing(fg as unknown as Parameters<typeof applyGraphSpacing>[0], 'compact')).toBe(
      true,
    );
    expect(charge.strength).toHaveBeenCalledWith(graphChargeStrength('compact'));
    expect(reheat).toHaveBeenCalledOnce();
  });
});
