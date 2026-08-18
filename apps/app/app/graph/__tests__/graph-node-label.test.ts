import { describe, expect, it } from 'vitest';
import {
  graphNodeCaption,
  graphNodeInitials,
  isHighlightedGraphNode,
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
