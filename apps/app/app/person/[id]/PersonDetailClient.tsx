'use client';

import * as React from 'react';
import {
  EntityDetailScaffold,
  type EntityCapture,
  type EntityFollowup,
  type EntityRelated,
  type EntityStat,
} from '@/app/_components/entity/EntityDetailScaffold';
import { PersonAvatar } from '@/app/_components/entity/EntityAvatar';

export interface PersonDetail {
  kind: 'person';
  id: string;
  name: string;
  sub: {
    role: string | null;
    companyId: string | null;
    companyName: string | null;
    warmFollowup: boolean;
  };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics: Array<{ id: string; name: string }>;
}

export default function PersonDetailClient({ detail }: { detail: PersonDetail }) {
  const subText =
    [detail.sub.role, detail.sub.companyName].filter(Boolean).join(' · ') || 'no role yet';

  return (
    <EntityDetailScaffold
      kind="person"
      hero={<PersonAvatar size={72} name={detail.name} seed={detail.id} />}
      eyebrow="◉ person"
      name={detail.name}
      sub={subText}
      primaryCta={{ label: 'draft check-in →' }}
      ghostCta={{ label: 'edit' }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
