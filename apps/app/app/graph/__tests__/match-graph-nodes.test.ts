import { describe, it, expect } from 'vitest';
import { matchGraphNodes } from '../match-graph-nodes';
import type { GraphNode } from '../graph-types';
import { linkColorOf, LINK_COLOR } from '../graph-style';

const NODES: GraphNode[] = [
  { id: 'p1', kind: 'person', label: 'Ada Lovelace' },
  { id: 'c1', kind: 'company', label: 'Acme' },
  { id: 'e1', kind: 'event', label: 'DevConnect' },
];

describe('matchGraphNodes', () => {
  it('returns nothing for an empty query', () => {
    expect(matchGraphNodes(NODES, '   ')).toEqual([]);
  });

  it('matches labels case-insensitively', () => {
    expect(matchGraphNodes(NODES, 'ada').map((n) => n.id)).toEqual(['p1']);
  });

  it('caps the result list', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      kind: 'person' as const,
      label: `Ada ${i}`,
    }));
    expect(matchGraphNodes(many, 'ada', 8)).toHaveLength(8);
  });
});

describe('linkColorOf', () => {
  it('paints a visible hex per relation (canvas cannot use css vars)', () => {
    expect(linkColorOf('works_at')).toBe(LINK_COLOR.works_at);
    expect(linkColorOf('attended')).toMatch(/^#/);
    expect(linkColorOf('discussed')).toBe(LINK_COLOR.discussed);
    expect(linkColorOf(undefined)).toMatch(/^#/);
  });
});
