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
import { CompanyTile } from '@/app/_components/entity/EntityAvatar';
import { trpc } from '@/lib/trpc/client';

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
  const router = useRouter();
  const createDraft = trpc.acts.createDraft.useMutation({
    onSuccess: (res) => {
      if (res.ok) router.push('/acts');
    },
  });

  const relatedPeople = detail.related.filter((r) => r.kind === 'person');
  const primaryPerson = relatedPeople[0];
  const secondaryPerson = relatedPeople[1];

  const subText =
    [detail.sub.industry, detail.sub.domain].filter(Boolean).join(' · ') || 'unknown industry';

  return (
    <EntityDetailScaffold
      kind="company"
      hero={<CompanyTile size={64} name={detail.name} domain={detail.sub.domain ?? undefined} />}
      eyebrow="▤ company"
      name={detail.name}
      sub={subText}
      primaryCta={{
        label: 'find warm path →',
        pending: createDraft.isPending,
        onClick: () =>
          createDraft.mutate({
            kind: 'todo',
            intent: 'warm-path',
            targetEntityId: primaryPerson?.id,
            contextName: detail.name,
          }),
      }}
      ghostCta={{
        label: 'draft intro',
        disabled: !primaryPerson,
        title: primaryPerson ? 'draft an intro' : 'add a related person first',
        onClick: primaryPerson
          ? () =>
              createDraft.mutate({
                kind: 'intro',
                intent: 'intro',
                targetEntityId: primaryPerson.id,
                secondaryEntityId: secondaryPerson?.id,
                contextName: detail.name,
              })
          : undefined,
      }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
