import { describe, expect, it, vi } from 'vitest';
import {
  configureGraphForces,
  graphLinkDistance,
  GRAPH_CHARGE_STRENGTH,
  GRAPH_COLLIDE_RADIUS,
} from '../graph-force';

describe('graphLinkDistance', () => {
  it('uses the longest distance for hub edges', () => {
    expect(graphLinkDistance({ rel: 'discussed', hub: true })).toBeGreaterThan(
      graphLinkDistance({ rel: 'discussed' }),
    );
  });

  it('orders discussed longer than works_at and attended', () => {
    expect(graphLinkDistance({ rel: 'discussed' })).toBeGreaterThan(
      graphLinkDistance({ rel: 'works_at' }),
    );
    expect(graphLinkDistance({ rel: 'works_at' })).toBeGreaterThan(
      graphLinkDistance({ rel: 'attended' }),
    );
  });
});

describe('configureGraphForces', () => {
  it('sets charge, link distance, and collide on the graph ref', () => {
    const charge = { strength: vi.fn() };
    const link = { distance: vi.fn(), strength: vi.fn() };
    const collide = { radius: vi.fn(), strength: vi.fn(), iterations: vi.fn() };
    const fg = {
      d3Force: (name: string) => {
        if (name === 'charge') return charge;
        if (name === 'link') return link;
        if (name === 'collide') return collide;
        return undefined;
      },
    };

    configureGraphForces(fg as Parameters<typeof configureGraphForces>[0]);

    expect(charge.strength).toHaveBeenCalledWith(GRAPH_CHARGE_STRENGTH);
    expect(link.distance).toHaveBeenCalled();
    expect(link.strength).toHaveBeenCalledWith(0.45);
    expect(collide.radius).toHaveBeenCalled();
    expect(collide.strength).toHaveBeenCalledWith(0.85);
    expect(collide.iterations).toHaveBeenCalledWith(3);
    const radiusFn = collide.radius.mock.calls[0]![0] as () => number;
    expect(radiusFn()).toBe(GRAPH_COLLIDE_RADIUS);
  });
});
