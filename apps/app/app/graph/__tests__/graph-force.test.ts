import { describe, expect, it, vi } from 'vitest';
import {
  configureGraphForces,
  graphLinkDistance,
  GRAPH_CHARGE_STRENGTH,
  GRAPH_COLLIDE_RADIUS,
  GRAPH_LINK_STRENGTH,
} from '../graph-force';

describe('graphLinkDistance', () => {
  it('uses the longest distance for hub edges', () => {
    expect(graphLinkDistance({ rel: 'discussed', hub: true })).toBeGreaterThan(
      graphLinkDistance({ rel: 'discussed' }),
    );
  });

  it('scales distance with spacing preset', () => {
    expect(graphLinkDistance({ rel: 'works_at' }, 'wide')).toBeGreaterThan(
      graphLinkDistance({ rel: 'works_at' }, 'compact'),
    );
  });
});

describe('configureGraphForces', () => {
  it('sets charge, link distance, center, and collide on the graph ref', () => {
    const charge = { strength: vi.fn() };
    const center = { strength: vi.fn() };
    const link = { distance: vi.fn(), strength: vi.fn() };
    const collide = { radius: vi.fn(), strength: vi.fn(), iterations: vi.fn() };
    const fg = {
      d3Force: (name: string) => {
        if (name === 'charge') return charge;
        if (name === 'center') return center;
        if (name === 'link') return link;
        if (name === 'collide') return collide;
        return undefined;
      },
    };

    configureGraphForces(fg as Parameters<typeof configureGraphForces>[0], 'normal');

    expect(charge.strength).toHaveBeenCalledWith(GRAPH_CHARGE_STRENGTH);
    expect(center.strength).toHaveBeenCalled();
    expect(link.distance).toHaveBeenCalled();
    expect(link.strength).toHaveBeenCalledWith(GRAPH_LINK_STRENGTH);
    expect(collide.radius).toHaveBeenCalled();
    expect(collide.strength).toHaveBeenCalledWith(0.9);
    expect(collide.iterations).toHaveBeenCalledWith(3);
    const radiusFn = collide.radius.mock.calls[0]![0] as () => number;
    expect(radiusFn()).toBe(GRAPH_COLLIDE_RADIUS);
  });
});
