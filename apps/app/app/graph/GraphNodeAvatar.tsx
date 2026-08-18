'use client';

import { EntityAvatar } from '@/app/_components/entity/EntityAvatar';
import type { GraphNode } from './graph-types';

export function GraphNodeAvatar({ node, size }: { node: GraphNode; size: number }) {
  switch (node.kind) {
    case 'person':
      return <EntityAvatar kind="person" name={node.label} size={size} />;
    case 'company':
      return <EntityAvatar kind="company" name={node.label} size={size} />;
    case 'event':
      return <EntityAvatar kind="event" name={node.label} size={size} />;
    case 'topic':
      return <EntityAvatar kind="topic" name={node.label} size={size} />;
    default: {
      const _exhaustive: never = node.kind;
      return _exhaustive;
    }
  }
}
