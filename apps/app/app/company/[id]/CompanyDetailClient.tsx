'use client';

import * as React from 'react';
import {
  EntityDetailScaffold,
  type EntityCapture,
  type EntityFollowup,
  type EntityRelated,
  type EntityStat,
} from '@/app/_components/entity/EntityDetailScaffold';
import { CompanyTile } from '@/app/_components/entity/EntityAvatar';

export interface CompanyDetail {
  kind: 'company';
  id: string;
  name: string;
  sub: { industry: string | null; domain: string | null };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics: Array<{ id: string; name: string }>;
}

export default function CompanyDetailClient({ detail }: { detail: CompanyDetail }) {
  const subText =
    [detail.sub.industry, detail.sub.domain].filter(Boolean).join(' · ') || 'unknown industry';

  return (
    <EntityDetailScaffold
      kind="company"
      hero={<CompanyTile size={64} name={detail.name} domain={detail.sub.domain ?? undefined} />}
      eyebrow="▤ company"
      name={detail.name}
      sub={subText}
      primaryCta={{ label: 'find warm path →' }}
      ghostCta={{ label: 'draft intro' }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
