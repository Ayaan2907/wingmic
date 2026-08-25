'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  EntityDetailScaffold,
  type EntityCapture,
  type EntityFollowup,
  type EntityRelated,
  type EntityStat,
} from '@/app/_components/entity/EntityDetailScaffold';
import { EntityAvatar } from '@/app/_components/entity/EntityAvatar';

export interface TopicDetail {
  kind: 'topic';
  id: string;
  name: string;
  sub: { slug: string | null };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics: Array<{ id: string; name: string }>;
}

export default function TopicDetailClient({ detail }: { detail: TopicDetail }) {
  const router = useRouter();

  const peopleCount = React.useMemo(
    () => detail.related.filter((r) => r.kind === 'person').length,
    [detail.related],
  );
  const subText = React.useMemo(
    () =>
      peopleCount > 0
        ? `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} in your graph`
        : 'topic in your graph',
    [peopleCount],
  );

  return (
    <EntityDetailScaffold
      kind="topic"
      hero={<EntityAvatar kind="topic" name={detail.name} size={64} />}
      eyebrow="◇ topic"
      name={detail.name}
      sub={subText}
      primaryCta={{
        label: 'search mentions →',
        onClick: () =>
          router.push(`/search?q=${encodeURIComponent(detail.name)}`),
      }}
      ghostCta={{
        label: 'view in graph',
        onClick: () => router.push('/graph'),
      }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
