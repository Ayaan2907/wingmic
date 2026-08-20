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
import { EventDiamond } from '@/app/_components/entity/EntityAvatar';
import { trpc } from '@/lib/trpc/client';

export interface EventDetail {
  kind: 'event';
  id: string;
  name: string;
  sub: {
    date: string | null;
    location: string | null;
    durationDays: number | null;
    url?: string | null;
  };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics: Array<{ id: string; name: string }>;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso)
      .toLocaleDateString([], { month: 'short', day: '2-digit' })
      .toLowerCase();
  } catch {
    return null;
  }
}

function safeEventUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export default function EventDetailClient({ detail }: { detail: EventDetail }) {
  const router = useRouter();
  const createDraft = trpc.acts.createDraft.useMutation({
    onSuccess: (res) => {
      if (res.ok) router.push('/acts');
    },
  });

  const parts = [
    fmtDate(detail.sub.date),
    detail.sub.location,
    detail.sub.durationDays ? `${detail.sub.durationDays} days` : null,
  ].filter(Boolean) as string[];
  const subText = parts.length ? parts.join(' · ') : 'date unknown';
  const publicHref = safeEventUrl(detail.sub.url);
  const subNode = publicHref ? (
    <>
      {subText}
      {' · '}
      <a
        href={publicHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="event-public-url"
        style={{ color: '#FFC452', textDecoration: 'none' }}
      >
        public page →
      </a>
    </>
  ) : (
    subText
  );

  return (
    <EntityDetailScaffold
      kind="event"
      hero={<EventDiamond size={64} name={detail.name} />}
      eyebrow="◆ event"
      name={detail.name}
      sub={subNode}
      primaryCta={{
        label: 'generate recap →',
        pending: createDraft.isPending,
        onClick: () =>
          createDraft.mutate({
            kind: 'todo',
            intent: 'recap',
            contextName: detail.name,
          }),
      }}
      ghostCta={{
        label: 'check-ins',
        pending: createDraft.isPending,
        onClick: () =>
          createDraft.mutate({
            kind: 'reminder',
            intent: 'reminder',
            contextName: detail.name,
            seedBody: `send check-ins after ${detail.name}`,
          }),
      }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
