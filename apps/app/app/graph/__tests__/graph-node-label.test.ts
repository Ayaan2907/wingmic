import { describe, expect, it } from 'vitest';
import {
  graphNodeCaption,
  graphNodeInitials,
  graphLinkNeighborhoodAlpha,
  graphNeighborhoodAlpha,
  graphNeighborhoodIds,
  isHighlightedGraphNode,
  shouldShowGraphNodeCaption,
} from '../graph-node-label';

describe('graphNodeInitials', () => {
  it('uses first and last word initials for people', () => {
    expect(graphNodeInitials('Ada Lovelace')).toBe('AL');
  });

  it('uses a single letter for one-word labels', () => {
    expect(graphNodeInitials('rust')).toBe('R');
    expect(graphNodeInitials('DevConnect')).toBe('D');
  });

  it('returns ? for blank labels', () => {
    expect(graphNodeInitials('   ')).toBe('?');
  });
});

describe('graphNodeCaption', () => {
  it('keeps short names as-is', () => {
    expect(graphNodeCaption('Ada Lovelace')).toBe('Ada Lovelace');
    expect(graphNodeCaption('Acme Corp')).toBe('Acme Corp');
  });

  it('falls back to the first word when the full label is long', () => {
    expect(graphNodeCaption('International Business Machines', 14)).toBe(
      'International',
    );
  });
});

describe('isHighlightedGraphNode', () => {
  it('is true only for the selected id', () => {
    expect(isHighlightedGraphNode('p1', 'p1')).toBe(true);
    expect(isHighlightedGraphNode('p1', 'c1')).toBe(false);
    expect(isHighlightedGraphNode('p1', null)).toBe(false);
  });
});

describe('shouldShowGraphNodeCaption', () => {
  it('shows only for selected or hovered nodes', () => {
    expect(shouldShowGraphNodeCaption('p1', 'p1', null, 1)).toBe(true);
    expect(shouldShowGraphNodeCaption('p1', null, 'p1', 1)).toBe(true);
    expect(shouldShowGraphNodeCaption('p1', null, null, 2)).toBe(false);
    expect(shouldShowGraphNodeCaption('p1', null, null, 0.8)).toBe(false);
  });
});

describe('graphNeighborhoodIds', () => {
  it('returns selected node plus one-hop neighbors', () => {
    const ids = graphNeighborhoodIds('p1', [
      { source: 'p1', target: 'c1' },
      { source: 'p2', target: 'c2' },
    ]);
    expect([...ids].sort()).toEqual(['c1', 'p1']);
  });

  it('is empty when nothing is selected', () => {
    expect(graphNeighborhoodIds(null, [{ source: 'p1', target: 'c1' }]).size).toBe(0);
  });
});

describe('neighborhood alpha', () => {
  it('dims nodes outside the neighborhood when one is selected', () => {
    const hood = new Set(['p1', 'c1']);
    expect(graphNeighborhoodAlpha('p1', hood)).toBe(1);
    expect(graphNeighborhoodAlpha('p2', hood)).toBe(0.22);
  });

  it('dims links that do not stay inside the neighborhood', () => {
    const hood = new Set(['p1', 'c1']);
    expect(graphLinkNeighborhoodAlpha('p1', 'c1', hood)).toBe(1);
    expect(graphLinkNeighborhoodAlpha('p1', 'p2', hood)).toBe(0.15);
  });
});
