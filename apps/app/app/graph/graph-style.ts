import { accent, blue, violet } from '@/app/chat/_components/tokens';
import type { LinkRel, NodeKind } from './graph-types';

// Canvas 2d cannot resolve CSS variables — keep hex only.
export const KIND_COLOR: Record<NodeKind, string> = {
  person: accent,
  company: blue,
  event: '#9ca3af',
  topic: violet,
};

export const LINK_COLOR: Record<LinkRel, string> = {
  works_at: blue,
  attended: '#d4d4d8',
  discussed: violet,
};

export const LINK_WIDTH = 1.8;
export const NODE_REL_SIZE = 8;

export const FILTERS: Array<{ kind: NodeKind; label: string }> = [
  { kind: 'person', label: 'people' },
  { kind: 'company', label: 'orgs' },
  { kind: 'event', label: 'events' },
  { kind: 'topic', label: 'topics' },
];

export function linkColorOf(rel: LinkRel | undefined): string {
  if (!rel) return '#a1a1aa';
  return LINK_COLOR[rel];
}

export function linkWidthOf(_rel?: LinkRel): number {
  return LINK_WIDTH;
}
