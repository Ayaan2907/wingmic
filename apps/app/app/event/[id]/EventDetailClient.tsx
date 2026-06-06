'use client';

import * as React from 'react';
import {
  EntityDetailScaffold,
  type EntityCapture,
  type EntityFollowup,
  type EntityRelated,
  type EntityStat,
} from '@/app/_components/entity/EntityDetailScaffold';
import { EventDiamond } from '@/app/_components/entity/EntityAvatar';

export interface EventDetail {
  kind: 'event';
  id: string;
  name: string;
  sub: { date: string | null; location: string | null; durationDays: number | null };
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

export default function EventDetailClient({ detail }: { detail: EventDetail }) {
  const parts = [
    fmtDate(detail.sub.date),
    detail.sub.location,
    detail.sub.durationDays ? `${detail.sub.durationDays} days` : null,
  ].filter(Boolean) as string[];
  const subText = parts.length ? parts.join(' · ') : 'date unknown';

  return (
    <EntityDetailScaffold
      kind="event"
      hero={<EventDiamond size={64} name={detail.name} />}
      eyebrow="◆ event"
      name={detail.name}
      sub={subText}
      primaryCta={{ label: 'generate recap →' }}
      ghostCta={{ label: 'check-ins' }}
      stats={detail.stats}
      captures={detail.captures}
      followups={detail.followups}
      related={detail.related}
      topics={detail.topics}
    />
  );
}
